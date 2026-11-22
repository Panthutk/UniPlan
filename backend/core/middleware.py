# core/middleware.py
"""
Security middleware for UniPlan.
Covers OWASP ASVS:
  - V3.2.1  Sec-Fetch validation (prevent direct browser navigation to APIs)
  - V3.4.1  HSTS header
  - V3.4.4  X-Content-Type-Options: nosniff
  - V3.4.5  Referrer-Policy
  - V3.4.6  frame-ancestors via CSP
  - V13.4.2 Suppress server version info
"""

import logging

logger = logging.getLogger("security")


class SecurityHeadersMiddleware:
    """
    Adds hardened HTTP security headers to every response.
    ASVS: V3.4.1, V3.4.4, V3.4.5, V3.4.6, V13.4.6
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # V3.4.1 — HSTS (1 year, include subdomains)
        response["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

        # V3.4.4 — Prevent MIME-type sniffing
        response["X-Content-Type-Options"] = "nosniff"

        # V3.4.5 — Referrer-Policy (no leaking full URL to third parties)
        response["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # V3.4.3 / V3.4.6 — Hardened Content-Security-Policy (remediated per OWASP ZAP DAST)
        response["Content-Security-Policy"] = (
            "default-src 'none'; "
            "frame-ancestors 'self'; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )

        # V13.4.6 — Suppress server version header (remove X-Powered-By completely)
        response.headers.pop("X-Powered-By", None)
        response["Server"] = "UniPlan"

        # Permissions-Policy — disable unused browser features
        response["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        # V3.4.8 — Cross-Origin-Opener-Policy
        response["Cross-Origin-Opener-Policy"] = "same-origin"

        return response


class SecFetchValidationMiddleware:
    """
    Reject direct browser navigation (Sec-Fetch-Dest: document) to API
    endpoints, preventing unintended content interpretation.
    ASVS: V3.2.1
    """

    # Paths that should NOT be navigated to directly (APIs, not pages)
    API_PREFIXES = ("/api/",)

    # Except the OAuth callback which IS a redirect from Google
    EXEMPT_PATHS = (
        "/api/auth/google/callback",
        "/api/auth/google/login",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        # Only check API endpoints
        if any(path.startswith(p) for p in self.API_PREFIXES):
            # Skip exempt paths (OAuth redirects)
            if not any(path.startswith(e) for e in self.EXEMPT_PATHS):
                sec_fetch_dest = request.META.get(
                    "HTTP_SEC_FETCH_DEST", ""
                ).lower()

                # Block if the browser says it's a top-level document navigation
                if sec_fetch_dest == "document":
                    logger.warning(
                        "Blocked direct browser navigation to API: %s "
                        "(Sec-Fetch-Dest: document, IP: %s)",
                        path,
                        request.META.get("REMOTE_ADDR", "?"),
                    )
                    from django.http import JsonResponse

                    return JsonResponse(
                        {
                            "detail": "Direct browser navigation to API endpoints is not allowed."
                        },
                        status=403,
                    )

        return self.get_response(request)
