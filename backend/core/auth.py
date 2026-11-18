from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .authorization import ensure_consumer_grants
from .tokens import verify_session_token

User = get_user_model()


class SignedTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith("Bearer "):
            return None

        email = verify_session_token(auth.split(" ", 1)[1].strip())
        if not email:
            raise AuthenticationFailed("Invalid/expired token")

        user, _ = User.objects.get_or_create(username=email, defaults={"email": email})
        ensure_consumer_grants(user)
        return (user, None)
