# backend/core/views.py
import csv
import io
import json
import logging
import os
import re
import secrets
import ssl
import time
import urllib.parse

import google_auth_httplib2
import httplib2
import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.core.files.uploadedfile import UploadedFile
from django.core.mail import send_mail
from django.core.signing import BadSignature, SignatureExpired, dumps, loads
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import redirect
from django.utils import timezone
from django.views.decorators.http import require_GET
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.exceptions import get_client_ip, sanitize_log_value
from .authorization import (
    FunctionAuthorizedMixin,
    HasFunctionPermission,
    ensure_consumer_grants,
    user_has_function_permission,
)
from .models import (
    ClassroomAssignment,
    ClassroomCourse,
    GoogleAccount,
    OAuthAccount,
    Reminder,
    Subject,
    Task,
    TimetableEntry,
)
from .serializers import (
    ClassroomAssignmentSerializer,
    ClassroomCourseSerializer,
    OAuthAccountSerializer,
    ReminderIntakeSerializer,
    ReminderSerializer,
    SubjectSerializer,
    TaskSerializer,
    TimetableEntrySerializer,
)
from .tokens import decode_session_token, issue_session_token, verify_session_token

auth_logger = logging.getLogger("security.auth")
error_logger = logging.getLogger("security.errors")
logger = logging.getLogger("security")


def _verified_requests_session() -> requests.Session:
    """
    V12.3.2: Return a requests.Session that strictly enforces TLS server
    certificate chain and hostname verification (verify=True).
    """
    session = requests.Session()
    session.verify = True
    return session


def _build_verified_google_service(service_name: str, version: str, creds: Credentials):
    """
    V12.3.2: Build a Google API client over an httplib2 transport that explicitly
    enforces TLS server certificate validation (disable_ssl_certificate_validation=False).
    """
    http = httplib2.Http(disable_ssl_certificate_validation=False, timeout=15)
    authed_http = google_auth_httplib2.AuthorizedHttp(creds, http=http)
    return build(service_name, version, http=authed_http, cache_discovery=False)


# ---- Scopes (V10.4.11: Least-privilege read-only scopes only) ----
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
]


def _client_config():
    # V10.4.10: Ensure confidential client credentials are present for backchannel token exchange
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise ImproperlyConfigured(
            "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured for confidential client authentication."
        )
    return {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "project_id": "uniplan-local",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            "javascript_origins": ["http://127.0.0.1:5173", "http://localhost:5173"],
        }
    }


# ---- V7.2.3 / V11.4.3 / V14.2.1: Signed token helpers ----
def _sign(email: str) -> str:
    """Create a signed session token with >=128 bits of entropy (V7.2.3) using HMAC-SHA256 (V11.4.3)."""
    return issue_session_token(email)


def _unsign(token: str):
    """
    Verify and decode a signed token.
    Returns (email, issued_at_timestamp) or (None, None).
    Also checks V7.4.2: reject tokens issued before account's token_valid_after.
    """
    return decode_session_token(token)


def _creds_for(email: str):
    try:
        acc = GoogleAccount.objects.get(pk=email)
    except GoogleAccount.DoesNotExist:
        return None
    return Credentials.from_authorized_user_info(acc.credentials, SCOPES)


# ---- V3.3.1 / V14.2.1: Cookie helpers ----
def _set_auth_cookie(response, token):
    """Set a secure, HttpOnly auth cookie (V3.3.1, V3.3.4, V14.2.1)."""
    response.set_cookie(
        key=getattr(settings, "AUTH_COOKIE_NAME", "__Secure-uniplan-auth"),
        value=token,
        max_age=getattr(settings, "AUTH_COOKIE_MAX_AGE", 60 * 60 * 8),
        httponly=getattr(settings, "AUTH_COOKIE_HTTPONLY", True),
        secure=getattr(settings, "AUTH_COOKIE_SECURE", not settings.DEBUG),
        samesite=getattr(settings, "AUTH_COOKIE_SAMESITE", "Lax"),
        path=getattr(settings, "AUTH_COOKIE_PATH", "/"),
        domain=getattr(settings, "AUTH_COOKIE_DOMAIN", None),
    )
    return response


