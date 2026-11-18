# core/auth.py
"""
Custom DRF authentication backend.
ASVS:
  - V3.3.1 / V3.3.4 / V14.2.1: Reads token from HttpOnly cookie first
  - V7.2.1: All verification is server-side
  - V7.2.3: Token contains >=128 bits of entropy (jti field)
  - V7.4.2: Rejects tokens issued before account's token_valid_after
  - V8.2.1: Enforces function permission grants for the consumer
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .authorization import ensure_consumer_grants
from .tokens import verify_session_token

User = get_user_model()
logger = logging.getLogger("security")


class SignedTokenAuthentication(BaseAuthentication):
    """
    Authenticates via:
      1. HttpOnly cookie (preferred — V14.2.1, V3.3.1)
      2. Authorization: Bearer <token> (fallback for API clients)
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

        email = verify_session_token(token)
        if not email:
            raise AuthenticationFailed("Invalid/expired token")

        user, _ = User.objects.get_or_create(
            username=email, defaults={"email": email}
        )
        ensure_consumer_grants(user)
        return (user, None)
