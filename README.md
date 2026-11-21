# UniPlanPlus (UniPlan)

[![OWASP ASVS v5.0](https://img.shields.io/badge/OWASP_ASVS_v5.0-59%2F59_Planned_Done-2ea44f)](#security--owasp-asvs-v50-compliance)
[![React + Vite](https://img.shields.io/badge/Frontend-React_18_%2B_Vite-61dafb?logo=react&logoColor=black)](#tech-stack)
[![Django DRF](https://img.shields.io/badge/Backend-Django_5.2_%2B_DRF-092e20?logo=django&logoColor=white)](#tech-stack)
[![MySQL 8.4](https://img.shields.io/badge/Database-MySQL_8.4-4479a1?logo=mysql&logoColor=white)](#tech-stack)
[![Docker Compose](https://img.shields.io/badge/Deployment-Docker_Compose-2496ed?logo=docker&logoColor=white)](#installation--running)

An **all-in-one academic timetable and task management web application** for university students that unifies class schedules, assignment deadlines, automated email reminders, and **Google Classroom** synchronization — hardened against **OWASP ASVS v5.0**.

---

## Overview

### Background & Objective

University students typically juggle separate tools for weekly class timetables and assignment trackers, forcing manual coordination between classes and homework deadlines. **UniPlanPlus** eliminates that gap by integrating weekly schedules, subject-linked tasks, due-date reminders, and Google Classroom assignments inside one unified interface.

### Key Features

- **Interactive Weekly Timetable:** Create, edit, color-code, and manage classes with built-in schedule overlap detection.
- **CSV Timetable Import & Export:** Bulk import/export schedules with strict file-type, size, UTF-8, and CSV formula-injection protections.
- **Subject-Linked Task Tracking:** Create, prioritize (`none`, `low`, `normal`, `high`), update status (`NOT_STARTED`, `IN_PROCESS`, `COMPLETED`), and archive/unarchive tasks directly from timetable classes.
- **Google Classroom Sync:** Sign in via Google OAuth 2.0 (SSO) and synchronize courses, coursework, and student submissions automatically using read-only scopes.
- **Automated Due-Date Reminders:** Background reminder worker (`send_reminders`) delivers scheduled email reminders (`1`, `3`, or `7` days before deadlines).

---

## Tech Stack

| Layer                       | Technologies                                                                   |
| :-------------------------- | :----------------------------------------------------------------------------- |
| **Frontend**          | React 18, Vite, Tailwind CSS, Shadcn/ui, Material UI (MUI), React Router       |
| **Backend**           | Python 3.13, Django 5.2, Django REST Framework (DRF), PyJWT, Google API Client |
| **Database**          | MySQL 8.4                                                                      |
| **Background Worker** | Django management command (`send_reminders --loop`)                          |
| **Infrastructure**    | Docker & Docker Compose                                                        |

---

## Installation & Running

> [!IMPORTANT]
> **Google OAuth 2.0 setup is required before running UniPlanPlus.**
> Because UniPlanPlus uses Google OAuth 2.0 exclusively for authentication and Google Classroom sync (no local user passwords), you **must** complete **[OAuth2Setup.md](OAuth2Setup.md)** first to obtain your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

For complete step-by-step details and troubleshooting tips, see **[INSTALLATION.md](INSTALLATION.md)**.

### Prerequisites

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/get-started/) with Docker Compose
- A **Google Cloud project** configured with **[OAuth2Setup.md](OAuth2Setup.md)** *(Required)*
- A **Gmail App Password** configured with **[EmailSetup.md](EmailSetup.md)** *(Optional — for sending real due-date reminder emails)*

### Quick Start (Docker Compose)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Sorasit-Kateratorn/UniPlanPlus.git
   cd UniPlanPlus
   ```

2. **Complete Google OAuth 2.0 setup (Required):**
   Follow **[OAuth2Setup.md](OAuth2Setup.md)** to configure your Google Cloud project, OAuth consent screen, authorized origins/redirect URIs, Google Classroom API scopes, and download your **Client ID** and **Client Secret**.
3. **Set up Email Reminders (Optional):**
   Follow **[EmailSetup.md](EmailSetup.md)** to configure Gmail SMTP (using a 16-character Google App Password) for real reminder emails, or keep `console.EmailBackend` in `backend/.env` for local testing without SMTP.
4. **Create environment files:**

   - **Backend (`backend/.env`)** — copy from `backend/.env.example` or create directly:

     ```env
     DJANGO_SECRET=__CHANGE_ME__
     GOOGLE_CLIENT_ID=__YOUR_GOOGLE_CLIENT_ID__
     GOOGLE_CLIENT_SECRET=__YOUR_GOOGLE_CLIENT_SECRET__
     GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/auth/google/callback

     # Email reminder settings — see EmailSetup.md for Gmail SMTP or console testing
     EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
     DEFAULT_FROM_EMAIL="Uniplan <your_email@example.com>"
     EMAIL_HOST=smtp.gmail.com
     EMAIL_PORT=587
     EMAIL_HOST_USER=your_email@example.com
     EMAIL_HOST_PASSWORD=__YOUR_APP_PASSWORD__
     EMAIL_USE_TLS=true
     ```

   - **Frontend (`frontend/.env`)**:

     ```env
     VITE_API_BASE_URL=http://127.0.0.1:8000
     ```

5. **Build and launch all containers:**

   ```bash
   docker compose up -d --build
   ```

6. **Access the application:**

   | Service                      | URL                                                                                                    |
   | :--------------------------- | :----------------------------------------------------------------------------------------------------- |
   | **Frontend Web App**   | `http://127.0.0.1:5173` *(use `127.0.0.1` so OAuth state cookies match `GOOGLE_REDIRECT_URI`)* |
   | **Backend REST API**   | `http://127.0.0.1:8000`                                                                              |
   | **Django Admin Panel** | `http://127.0.0.1:8000/admin`                                                                        |

7. **Optional — Create a Django Admin superuser:**

   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

8. **Stop containers:**

   ```bash
   docker compose down            # Stop containers (preserves database volume)
   docker compose down --volumes  # Stop containers and wipe database data
   ```

---

## Security & OWASP ASVS v5.0 Compliance

UniPlanPlus was systematically hardened against **OWASP ASVS v5.0**. Every planned security requirement (**59 / 59 — 100%**) across **15 chapters** has been implemented and verified in the codebase.

**Full requirement-by-requirement checklist & codebase evidence:** **[ASVS_COMPLIANCE.md](ASVS_COMPLIANCE.md)**

### Compliance Overview by Chapter

| Chapter | Security Domain | Planned | Done | Key Implemented Controls & Documentation |
| :---: | :--- | :---: | :---: | :--- |
| **V1** | Encoding & Sanitization | 6 | **6 / 6** | React JSX auto-escaping, DRF `JSONRenderer`, Django ORM parameterized queries (zero raw SQL), URL protocol allowlisting (`http`/`https` only), zero `eval`/`subprocess` — [`ASVS_COMPLIANCE.md`](ASVS_COMPLIANCE.md#chapter-v1--encoding-and-sanitization-6--6) |
| **V2** | Validation & Business Logic | 4 | **4 / 4** | Server-side DRF serializer validation (`HEX_RE`, `TIME_RE`, overlap checks, enum choices), atomic CSV row validation, sequential OAuth flow — [`VALIDATION_RULES.md`](VALIDATION_RULES.md) |
| **V3** | Web Frontend Security | 5 | **5 / 5** | `SecFetchValidationMiddleware`, `SecurityHeadersMiddleware` (HSTS, CSP `frame-ancestors`, `nosniff`, Referrer-Policy, COOP), `HttpOnly`/`SameSite=Lax`/`__Secure-` cookies, strict CORS allowlist, safe HTTP methods — [`SECURITY.md`](SECURITY.md) |
| **V5** | File Handling | 5 | **5 / 5** | `.csv`-only extension & MIME allowlist, 1 MB max size, strictly in-memory processing (`io.StringIO`), `os.path.basename()`, hardcoded `Content-Disposition`, CSV formula injection sanitization — [Policy below](#file-handling--security-policy-owasp-asvs-v5) |
| **V6** | Authentication | 4 | **4 / 4** | Federated Google OAuth 2.0 only (no local passwords, no default accounts, no secret questions), per-IP OAuth rate limiting (`15/60s`) & DRF throttling (`20/min` anon, `120/min` user) — [Policy below](#authentication--anti-automation-policy-owasp-asvs-v6) |
| **V7** | Session Management | 5 | **5 / 5** | Server-side `SignedTokenAuthentication`, dynamic session JWTs with 192-bit CSPRNG `jti`, 8-hour lifetime, immediate revocation via `GoogleAccount.token_valid_after` on logout — [`SECURITY.md`](SECURITY.md) |
| **V8** | Authorization | 4 | **4 / 4** | Deny-by-default function grants (`FunctionGrant`, 15 permission codes), strict per-user queryset filtering & `OwnsObject` / `require_owned_item()` IDOR/BOLA protection — [`docs/authorization.md`](docs/authorization.md) |
| **V9** | Self-contained Tokens | 4 | **4 / 4** | Mandatory HMAC-SHA256 verification, strict `HS256` allowlist (rejects `none`), server-only key material (rejects `jku`/`x5u`/`jwk`/`x5c`), enforced `nbf`/`exp`/`iat` window — [`docs/authorization.md`](docs/authorization.md) |
| **V10** | OAuth & OIDC | 6 | **6 / 6** | BFF pattern (Google tokens strictly backend-only), 256-bit signed `HttpOnly` `oauth_state` CSRF cookie, confidential client backchannel auth, read-only Classroom scopes, `prompt="consent"` — [Policy below](#oauth-20--oidc-security-policy-owasp-asvs-v10) |
| **V11** | Cryptography | 2 | **2 / 2** | Industry-validated stdlib/PyJWT/`cryptography`/Django primitives only; pinned 256-bit `HS256` & `PBKDF2-HMAC-SHA256` (zero MD5/SHA-1) — [Policy below](#cryptography--data-integrity-policy-owasp-asvs-v11) |
| **V12** | Secure Communication | 1 | **1 / 1** | Mandatory TLS certificate & hostname verification for Google OAuth (`verify=True`), Google APIs (`disable_ssl_certificate_validation=False`), and SMTP STARTTLS (`CERT_REQUIRED`) — [Policy below](#secure-communications--tls-certificate-validation-owasp-asvs-v12) |
| **V13** | Configuration | 3 | **3 / 3** | External services documented, gitignored `.env` secret management with `.env.example`, directory listings disabled, `.git` excluded via `.dockerignore`, `DEBUG=0` default, masked `Server` header — [`SECURITY.md`](SECURITY.md) |
| **V14** | Data Protection | 3 | **3 / 3** | Sensitive data classification, tokens removed from URL query strings (`HttpOnly` cookie + `replaceState()`), zero third-party trackers, `Clear-Site-Data` + client storage wipe on logout — [`SECURITY.md`](SECURITY.md) |
| **V15** | Secure Coding & Architecture | 4 | **4 / 4** | Vulnerability remediation SLAs, CycloneDX 1.5 SBOM (`sbom/inventory.json`, 46 components), trusted registries enforced (`scripts/check_sbom.py`), explicit serializer field allowlists — [`docs/dependency-policy.md`](docs/dependency-policy.md) |
| **V16** | Logging & Error Handling | 3 | **3 / 3** | 5-layer structured UTC logging inventory (`backend/logs/security.log`), full auth & security error event logging, log-injection escaping, generic HTTP 500 responses — [`SECURITY_LOGGING.md`](SECURITY_LOGGING.md) |
| **Total** | **15 Active Chapters** | **59** | **59 / 59 (100%)** | **[View Full Matrix -> `ASVS_COMPLIANCE.md`](ASVS_COMPLIANCE.md)** |

---

## Security Policies

### File Handling & Security Policy (OWASP ASVS V5)

#### 1. Timetable CSV Upload (`POST /api/timetable/import/`)

- **Permitted File Types & MIME Types:** `text/csv`, `application/csv`, `application/vnd.ms-excel`
- **Expected File Extension:** `.csv` (strictly validated on both client and server)
- **Maximum File Size:** `1,000,000` bytes (1 MB). Archives/compressed files (`.zip`, `.gz`) are rejected (`400`/`415`).
- **Processing & Malicious File Behavior:**
  - Files are processed strictly **in-memory** (`io.StringIO`) and are **never saved to disk or public folders** (`V5.3.1`, `V5.3.2`).
  - User-submitted filenames are stripped via `os.path.basename()` for extension checking only and never used in file path operations (`V5.3.2`).
  - Invalid extensions, unsupported MIME types, non-UTF-8 payloads, malformed CSV structures, or oversized files abort immediately before any database writes (`400 Bad Request`, `413 Payload Too Large`, or `415 Unsupported Media Type`).
  - Leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are stripped from imported text fields to prevent stored CSV injection.

#### 2. Timetable CSV Download (`GET /api/timetable/export/`)

- Ignores any user-supplied filename parameters in URLs or payloads and enforces a hardcoded server header: `Content-Disposition: attachment; filename="timetable.csv"` (`V5.4.1`).
- Sets `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, and `Content-Type: text/csv; charset=utf-8` so browsers download the file safely rather than rendering or executing content.
- All exported text fields (`subject`, `room`) are sanitized against CSV Formula Injection by prefixing dangerous leading characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a single quote (`'`).

### Authentication & Anti-Automation Policy (OWASP ASVS V6)

- **Federated Identity Provider (`V6.3.1`, `V6.4.2`):** UniPlan delegates primary user authentication exclusively to **Google OAuth 2.0**. The application stores no local user passwords, password hints, or knowledge-based security questions. Credential stuffing, brute-force defense, CAPTCHA challenges, and suspicious login detection are enforced by Google's Identity Platform.
- **No Default Accounts (`V6.3.2`):** No default accounts (`root`, `admin`, `sa`) are seeded or enabled. User accounts are provisioned dynamically upon verified Google OAuth callback.
- **Rate Limiting & Lockout Prevention (`V6.1.1`, `V6.3.1`):**
  - `/api/auth/google/login` and `/api/auth/google/callback` enforce a per-IP sliding window limit of **15 requests per 60 seconds** (`_check_auth_rate_limit`), returning `HTTP 429 Too Many Requests` when exceeded.
  - Django REST Framework enforces `AnonRateThrottle` (**20 requests/minute** per IP) and `UserRateThrottle` (**120 requests/minute** per authenticated user).
  - Throttling is keyed strictly by **client IP address** with **temporary 60-second windows**, never permanently locking a target user's account.

### OAuth 2.0 & OIDC Security Policy (OWASP ASVS V10)

- **Token Isolation & Backend-for-Frontend Pattern (`V10.1.1`):** Google OAuth 2.0 `access_token` and `refresh_token` credentials are exchanged and stored strictly on the Django backend (`GoogleAccount` model) and never transmitted to the React frontend. The application session token is set in an `HttpOnly`, `SameSite=Lax` cookie with `Cache-Control: no-store`, and `Login.jsx` scrubs the callback URL immediately via `window.history.replaceState()`.
- **Transaction Binding & OAuth CSRF Protection (`V10.1.2`, `V10.2.1`):** `/api/auth/google/login` generates a 256-bit CSPRNG `state` parameter (`secrets.token_urlsafe(32)`) bound to the user's browser session in a signed, `HttpOnly`, `SameSite=Lax` cookie (`oauth_state`, 10-minute expiry). `/api/auth/google/callback` validates the signature and compares `state` in constant time (`secrets.compare_digest()`) before calling `flow.fetch_token()`.
- **Confidential Client Authentication & Least-Privilege Scopes (`V10.4.10`, `V10.4.11`, `V10.7.1`):** Backchannel token requests authenticate with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` over HTTPS. Only read-only scopes are requested (`openid`, `userinfo.email`, `userinfo.profile`, `classroom.courses.readonly`, `classroom.student-submissions.me.readonly`, `classroom.coursework.me.readonly`), and `prompt="consent"` enforces explicit user consent.

### Cryptography & Data Integrity Policy (OWASP ASVS V11)

- **Industry-Validated Libraries (`V11.2.1`):** Zero custom or homegrown cryptographic algorithms. All operations use peer-reviewed implementations: Python stdlib (`hashlib`, `hmac`, `secrets`), `PyJWT` + `pyca/cryptography`, Django `PBKDF2PasswordHasher` / `TimestampSigner`, and `google-auth`.
- **Collision-Resistant 256-Bit Hash Functions (`V11.4.3`):** Session signing explicitly enforces `HS256` (`core/tokens.py`) and `HASH_ALGORITHM = "sha256"` (`core/auth.py`). Key derivation and Django admin password hashing enforce `PBKDF2PasswordHasher` (`PBKDF2-HMAC-SHA256`). Deprecated hash algorithms (`MD5`, `SHA-1`) are not used anywhere.

### Secure Communications & TLS Certificate Validation (OWASP ASVS V12)

- **Outbound TLS Certificate Validation (`V12.3.2`):**
  - Google OAuth token refreshes use `_verified_requests_session()` (`session.verify = True`).
  - Google Classroom & UserInfo API clients use `_build_verified_google_service()` (`httplib2.Http(disable_ssl_certificate_validation=False, timeout=15)`).
  - Outbound SMTP reminders enforce `EMAIL_USE_TLS = True` over STARTTLS with `ssl.create_default_context()` asserted for `CERT_REQUIRED` and `check_hostname = True`.
  - `verify=False`, `CERT_NONE`, and `PYTHONHTTPSVERIFY=0` are strictly prohibited across the codebase and Docker configs.

---

## Security Testing & Verification

```bash
# 1. Verify Software Bill of Materials (SBOM) & trusted registry policy (ASVS V15)
python scripts/check_sbom.py

# 2. Run automated backend security test suites (ASVS V1, V2, V3, V7, V13, V14, V16)
cd backend
pytest -v
```

Test suites included in `backend/core/tests/`:

- `test_v1_encoding_sanitization.py` — JSON/JS output encoding, URL protocol validation, ORM SQLi protection
- `test_v2_validation_rules.py` — Serializer regex/range/overlap validation and CSV upload guards
- `test_security_v3_v7_v13_v14.py` — Security headers, `Sec-Fetch` context isolation, token entropy/revocation, logout `Clear-Site-Data`
- `test_v16_logging_error_handling.py` — Auth & error event logging, log injection escaping, generic 500 responses

---

## Project Documentation

| Document                                                                                                                                                                                       | Description                                                                                                                          |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| **[INSTALLATION.md](INSTALLATION.md)**                                                                                                                                                    | Complete Docker installation, environment configuration, and operations guide                                                        |
| **[OAuth2Setup.md](OAuth2Setup.md)**                                                                                                                                                      | Step-by-step Google Cloud OAuth 2.0 & Classroom API setup guide *(Required)*                                                       |
| **[EmailSetup.md](EmailSetup.md)**                                                                                                                                                        | Quick Gmail SMTP App Password & console email setup guide *(Optional)*                                                             |
| **[ASVS_COMPLIANCE.md](ASVS_COMPLIANCE.md)**                                                                                                                                              | Complete OWASP ASVS v5.0 Plan/Done compliance matrix (`59/59` planned)                                                             |
| **[PROJECT_SECURITY_REPORT.md](PROJECT_SECURITY_REPORT.md)**                                                                                                                              | Course security report mapped to rubric Items 4–18, STRIDE threat model, OWASP ASVS v5.0 & Top 10, and 4 advanced security features |
| **[SECURITY.md](SECURITY.md)**                                                                                                                                                            | External communications inventory, secrets management, data classification, session & frontend controls                              |
| **[VALIDATION_RULES.md](VALIDATION_RULES.md)**                                                                                                                                            | OWASP ASVS V2 input validation schemas, allowlists, and CSV upload rules                                                             |
| **[SECURITY_LOGGING.md](SECURITY_LOGGING.md)**                                                                                                                                            | OWASP ASVS V16 5-layer logging inventory, event catalog, and error-handling policy                                                   |
| **[docs/authorization.md](docs/authorization.md)**                                                                                                                                        | OWASP ASVS V8 & V9 function-level permission catalog, ownership checks, and session JWT rules                                        |
| **[docs/dependency-policy.md](docs/dependency-policy.md)**                                                                                                                                | OWASP ASVS V15 trusted package registries, vulnerability SLAs, and SBOM workflow                                                     |
| **[Project Write-up (Google Doc)](https://docs.google.com/document/d/1DCrA-3688mUq6HGsNAnI9CS53ziWLud2McELJog4sqA/edit?usp=sharing)**                                                     | Original project design specification                                                                                                |
| **[UI Prototype (Canva)](https://www.canva.com/design/DAGxuHuyKDU/g_PNCcumdICsxAvOEeKd9A/edit?utm_content=DAGxuHuyKDU&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton)** | Application UI/UX design prototype                                                                                                   |
| **[Project Management (Jira)](https://ku-team-panthut.atlassian.net/jira/software/projects/TAW/settings/access)**                                                                         | Sprint & issue tracking board                                                                                                        |

---

## Team Members

| No. |   Student ID   | Full Name                          |
| :-: | :------------: | :--------------------------------- |
|  1  | `6410546262` | **Vorakorn Leechavanan**     |
|  2  | `6610545774` | **Jongchana Khachatrokphai** |
|  3  | `6610545421` | **Panthut Ketphan**          |
|  4  | `6610545944` | **Sorasit Kateratorn**       |
