# core/auth.py
"""
Custom DRF authentication backend.
ASVS:
  - V3.3.1 / V3.3.4 / V14.2.1: Reads token from HttpOnly cookie first
  - V7.2.1: All verification is server-side
  - V7.2.3: Token contains >=128 bits of entropy (jti field)
  - V7.4.2: Rejects tokens issued before account's token_valid_after
  - V8.2.1: Enforces function permission grants for the consumer
  - V16.3.1: Logs all successful and unsuccessful authentication attempts
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from core.exceptions import get_client_ip, sanitize_log_value
from .authorization import ensure_consumer_grants
from .tokens import verify_session_token

User = get_user_model()
auth_logger = logging.getLogger("security.auth")


class SignedTokenAuthentication(BaseAuthentication):
    """
    Authenticates via:
      1. HttpOnly cookie (preferred — V14.2.1, V3.3.1)
      2. Authorization: Bearer <token> (fallback for API clients)
    Logs all authentication attempts (successful and unsuccessful) per OWASP ASVS V16.3.1.
    """

    def authenticate(self, request):
        # 1) Try HttpOnly cookie first (V3.3.4 / V14.2.1)
        token = request.COOKIES.get(
            getattr(settings, "AUTH_COOKIE_NAME", "__Secure-uniplan-auth")
        )
        auth_type = "cookie_signed_token"

        # 2) Fallback to Authorization header
        if not token:
            auth = request.META.get("HTTP_AUTHORIZATION", "")
            if not auth.startswith("Bearer "):
                return None  # let other auth classes try
            token = auth.split(" ", 1)[1].strip()
            auth_type = "bearer_signed_token"

        ip = get_client_ip(request)
        path = sanitize_log_value(getattr(request, "path", "-"))
        ua = sanitize_log_value(request.META.get("HTTP_USER_AGENT", "-"))

        email = verify_session_token(token)
        if not email:
            auth_logger.warning(
                "event=auth_failure auth_type=%s reason=invalid_or_expired_token ip=%s path=%s ua=%s",
                auth_type,
                ip,
                path,
                ua,
            )
            raise AuthenticationFailed("Invalid/expired token")

        user, _ = User.objects.get_or_create(
            username=email, defaults={"email": email}
        )
        ensure_consumer_grants(user)
        auth_logger.info(
            "event=auth_success user=%s auth_type=%s ip=%s path=%s",
            sanitize_log_value(email),
            auth_type,
            ip,
            path,
        )
        return (user, None)
