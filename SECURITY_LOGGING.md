# UniPlan Security Logging & Error Handling Inventory (OWASP ASVS V16)

This document provides the complete logging inventory, event catalog, log format specification, storage/retention policy, and access control guidelines for **UniPlan** in compliance with **OWASP ASVS v5.0 Chapter V16 (V16.1.1, V16.3.1, V16.3.4)**.

---

## 1. Technology Stack Logging Inventory (V16.1.1)

| Stack Layer | Component | Logger / Source | Events Logged | Storage Location | Retention Policy | Access Control |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Frontend (Client)** | React + Vite (`frontend/`) | Browser Console & UI Toast Handler (`pushToast`) | Client-side API request failures, OAuth initiation errors, CSV client-side guard warnings | Ephemeral in-memory browser console (never persists tokens or PII) | Session-only (cleared on page close/logout) | End-user browser context only |
| **2. Container & Web Server** | Docker / Gunicorn / Django WSGI | Container `stdout` / `stderr` (`console` StreamHandler) | HTTP request/response status codes, startup/shutdown events, structured security & error logs | Docker JSON-file log driver & CI/CD job logs | 30 days in container host log rotation | Host administrators & CI/CD maintainers only |
| **3. Authentication & Security Audit** | `core.auth`, `core.views`, `core.exceptions` | `security.auth` (`INFO`+) | OAuth2 login initiation, OAuth2 callback success/failure, Bearer signed-token verification success/failure, expired/tampered token attempts, OAuth refresh events | `backend/logs/security.log` (`RotatingFileHandler`, 5 MB × 5 backups) + `stdout` | 90 days (rotated at 5 MB per file, up to 5 archive files) | Backend service account & authorized system administrators (`0600`/`0640` file permissions) |
| **4. Error & Security Control Layer** | `core.exceptions`, `core.views`, `django.security`, `django.request` | `security.errors` (`WARNING`+) | Input/CSV validation rejections (extension, MIME, size, UTF-8), DRF permission/validation denials, Google Classroom API / OAuth TLS errors, SMTP/TLS failures, unhandled 500 exceptions | `backend/logs/security.log` (`RotatingFileHandler`, 5 MB × 5 backups) + `stdout` | 90 days | Backend service account & authorized system administrators |
| **5. Database Layer** | MySQL 8.0 (`db` service) | MySQL error log (`/var/log/mysql/error.log` / container `stderr`) | Database startup/shutdown, connection errors, deadlock/query errors | MySQL container volume / `stderr` | 30 days | Database administrator (`root` / container host admin) only |

---

## 2. Log Format & Metadata Specification (V16.1.1 & V16.2.1)

All backend security and error logs use the `security_structured` formatter defined in `backend/mysite/settings.py`:

```text
{asctime} [{levelname}] logger={name} module={module} pid={process} {message}
```

- **Timestamp (`when`)**: UTC ISO-8601 format (`%Y-%m-%dT%H:%M:%SZ`, e.g., `2026-11-17T10:30:00Z`), synchronized via `USE_TZ = True` and `TIME_ZONE = 'UTC'`.
- **Source (`where`)**: `logger`, `module`, process ID (`pid`), request `path`, HTTP `method`, and DRF `view` name.
- **Actor (`who`)**: Authenticated `user` (email/username) or `anonymous`, client IP address (`ip`, extracted via `core.exceptions.get_client_ip`), and `ua` (User-Agent where applicable).
- **Event (`what`)**: Structured `key=value` pairs starting with `event=<event_name>`, `auth_type=<mechanism>`, and `reason=<failure_reason>` or `detail=<summary>`.
- **Log Injection & Sensitive Data Protection**:
  - All dynamic values pass through `sanitize_log_value()` (`backend/core/exceptions.py`), which escapes `\r` and `\n` to prevent log injection (V16.4.1).
  - Raw bearer tokens, OAuth `client_secret`, `refresh_token`, and passwords are **never** written to log files (V16.2.5).

---

## 3. Catalog of Logged Security Events (V16.3.1 & V16.3.4)

### 3.1 Authentication Events (`security.auth` — V16.3.1)

| Event Identifier | Level | Trigger Condition | Metadata Collected |
| :--- | :--- | :--- | :--- |
| `event=oauth_login_initiated` | `INFO` | User requests `/api/auth/google/login` | `provider=google`, `auth_type=oauth2`, `ip` |
| `event=oauth_login_success` | `INFO` | Google OAuth callback succeeds (`/api/auth/google/callback`) | `user`, `provider=google`, `auth_type=oauth2`, `ip` |
| `event=oauth_callback_failure` | `WARNING` | Google OAuth callback missing `code` parameter | `reason=missing_code`, `provider=google`, `auth_type=oauth2`, `ip` |
| `event=oauth_callback_error` | `ERROR` | Google OAuth token exchange or `userinfo` call fails | `provider=google`, `auth_type=oauth2`, `ip`, `error` |
| `event=auth_success` | `INFO` | Valid Bearer signed token verified in `SignedTokenAuthentication` or `_require_auth` | `user`, `auth_type=bearer_signed_token`, `ip`, `path` |
| `event=token_validation_failed` | `WARNING` | `_unsign()` detects expired signature, bad HMAC signature, or missing `sub` | `reason` (`expired_signature`, `bad_signature`, `missing_subject`), `auth_type=bearer_signed_token` |
| `event=auth_failure` | `WARNING` | Missing, invalid, or expired Bearer token, or missing stored Google credentials | `reason`, `auth_type`, `ip`, `path`, `ua` |
| `event=oauth_token_refreshed` | `INFO` | Expired Google OAuth access token refreshed via refresh token | `user`, `provider=google`, `auth_type=oauth2_refresh_token`, `ip` |
| `event=drf_auth_denied` | `WARNING` | DRF raises `AuthenticationFailed` or `NotAuthenticated` | `user`, `ip`, `method`, `path`, `view`, `detail` |

### 3.2 Unexpected Errors & Security Control Failures (`security.errors` — V16.3.4)

| Event Identifier | Level | Trigger Condition | Metadata Collected |
| :--- | :--- | :--- | :--- |
| `event=csv_import_rejected` | `WARNING` | File upload security control blocks invalid extension, MIME type, >1 MB size, invalid UTF-8, or non-CSV payload | `reason`, `user`, `ip`, `filename` / `content_type` / `size` |
| `event=security_control_denied` | `WARNING` | DRF `PermissionDenied` (e.g. `IsOwner`) or `Throttled` raised | `type`, `user`, `ip`, `method`, `path`, `view`, `detail` |
| `event=validation_failure` | `WARNING` | DRF `ValidationError` raised on invalid input payload | `user`, `ip`, `method`, `path`, `view`, `detail` |
| `event=oauth_token_exchange_failed` | `ERROR` | OAuth token endpoint or TLS connection failure during login | `provider=google`, `ip`, `error` + stack trace |
| `event=oauth_token_refresh_failed` | `ERROR` | Google OAuth token refresh or TLS failure in `_require_auth` | `user`, `provider=google`, `ip`, `error` + stack trace |
| `event=classroom_coursework_fetch_error` | `WARNING` | Google Classroom coursework API call fails during submission sync | `course_id`, `coursework_id`, `error` |
| `event=smtp_send_failed` | `ERROR` | SMTP / TLS failure when sending email (`send_test_email`) | `user`, `error` + stack trace |
| `event=unhandled_exception` | `ERROR` | Any unhandled server exception caught by `security_exception_handler` | `user`, `ip`, `method`, `path`, `view`, `error` + stack trace (returns generic HTTP 500 message to client) |
