# core/auth.py
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.signing import loads, BadSignature, SignatureExpired
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from core.exceptions import get_client_ip, sanitize_log_value

User = get_user_model()
auth_logger = logging.getLogger("security.auth")


def _unsign(token: str):
    try:
        # must match how you sign in views.py
        data = loads(token, salt="uniplan", key=settings.SECRET_KEY, max_age=60 * 60 * 8)
        sub = data.get("sub")
        if not sub:
            auth_logger.warning(
                "event=token_validation_failed reason=missing_subject auth_type=bearer_signed_token"
            )
            return None
        return sub
    except SignatureExpired:
        auth_logger.warning(
            "event=token_validation_failed reason=expired_signature auth_type=bearer_signed_token"
        )
        return None
    except (BadSignature, KeyError):
        auth_logger.warning(
            "event=token_validation_failed reason=bad_signature auth_type=bearer_signed_token"
        )
        return None


class SignedTokenAuthentication(BaseAuthentication):
    """
    Accepts: Authorization: Bearer <signed token>
    Token is produced by _sign() in views.py (payload: {"sub": email}).
    Logs all authentication attempts (successful and unsuccessful) per OWASP ASVS V16.3.1.
    """
    def authenticate(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith("Bearer "):
            return None  # let other auth classes try

        ip = get_client_ip(request)
        path = sanitize_log_value(getattr(request, "path", "-"))
        ua = sanitize_log_value(request.META.get("HTTP_USER_AGENT", "-"))

        token = auth.split(" ", 1)[1].strip()
        email = _unsign(token)
        if not email:
            auth_logger.warning(
                "event=auth_failure auth_type=bearer_signed_token reason=invalid_or_expired_token ip=%s path=%s ua=%s",
                ip,
                path,
                ua,
            )
            raise AuthenticationFailed("Invalid/expired token")

        user, _ = User.objects.get_or_create(username=email, defaults={"email": email})
        auth_logger.info(
            "event=auth_success user=%s auth_type=bearer_signed_token ip=%s path=%s",
            sanitize_log_value(email),
            ip,
            path,
        )
        return (user, None)
