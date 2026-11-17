import json
import time
from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, RequestFactory
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import GoogleAccount
from core.views import _sign, _unsign, _set_auth_cookie, _clear_auth_cookie
from core.auth import SignedTokenAuthentication
from core.middleware import SecurityHeadersMiddleware, SecFetchValidationMiddleware


class SecurityHeadersTests(TestCase):
    """Verify HTTP security headers (V3.4.1, V3.4.4, V3.4.5, V3.4.6, V3.4.8, V13.4.6)."""

    def setUp(self):
        self.client = APIClient()

    def test_security_headers_present_on_response(self):
        resp = self.client.get("/api/hello/")
        self.assertEqual(resp.status_code, 200)

        # V3.4.1: HSTS
        self.assertIn("Strict-Transport-Security", resp)
        self.assertIn("max-age=31536000", resp["Strict-Transport-Security"])

        # V3.4.4: nosniff
        self.assertEqual(resp.get("X-Content-Type-Options"), "nosniff")

        # V3.4.5: Referrer-Policy
        self.assertEqual(resp.get("Referrer-Policy"), "strict-origin-when-cross-origin")

        # V3.4.6: frame-ancestors via CSP
        self.assertIn("frame-ancestors 'self'", resp.get("Content-Security-Policy", ""))
        self.assertIn("object-src 'none'", resp.get("Content-Security-Policy", ""))

        # V3.4.8: Cross-Origin-Opener-Policy
        self.assertEqual(resp.get("Cross-Origin-Opener-Policy"), "same-origin")

        # V13.4.6: Server version suppressed
        self.assertEqual(resp.get("Server"), "UniPlan")
        self.assertEqual(resp.get("X-Powered-By"), "")


class SecFetchValidationTests(TestCase):
    """Verify Sec-Fetch validation rejects direct browser navigation to APIs (V3.2.1)."""

    def setUp(self):
        self.factory = RequestFactory()

    def test_blocks_document_navigation_to_api(self):
        middleware = SecFetchValidationMiddleware(lambda req: None)
        request = self.factory.get("/api/subjects/", HTTP_SEC_FETCH_DEST="document")
        response = middleware(request)
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, 403)

    def test_allows_ajax_fetch_to_api(self):
        middleware = SecFetchValidationMiddleware(lambda req: "ok")
        request = self.factory.get("/api/subjects/", HTTP_SEC_FETCH_DEST="empty")
        response = middleware(request)
        self.assertEqual(response, "ok")

    def test_exempts_oauth_login_and_callback(self):
        middleware = SecFetchValidationMiddleware(lambda req: "ok")
        req1 = self.factory.get("/api/auth/google/login", HTTP_SEC_FETCH_DEST="document")
        self.assertEqual(middleware(req1), "ok")

        req2 = self.factory.get("/api/auth/google/callback", HTTP_SEC_FETCH_DEST="document")
        self.assertEqual(middleware(req2), "ok")


class TokenAndSessionTests(TestCase):
    """Verify token entropy (V7.2.3), session invalidation (V7.4.2), and cookie auth (V3.3.1, V14.2.1)."""

    def setUp(self):
        self.email = "student@ku.th"
        self.account = GoogleAccount.objects.create(
            email=self.email,
            credentials={"token": "fake-google-token"},
            name="Student KU",
        )

    def test_token_contains_high_entropy_and_iat(self):
        token = _sign(self.email)
        email, iat = _unsign(token)
        self.assertEqual(email, self.email)
        self.assertIsInstance(iat, int)
        self.assertGreater(iat, 0)

    def test_two_tokens_for_same_user_are_unique(self):
        t1 = _sign(self.email)
        t2 = _sign(self.email)
        self.assertNotEqual(t1, t2)  # because of random jti

    def test_token_rejected_if_issued_before_invalidation(self):
        token = _sign(self.email)
        # Invalidate all tokens before now + 1 second
        time.sleep(0.05)
        self.account.token_valid_after = timezone.now()
        self.account.save()

        email, _ = _unsign(token)
        self.assertIsNone(email)

    def test_fresh_token_accepted_after_invalidation(self):
        self.account.token_valid_after = timezone.now()
        self.account.save()

        time.sleep(0.05)
        fresh_token = _sign(self.email)
        email, _ = _unsign(fresh_token)
        self.assertEqual(email, self.email)

    def test_auth_backend_reads_httponly_cookie(self):
        token = _sign(self.email)
        factory = RequestFactory()
        request = factory.get("/api/whoami/")
        request.COOKIES[settings.AUTH_COOKIE_NAME] = token

        auth = SignedTokenAuthentication()
        user, _ = auth.authenticate(request)
        self.assertIsNotNone(user)
        self.assertEqual(user.email, self.email)


class LogoutEndpointTests(TestCase):
    """Verify logout endpoint (V7.4.2 + V14.3.1)."""

    def setUp(self):
        self.client = APIClient()
        self.email = "student@ku.th"
        self.account = GoogleAccount.objects.create(
            email=self.email,
            credentials={"token": "fake"},
            name="Student",
        )

    def test_logout_sets_clear_site_data_and_deletes_cookie(self):
        token = _sign(self.email)
        self.client.cookies[settings.AUTH_COOKIE_NAME] = token

        resp = self.client.post("/api/auth/logout")
        self.assertEqual(resp.status_code, 200)

        # V14.3.1: Clear-Site-Data header
        self.assertIn("Clear-Site-Data", resp)
        self.assertIn('"cookies"', resp["Clear-Site-Data"])
        self.assertIn('"storage"', resp["Clear-Site-Data"])

        # V7.4.2: Session invalidated in database
        self.account.refresh_from_db()
        self.assertIsNotNone(self.account.token_valid_after)

        # Old token is now rejected
        email, _ = _unsign(token)
        self.assertIsNone(email)
