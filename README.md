[![ForTheBadge built-with-love](http://ForTheBadge.com/images/badges/built-with-love.svg)](https://GitHub.com/Naereen/)

# UniPlan

## 📖 Background

University students often need a timetable for classes and a task tracker for homework. Most tools keep these separate, forcing students to manually connect assignments with the related class. This leads to missed deadlines, confusion, and extra work.

## 🎯 Objective

To address the issue of missed deadlines, overwhelm, and confusion caused by the need to manage multiple timetables, particularly for university students, because most existing tools keep class schedules and task deadlines separate.

UniPlan aims to provide an **all-in-one application** that integrates both class schedules and task tracking into a single, unified timetable.

## 📂 Documents

- [🔐 Authorization Rules](docs/authorization.md) — Function-level and data-specific access
- [📝 Dependency Policy](docs/dependency-policy.md) — Trusted registries and remediation time frames
- [📄 GoogleDoc](https://docs.google.com/document/d/1DCrA-3688mUq6HGsNAnI9CS53ziWLud2McELJog4sqA/edit?usp=sharing) — Project write-up
- [🎨 MockUp UI](https://www.canva.com/design/DAGxuHuyKDU/g_PNCcumdICsxAvOEeKd9A/edit?utm_content=DAGxuHuyKDU&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton) — Canva prototype
- [🛠 Jira Board](https://ku-team-panthut.atlassian.net/jira/software/projects/TAW/settings/access) — Project management
- [🔒 Security V1 — Encoding &amp; Sanitization](SECURITY_V1.md) — OWASP ASVS V1 documentation & verification
- [✅ Input Validation &amp; Business Logic Rules (ASVS V2)](VALIDATION_RULES.md) — Data structure & input validation specification
- [📋 Security Logging &amp; Error Handling Inventory (ASVS V16)](SECURITY_LOGGING.md) — Logging architecture, events, and error handling

## 🛡️ File Handling & Security Policy (OWASP ASVS V5)

### 1. Timetable CSV Upload (`/api/timetable/import/`)

- **Permitted File Types & MIME Types:** `text/csv`, `application/csv`, `application/vnd.ms-excel`
- **Expected File Extension:** `.csv` (strictly validated on both client and server)
- **Maximum File Size:** `1,000,000 bytes` (1 MB). Archives/compressed files (`.zip`, `.gz`) are rejected (`400`/`415`).
- **Processing & Malicious File Behavior:**
  - Files are processed strictly **in-memory** (`io.StringIO`) and are **never saved to disk or public folders** (`V5.3.1`, `V5.3.2`).
  - User-submitted filenames are stripped via `os.path.basename()` for extension checking only and never used in file path operations (`V5.3.2`).
  - If an invalid extension, unsupported MIME type, non-UTF-8 payload, malformed CSV structure, or oversized file is detected, the server immediately aborts before any database writes and returns `400 Bad Request`, `413 Payload Too Large`, or `415 Unsupported Media Type`.
  - Leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are stripped from imported text fields to prevent stored CSV injection.

### 2. Timetable CSV Download (`/api/timetable/export/`)

- **Safe End-User Download & Processing:**
  - Ignores any user-supplied filename parameters in URLs or payloads and enforces a hardcoded server header: `Content-Disposition: attachment; filename="timetable.csv"` (`V5.4.1`).
  - Sets `X-Content-Type-Options: nosniff` and `Content-Type: text/csv; charset=utf-8` so browsers download the file safely rather than rendering or executing content.
  - All exported text fields (`subject`, `room`) are sanitized against CSV Formula Injection by prefixing dangerous leading characters (`=`, `+`, `-`, `@`) with a single quote (`'`).

## 🔐 Authentication & Anti-Automation Policy (OWASP ASVS V6)

### 1. Federated Identity Provider (Google OAuth 2.0)

- **No Local Passwords (`V6.3.1`, `V6.4.2`):** UniPlan delegates primary user authentication exclusively to **Google OAuth 2.0**. The application does not store local user passwords, password hints, or knowledge-based security questions (`BasicAuthentication` is disabled).
- **Anti-Automation & Adaptive Response at IdP:** Credential stuffing, password brute-Force defense, CAPTCHA challenges, device fingerprinting, and suspicious login detection are enforced by Google's Identity Platform during the OAuth 2.0 consent flow.
- **No Default Accounts (`V6.3.2`):** No default accounts (`root`, `admin`, `sa`) are seeded or enabled. User accounts are provisioned dynamically upon verified Google OAuth callback.

### 2. Application-Level Rate Limiting & Lockout Prevention (`V6.1.1`, `V6.3.1`)

- **OAuth Endpoint Throttling:** `/api/auth/google/login` and `/api/auth/google/callback` enforce a per-IP sliding window limit of **15 requests per 60 seconds** (`_check_auth_rate_limit`). Excess requests receive `HTTP 429 Too Many Requests`.
- **API Rate Limiting:** Django REST Framework enforces `AnonRateThrottle` (**20 requests/minute** per IP) and `UserRateThrottle` (**120 requests/minute** per authenticated user).
- **Malicious Account Lockout Prevention:** Throttling is keyed strictly by **client IP address** (for unauthenticated/OAuth requests) and **temporary 60-second sliding windows**, never by permanently disabling or locking a target user's email/account. An attacker spamming requests from an external IP cannot lock a legitimate user out of their account.

## 🔑 OAuth 2.0 & OIDC Security Policy (OWASP ASVS V10)

### 1. Token Isolation & Backend-for-Frontend Pattern (`V10.1.1`)

- **Upstream OAuth Tokens Kept Server-Side:** Google OAuth 2.0 `access_token` and `refresh_token` credentials are exchanged and stored strictly on the Django backend (`GoogleAccount` model) and are never transmitted to the React frontend.
- **No Sensitive Tokens in URL Query Strings:** The application session token is passed to the SPA callback via a URL fragment (`#token=...`) with `Cache-Control: no-store` and immediately cleared via `window.history.replaceState()`, preventing exposure in HTTP access logs or `Referer` headers.

### 2. Transaction Binding & OAuth CSRF Protection (`V10.1.2`, `V10.2.1`)

- On `/api/auth/google/login`, the backend generates a 256-bit CSPRNG `state` parameter (`secrets.token_urlsafe(32)`) and binds it to the user's browser session in a signed, `HttpOnly`, `SameSite=Lax` cookie (`oauth_state`, 10-minute expiry).
- On `/api/auth/google/callback`, the backend verifies the `state` cookie signature and compares it to the query `state` parameter using constant-time `secrets.compare_digest()` before calling `flow.fetch_token()`.

### 3. Confidential Client Authentication & Least-Privilege Scopes (`V10.4.10`, `V10.4.11`, `V10.7.1`)

- **Backchannel Client Authentication (`V10.4.10`):** The Django backend acts as a confidential OAuth 2.0 client, authenticating backchannel token requests to `https://oauth2.googleapis.com/token` over HTTPS using `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **Minimal Read-Only Scopes (`V10.4.11`):** Only read-only scopes required for student identity and Classroom assignment sync are requested (`openid`, `userinfo.email`, `userinfo.profile`, `classroom.courses.readonly`, `classroom.student-submissions.me.readonly`, `classroom.coursework.me.readonly`). Write scope `classroom.coursework.me` is not used.
- **Explicit User Consent (`V10.7.1`):** Authorization requests enforce `prompt="consent"` so Google's authorization server explicitly prompts the user to review and consent to requested scopes on every authorization flow.

## 🔒 Cryptography & Data Integrity Policy (OWASP ASVS V11)

### 1. Industry-Validated Cryptographic Libraries (`V11.2.1`)

- UniPlan strictly prohibits custom or homegrown cryptographic algorithms. All cryptographic operations use industry-validated, peer-reviewed implementations:
  - **Python Standard Library (`hashlib`, `hmac`, `secrets`):** Backed by OpenSSL C extensions for constant-time MAC verification (`hmac.compare_digest`, `secrets.compare_digest`) and CSPRNG token generation (`secrets.token_urlsafe(32)`).
  - **Django Cryptographic Signing (`django.core.signing.TimestampSigner`):** Used for stateless session bearer tokens and signed OAuth `state` cookies.
  - **`google-auth` & `pyca/cryptography` (`requirements.txt`):** Used for TLS-authenticated OAuth 2.0 token exchanges and Google API client authentication.

### 2. Collision-Resistant 256-Bit Hash Functions (`V11.4.3`)

- **Bearer Token & Cookie Authentication (`HMAC-SHA256`):** `core/auth.py` explicitly pins `algorithm="sha256"` in `TimestampSigner` (`HASH_ALGORITHM = "sha256"`), producing a **256-bit** message authentication code using collision-resistant **SHA-256** (FIPS 180-4).
- **Key Derivation & Admin Authentication (`PBKDF2-HMAC-SHA256`):** Salted key derivation in `django.core.signing` and `PBKDF2PasswordHasher` in `mysite/settings.py` both use **SHA-256** (256-bit output length). Weak/deprecated hash algorithms (`MD5`, `SHA-1`) are not used anywhere in the codebase.

## 🌐 Secure Communications & TLS Certificate Validation (OWASP ASVS V12)

### 1. Outbound TLS Client Certificate Validation (`V12.3.2`)

- **Google OAuth 2.0 & Token Refresh (`requests.Session`):** All backchannel token exchanges (`https://oauth2.googleapis.com/token`) use `_verified_requests_session()` with `session.verify = True`, validating the server certificate chain against the trusted CA bundle and verifying the server hostname.
- **Google Classroom & UserInfo APIs (`httplib2.Http`):** All Google API service clients are constructed via `_build_verified_google_service()` with `httplib2.Http(disable_ssl_certificate_validation=False, timeout=15)`, rejecting any self-signed, expired, or mismatched TLS certificates.
- **SMTP Email Reminders (`smtp.gmail.com:587`):** Outbound reminder emails enforce `EMAIL_USE_TLS = True` over STARTTLS with Python's `ssl.create_default_context()` (`verify_mode = ssl.CERT_REQUIRED` and `check_hostname = True`).
- **Zero Insecure Overrides:** `verify=False`, `CERT_NONE`, and `PYTHONHTTPSVERIFY=0` are strictly prohibited across the codebase and Docker configurations.

## 👥 Team Members

1. **Vorakorn Leechavanan** — 6410546262
2. **Jongchana Khachatrokphai** — 6610545774
3. **Panthut Ketphan** — 6610545421
4. **Sorasit Kateratorn** — 6610545944

## 🚀 Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + Shadcn/ui + MaterialUI
- **Backend**: Django REST Framework (DRF)
- **Database**: SQL
- **Project Management**: Jira

## ⚙️ Installation & Running

**Follow the instructions in [Installation guide](INSTALLATION.md) if this is your first time.**
