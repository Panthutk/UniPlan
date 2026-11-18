# core/auth.py
import hashlib
import hmac
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()

# V11.2.1 & V11.4.3: Explicitly enforce 256-bit collision-resistant SHA-256 (HMAC-SHA256)
# using Python's OpenSSL-backed stdlib (hashlib/hmac) and Django's TimestampSigner.
SIGNING_SALT = "uniplan"
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 8  # 8 hours
HASH_ALGORITHM = "sha256"            # 256-bit digest output (>= 256 bits required by V11.4.3)


class SHA256JSONSerializer(signing.JSONSerializer):
    """JSON serializer paired with explicit HMAC-SHA256 TimestampSigner."""
    pass


def sign_token(email: str) -> str:
    """
    Produce an HMAC-SHA256 authenticated, timestamped token for the given email.
    Explicitly pins algorithm='sha256' (256-bit MAC) to satisfy ASVS V11.4.3.
    """
    signer = signing.TimestampSigner(
        key=settings.SECRET_KEY,
        salt=SIGNING_SALT,
        algorithm=HASH_ALGORITHM,
    )
    payload = signing.b64_encode(SHA256JSONSerializer().dumps({"sub": email})).decode("ascii")
    return signer.sign(payload)


def _unsign(token: str):
    """
    Verify the 256-bit HMAC-SHA256 signature in constant time (hmac.compare_digest)
    and enforce the 8-hour token expiration window.
    """
    try:
        signer = signing.TimestampSigner(
            key=settings.SECRET_KEY,
            salt=SIGNING_SALT,
            algorithm=HASH_ALGORITHM,
        )
        unsigned_b64 = signer.unsign(token, max_age=TOKEN_MAX_AGE_SECONDS)
        data = SHA256JSONSerializer().loads(signing.b64_decode(unsigned_b64.encode("ascii")))
        return data.get("sub")
    except (BadSignature, SignatureExpired, KeyError, ValueError):
        return None


class SignedTokenAuthentication(BaseAuthentication):
    """
    Accepts: Authorization: Bearer <signed token>
    Token is authenticated via 256-bit HMAC-SHA256.
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