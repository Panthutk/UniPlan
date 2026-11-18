import logging
from rest_framework.views import exception_handler
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
    Throttled,
)
from rest_framework.response import Response
from rest_framework import status

auth_logger = logging.getLogger("security.auth")
error_logger = logging.getLogger("security.errors")


def sanitize_log_value(val) -> str:
    """Prevent log injection by stripping CR/LF characters."""
    if val is None:
        return "-"
    return str(val).replace("\r", "\\r").replace("\n", "\\n")


def get_client_ip(request) -> str:
    if not request:
        return "unknown"
    meta = getattr(request, "META", {}) or {}
    xff = meta.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return sanitize_log_value(xff.split(",")[0].strip())
    return sanitize_log_value(meta.get("REMOTE_ADDR", "unknown"))


def security_exception_handler(exc, context):
    """
    Custom DRF exception handler that logs authentication failures (V16.3.1),
    security control / validation failures, and unexpected server errors (V16.3.4).
    """
    response = exception_handler(exc, context)
    request = context.get("request")
    view = context.get("view")
    ip = get_client_ip(request)
    path = sanitize_log_value(getattr(request, "path", "-"))
    method = sanitize_log_value(getattr(request, "method", "-"))
    view_name = sanitize_log_value(view.__class__.__name__ if view else "-")
    user = getattr(request, "user", None)
    username = sanitize_log_value(getattr(user, "username", None) or "anonymous")

    if isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
        auth_logger.warning(
            "event=drf_auth_denied user=%s ip=%s method=%s path=%s view=%s detail=%s",
            username,
            ip,
            method,
            path,
            view_name,
            sanitize_log_value(getattr(exc, "detail", str(exc))),
        )
    elif isinstance(exc, (PermissionDenied, Throttled)):
        error_logger.warning(
            "event=security_control_denied type=%s user=%s ip=%s method=%s path=%s view=%s detail=%s",
            exc.__class__.__name__,
            username,
            ip,
            method,
            path,
            view_name,
            sanitize_log_value(getattr(exc, "detail", str(exc))),
        )
    elif isinstance(exc, ValidationError):
        error_logger.warning(
            "event=validation_failure user=%s ip=%s method=%s path=%s view=%s detail=%s",
            username,
            ip,
            method,
            path,
            view_name,
            sanitize_log_value(getattr(exc, "detail", str(exc))),
        )
    elif response is None:
        # Unhandled / unexpected exception (V16.3.4)
        error_logger.error(
            "event=unhandled_exception user=%s ip=%s method=%s path=%s view=%s error=%s",
            username,
            ip,
            method,
            path,
            view_name,
            sanitize_log_value(str(exc)),
            exc_info=True,
        )
        return Response(
            {"detail": "An unexpected server error occurred."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response