def _clear_auth_cookie(response):
    """Clear the auth cookie on logout (V14.3.1)."""
    response.delete_cookie(
        key=getattr(settings, "AUTH_COOKIE_NAME", "__Secure-uniplan-auth"),
        path=getattr(settings, "AUTH_COOKIE_PATH", "/"),
        domain=getattr(settings, "AUTH_COOKIE_DOMAIN", None),
        samesite=getattr(settings, "AUTH_COOKIE_SAMESITE", "Lax"),
    )
    return response


def _get_token_from_request(request):
    """
    Read the auth token from (1) HttpOnly cookie or (2) Authorization header.
    Cookie is preferred (V14.2.1); header kept for backward compatibility.
    """
    token = request.COOKIES.get(
        getattr(settings, "AUTH_COOKIE_NAME", "__Secure-uniplan-auth")
    )
    if token:
        return token

    authz = request.META.get("HTTP_AUTHORIZATION", "")
    if authz.startswith("Bearer "):
        return authz.split(" ", 1)[1].strip()

    return None


@require_GET
def hello(request):
    return JsonResponse({"ok": True})


# ---- OAuth ----
def _check_auth_rate_limit(request, scope: str, limit: int = 15, window: int = 60) -> bool:
    """
    V6.1.1 / V6.3.1: Per-IP rate limiting on authentication endpoints.
    Returns True if allowed, False if rate limit exceeded (prevents brute-force
    and token-endpoint abuse without locking out user accounts).
    """
    ip = (
        request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        or request.META.get("REMOTE_ADDR", "unknown")
    )
    key = f"rl:{scope}:{ip}"
    count = cache.get(key, 0)
    if count >= limit:
        return False
    cache.set(key, count + 1, timeout=window)
    return True


@require_GET
def google_login(request):
    ip = get_client_ip(request)
    if not _check_auth_rate_limit(request, "oauth_login", limit=15, window=60):
        auth_logger.warning("event=oauth_login_rate_limited provider=google ip=%s", ip)
        return JsonResponse(
            {"detail": "Too many login requests. Please try again in a minute."},
            status=429,
        )

    flow = Flow.from_client_config(
        _client_config(), scopes=SCOPES, redirect_uri=settings.GOOGLE_REDIRECT_URI
    )
    # V10.1.2 & V10.2.1: Generate CSPRNG state parameter bound to user agent session
    raw_state = secrets.token_urlsafe(32)
    auth_url, state = flow.authorization_url(
        state=raw_state,
        access_type="offline",
        prompt="consent",  # V10.7.1: Explicitly prompt user for consent on each authorization request
    )
    auth_logger.info(
        "event=oauth_login_initiated provider=google auth_type=oauth2 ip=%s",
        ip,
    )
    signed_state = dumps({"state": state}, salt="uniplan-oauth-state", key=settings.SECRET_KEY)
    if request.GET.get("redirect") == "1":
        resp = redirect(auth_url)
    else:
        resp = JsonResponse({"auth_url": auth_url})
    resp.set_cookie(
        "oauth_state",
        signed_state,
        max_age=600,  # 10-minute transaction lifetime
        httponly=True,
        samesite="Lax",
        secure=not settings.DEBUG,
    )
    resp["Cache-Control"] = "no-store"
    return resp


