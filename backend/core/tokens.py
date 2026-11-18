from datetime import datetime, timedelta, timezone
import logging
import secrets
import jwt
from django.conf import settings

auth_logger = logging.getLogger("security.auth")

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
            "iat_f": now.timestamp(),
            "nbf": now,
            "exp": now + TOKEN_LIFETIME,
            "jti": secrets.token_urlsafe(24),  # 192 bits of CSPRNG entropy (V7.2.3)
        },
        _signing_key(),
        algorithm=SIGNING_ALGORITHM,
        headers={"alg": SIGNING_ALGORITHM, "typ": "JWT"},
    )


def decode_session_token(token: str) -> tuple[str | None, int | None]:
    if not token:
        return None, None
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError:
        auth_logger.warning(
            "event=token_validation_failed reason=bad_signature auth_type=bearer_signed_token"
        )
        return None, None

    if header.get("alg") not in ALLOWED_ALGORITHMS:
        auth_logger.warning(
            "event=token_validation_failed reason=disallowed_algorithm auth_type=bearer_signed_token"
        )
        return None, None
    if FORBIDDEN_HEADER_PARAMS.intersection(header):
        auth_logger.warning(
            "event=token_validation_failed reason=forbidden_header_param auth_type=bearer_signed_token"
        )
        return None, None

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
    except jwt.ExpiredSignatureError:
        auth_logger.warning(
            "event=token_validation_failed reason=expired_signature auth_type=bearer_signed_token"
        )
        return None, None
    except jwt.InvalidTokenError:
        auth_logger.warning(
            "event=token_validation_failed reason=bad_signature auth_type=bearer_signed_token"
        )
        return None, None

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        auth_logger.warning(
            "event=token_validation_failed reason=missing_subject auth_type=bearer_signed_token"
        )
        return None, None

    iat = payload.get("iat")
    iat_f = payload.get("iat_f")
    if iat_f is not None:
        check_ts = float(iat_f)
    elif isinstance(iat, (int, float)):
        check_ts = float(iat)
    elif hasattr(iat, "timestamp"):
        check_ts = float(iat.timestamp())
    else:
        check_ts = 0.0

    # V7.4.2 — check if token was issued before a forced invalidation (e.g. logout)
    try:
        from .models import GoogleAccount
        acc = GoogleAccount.objects.get(pk=sub)
        if acc.token_valid_after:
            if check_ts < acc.token_valid_after.timestamp():
                auth_logger.warning(
                    "event=token_validation_failed reason=revoked_before_token_valid_after auth_type=bearer_signed_token"
                )
                return None, None
    except Exception:
        pass

    iat_ret = int(check_ts) if check_ts else 0
    return sub, iat_ret


def verify_session_token(token: str) -> str | None:
    sub, _ = decode_session_token(token)
    return sub
