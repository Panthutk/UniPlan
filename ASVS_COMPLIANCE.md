# OWASP ASVS v5.0 Security Compliance & Verification Matrix

This document records the complete **OWASP Application Security Verification Standard (ASVS v5.0)** security plan, completion status, and codebase verification evidence for **UniPlanPlus (UniPlan)**.

All **59 planned security requirements** across **15 ASVS chapters** (`V1`–`V3`, `V5`–`V16`) have been implemented and verified in the codebase, along with **15 additional defense-in-depth hardening controls** beyond the initial project plan (**74 verified controls in total**).

---

## Executive Summary

| Chapter | Domain | Planned | Done | Additional Controls | Primary Reference / Evidence |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **V1** | Encoding and Sanitization | 6 | **6 / 6** | — | `core/serializers.py`, `core/views.py`, `test_v1_encoding_sanitization.py` |
| **V2** | Validation and Business Logic | 4 | **4 / 4** | — | [`VALIDATION_RULES.md`](VALIDATION_RULES.md), `test_v2_validation_rules.py` |
| **V3** | Web Frontend Security | 5 | **5 / 5** | +9 | [`SECURITY.md`](SECURITY.md), `core/middleware.py`, `test_security_v3_v7_v13_v14.py` |
| **V5** | File Handling | 5 | **5 / 5** | — | [`README.md`](README.md#file-handling--security-policy-owasp-asvs-v5), [`VALIDATION_RULES.md`](VALIDATION_RULES.md), `core/views.py` |
| **V6** | Authentication | 4 | **4 / 4** | — | [`README.md`](README.md#authentication--anti-automation-policy-owasp-asvs-v6), `core/views.py`, `mysite/settings.py` |
| **V7** | Session Management | 5 | **5 / 5** | +2 | [`SECURITY.md`](SECURITY.md), `core/auth.py`, `core/tokens.py`, `test_security_v3_v7_v13_v14.py` |
| **V8** | Authorization | 4 | **4 / 4** | — | [`docs/authorization.md`](docs/authorization.md), `core/authorization.py`, `core/views.py` |
| **V9** | Self-contained Tokens | 4 | **4 / 4** | — | [`docs/authorization.md`](docs/authorization.md#session-tokens), `core/tokens.py` |
| **V10** | OAuth and OIDC | 6 | **6 / 6** | — | [`README.md`](README.md#oauth-20--oidc-security-policy-owasp-asvs-v10), [`OAuth2Setup.md`](OAuth2Setup.md), `core/views.py` |
| **V11** | Cryptography | 2 | **2 / 2** | — | [`README.md`](README.md#cryptography--data-integrity-policy-owasp-asvs-v11), `core/auth.py`, `core/tokens.py` |
| **V12** | Secure Communication | 1 | **1 / 1** | — | [`README.md`](README.md#secure-communications--tls-certificate-validation-owasp-asvs-v12), `core/views.py`, `mysite/settings.py` |
| **V13** | Configuration | 3 | **3 / 3** | +3 | [`SECURITY.md`](SECURITY.md), `backend/.env.example`, `mysite/settings.py` |
| **V14** | Data Protection | 3 | **3 / 3** | +1 | [`SECURITY.md`](SECURITY.md), `core/views.py`, `frontend/src/utils/api.js` |
| **V15** | Secure Coding and Architecture | 4 | **4 / 4** | — | [`docs/dependency-policy.md`](docs/dependency-policy.md), `sbom/inventory.json`, `scripts/check_sbom.py` |
| **V16** | Security Logging and Error Handling | 3 | **3 / 3** | — | [`SECURITY_LOGGING.md`](SECURITY_LOGGING.md), `core/exceptions.py`, `test_v16_logging_error_handling.py` |
| **Total** | **15 Active Chapters** | **59** | **59 / 59 (100%)** | **+15** | **74 Total Verified Controls** |

> [!NOTE]
> Chapters **V4** (API/Web Service framing, GraphQL, WebSocket) and **V17** (WebRTC) were not in scope (`Plan = False`) because UniPlan does not expose GraphQL, WebSocket, or WebRTC services.

---

## Planned OWASP ASVS Requirements (59 / 59 Completed)

### Chapter V1 — Encoding and Sanitization (6 / 6)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V1.2.1** | L1 | Context-relevant output encoding for HTTP, HTML, and XML responses | Yes | Done | Django templates auto-escape HTML by default; React JSX auto-escapes rendered text nodes with zero `dangerouslySetInnerHTML` usage; DRF `JSONRenderer` encodes all API responses (`backend/mysite/settings.py`). |
| **V1.2.2** | L1 | Context-appropriate URL encoding and safe URL protocol allowlisting | Yes | Done | Backend OAuth query/fragment URLs use `urllib.parse.urlencode()` (`backend/core/views.py`); frontend uses `encodeURIComponent()` and `URLSearchParams`. External links are restricted strictly to `http://` and `https://` in `TaskSerializer.validate_assignment_alt_link` (`backend/core/serializers.py`) and `safeExternalUrl()` (`frontend/src/utils/api.js`), disallowing `javascript:` and `data:` schemes. |
| **V1.2.3** | L1 | Output encoding/escaping when dynamically building JavaScript and JSON | Yes | Done | Backend serializes all API responses exclusively through DRF `JSONRenderer` (`DEFAULT_RENDERER_CLASSES`), `JsonResponse`, and `json.dumps`; frontend builds/parses payloads strictly via `JSON.stringify()` and `JSON.parse()`. Verified in `backend/core/tests/test_v1_encoding_sanitization.py`. |
| **V1.2.4** | L1 | Parameterized queries / ORM protection against SQL injection | Yes | Done | All database queries exclusively use the Django ORM (`filter()`, `exclude()`, `get_or_create()`, `update_or_create()`, `create()`), which binds parameters via the MySQL driver. Zero `.raw()`, `.extra()`, `cursor.execute()`, or `RawSQL` calls exist. Verified in `backend/core/tests/test_v1_encoding_sanitization.py`. |
| **V1.2.5** | L1 | Protection against OS command injection | Yes | Done | Verified no `os.system()`, `subprocess`, `popen()`, or shell execution calls exist anywhere in the application codebase (`backend/core/`). |
| **V1.3.2** | L1 | Avoidance of `eval()` and dynamic code execution | Yes | Done | Verified no `eval()`, `exec()`, `Function()`, or dynamic expression evaluation exists in either the Python backend or React frontend. |

---

### Chapter V2 — Validation and Business Logic (4 / 4)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V2.1.1** | L1 | Documented input validation rules for common and internal data formats | Yes | Done | Complete specification of common data formats (email, URL, hex color, 24-hour time, ISO-8601 datetime, signed token), model field schemas (`Subject`, `TimetableEntry`, `Task`, `Reminder`), and CSV import validation rules documented in [`VALIDATION_RULES.md`](VALIDATION_RULES.md). |
| **V2.2.1** | L1 | Positive input validation against allowlists, patterns, ranges, and logical limits | Yes | Done | Server-side serializers enforce `HEX_RE` (`^#[0-9A-Fa-f]{6}$`), `TIME_RE` (`^\d{2}:\d{2}(:\d{2})?$`), `start_time < end_time` and per-user/day overlap checks in `TimetableEntrySerializer`, allowlist choices (`DayOfWeek`, `TaskStatus`, `Priority`, `ReminderChannel`), and pre-write row validation in `import_csv()`. Verified in `backend/core/tests/test_v2_validation_rules.py`. |
| **V2.2.2** | L1 | Input validation enforced at a trusted service layer (server-side) | Yes | Done | All validation is enforced server-side in DRF serializers (`backend/core/serializers.py`), views (`backend/core/views.py`), and models (`backend/core/models.py`); client-side checks in React are for usability only. Verified in `backend/core/tests/test_v2_validation_rules.py`. |
| **V2.3.1** | L1 | Business logic flows processed only in expected sequential step order | Yes | Done | OAuth login enforces strict sequential progression (`login` -> signed `oauth_state` cookie -> `callback` state verification -> backchannel token exchange -> session token issuance). Reminder scheduling validates owned task existence, non-null `due_at`, and future `notify_at` before persistence. |

---

### Chapter V3 — Web Frontend Security (5 / 5)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V3.2.1** | L1 | Prevent unintended browser content interpretation in incorrect contexts | Yes | Done | `SecFetchValidationMiddleware` (`backend/core/middleware.py`) inspects `Sec-Fetch-Dest` and blocks direct browser navigation (`Sec-Fetch-Dest: document`) to `/api/*` endpoints with `403 Forbidden` (exempting OAuth redirect endpoints). CSV export enforces `Content-Disposition: attachment; filename="timetable.csv"` and `X-Content-Type-Options: nosniff`. Verified in `backend/core/tests/test_security_v3_v7_v13_v14.py`. |
| **V3.2.2** | L1 | Safe rendering functions for text content | Yes | Done | React JSX auto-escapes all interpolated text by default; zero `dangerouslySetInnerHTML` usage across the frontend codebase. |
| **V3.5.1** | L1 | CSRF defense for cross-origin sensitive functionality | Yes | Done | Django `CsrfViewMiddleware` is enabled in `MIDDLEWARE`; authentication cookies use `HttpOnly` and `SameSite=Lax`, and API clients can authenticate via non-CORS-safelisted `Authorization: Bearer` headers. |
| **V3.5.2** | L1 | CORS preflight protection and strict origin allowlist | Yes | Done | `django-cors-headers` enforces an explicit allowlist (`CORS_ALLOWED_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]`) with `CORS_ALLOW_CREDENTIALS = True` and no wildcard `*`. |
| **V3.5.3** | L1 | State-changing operations use unsafe HTTP methods (`POST`/`PATCH`/`DELETE`), not `GET`/`HEAD` | Yes | Done | All create/update/delete/archive/logout/import/email actions strictly require `POST`, `PATCH`, or `DELETE` via DRF ViewSets and `@api_view(["POST"])`; `@require_GET` is restricted strictly to read-only and OAuth redirect endpoints. |

---

### Chapter V5 — File Handling (5 / 5)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V5.1.1** | L2 | Document permitted file types, extensions, max size, and safe download/malicious-file handling | Yes | Done | Documented in [`README.md`](README.md#file-handling--security-policy-owasp-asvs-v5) and [`VALIDATION_RULES.md`](VALIDATION_RULES.md#3-file-upload-validation-rules--timetable-csv-import-post-apitimetableimport): `.csv` extension only, MIME allowlist (`text/csv`, `application/csv`, `application/vnd.ms-excel`), `1,000,000`-byte (1 MB) limit, in-memory processing, immediate rejection (`400`/`413`/`415`), and CSV formula injection sanitization. |
| **V5.2.1** | L1 | Enforce maximum upload file size to prevent DoS | Yes | Done | `MAX_BYTES = 1_000_000` (1 MB) enforced in `TimetableEntryViewSet.import_csv()` (`backend/core/views.py`), returning `413 Payload Too Large` and logging `event=csv_import_rejected` when exceeded. |
| **V5.3.1** | L1 | Uploaded/generated files are never executed as server-side code in public folders | Yes | Done | Both `import_csv()` (using `io.StringIO`) and `export_csv()` (streaming directly to `HttpResponse`) process CSV data strictly in-memory; uploaded or exported files are never written to disk or served from a public directory. |
| **V5.3.2** | L1 | Never use unsanitized user-submitted filenames for file path operations | Yes | Done | `import_csv()` strips path segments with `os.path.basename(f.name or "")` strictly to inspect the `.csv` extension and never performs filesystem path operations; `export_csv()` uses a hardcoded `safe_filename = "timetable.csv"`. |
| **V5.4.1** | L2 | Ignore user-submitted filenames on download and set `Content-Disposition` | Yes | Done | `export_csv()` ignores all user-supplied filename parameters and enforces hardcoded `Content-Disposition: attachment; filename="timetable.csv"`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`. |

---

### Chapter V6 — Authentication (4 / 4)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V6.1.1** | L1 | Document rate limiting, anti-automation, adaptive response, and lockout prevention | Yes | Done | Documented in [`README.md`](README.md#authentication--anti-automation-policy-owasp-asvs-v6): federated Google OAuth 2.0 adaptive protection, per-IP sliding-window OAuth throttling (`15 req / 60s`), DRF throttling (`20/min` anon, `120/min` user), and strict IP-based temporary windows preventing malicious account lockout. |
| **V6.3.1** | L1 | Implement brute-force and anti-automation controls per security documentation | Yes | Done | Primary authentication delegated to Google OAuth 2.0 (no local user passwords); `_check_auth_rate_limit()` enforces `15 requests / 60 seconds` per IP (`429 Too Many Requests`) on `/api/auth/google/login` and `/api/auth/google/callback`; DRF enforces `AnonRateThrottle` (`20/minute`) and `UserRateThrottle` (`120/minute`). |
| **V6.3.2** | L1 | No default user accounts (`root`, `admin`, `sa`) present or enabled | Yes | Done | No default accounts are seeded in migrations, fixtures, or startup scripts; user accounts are provisioned dynamically upon verified Google OAuth callback. |
| **V6.4.2** | L1 | No password hints or knowledge-based authentication ("secret questions") | Yes | Done | Local password login, password hints, and security questions do not exist in the application — user authentication is exclusively Google OAuth 2.0. |

---

### Chapter V7 — Session Management (5 / 5)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V7.2.1** | L1 | All session token verification performed at a trusted backend service | Yes | Done | `SignedTokenAuthentication` (`backend/core/auth.py`) and `decode_session_token()` (`backend/core/tokens.py`) validate every session token cryptographically on the Django backend. |
| **V7.2.2** | L1 | Dynamically generated session tokens (no static API keys/secrets) | Yes | Done | `issue_session_token(email)` (`backend/core/tokens.py`) dynamically generates signed session JWTs per login with unique 192-bit CSPRNG `jti` (`secrets.token_urlsafe(24)`), `iat`, `nbf`, and `exp` claims. |
| **V7.2.4** | L1 | Generate a new session token on every authentication/re-authentication | Yes | Done | Every Google OAuth callback invokes `issue_session_token(email)`, minting a fresh token with a new `jti` and `iat` timestamp and replacing the auth cookie. |
| **V7.4.1** | L1 | Disallow further use of terminated or expired sessions | Yes | Done | Tokens enforce an 8-hour absolute lifetime (`TOKEN_LIFETIME = timedelta(hours=8)` / `max_age = 28800`); expired or revoked tokens are immediately rejected server-side (`401 Unauthorized`). Verified in `backend/core/tests/test_security_v3_v7_v13_v14.py`. |
| **V7.4.2** | L1 | Terminate active sessions upon logout or account disablement/revocation | Yes | Done | `GoogleAccount.token_valid_after` is checked in `decode_session_token()` on every request. `POST /api/auth/logout` sets `token_valid_after = timezone.now()`, immediately invalidating all previously issued tokens server-side (and admins can revoke or delete accounts at any time). Verified in `backend/core/tests/test_security_v3_v7_v13_v14.py`. |

---

### Chapter V8 — Authorization (4 / 4)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V8.1.1** | L1 | Document function-level and data-specific access rules based on consumer permissions and resource attributes | Yes | Done | Complete permission catalog (`15` function permissions), default consumer grant rules, deny-by-default model, and resource ownership attribute mappings documented in [`docs/authorization.md`](docs/authorization.md). |
| **V8.2.1** | L1 | Restrict function-level access to consumers with explicit permissions | Yes | Done | Implemented deny-by-default function grants via `FunctionGrant` model, `EnforcesDeclaredFunctionPermission`, `HasFunctionPermission`, and `FunctionAuthorizedMixin` (`backend/core/authorization.py`), registered globally in `REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"]`. Diagnostic `debug.read` is excluded from default consumer grants. |
| **V8.2.2** | L1 | Restrict data-specific access via ownership checks to prevent IDOR / BOLA | Yes | Done | Every ViewSet scopes `get_queryset()` strictly to `request.user` (`user`, `task__user`, or `classroom_course__user`), `OwnsObject` validates object-level access, and `require_owned_item()` blocks cross-user foreign key references in serializers (`backend/core/serializers.py`). |
| **V8.3.1** | L1 | Enforce authorization rules at a trusted service layer (not client-side) | Yes | Done | All authentication, function-level permission checks, and object ownership checks execute server-side in Django REST Framework (`backend/mysite/settings.py`, `backend/core/authorization.py`, `backend/core/views.py`). |

---

### Chapter V9 — Self-contained Tokens (4 / 4)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V9.1.1** | L1 | Validate token digital signature / MAC before accepting contents | Yes | Done | `decode_session_token()` (`backend/core/tokens.py`) enforces `verify_signature: True` (HMAC-SHA256) before reading `sub` or any claims; tampered tokens are rejected and logged. |
| **V9.1.2** | L1 | Restrict signing/verification algorithms to an explicit allowlist (no `none`) | Yes | Done | `ALLOWED_ALGORITHMS = ("HS256",)` strictly enforced in `backend/core/tokens.py`; unverified header `alg` is checked against the allowlist before decoding, rejecting `none` and preventing symmetric/asymmetric algorithm confusion. |
| **V9.1.3** | L1 | Source verification key material strictly from trusted pre-configured server config | Yes | Done | Verification key is always sourced solely from `settings.SECRET_KEY`; `decode_session_token()` explicitly rejects tokens containing `FORBIDDEN_HEADER_PARAMS = {"jku", "x5u", "jwk", "x5c", "jwe", "x5t", "x5t#S256"}`. |
| **V9.2.1** | L1 | Enforce token validity time span (`nbf` and `exp`) | Yes | Done | `issue_session_token()` embeds `iat`, `nbf`, and `exp` (8-hour lifetime), and `decode_session_token()` requires and verifies all three (`require: ["sub", "iat", "nbf", "exp"]`, `verify_exp: True`, `verify_nbf: True`, `verify_iat: True`). |

---

### Chapter V10 — OAuth and OIDC (6 / 6)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V10.1.1** | L2 | Backend-for-Frontend token isolation (OAuth access/refresh tokens backend-only) | Yes | Done | Google OAuth `access_token` and `refresh_token` are stored strictly server-side in `GoogleAccount.credentials` (`backend/core/views.py`) and never sent to the browser. App session tokens are delivered via `HttpOnly`, `SameSite=Lax` cookie with `Cache-Control: no-store`, and `frontend/src/Login.jsx` immediately cleans callback URLs via `window.history.replaceState()`. |
| **V10.1.2** | L2 | Unguessable transaction-bound `state` bound to user agent session | Yes | Done | `google_login()` generates a 256-bit CSPRNG `state` (`secrets.token_urlsafe(32)`) and binds it to the user agent session in a signed, `HttpOnly`, `SameSite=Lax` cookie (`oauth_state`, `max_age=600`). |
| **V10.2.1** | L2 | OAuth authorization code flow CSRF protection via `state` validation | Yes | Done | `google_callback()` verifies the `oauth_state` cookie signature/expiration and compares it against the callback `state` query parameter using constant-time `secrets.compare_digest()` before calling `flow.fetch_token()`, deleting `oauth_state` afterward. |
| **V10.4.10** | L2 | Confidential client authentication for backchannel token requests | Yes | Done | `_client_config()` (`backend/core/views.py`) enforces presence of `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (raising `ImproperlyConfigured` if absent) and authenticates backchannel token requests to `https://oauth2.googleapis.com/token` over TLS. |
| **V10.4.11** | L2 | Least-privilege OAuth scopes only | Yes | Done | `SCOPES` in `backend/core/views.py` requests strictly read-only scopes (`openid`, `userinfo.email`, `userinfo.profile`, `classroom.courses.readonly`, `classroom.student-submissions.me.readonly`, `classroom.coursework.me.readonly`); write scope `classroom.coursework.me` is excluded. |
| **V10.7.1** | L2 | Explicit user consent prompted on authorization requests | Yes | Done | `google_login()` passes `prompt="consent"` to `flow.authorization_url()`, and consent scope requirements are documented in [`README.md`](README.md#oauth-20--oidc-security-policy-owasp-asvs-v10) and [`OAuth2Setup.md`](OAuth2Setup.md). |

---

### Chapter V11 — Cryptography (2 / 2)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V11.2.1** | L2 | Industry-validated cryptographic implementations used (no custom crypto) | Yes | Done | Uses only standard peer-reviewed libraries: Python stdlib (`hashlib`, `hmac`, `secrets`), `PyJWT` + `cryptography`, Django `PBKDF2PasswordHasher` / `TimestampSigner`, and `google-auth`. Policy documented in [`README.md`](README.md#cryptography--data-integrity-policy-owasp-asvs-v11). |
| **V11.4.3** | L2 | Collision-resistant >= 256-bit hash functions for signing and integrity | Yes | Done | Session signing explicitly pins `HS256` (`backend/core/tokens.py`) and `HASH_ALGORITHM = "sha256"` (`backend/core/auth.py`); Django admin password hashing explicitly enforces `PBKDF2PasswordHasher` (PBKDF2-HMAC-SHA256) in `backend/mysite/settings.py`. Zero MD5/SHA-1 usage. |

---

### Chapter V12 — Secure Communication (1 / 1)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V12.3.2** | L2 | TLS clients validate server certificates before communicating with TLS servers | Yes | Done | Outbound Google OAuth refreshes use `_verified_requests_session()` (`session.verify = True`); Google API calls use `_build_verified_google_service()` (`httplib2.Http(disable_ssl_certificate_validation=False, timeout=15)`); `backend/mysite/settings.py` asserts `ssl.create_default_context()` enforces `CERT_REQUIRED` and `check_hostname = True` for STARTTLS SMTP (`EMAIL_USE_TLS = True`). Zero `verify=False` or `CERT_NONE` overrides exist. |

---

### Chapter V13 — Configuration (3 / 3)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V13.1.1** | L2 | Document all external application communication needs | Yes | Done | All external services (Google OAuth 2.0, Google Classroom API, MySQL 8.4, Gmail SMTP), transport protocols, and authentication methods are documented in [`SECURITY.md`](SECURITY.md#1-external-services--communication-v1311). |
| **V13.3.1** | L2 | Keep backend secrets out of source code and build artifacts | Yes | Done | Secrets (`DJANGO_SECRET`, `GOOGLE_CLIENT_SECRET`, `DB_PASSWORD`, `EMAIL_HOST_PASSWORD`) are loaded strictly from gitignored `.env` environment variables; `backend/.env.example` contains only `__CHANGE_ME__` placeholders; secret inventory and rotation guidance are documented in [`SECURITY.md`](SECURITY.md#2-secret-management-v1331). |
| **V13.4.3** | L2 | Web servers do not expose directory listings | Yes | Done | Django does not enable directory indexing, no directory-browsing static file handlers are exposed, and `SECURE_CONTENT_TYPE_NOSNIFF = True` prevents MIME sniffing (`SECURITY.md`, `PROJECT_SECURITY_REPORT.md`). |

---

### Chapter V14 — Data Protection (3 / 3)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V14.2.1** | L1 | Do not transmit sensitive data in URL query strings | Yes | Done | Eliminated `?token=...&email=...` from OAuth callback query strings; session tokens are transmitted via `HttpOnly`, `SameSite=Lax` `Set-Cookie` (or `Authorization: Bearer` header for non-browser API clients), `Cache-Control: no-store` is set, and `frontend/src/Login.jsx` immediately strips callback parameters via `window.history.replaceState()`. |
| **V14.2.3** | L2 | Do not send sensitive data to untrusted third parties (e.g., trackers) | Yes | Done | Audited `frontend/package.json` and `frontend/index.html`; zero third-party analytics, telemetry, or advertising SDKs exist. Outbound communication goes exclusively to Google OAuth/Classroom APIs for core features (`SECURITY.md`). |
| **V14.3.1** | L1 | Clear authenticated data from client storage upon session termination | Yes | Done | `POST /api/auth/logout` deletes the auth cookie, returns `Clear-Site-Data: "cookies", "storage"`, and revokes server-side tokens via `token_valid_after`; `frontend/src/utils/api.js` `logout()` always executes `localStorage.clear()` and `sessionStorage.clear()` even if the server request fails. Verified in `backend/core/tests/test_security_v3_v7_v13_v14.py`. |

---

### Chapter V15 — Secure Coding and Architecture (4 / 4)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V15.1.1** | L1 | Document risk-based remediation time frames for third-party component vulnerabilities | Yes | Done | Remediation SLAs (Critical: 7 days, High: 30 days, Medium: 90 days, Low/inventory refresh: 90 days) documented in [`docs/dependency-policy.md`](docs/dependency-policy.md) and encoded in `sbom/inventory.json`. |
| **V15.1.2** | L2 | Maintain an SBOM inventory catalog verifying trusted component repositories | Yes | Done | CycloneDX 1.5 SBOM maintained at [`sbom/inventory.json`](sbom/inventory.json) (`46` Python + npm components), generated via `scripts/generate_sbom.py` and verified via `scripts/check_sbom.py`. Both Dockerfiles pin official registries (`https://pypi.org/simple`, `https://registry.npmjs.org/`). |
| **V15.2.1** | L1 | Ensure application components comply with documented update/review time frames | Yes | Done | Automated gate `python scripts/check_sbom.py` verifies every declared Python and npm package is pinned, sourced from trusted registries, and reviewed within the 90-day policy window (`SBOM OK: 46 components, last_reviewed=2026-11-17`). |
| **V15.3.1** | L1 | Return only the required subset of fields from data objects | Yes | Done | All serializers in `backend/core/serializers.py` declare explicit `fields = (...)` allowlists (zero `fields = "__all__"`). `OAuthAccountSerializer` marks `refresh_token` as `write_only=True`; `GoogleAccount.credentials` is never serialized in any API response; `/api/whoami/` and `/api/classroom/courses` return strictly minimal fields. |

---

### Chapter V16 — Security Logging and Error Handling (3 / 3)

| Req ID | Level | Section & Requirement Summary | Plan | Done | Implementation Evidence & Verification |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **V16.1.1** | L2 | Maintain a logging inventory across stack layers (events, format, storage, access, retention) | Yes | Done | Complete 5-layer logging inventory, UTC ISO-8601 `security_structured` formatter, `RotatingFileHandler` (`backend/logs/security.log`, 5 MB x 5 backups) + `stdout`, log-injection sanitization (`sanitize_log_value`), access control, and 30/90-day retention policies documented in [`SECURITY_LOGGING.md`](SECURITY_LOGGING.md) and configured in `backend/mysite/settings.py`. |
| **V16.3.1** | L2 | Log all authentication operations (successful and unsuccessful) with metadata | Yes | Done | `security.auth` logs `oauth_login_initiated`, `oauth_login_success`, `oauth_callback_failure`, `oauth_callback_error`, `auth_success`, `auth_failure`, `token_validation_failed`, `oauth_token_refreshed`, and `drf_auth_denied` with UTC timestamp, user, auth_type, IP, and path (without logging raw tokens). Verified in `backend/core/tests/test_v16_logging_error_handling.py`. |
| **V16.3.4** | L2 | Log unexpected errors and security control failures (including TLS failures) | Yes | Done | `security.errors` and custom `security_exception_handler` (`backend/core/exceptions.py`) log `csv_import_rejected`, `security_control_denied`, `validation_failure`, `oauth_token_exchange_failed`, `oauth_token_refresh_failed`, `classroom_coursework_fetch_error`, `smtp_send_failed`, and `unhandled_exception` (returning a generic HTTP 500 JSON message without stack traces). Verified in `backend/core/tests/test_v16_logging_error_handling.py`. |

---

## Additional Hardening Controls Implemented (Beyond Initial Plan: +15)

In addition to all 59 planned requirements above, the team implemented and verified **15 extra OWASP ASVS controls** across Chapters V3, V7, V13, and V14 (also recorded in [`asvs_updated_v3_v7_v13_v14.csv`](asvs_updated_v3_v7_v13_v14.csv) and [`PROJECT_SECURITY_REPORT.md`](PROJECT_SECURITY_REPORT.md)):

| Req ID | Level | Control Implemented | Implementation Evidence |
| :--- | :---: | :--- | :--- |
| **V3.3.1** | L1 | `Secure` cookie attribute & `__Secure-` prefix | Auth cookie uses `__Secure-uniplan-auth` with `Secure=True` in production (`DEBUG=0`). |
| **V3.3.2** | L2 | `SameSite` cookie attribute | `AUTH_COOKIE_SAMESITE = "Lax"` enforced on auth and OAuth state cookies. |
| **V3.3.4** | L2 | `HttpOnly` cookie attribute | `AUTH_COOKIE_HTTPONLY = True` prevents client-side JavaScript from reading the session token. |
| **V3.4.1** | L1 | HTTP Strict Transport Security (HSTS) | `Strict-Transport-Security: max-age=31536000; includeSubDomains` set via `SecurityHeadersMiddleware` & `SECURE_HSTS_SECONDS`. |
| **V3.4.2** | L1 | Explicit CORS `Access-Control-Allow-Origin` allowlist | `CORS_ALLOWED_ORIGINS` restricts origins to `127.0.0.1:5173` and `localhost:5173`; wildcard `*` disallowed. |
| **V3.4.4** | L2 | `X-Content-Type-Options: nosniff` | Enforced on all HTTP responses via `SecurityHeadersMiddleware` and `SECURE_CONTENT_TYPE_NOSNIFF = True`. |
| **V3.4.5** | L2 | `Referrer-Policy` header | `Referrer-Policy: strict-origin-when-cross-origin` enforced on all responses. |
| **V3.4.6** | L2 | CSP `frame-ancestors` clickjacking defense | `Content-Security-Policy: frame-ancestors 'self'; object-src 'none'; base-uri 'self'` enforced on all responses. |
| **V3.4.8** | L3 | `Cross-Origin-Opener-Policy` (COOP) | `Cross-Origin-Opener-Policy: same-origin` isolates top-level browsing context against tabnabbing. |
| **V7.2.3** | L1 | CSPRNG token entropy >= 128 bits | `jti` generated with `secrets.token_urlsafe(24)` providing **192 bits** of cryptographic entropy. |
| **V7.4.4** | L2 | Accessible logout on authenticated pages | Prominent logout button exposed in authenticated navigation header calling `logout()`. |
| **V13.4.1** | L1 | Source control metadata (`.git`) excluded | `.dockerignore` excludes `.git` from Docker build contexts and Django does not serve VCS metadata. |
| **V13.4.2** | L2 | Debug mode disabled by default in production | `DEBUG` defaults to `"0"` (`False`) via `os.getenv("DEBUG", "0")` in `backend/mysite/settings.py`. |
| **V13.4.6** | L3 | Backend version header masking | `SecurityHeadersMiddleware` sets `Server: UniPlan` and blanks `X-Powered-By`. |
| **V14.1.1** | L2 | Sensitive data classification | High / Medium / Low sensitivity classification documented in [`SECURITY.md`](SECURITY.md#3-data-protection-classification-v1411--v1423). |

---

## Automated Verification Suites

| Test / Verification Suite | Coverage |
| :--- | :--- |
| `backend/core/tests/test_v1_encoding_sanitization.py` | ASVS V1.2.1–V1.2.4 (JSON/JS injection encoding, URL validation, ORM SQLi protection) |
| `backend/core/tests/test_v2_validation_rules.py` | ASVS V2.2.1–V2.2.2 (color hex, time ranges, timetable overlaps, CSV import guards) |
| `backend/core/tests/test_security_v3_v7_v13_v14.py` | ASVS V3, V7, V13, V14 (security headers, Sec-Fetch blocks, token entropy & revocation, logout `Clear-Site-Data`) |
| `backend/core/tests/test_v16_logging_error_handling.py` | ASVS V16.3.1, V16.3.4 (auth/error structured logging, log sanitization, generic 500 handler) |
| `scripts/check_sbom.py` | ASVS V15.1.2, V15.2.1 (SBOM completeness, trusted registries, 90-day review freshness) |

```bash
# Run SBOM compliance check
python scripts/check_sbom.py

# Run backend security test suites (with pytest & pytest-django installed)
cd backend && pytest -v
```