@require_GET
def google_callback(request):
    """
    OAuth callback:
      - V6.3.1: Enforces per-IP rate limiting
      - V10.1.2 / V10.2.1: Validates signed HttpOnly oauth_state cookie (CSRF defense)
      - V10.4.10: Confidential client backchannel authentication
      - V12.3.2: Uses verified TLS transport (_build_verified_google_service)
      - V10.1.1 / V14.2.1: Stores Google OAuth tokens strictly on backend, sets HttpOnly
        auth cookie, and avoids leaking tokens in URL query strings
    """
    ip = get_client_ip(request)
    if not _check_auth_rate_limit(request, "oauth_callback", limit=15, window=60):
        auth_logger.warning("event=oauth_callback_rate_limited provider=google ip=%s", ip)
        return JsonResponse(
            {"detail": "Too many authentication attempts. Please try again in a minute."},
            status=429,
        )

    code = request.GET.get("code")
    returned_state = request.GET.get("state")
    cookie_state = request.COOKIES.get("oauth_state")

    if not code:
        auth_logger.warning(
            "event=oauth_callback_failure reason=missing_code provider=google auth_type=oauth2 ip=%s",
            ip,
        )
        return HttpResponseBadRequest("Missing code")

    # V10.1.2 & V10.2.1: Validate state parameter against the signed HttpOnly session cookie
    if not returned_state or not cookie_state:
        auth_logger.warning(
            "event=oauth_callback_failure reason=missing_state provider=google auth_type=oauth2 ip=%s",
            ip,
        )
        return HttpResponseBadRequest("Missing OAuth state parameter")
    try:
        expected_state = loads(
            cookie_state, salt="uniplan-oauth-state", key=settings.SECRET_KEY, max_age=600
        ).get("state")
    except (BadSignature, SignatureExpired):
        auth_logger.warning(
            "event=oauth_callback_failure reason=invalid_or_expired_state provider=google auth_type=oauth2 ip=%s",
            ip,
        )
        return HttpResponseBadRequest("Invalid or expired OAuth state")

    if not expected_state or not secrets.compare_digest(str(returned_state), str(expected_state)):
        auth_logger.warning(
            "event=oauth_callback_failure reason=state_mismatch provider=google auth_type=oauth2 ip=%s",
            ip,
        )
        return HttpResponseBadRequest("OAuth state mismatch (CSRF protection)")

    try:
        # V10.4.10: Backchannel token exchange authenticates confidential client using client_id & client_secret
        flow = Flow.from_client_config(
            _client_config(),
            scopes=SCOPES,
            state=expected_state,
            redirect_uri=settings.GOOGLE_REDIRECT_URI,
        )
        # Google may omit a requested Classroom scope. Accept the granted subset.
        os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"
        flow.fetch_token(code=code)
        creds: Credentials = flow.credentials

        # V12.3.2: Use verified TLS transport for Google OAuth2 UserInfo API
        oauth2 = _build_verified_google_service("oauth2", "v2", creds)
        me = oauth2.userinfo().get().execute()
    except Exception as exc:
        auth_logger.error(
            "event=oauth_callback_error provider=google auth_type=oauth2 ip=%s error=%s",
            ip,
            sanitize_log_value(str(exc)),
        )
        error_logger.error(
            "event=oauth_token_exchange_failed provider=google ip=%s error=%s",
            ip,
            sanitize_log_value(str(exc)),
            exc_info=True,
        )
        return HttpResponseBadRequest("OAuth authentication failed")

    email = me.get("email")
    name = me.get("name", "")
    picture = me.get("picture", "")

    # V10.1.1: Backend-for-Frontend (BFF) pattern — Google OAuth access_token and refresh_token
    # are stored strictly on the backend database and never sent to the browser.
    GoogleAccount.objects.update_or_create(
        email=email,
        defaults={"credentials": json.loads(creds.to_json()), "name": name, "picture": picture},
    )

    User = get_user_model()
    user, _ = User.objects.get_or_create(username=email, defaults={"email": email})
    if user.email != email:
        user.email = email
        user.save(update_fields=["email"])
    ensure_consumer_grants(user)

    token = issue_session_token(email)
    frontend_url = getattr(
        settings, "FRONTEND_URL", os.getenv("FRONTEND_REDIRECT", "http://localhost:5173")
    )

    # Pass non-sensitive display info in query string (for v8-branch) and fragment (for V10.1.1 compatibility)
    qs = urllib.parse.urlencode({"login": "success", "name": name, "picture": picture})
    fragment = urllib.parse.urlencode({"token": token, "email": email, "name": name, "picture": picture})
    response = redirect(f"{frontend_url}?{qs}#{fragment}")
    _set_auth_cookie(response, token)
    response.delete_cookie("oauth_state")
    response["Cache-Control"] = "no-store"

    auth_logger.info(
        "event=oauth_login_success user=%s provider=google auth_type=oauth2 ip=%s",
        sanitize_log_value(email),
        ip,
    )
    logger.info("Successful OAuth login for %s", email)
    return response


