from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings

ALLOWED_ALGORITHMS = ("HS256",)
SIGNING_ALGORITHM = ALLOWED_ALGORITHMS[0]
FORBIDDEN_HEADER_PARAMS = frozenset({"jku", "x5u", "jwk", "x5c", "jwe", "x5t", "x5t#S256"})
TOKEN_LIFETIME = timedelta(hours=8)
REQUIRED_CLAIMS = ("sub", "iat", "nbf", "exp")


def _signing_key() -> str:
    return settings.SECRET_KEY


def issue_session_token(email: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": email,
            "iat": now,
            "nbf": now,
            "exp": now + TOKEN_LIFETIME,
        },
        _signing_key(),
        algorithm=SIGNING_ALGORITHM,
        headers={"alg": SIGNING_ALGORITHM, "typ": "JWT"},
    )


def verify_session_token(token: str) -> str | None:
    if not token:
        return None
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError:
        return None

    if header.get("alg") not in ALLOWED_ALGORITHMS:
        return None
    if FORBIDDEN_HEADER_PARAMS.intersection(header):
        return None

    try:
        payload = jwt.decode(
            token,
            _signing_key(),
            algorithms=list(ALLOWED_ALGORITHMS),
            options={
                "require": list(REQUIRED_CLAIMS),
                "verify_signature": True,
                "verify_exp": True,
                "verify_nbf": True,
                "verify_iat": True,
            },
        )
    except jwt.InvalidTokenError:
        return None

    sub = payload.get("sub")
    return sub if isinstance(sub, str) and sub else None
