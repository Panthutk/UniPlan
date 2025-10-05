# core/auth.py
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.signing import loads, BadSignature, SignatureExpired
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()

def _unsign(token: str):
    try:
        # must match how you sign in views.py
        data = loads(token, salt="uniplan", key=settings.SECRET_KEY, max_age=60 * 60 * 8)
        return data.get("sub")
    except (BadSignature, SignatureExpired, KeyError):
        return None

class SignedTokenAuthentication(BaseAuthentication):
    """
    Accepts: Authorization: Bearer <signed token>
    Token is produced by _sign() in views.py (payload: {"sub": email}).
    """
    def authenticate(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith("Bearer "):
            return None  # let other auth classes try

        token = auth.split(" ", 1)[1].strip()
        email = _unsign(token)
        if not email:
            raise AuthenticationFailed("Invalid/expired token")

        user, _ = User.objects.get_or_create(username=email, defaults={"email": email})
        return (user, None)