# ---- V7.4.2 + V14.3.1: Logout endpoint ----
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    """
    Logout: invalidate token (V7.4.2) + clear client storage (V14.3.1).
    """
    token = _get_token_from_request(request)
    if token:
        email, _ = _unsign(token)
        if email:
            # V7.4.2 — Invalidate all tokens issued before now
            try:
                acc = GoogleAccount.objects.get(pk=email)
                acc.token_valid_after = timezone.now()
                acc.save(update_fields=["token_valid_after"])
                logger.info("Logout: invalidated all sessions for %s", email)
            except GoogleAccount.DoesNotExist:
                pass

    response = Response({"detail": "Logged out"})

    # V14.3.1 — Clear auth cookie
    _clear_auth_cookie(response)

    # V14.3.1 — Clear-Site-Data header to wipe browser storage
    response["Clear-Site-Data"] = '"cookies", "storage"'

    return response


# ---- auth guard (for non-DRF views) ----
def _require_auth(request):
    ip = get_client_ip(request)
    path = sanitize_log_value(getattr(request, "path", "-"))
    token = _get_token_from_request(request)
    if not token:
        auth_logger.warning(
            "event=auth_failure reason=missing_bearer_token auth_type=bearer_signed_token ip=%s path=%s",
            ip,
            path,
        )
        return None, JsonResponse({"detail": "Missing authentication"}, status=401)

    email = verify_session_token(token)
    if not email:
        auth_logger.warning(
            "event=auth_failure reason=invalid_or_expired_token auth_type=bearer_signed_token ip=%s path=%s",
            ip,
            path,
        )
        return None, JsonResponse({"detail": "Invalid/expired token"}, status=401)

    creds = _creds_for(email)
    if not creds:
        auth_logger.warning(
            "event=auth_failure reason=no_google_credentials user=%s auth_type=google_oauth_token ip=%s path=%s",
            sanitize_log_value(email),
            ip,
            path,
        )
        return None, JsonResponse({"detail": "No Google credentials stored"}, status=401)

    # refresh if needed and persist (V12.3.2: use verified TLS session)
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request(session=_verified_requests_session()))
            acc = GoogleAccount.objects.get(pk=email)
            acc.credentials = json.loads(creds.to_json())
            acc.save(update_fields=["credentials"])
            auth_logger.info(
                "event=oauth_token_refreshed user=%s provider=google auth_type=oauth2_refresh_token ip=%s",
                sanitize_log_value(email),
                ip,
            )
        except GoogleAccount.DoesNotExist:
            error_logger.warning(
                "event=google_account_missing_on_refresh user=%s ip=%s",
                sanitize_log_value(email),
                ip,
            )
        except Exception as exc:
            error_logger.error(
                "event=oauth_token_refresh_failed user=%s provider=google ip=%s error=%s",
                sanitize_log_value(email),
                ip,
                sanitize_log_value(str(exc)),
                exc_info=True,
            )
            return None, JsonResponse({"detail": "Failed to refresh Google credentials"}, status=401)

    auth_logger.info(
        "event=auth_success user=%s auth_type=bearer_signed_token ip=%s path=%s",
        sanitize_log_value(email),
        ip,
        path,
    )
    return (email, creds), None


def _require_function_permission(email, permission_code):
    User = get_user_model()
    user = (
        User.objects.filter(username=email).first()
        or User.objects.filter(email=email).first()
    )
    if user is None or not user_has_function_permission(user, permission_code):
        return JsonResponse(
            {"detail": "You do not have permission to perform this function."},
            status=403,
        )
    return None


# ---- Classroom API ----
@require_GET
def list_courses(request):
    """Return ACTIVE courses only."""
    auth, err = _require_auth(request)
    if err:
        return err
    email, creds = auth
    denied = _require_function_permission(email, "classroom.read")
    if denied:
        return denied

    classroom = _build_verified_google_service("classroom", "v1", creds)
    data = classroom.courses().list(pageSize=50, courseStates=["ACTIVE"]).execute()
    courses = [
        {
            "id": c.get("id"),
            "name": c.get("name"),
            "section": c.get("section"),
        }
        for c in data.get("courses", [])
    ]
    return JsonResponse({"courses": courses})


