# core/auth.py
"""
Custom DRF authentication backend.
ASVS:
  - V3.3.1 / V3.3.4 / V14.2.1: Reads token from HttpOnly cookie first
  - V7.2.1: All verification is server-side
  - V7.2.3: Token contains ≥128 bits of entropy (jti field)
  - V7.4.2: Rejects tokens issued before account's token_valid_after
"""

import time
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.signing import loads, BadSignature, SignatureExpired
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import GoogleAccount

User = get_user_model()
logger = logging.getLogger("security")


def _unsign(token: str):
    """
    Verify a signed token and return (email, issued_at) or (None, None).
    Checks V7.4.2: token_valid_after on the GoogleAccount.
    """
    try:
        data = loads(
            token, salt="uniplan", key=settings.SECRET_KEY, max_age=60 * 60 * 8
        )
        email = data.get("sub")
        iat = data.get("iat", 0)
        if not email:
            return None, None

        # V7.4.2 — reject tokens issued before forced invalidation
        try:
            acc = GoogleAccount.objects.get(pk=email)
            if acc.token_valid_after:
                if iat < acc.token_valid_after.timestamp():
                    logger.info(
                        "DRF auth: token rejected (pre-invalidation) for %s", email
                    )
                    return None, None
        except GoogleAccount.DoesNotExist:
            pass

        return email, iat
    except (BadSignature, SignatureExpired, KeyError):
        return None, None


class SignedTokenAuthentication(BaseAuthentication):
    """
    Authenticates via:
      1. HttpOnly cookie (preferred — V14.2.1, V3.3.1)
      2. Authorization: Bearer <signed token> (fallback for API clients)
    Token is produced by _sign() in views.py (payload: {sub, jti, iat}).
    """

    def authenticate(self, request):
        # 1) Try HttpOnly cookie first (V3.3.4 / V14.2.1)
        token = request.COOKIES.get(
            getattr(settings, "AUTH_COOKIE_NAME", "__Secure-uniplan-auth")
        )

        # 2) Fallback to Authorization header
        if not token:
            auth = request.META.get("HTTP_AUTHORIZATION", "")
            if not auth.startswith("Bearer "):
                return None  # let other auth classes try
            token = auth.split(" ", 1)[1].strip()

        email, _ = _unsign(token)
        if not email:
            raise AuthenticationFailed("Invalid/expired token")

        user, _ = User.objects.get_or_create(
            username=email, defaults={"email": email}
        )
        return (user, None)
