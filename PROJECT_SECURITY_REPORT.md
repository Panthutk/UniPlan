# Project Security Report — 01219325 Software Development Security

## 1. Application Information & Team Members

- **Application Name:** UniPlanPlus (UniPlan)
- **Repository:** [https://github.com/Sorasit-Kateratorn/UniPlanPlus](https://github.com/Sorasit-Kateratorn/UniPlanPlus)
- **Course:** 01219325 Software Development Security (Academic Year 2026)
- **Security Standards:** OWASP ASVS v5.0 & OWASP Top 10 (2021)

### Team Members

| No. | Student ID | Full Name | Primary Focus Areas |
| :---: | :---: | :--- | :--- |
| 1 | `6410546262` | **Vorakorn Leechavanan** | Authorization (V8), Self-contained Tokens (V9), SBOM & Dependency Security (V15), Architecture |
| 2 | `6610545774` | **Jongchana Khachatrokphai** | Encoding & Sanitization (V1), Input Validation (V2), Security Logging & Error Handling (V16), Testing |
| 3 | `6610545421` | **Panthut Ketphan** | File Handling (V5), Authentication (V6), OAuth 2.0 & OIDC (V10), Cryptography (V11), TLS (V12), Deployment |
| 4 | `6610545944` | **Sorasit Kateratorn** | Web Frontend Security (V3), Session Management (V7), Configuration (V13), Data Protection (V14), Testing |

---

## 2. Functional Overview

UniPlanPlus is an integrated academic timetable and task management web platform for university students built with **React 18 + Vite**, **Django 5.2 + Django REST Framework (DRF)**, **MySQL 8.4**, and **Docker Compose**:

1. **Interactive Weekly Timetable:** Create, edit, color-code, and manage classes with conflict/overlap prevention (`TimetableEntryViewSet`, `SubjectViewSet`).
2. **Timetable CSV Import & Export:** Bulk upload and download schedules with strict extension, MIME, size, UTF-8, schema, and CSV formula-injection protections.
3. **Subject-Linked Task Tracking:** Create, prioritize, update status (`NOT_STARTED`, `IN_PROCESS`, `COMPLETED`), and archive/unarchive tasks linked to timetable subjects (`TaskViewSet`).
4. **Google Classroom Sync:** Authenticate via Google OAuth 2.0 (SSO) and synchronize active courses, coursework, and student submissions using read-only scopes.
5. **Automated Due-Date Reminders:** Background worker (`send_reminders --loop`) sends scheduled reminders (`1`, `3`, or `7` days before deadlines) via SMTP over STARTTLS or console backend.

---

## 3. Implementation Phase Security Controls (Rubric Items 4–13)

### Item 4 — Password Authentication

- **End-User Authentication (Federated SSO Only):** UniPlanPlus delegates end-user authentication exclusively to **Google OAuth 2.0**. No local student passwords, password hints, or knowledge-based security questions are stored or accepted (`V6.4.2`). No default accounts (`root`, `admin`, `sa`) are seeded (`V6.3.2`).
- **Administrator Password Hashing:** For optional Django Admin superuser accounts created via `manage.py createsuperuser`, `backend/mysite/settings.py` explicitly enforces `PASSWORD_HASHERS = ["django.contrib.auth.hashers.PBKDF2PasswordHasher"]` (PBKDF2-HMAC-SHA256, 256-bit hash output, `V11.4.3`).

### Item 5 — Social SSO with OAuth 2.0 / OpenID Connect

Implemented in `backend/core/views.py` (`google_login`, `google_callback`) and documented in [OAuth2Setup.md](OAuth2Setup.md):

- **OIDC & Least-Privilege Scopes (`V10.4.11`):** Requests only `openid`, `userinfo.email`, `userinfo.profile`, `classroom.courses.readonly`, `classroom.student-submissions.me.readonly`, and `classroom.coursework.me.readonly` (no Classroom write scopes).
- **OAuth CSRF & Transaction Binding (`V10.1.2`, `V10.2.1`):** `/api/auth/google/login` generates a 256-bit CSPRNG `state` (`secrets.token_urlsafe(32)`), signs it inside an `HttpOnly`, `SameSite=Lax` cookie (`oauth_state`, `max_age=600`), and `/api/auth/google/callback` verifies both the cookie signature and constant-time equality (`secrets.compare_digest()`) before calling `flow.fetch_token()`.
- **Confidential Client & BFF Token Isolation (`V10.1.1`, `V10.4.10`):** `_client_config()` requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for backchannel exchanges over verified TLS (`_build_verified_google_service`, `_verified_requests_session`). Google `access_token` and `refresh_token` are stored exclusively server-side in `GoogleAccount.credentials` and never returned to the browser.
- **Explicit Consent (`V10.7.1`):** Passes `prompt="consent"` on authorization requests.

### Item 6 — Authorization (Function-Level & Role-Based)

Implemented in `backend/core/authorization.py`, configured globally in `backend/mysite/settings.py`, and specified in [docs/authorization.md](docs/authorization.md):

- **Deny-by-Default Global Stack (`V8.2.1`, `V8.3.1`):** `REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"]` enforces `[IsAuthenticated, EnforcesDeclaredFunctionPermission, OwnsObject]` at the trusted Django service layer. Any endpoint without an explicit permission declaration is denied by default (`403 Forbidden`).
- **Granular Function Permission Catalog (`FunctionGrant`):** Defines 15 explicit permissions (`account.read`, `subjects.read/write`, `timetable.read/write`, `tasks.read/write`, `reminders.read/write`, `classroom.read/write`, `oauth.read/write`, `email.send`, and privileged `debug.read`).
- **Consumer vs. Privileged Separation:** Standard users automatically receive non-debug permissions on first Google sign-in via `ensure_consumer_grants(user)`. Diagnostic endpoint `/api/echo-auth/` requires `debug.read` (excluded from default grants). Administrators can grant or revoke individual `FunctionGrant` rows in Django Admin; superusers bypass function grants while remaining subject to object ownership checks on API endpoints.

### Item 7 — Access Control (IDOR / BOLA Prevention)

Implemented across `backend/core/views.py`, `backend/core/authorization.py`, and `backend/core/serializers.py` (`V8.2.2`, `V8.3.1`):

- **Per-User Queryset Isolation:** Every ViewSet (`SubjectViewSet`, `TimetableEntryViewSet`, `TaskViewSet`, `ReminderViewSet`, `ClassroomCourseViewSet`, `ClassroomAssignmentViewSet`, `OAuthAccountViewSet`) scopes `get_queryset()` strictly to `request.user` (`user`, `task__user`, or `classroom_course__user`).
- **Object-Level Ownership Enforcement:** `OwnsObject` verifies object ownership on retrieve/update/delete operations, denying cross-user access even if an attacker guesses another user's primary key.
- **Related Foreign-Key Validation:** `require_owned_item()` validates related IDs on writes (`TimetableEntrySerializer.validate_subject`, `TaskSerializer.validate_subject`, `ReminderSerializer.validate`, `ClassroomAssignmentSerializer.validate_classroom_course` / `validate_task`), preventing cross-tenant object linking. Create actions always assign `user=self.request.user` server-side.

### Item 8 — Input Validation & SQL / ORM Injection Protection

Specified in [VALIDATION_RULES.md](VALIDATION_RULES.md) and verified by `backend/core/tests/test_v1_encoding_sanitization.py` and `backend/core/tests/test_v2_validation_rules.py`:

- **Server-Side Input Validation (`V2.1.1`, `V2.2.1`, `V2.2.2`):** DRF serializers enforce strict allowlists and patterns:
  - Hex color validation (`HEX_RE = ^#[0-9A-Fa-f]{6}$`)
  - 24-hour clock validation (`TIME_RE = ^\d{2}:\d{2}(:\d{2})?$`), chronological ordering (`start_time < end_time`), and per-user/day overlap detection in `TimetableEntrySerializer`
  - Enum allowlists (`DayOfWeek`, `TaskStatus`, `Priority`, `ReminderChannel`) and `http://`/`https://` URL scheme validation (`TaskSerializer.validate_assignment_alt_link`, `safeExternalUrl()`)
  - Timetable CSV import (`import_csv()`): `.csv` extension only, MIME allowlist (`text/csv`, `application/csv`, `application/vnd.ms-excel`), 1 MB limit (`MAX_BYTES = 1_000_000`), UTF-8 verification, pre-write atomic validation of all rows, and CSV formula-injection sanitization (`=`, `+`, `-`, `@`, `\t`, `\r`) on both import and export.
- **SQL & ORM Injection Protection (`V1.2.4`):** All database operations exclusively use parameterized Django ORM queries (`filter()`, `exclude()`, `get_or_create()`, `update_or_create()`, `create()`). Zero `.raw()`, `.extra()`, `cursor.execute()`, or `RawSQL` calls exist anywhere in the codebase.
- **Output Encoding & Code Execution Safety (`V1.2.1`–`V1.2.5`, `V1.3.2`):** DRF `JSONRenderer` and `JSON.stringify()` prevent JSON/JS injection; React JSX auto-escapes rendered text with zero `dangerouslySetInnerHTML`; zero `eval()`, `exec()`, `os.system()`, or `subprocess` calls exist.

### Item 9 — Environment Variables & Credentials Management

Documented in [SECURITY.md](SECURITY.md) and [INSTALLATION.md](INSTALLATION.md) (`V13.3.1`, `V13.4.1`):

- **Secret Isolation:** `DJANGO_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DB_PASSWORD`, and `EMAIL_HOST_PASSWORD` are loaded via `python-dotenv` from `backend/.env` (gitignored; never committed).
- **Safe Templates:** [backend/.env.example](backend/.env.example) provides only `__CHANGE_ME__` placeholder values.
- **Build & Metadata Hygiene:** `.dockerignore` excludes `.git` and local secrets from Docker image build contexts.

### Item 10 — Proper CORS Configuration

Configured in `backend/mysite/settings.py` (`V3.4.2`, `V3.5.2`):

- Uses `django-cors-headers` with an explicit allowlist:
  ```python
  CORS_ALLOWED_ORIGINS = [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
  ]
  CORS_ALLOW_CREDENTIALS = True
  ```
- Wildcard `*` is explicitly disallowed.

### Item 11 — Error Handling

Implemented in `backend/core/exceptions.py` and `backend/mysite/settings.py` (`V13.4.2`, `V16.3.4`):

- **Custom Exception Handler:** `REST_FRAMEWORK["EXCEPTION_HANDLER"] = "core.exceptions.security_exception_handler"` catches unexpected exceptions, logs the full stack trace internally to `security.errors`, and returns a generic `{"detail": "An unexpected server error occurred."}` (`HTTP 500`) to clients without exposing internal traces or secrets.
- **Production Debug Guard:** `DEBUG` is evaluated from `os.getenv("DEBUG", "0")` so production defaults to `DEBUG = False`.
- **Safe Failure Modes:** Invalid/expired/tampered tokens fail closed with `401 Unauthorized`; missing grants or ownership mismatches return `403 Forbidden`; invalid CSV imports abort prior to any database modification.

### Item 12 — Security Logging

Configured in `backend/mysite/settings.py`, implemented in `backend/core/auth.py`, `backend/core/views.py`, and `backend/core/exceptions.py`, and documented in [SECURITY_LOGGING.md](SECURITY_LOGGING.md) (`V16.1.1`, `V16.3.1`, `V16.3.4`):

- **Structured UTC Format:** `{asctime} [{levelname}] logger={name} module={module} pid={process} {message}` in ISO-8601 UTC (`%Y-%m-%dT%H:%M:%SZ`).
- **Dedicated Security Loggers & Rotation:** `security`, `security.auth`, and `security.errors` write to both `stdout` and `backend/logs/security.log` (`RotatingFileHandler`, 5 MB x 5 backups).
- **Logged Events:** OAuth login initiation/success/failure/rate-limit, token verification success/failure/revocation, token refresh, DRF auth/permission/validation denials, CSV import rejections, Classroom/SMTP/TLS failures, and unhandled exceptions.
- **Log Protection:** Dynamic fields are passed through `sanitize_log_value()` to escape `\r`/`\n` (log injection defense); raw bearer tokens, OAuth secrets, and passwords are never logged.

### Item 13 — HTTP Security Headers

Explicitly implemented in code via `SecurityHeadersMiddleware` and `SecFetchValidationMiddleware` in `backend/core/middleware.py`, plus `backend/mysite/settings.py` and `logout_view` in `backend/core/views.py`:

| Header | Configured Value | Purpose / ASVS |
| :--- | :--- | :--- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforce HTTPS (V3.4.1) |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing (V3.4.4) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Prevent URL/query leakage (V3.4.5) |
| `Content-Security-Policy` | `frame-ancestors 'self'; object-src 'none'; base-uri 'self'` | Clickjacking & object/base defense (V3.4.6) |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolate browsing context / anti-tabnabbing (V3.4.8) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disable unused browser APIs |
| `Server` / `X-Powered-By` | `Server: UniPlan`, `X-Powered-By` cleared | Mask backend version info (V13.4.6) |
| `Clear-Site-Data` | `"cookies", "storage"` *(on `POST /api/auth/logout`)* | Purge client storage on logout (V14.3.1) |
| `Cache-Control` | `no-store` *(on OAuth & CSV export responses)* | Prevent sensitive response caching (V14.3.2) |
| `Sec-Fetch-Dest` enforcement | Blocks `Sec-Fetch-Dest: document` on `/api/*` (`403`) | Prevent direct browser rendering of APIs (V3.2.1) |

> **Presentation / Verification Note:** Because these headers are set explicitly in application middleware (`backend/core/middleware.py`), they can be demonstrated directly in code, verified via `backend/core/tests/test_security_v3_v7_v13_v14.py` (`SecurityHeadersTests`), and inspected live in browser DevTools Network tab during presentation.

---

## 4. Security Testing & Tool Analysis (Rubric Items 14–15)

### Automated Security Unit & Integration Tests (Implemented)

| Suite | File | Verified Controls |
| :--- | :--- | :--- |
| Encoding & Injection | `backend/core/tests/test_v1_encoding_sanitization.py` | JSON/JS output encoding, URL scheme validation, ORM SQLi protection |
| Input Validation | `backend/core/tests/test_v2_validation_rules.py` | Hex color, time ranges, timetable overlaps, CSV import security guards |
| Frontend, Session & Data | `backend/core/tests/test_security_v3_v7_v13_v14.py` | Security headers, `Sec-Fetch` blocking, JWT entropy & revocation, logout `Clear-Site-Data` |
| Logging & Error Handling | `backend/core/tests/test_v16_logging_error_handling.py` | Auth/error structured logging, log sanitization, generic HTTP 500 responses |
| SBOM & Registry Gate | `scripts/check_sbom.py` | CycloneDX 1.5 SBOM completeness (`46` components), trusted registries, 90-day review freshness |

### Item 14 — Static Application Security Testing (SAST) Report

- **Status:** `[Pending]` — To be populated once SAST scan results (e.g., CodeQL / Semgrep / SonarQube) are completed and attached.
- **Placeholder for Findings & Remediation Summary:**
  - *Tool Used:* TBD
  - *Scan Date & Scope:* TBD
  - *Summary of Findings & Fixes:* TBD

### Item 15 — Dynamic Application Security Testing (DAST) Report

- **Status:** `[Pending]` — To be populated once OWASP ZAP DAST scan results are completed and attached.
- **Placeholder for Findings & Remediation Summary:**
  - *Tool Used:* OWASP ZAP (TBD)
  - *Target Endpoints & Scan Date:* TBD
  - *Summary of Alerts & Remediation:* TBD

---

## 5. Threat Modeling Mitigation Checklist (Rubric Item 16)

STRIDE threat model mapped directly to current implementation status, distinguishing **Done** controls from **Not Done / Deferred for Production Deployment**:

| STRIDE Category | Threat Scenario | Asset | Mitigation / Prevention Designed | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Spoofing** | Forging or replaying session tokens to impersonate a student | User session | HMAC-SHA256 signed JWTs (`HS256` allowlist only), 192-bit CSPRNG `jti`, forbidden header rejection (`jku`/`x5u`/`jwk`), server-side `SignedTokenAuthentication` | **Done** | `backend/core/tokens.py`, `backend/core/auth.py` |
| **Spoofing** | OAuth login CSRF forcing victim into attacker's Google session | OAuth flow | 256-bit CSPRNG `state` bound to signed `HttpOnly` `SameSite=Lax` cookie (`oauth_state`), verified via `secrets.compare_digest()` | **Done** | `backend/core/views.py` (`google_login`, `google_callback`) |
| **Tampering** | Modifying or reading another student's tasks, subjects, timetable, or reminders (IDOR/BOLA) | MySQL user records | Per-user `get_queryset()` filtering, `OwnsObject` permission, and `require_owned_item()` FK checks | **Done** | `backend/core/authorization.py`, `backend/core/views.py`, `backend/core/serializers.py` |
| **Tampering** | SQL injection or CSV formula injection via user inputs or uploaded CSV files | Database & exported spreadsheets | Exclusive Django ORM parameterized queries; strip/prefix leading `=`, `+`, `-`, `@`, `\t`, `\r` on CSV import/export | **Done** | `backend/core/views.py`, `test_v1_encoding_sanitization.py` |
| **Repudiation** | Unaudited authentication attempts, permission denials, or security failures | Audit trail | Structured UTC logging (`security.auth`, `security.errors`) to rotating `backend/logs/security.log` + `stdout` with CR/LF escaping | **Done** | `backend/mysite/settings.py`, `backend/core/exceptions.py`, [SECURITY_LOGGING.md](SECURITY_LOGGING.md) |
| **Information Disclosure** | Session token leaked via URL query strings, browser history, Referer headers, or JS XSS | Session token & user profile | `HttpOnly`, `SameSite=Lax` cookie (`__Secure-` in prod), `Cache-Control: no-store`, `window.history.replaceState()`, `Referrer-Policy`, `Clear-Site-Data` on logout | **Done** | `backend/core/views.py`, `backend/core/middleware.py`, `frontend/src/Login.jsx`, `frontend/src/utils/api.js` |
| **Information Disclosure** | Stack traces, internal versions, or secrets leaked via responses or VCS | Backend internals & credentials | Custom `security_exception_handler` generic 500, `DEBUG=0` default, masked `Server: UniPlan`, gitignored `.env`, `.dockerignore` excluding `.git` | **Done** | `backend/core/exceptions.py`, `backend/core/middleware.py`, `backend/mysite/settings.py` |
| **Denial of Service** | Brute-force / automated flooding of OAuth or REST API endpoints | Backend availability | Per-IP OAuth rate limit (`15/60s`, HTTP `429`) + DRF `AnonRateThrottle` (`20/min`) & `UserRateThrottle` (`120/min`) | **Done** | `backend/core/views.py`, `backend/mysite/settings.py` |
| **Denial of Service** | Oversized or malformed CSV uploads exhausting memory | Server RAM & CPU | 1 MB hard size cap (`MAX_BYTES = 1_000_000`), `.csv` & MIME allowlist, in-memory validation before DB write | **Done** | `backend/core/views.py` (`import_csv`) |
| **Elevation of Privilege** | Calling restricted/diagnostic endpoints or rendering APIs directly in browser | Backend APIs & admin functions | Deny-by-default `FunctionGrant` permissions (`debug.read` excluded from default users) + `SecFetchValidationMiddleware` blocking `Sec-Fetch-Dest: document` on `/api/*` | **Done** | `backend/core/authorization.py`, `backend/core/middleware.py` |
| **Information Disclosure / Tampering** | Eavesdropping on local HTTP traffic or DB credentials at rest in production | Transport & stored OAuth tokens | Production HTTPS reverse proxy (TLS termination for browser-to-app traffic) & dedicated external secrets vault / column-level encryption for `GoogleAccount.credentials` | **Not Done (Prod-Deferred)** | Local Docker Compose runs over `http://127.0.0.1` for dev; outbound Google/SMTP calls strictly verify TLS (`V12.3.2`). Production deployment requires HTTPS reverse proxy & KMS/Vault (documented in [SECURITY.md](SECURITY.md)). |
| **Denial of Service / Malware** | Antivirus scanning of uploaded files | File upload pipeline | Dedicated antivirus scanner (e.g., ClamAV) | **Not Done (Out of Scope)** | Mitigated by accepting strictly UTF-8 `.csv` text files <= 1 MB parsed purely in-memory without saving or executing files. |

---

## 6. OWASP ASVS v5.0 & OWASP Top 10 Mapping (Rubric Item 17)

### 6.1 OWASP ASVS v5.0 Coverage Summary

All **59 / 59 planned requirements (100%)** across **15 active ASVS chapters** are implemented and documented in full in [ASVS_COMPLIANCE.md](ASVS_COMPLIANCE.md):

| Chapters | Planned | Done | Supporting Documentation |
| :--- | :---: | :---: | :--- |
| **V1** Encoding & Sanitization | 6 | 6 / 6 | [ASVS_COMPLIANCE.md](ASVS_COMPLIANCE.md), `test_v1_encoding_sanitization.py` |
| **V2** Validation & Business Logic | 4 | 4 / 4 | [VALIDATION_RULES.md](VALIDATION_RULES.md), `test_v2_validation_rules.py` |
| **V3** Web Frontend Security | 5 | 5 / 5 | [SECURITY.md](SECURITY.md), `test_security_v3_v7_v13_v14.py` |
| **V5** File Handling | 5 | 5 / 5 | [README.md](README.md#file-handling--security-policy-owasp-asvs-v5), [VALIDATION_RULES.md](VALIDATION_RULES.md) |
| **V6** Authentication | 4 | 4 / 4 | [README.md](README.md#authentication--anti-automation-policy-owasp-asvs-v6) |
| **V7** Session Management | 5 | 5 / 5 | [SECURITY.md](SECURITY.md), `test_security_v3_v7_v13_v14.py` |
| **V8** Authorization | 4 | 4 / 4 | [docs/authorization.md](docs/authorization.md) |
| **V9** Self-contained Tokens | 4 | 4 / 4 | [docs/authorization.md](docs/authorization.md#session-tokens), `core/tokens.py` |
| **V10** OAuth & OIDC | 6 | 6 / 6 | [README.md](README.md#oauth-20--oidc-security-policy-owasp-asvs-v10), [OAuth2Setup.md](OAuth2Setup.md) |
| **V11** Cryptography | 2 | 2 / 2 | [README.md](README.md#cryptography--data-integrity-policy-owasp-asvs-v11) |
| **V12** Secure Communication | 1 | 1 / 1 | [README.md](README.md#secure-communications--tls-certificate-validation-owasp-asvs-v12) |
| **V13** Configuration | 3 | 3 / 3 | [SECURITY.md](SECURITY.md) |
| **V14** Data Protection | 3 | 3 / 3 | [SECURITY.md](SECURITY.md) |
| **V15** Secure Coding & Architecture | 4 | 4 / 4 | [docs/dependency-policy.md](docs/dependency-policy.md), `sbom/inventory.json` |
| **V16** Security Logging & Error Handling | 3 | 3 / 3 | [SECURITY_LOGGING.md](SECURITY_LOGGING.md), `test_v16_logging_error_handling.py` |
| **Total** | **59** | **59 / 59 (100%)** | **All Planned Controls Verified** |

### 6.2 OWASP Top 10 (2021) Mapping

| OWASP Top 10 (2021) Category | Related ASVS Chapters | Implementation in UniPlanPlus |
| :--- | :--- | :--- |
| **A01:2021 — Broken Access Control** | V3, V8, V10 | Deny-by-default `FunctionGrant` permissions (`EnforcesDeclaredFunctionPermission`), strict per-user queryset scoping, `OwnsObject`, `require_owned_item()` FK checks, explicit `CORS_ALLOWED_ORIGINS`, `SecFetchValidationMiddleware`, OAuth `state` CSRF validation. |
| **A02:2021 — Cryptographic Failures** | V7, V9, V11, V12, V14 | Industry-standard `PyJWT` `HS256` & `PBKDF2-HMAC-SHA256` (zero MD5/SHA-1), 192-bit CSPRNG `jti`, mandatory TLS certificate & hostname verification on outbound Google API/OAuth/SMTP connections, `HttpOnly`/`SameSite=Lax`/`__Secure-` cookies, no tokens in URL query strings. |
| **A03:2021 — Injection** | V1, V2, V5 | Exclusive parameterized Django ORM queries (zero raw SQL), DRF `JSONRenderer` & `JSON.stringify()`, React JSX auto-escaping (zero `dangerouslySetInnerHTML`), `http`/`https` URL allowlist, CSV formula-injection neutralization, zero `eval`/`subprocess`, log CR/LF escaping. |
| **A04:2021 — Insecure Design** | V2, V6, V10, V15 | Backend-for-Frontend (BFF) OAuth architecture keeping Google tokens server-side, sequential OAuth state binding, explicit serializer field allowlists (preventing mass assignment/over-exposure), timetable overlap checks, and STRIDE threat modeling. |
| **A05:2021 — Security Misconfiguration** | V3, V13 | Hardened HTTP security headers (`HSTS`, `CSP`, `nosniff`, `Referrer-Policy`, `COOP`, `Permissions-Policy`), masked `Server` header, `DEBUG=0` default, directory listings disabled, `.dockerignore` excluding `.git`, gitignored `.env` secrets. |
| **A06:2021 — Vulnerable and Outdated Components** | V15 | CycloneDX 1.5 SBOM (`sbom/inventory.json`, 46 pinned components), official trusted registries enforced in Dockerfiles (`pypi.org`, `registry.npmjs.org`), documented remediation SLAs (`docs/dependency-policy.md`), automated gate (`scripts/check_sbom.py`). |
| **A07:2021 — Identification and Authentication Failures** | V6, V7, V9, V10 | Federated Google OAuth 2.0 SSO (no default accounts, no weak local passwords/secret questions), per-IP OAuth rate limiting (`15/60s`), strict `HS256` JWT validation (`nbf`/`exp`/`iat`, no `none`/header key injection), 8h expiry, immediate logout revocation via `token_valid_after` + `Clear-Site-Data`. |
| **A08:2021 — Software and Data Integrity Failures** | V9, V11, V15 | Cryptographic HMAC-SHA256 verification before reading any token payload, lockfile-based `npm ci` and pinned Python versions from trusted registries verified by `scripts/check_sbom.py`. |
| **A09:2021 — Security Logging and Monitoring Failures** | V16 | 5-layer structured UTC logging (`backend/logs/security.log` rotating 5 MB x 5 + `stdout`), dedicated `security.auth` & `security.errors` loggers capturing auth attempts, denials, CSV rejections, TLS/SMTP failures, and unhandled exceptions. |
| **A10:2021 — Server-Side Request Forgery (SSRF)** | V1, V12 | No server-side fetching of user-supplied URLs; backend outbound calls communicate exclusively with hardcoded Google OAuth/Classroom endpoints and configured SMTP host over verified TLS; user link fields (`assignment_alt_link`) are strictly validated to `http`/`https` for client-side display only. |

---

## 7. Four Advanced (Self-Studied) Security Features (Rubric Item 18)

From the rubric's advanced security feature options, UniPlanPlus implements the following **4 primary features** (plus **Login timeout** as an additional implemented control):

### 1. Authorization Process with Scope
- **OAuth 2.0 Scope Enforcement:** `backend/core/views.py` requests minimal read-only Google Classroom & OIDC scopes (`openid`, `userinfo.email`, `userinfo.profile`, `classroom.courses.readonly`, `classroom.student-submissions.me.readonly`, `classroom.coursework.me.readonly`) and prompts explicit user consent (`prompt="consent"`).
- **Application-Level Function Scopes:** `backend/core/authorization.py` implements 15 granular permission scopes stored in `FunctionGrant` (`subjects.read/write`, `timetable.read/write`, `tasks.read/write`, `reminders.read/write`, `classroom.read/write`, `oauth.read/write`, `account.read`, `email.send`, `debug.read`), enforced globally on every DRF view with deny-by-default semantics.

### 2. Rate Limit for Login Attempt
- Implemented via `_check_auth_rate_limit()` in `backend/core/views.py` on both `/api/auth/google/login` and `/api/auth/google/callback`.
- Enforces a per-IP sliding window of **15 requests per 60 seconds**, returning `HTTP 429 Too Many Requests` and logging `event=oauth_login_rate_limited` / `event=oauth_callback_rate_limited` without permanently locking out legitimate user accounts.

### 3. Rate Limit for Backend APIs
- Configured globally in `REST_FRAMEWORK` (`backend/mysite/settings.py`) using DRF's throttling classes:
  - `AnonRateThrottle`: **20 requests/minute** per unauthenticated client IP.
  - `UserRateThrottle`: **120 requests/minute** per authenticated user.
- Throttled requests are logged via `security_exception_handler` (`event=security_control_denied`).

### 4. JWT Expiration Checking and Management
- Implemented in `backend/core/tokens.py`, `backend/core/auth.py`, and `backend/core/views.py` (`logout_view`):
  - Issues self-contained `PyJWT` `HS256` tokens containing `sub`, `iat`, `nbf`, `exp` (8-hour lifetime), and a 192-bit CSPRNG `jti`.
  - Rejects disallowed algorithms (`none`, asymmetric confusion) and forbidden key-injection headers (`jku`, `x5u`, `jwk`, `x5c`, `x5t`).
  - Enforces strict `nbf`/`exp`/`iat` time-window validation on every request.
  - Supports immediate server-side token revocation via `GoogleAccount.token_valid_after`: `POST /api/auth/logout` updates `token_valid_after = timezone.now()`, immediately invalidating all previously issued JWTs, deletes the `HttpOnly` auth cookie, and sends `Clear-Site-Data: "cookies", "storage"`.

*(Additional rubric option implemented: **Login timeout** — 8-hour absolute session token & cookie timeout (`TOKEN_LIFETIME = timedelta(hours=8)`, `AUTH_COOKIE_MAX_AGE = 28800`) plus 10-minute OAuth login transaction state timeout (`max_age=600`).)*

---

## 8. Grading Criteria Checklist (Rubric Items 4–18)

| No. | Criteria | Implementation Summary | Status |
| :---: | :--- | :--- | :---: |
| 4 | Password Authentication | Federated Google OAuth 2.0 for users; `PBKDF2PasswordHasher` (SHA-256) for Django Admin | Complete |
| 5 | Social SSO with OAuth / OpenID | Google OAuth 2.0 + OIDC with signed `oauth_state` CSRF cookie, confidential client, `prompt="consent"` | Complete |
| 6 | Authorization (Role / Function) | Deny-by-default `FunctionGrant` (15 permissions), `EnforcesDeclaredFunctionPermission`, `debug.read` separation | Complete |
| 7 | Access Control (IDOR / Data Isolation) | Per-user `get_queryset()`, `OwnsObject`, and `require_owned_item()` FK checks | Complete |
| 8 | Input Validation & SQLi / ORM Protection | Server-side DRF serializers (`HEX_RE`, `TIME_RE`, overlaps, CSV guards) + 100% parameterized Django ORM | Complete |
| 9 | Environment Variables & Credentials | Gitignored `.env`, `.env.example` placeholders, `python-dotenv`, `.dockerignore` excluding `.git` | Complete |
| 10 | CORS Properly Configured | Explicit `CORS_ALLOWED_ORIGINS` allowlist (`127.0.0.1:5173`, `localhost:5173`), no `*` | Complete |
| 11 | Error Handling | Custom `security_exception_handler` generic HTTP 500 JSON, `DEBUG=0` default | Complete |
| 12 | Logging | Structured UTC logging (`security.auth`, `security.errors`) to rotating `security.log` + `stdout` | Complete |
| 13 | HTTP Security Headers | `SecurityHeadersMiddleware` (HSTS, nosniff, CSP, Referrer-Policy, COOP, masked Server) + `SecFetchValidationMiddleware` | Complete |
| 14 | SAST Tool Analysis & Report | *To be completed and attached by team* | **Pending** |
| 15 | DAST Tool Analysis & Report | *To be completed and attached by team* | **Pending** |
| 16 | Threat Model Implementation Mapping | STRIDE checklist mapping Done vs. Not Done (Prod-Deferred) mitigations in Section 5 | Complete |
| 17 | Mapping to OWASP ASVS & Top 10 | 59/59 Planned ASVS v5.0 controls ([ASVS_COMPLIANCE.md](ASVS_COMPLIANCE.md)) + full OWASP Top 10 (2021) table | Complete |
| 18 | 4 Advanced Security Features | (1) Authorization with scope, (2) Login attempt rate limit, (3) Backend API rate limit, (4) JWT expiration & management *(+ Login timeout)* | Complete |

---

## 9. Installation, Running & Verification

1. Complete the required Google OAuth 2.0 setup in **[OAuth2Setup.md](OAuth2Setup.md)** and optional email setup in **[EmailSetup.md](EmailSetup.md)**.
2. Follow **[INSTALLATION.md](INSTALLATION.md)** (or the Quick Start in **[README.md](README.md)**) to configure `backend/.env` and `frontend/.env` and launch with:
   ```bash
   docker compose up -d --build
   ```
3. Run automated verification checks:
   ```bash
   python scripts/check_sbom.py
   cd backend && pytest -v
   ```