@require_GET
def list_active_submissions(request, course_id: str):
    """
    Return *my* active (pending) submissions for a given course,
    augmented with coursework title/due/link.
    Active states: NEW, CREATED, RECLAIMED_BY_STUDENT
    """
    auth, err = _require_auth(request)
    if err:
        return err
    email, creds = auth
    denied = _require_function_permission(email, "classroom.read")
    if denied:
        return denied

    classroom = _build_verified_google_service("classroom", "v1", creds)

    # fetch my active submissions
    data = (
        classroom.courses()
        .courseWork()
        .studentSubmissions()
        .list(
            courseId=course_id,
            courseWorkId="-",  # all coursework in the course
            pageSize=100,
            states=["NEW", "CREATED", "RECLAIMED_BY_STUDENT"],
        )
        .execute()
    )

    subs = data.get("studentSubmissions", [])
    if not subs:
        return JsonResponse({"studentSubmissions": []})

    # fetch coursework objects in bulk via list() first (avoids N+1 get() calls)
    cw_ids = sorted({s.get("courseWorkId") for s in subs if s.get("courseWorkId")})
    cw_needed = set(cw_ids)
    cw_map = {}

    if cw_needed:
        try:
            page_token = None
            while len(cw_map) < len(cw_needed):
                list_kwargs = {"courseId": course_id, "pageSize": 100}
                if page_token:
                    list_kwargs["pageToken"] = page_token
                cw_resp = classroom.courses().courseWork().list(**list_kwargs).execute()
                for cw in cw_resp.get("courseWork", []):
                    cw_id = cw.get("id")
                    if cw_id in cw_needed:
                        cw_map[cw_id] = cw
                page_token = cw_resp.get("nextPageToken")
                if not page_token:
                    break
        except Exception as exc:
            error_logger.warning(
                "event=classroom_coursework_list_error course_id=%s error=%s",
                sanitize_log_value(course_id),
                sanitize_log_value(str(exc)),
            )

    # fallback to per-item get() only for any coursework IDs not returned by list()
    for cw_id in cw_ids:
        if cw_id in cw_map:
            continue
        try:
            cw_map[cw_id] = (
                classroom.courses()
                .courseWork()
                .get(courseId=course_id, id=cw_id)
                .execute()
            )
        except Exception as exc:
            error_logger.warning(
                "event=classroom_coursework_fetch_error course_id=%s coursework_id=%s error=%s",
                sanitize_log_value(course_id),
                sanitize_log_value(cw_id),
                sanitize_log_value(str(exc)),
            )

    # merge coursework info into each submission
    for s in subs:
        cw = cw_map.get(s.get("courseWorkId"))
        if not cw:
            continue
        if cw.get("title"):
            s["title"] = cw["title"]
        if cw.get("alternateLink"):
            s["alternateLink"] = cw["alternateLink"]
        if cw.get("dueDate"):
            s["dueDate"] = cw["dueDate"]  # {year, month, day}
        if cw.get("dueTime"):
            s["dueTime"] = cw["dueTime"]  # {hours, minutes}

    trimmed = []
    for s in subs:
        trimmed.append(
            {
                "id": s.get("id"),
                "courseId": s.get("courseId"),
                "courseWorkId": s.get("courseWorkId"),
                "title": s.get("title"),
                "alternateLink": s.get("alternateLink"),
                "state": s.get("state"),
                "dueDate": s.get("dueDate"),
                "dueTime": s.get("dueTime"),
                "updateTime": s.get("updateTime"),
                "creationTime": s.get("creationTime"),
            }
        )
    return JsonResponse({"studentSubmissions": trimmed})


@require_GET
def summary(request):
    """Small summary for the header."""
    auth, err = _require_auth(request)
    if err:
        return err
    email, creds = auth
    denied = _require_function_permission(email, "classroom.read")
    if denied:
        return denied

    classroom = _build_verified_google_service("classroom", "v1", creds)
    courses = (
        classroom.courses()
        .list(pageSize=50, courseStates=["ACTIVE"])
        .execute()
        .get("courses", [])
    )
    return JsonResponse(
        {
            "email": email,
            "courseCount": len(courses),
            "courses": [
                {"id": c.get("id"), "name": c.get("name"), "section": c.get("section")}
                for c in courses
            ],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, HasFunctionPermission("debug.read")])
def echo_auth(request):
    return Response(
        {
            "is_authenticated": bool(getattr(request.user, "is_authenticated", False)),
            "user": getattr(request.user, "username", None),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, HasFunctionPermission("account.read")])
def whoami(request):
    u = request.user
    return Response({"id": u.id, "email": u.email, "username": u.username})


class SubjectViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = Subject.objects.none()
    serializer_class = SubjectSerializer
    read_permission = "subjects.read"
    write_permission = "subjects.write"

    def get_queryset(self):
        return Subject.objects.filter(user=self.request.user).order_by("name")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)


class TimetableEntryViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = TimetableEntry.objects.none()
    serializer_class = TimetableEntrySerializer
    read_permission = "timetable.read"
    write_permission = "timetable.write"
    function_permissions = {
        "export_csv": "timetable.read",
        "import_csv": "timetable.write",
    }

    def get_queryset(self):
        return TimetableEntry.objects.filter(user=self.request.user).order_by(
            "day_of_week", "start_time"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    @staticmethod
    def _sanitize_csv_cell(val: str) -> str:
        """
        V5.1.1 / V5.3.1: Prevent CSV Formula Injection when end-users download/open the file.
        Prefixes dangerous leading characters (=, +, -, @, tab, CR) with a single quote.
        """
        s = str(val or "")
        if s.startswith(("=", "+", "-", "@", "\t", "\r")):
            return f"'{s}"
        return s

    @action(detail=False, methods=["get"], url_path="export", url_name="export")
    def export_csv(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)

        # V5.3.2 & V5.4.1: Explicitly ignore any user-submitted filename parameters in URL/JSON
        # Always use a trusted, internally generated static filename.
        safe_filename = "timetable.csv"

        rows = (
            TimetableEntry.objects.filter(user=user)
            .select_related("subject")
            .order_by("day_of_week", "start_time")
        )

        # Build CSV strictly in-memory (V5.3.1: never written to a public folder)
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="{safe_filename}"'
        resp["X-Content-Type-Options"] = "nosniff"
        resp["Cache-Control"] = "no-store"

        writer = csv.writer(resp)
        writer.writerow(["subject", "day_of_week", "start_time", "end_time", "room"])
        for r in rows:
            writer.writerow(
                [
                    self._sanitize_csv_cell(r.subject.name if r.subject else ""),
                    r.day_of_week,  # backend 0=Sun..6=Sat
                    r.start_time.strftime("%H:%M:%S"),
                    r.end_time.strftime("%H:%M:%S"),
                    self._sanitize_csv_cell(r.room or ""),
                ]
            )
        return resp

    @action(detail=False, methods=["post"], url_path="import", url_name="import")
    def import_csv(self, request):
        MAX_BYTES = 1_000_000  # 1 MB (V5.2.1)
        ALLOWED_MIMES = {"text/csv", "application/csv", "application/vnd.ms-excel"}
        TIME_RE = re.compile(r"^\d{2}:\d{2}(:\d{2})?$")

        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)

        f: UploadedFile | None = request.FILES.get("file")
        if not f:
            return Response(
                {"detail": "No file uploaded (field name must be 'file')."}, status=400
            )

        # 1) quick guards (V5.3.2: strip path via os.path.basename() for extension check only)
        ip = get_client_ip(request)
        raw_filename = os.path.basename(f.name or "")
        _, ext = os.path.splitext(raw_filename.lower())
        ctype = (f.content_type or "").lower()

        if ext != ".csv":
            error_logger.warning(
                "event=csv_import_rejected reason=invalid_extension user=%s ip=%s filename=%s",
                sanitize_log_value(user.username),
                ip,
                sanitize_log_value(raw_filename),
            )
            return Response({"detail": "Only .csv files are accepted."}, status=400)
        if ctype and ctype not in ALLOWED_MIMES:
            error_logger.warning(
                "event=csv_import_rejected reason=unsupported_content_type user=%s ip=%s content_type=%s",
                sanitize_log_value(user.username),
                ip,
                sanitize_log_value(ctype),
            )
            return Response(
                {"detail": f"Unsupported content-type '{ctype}'."}, status=415
            )
        if f.size and f.size > MAX_BYTES:
            error_logger.warning(
                "event=csv_import_rejected reason=file_too_large user=%s ip=%s size=%s",
                sanitize_log_value(user.username),
                ip,
                f.size,
            )
            return Response(
                {"detail": f"File too large (> {MAX_BYTES//1000} KB)."}, status=413
            )

        # 2) decode (tolerate BOM)
        raw = f.read()
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError as exc:
                error_logger.warning(
                    "event=csv_import_rejected reason=invalid_utf8 user=%s ip=%s error=%s",
                    sanitize_log_value(user.username),
                    ip,
                    sanitize_log_value(str(exc)),
                )
                return Response({"detail": "File is not valid UTF-8 text."}, status=400)

        # 3) sniff CSV
        sample = text[:4096]
        if "," not in sample and ";" not in sample and "\t" not in sample:
            error_logger.warning(
                "event=csv_import_rejected reason=not_csv_like user=%s ip=%s",
                sanitize_log_value(user.username),
                ip,
            )
            return Response({"detail": "Not a CSV-like text file."}, status=400)

        # 4) dialect + reader
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error as exc:
            error_logger.info(
                "event=csv_sniffer_fallback user=%s ip=%s detail=%s",
                sanitize_log_value(user.username),
                ip,
                sanitize_log_value(str(exc)),
            )
            dialect = csv.excel
            dialect.delimiter = ","

        reader = csv.DictReader(io.StringIO(text), dialect=dialect)

        required_any = {"subject", "subject_name"}
        required_all = {"day_of_week", "start_time", "end_time"}  # 'room' optional

        header = {h.strip().lower() for h in (reader.fieldnames or [])}
        if not header:
            return Response({"detail": "CSV has no header row."}, status=400)
        if header.isdisjoint(required_any) or not required_all.issubset(header):
            return Response(
                {
                    "detail": "Missing required columns. Need: subject(or subject_name), day_of_week, start_time, end_time."
                },
                status=400,
            )

        # 5) validate rows first (collect errors; do NOT write yet)
        errors = []
        rows = []
        day_map = {
            "sun": 0,
            "sunday": 0,
            "mon": 1,
            "monday": 1,
            "tue": 2,
            "tuesday": 2,
            "wed": 3,
            "wednesday": 3,
            "thu": 4,
            "thursday": 4,
            "fri": 5,
            "friday": 5,
            "sat": 6,
            "saturday": 6,
        }

        def norm_time(s):
            s = (s or "").strip()
            if not s or not TIME_RE.match(s):
                return None
            full = s if len(s) == 8 else s + ":00"  # HH:MM -> HH:MM:SS
            hh, mm, ss = (int(part) for part in full.split(":"))
            if not (0 <= hh <= 23 and 0 <= mm <= 59 and 0 <= ss <= 59):
                return None
            return full

        for i, row in enumerate(reader, start=2):  # data starts at line 2
            subj = (
                (row.get("subject") or row.get("subject_name") or "")
                .strip()
                .lstrip("=+-@\t\r")
            )
            dow_raw = (row.get("day_of_week") or "").strip()
            st = norm_time(row.get("start_time"))
            et = norm_time(row.get("end_time"))
            rm = (row.get("room") or "").strip().lstrip("=+-@\t\r")

            if not subj:
                errors.append(f"Line {i}: subject empty")
                continue
            if dow_raw == "":
                errors.append(f"Line {i}: day_of_week empty")
                continue
            try:
                dow = int(dow_raw)
            except ValueError:
                dow = day_map.get(dow_raw.lower())
            if dow is None or not (0 <= dow <= 6):
                errors.append(f"Line {i}: invalid day_of_week '{dow_raw}'")
                continue
            if not st or not et:
                errors.append(f"Line {i}: invalid time (use HH:MM or HH:MM:SS)")
                continue
            if st >= et:
                errors.append(f"Line {i}: end_time must be after start_time")
                continue

            rows.append((subj, dow, st, et, rm))

        if errors:
            return Response(
                {"detail": "CSV validation failed.", "errors": errors[:50]}, status=400
            )

        # 6) apply (replace)
        SubjectModel = self.serializer_class.Meta.model._meta.apps.get_model(
            "core", "Subject"
        )
        TimetableEntryModel = self.serializer_class.Meta.model

        TimetableEntryModel.objects.filter(user=user).delete()
        created = 0
        for subj_name, dow, st, et, rm in rows:
            subj, _ = SubjectModel.objects.get_or_create(
                user=user,
                name=subj_name,
                defaults={
                    "code": subj_name.lower().replace(" ", "-")[:30],
                    "color_hex": "#888888",
                },
            )
            TimetableEntryModel.objects.create(
                user=user,
                subject=subj,
                day_of_week=dow,
                start_time=st,
                end_time=et,
                room=rm,
            )
            created += 1

        return Response({"replaced": created}, status=200)


class TaskViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = Task.objects.none()
    serializer_class = TaskSerializer
    read_permission = "tasks.read"
    write_permission = "tasks.write"
    function_permissions = {
        "archive": "tasks.write",
        "unarchive": "tasks.write",
    }

    def get_queryset(self):
        qs = (
            Task.objects.filter(user=self.request.user)
            .select_related("subject")
            .order_by("due_at", "priority")
        )
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)

        open_only = self.request.query_params.get("open", "true").lower() == "true"
        if open_only:
            qs = qs.exclude(status="COMPLETED")

        # Special case: allow archived tasks for unarchive action
        if getattr(self, "action", None) == "unarchive":
            return qs  # don't hide archived ones

        # Hide archived tasks by default unless ?archived=true
        show_archived = (
            self.request.query_params.get("archived", "false").lower() == "true"
        )
        if not show_archived:
            qs = qs.filter(is_archived=False)

        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    # Archive endpoint
    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        task = self.get_object()
        task.is_archived = True
        task.save(update_fields=["is_archived"])
        return Response({"success": True, "id": task.id, "is_archived": True})

    # Unarchive endpoint
    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        task = self.get_object()
        task.is_archived = False
        task.save(update_fields=["is_archived"])
        return Response({"success": True, "id": task.id, "is_archived": False})


class ReminderViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = Reminder.objects.none()
    serializer_class = ReminderSerializer
    read_permission = "reminders.read"
    write_permission = "reminders.write"

    def get_queryset(self):
        return (
            Reminder.objects.filter(task__user=self.request.user)
            .select_related("task")
            .order_by("-notify_at")
        )


class ClassroomCourseViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = ClassroomCourse.objects.none()
    serializer_class = ClassroomCourseSerializer
    read_permission = "classroom.read"
    write_permission = "classroom.write"

    def get_queryset(self):
        return ClassroomCourse.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ClassroomAssignmentViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = ClassroomAssignment.objects.none()
    serializer_class = ClassroomAssignmentSerializer
    read_permission = "classroom.read"
    write_permission = "classroom.write"

    def get_queryset(self):
        return ClassroomAssignment.objects.filter(
            classroom_course__user=self.request.user
        )


class OAuthAccountViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = OAuthAccount.objects.none()
    serializer_class = OAuthAccountSerializer
    read_permission = "oauth.read"
    write_permission = "oauth.write"

    def get_queryset(self):
        return OAuthAccount.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ReminderIntakeViewSet(
    FunctionAuthorizedMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """
    POST /api/reminders/intake/
    Body: { assignmentId, courseName?, title, dueISO, remindAtISO, offsetDays?, link? }
    """

    write_permission = "reminders.write"
    serializer_class = ReminderIntakeSerializer
    queryset = Reminder.objects.none()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


@api_view(["POST"])
@permission_classes([IsAuthenticated, HasFunctionPermission("email.send")])
def send_test_email(request):
    """
    Sends a test email to the currently logged-in user.
    """
    user = request.user
    if not user.email:
        return Response({"detail": "User has no email"}, status=400)

    subject = "UniPlan Test Email"
    message = (
        f"Hello {user.username or user.email},\n\nThis is a test email from UniPlan!"
    )
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except Exception as exc:
        error_logger.error(
            "event=smtp_send_failed user=%s error=%s",
            sanitize_log_value(user.email),
            sanitize_log_value(str(exc)),
            exc_info=True,
        )
        return Response({"detail": "Failed to send email."}, status=502)
    return Response({"detail": f"Email sent to {user.email}!"})


@api_view(["GET"])
@permission_classes([IsAuthenticated, HasFunctionPermission("reminders.read")])
def reminders_summary(request):
    qs = Reminder.objects.select_related("task").filter(
        task__user=request.user,
        delivered_at__isnull=True,
        status__in=["", "pending"],
    )
    data = {}
    for r in qs:
        ext = r.task.external_id
        if not ext:
            continue
        offset = None
        if r.task.due_at:
            offset = max(0, (r.task.due_at.date() - r.notify_at.date()).days)
        # keep earliest reminder if multiple
        prev = data.get(ext)
        if not prev or r.notify_at < prev["notify_at"]:
            data[ext] = {
                "notify_at": r.notify_at.isoformat(),
                "offset_days": offset,
            }
    return Response(data)