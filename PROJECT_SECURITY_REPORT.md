# Project Security Report — 01219325 Software Development Security

## 1. Application Name and Team Members

**Application Name:** UniPlanPlus (UniPlan)  
**Repository:** [UniPlanPlus on GitHub](https://github.com/sorasitkateratorn/security_project)  
**Academic Year / Class:** 2026 / 01219325 Software Development Security  

### Team Members
| No. | Student ID | Full Name | Responsibilities |
|:---:|:----------:|:----------|:-----------------|
| 1 | **6610545944** | Sorasit Kateratorn | Web Frontend Security (V3), Session Management (V7), Configuration (V13), Data Protection (V14) |
| 2 | **6610545774** | Jongchana Khachatrokphai | Encoding & Sanitization (V1), Input Validation (V2), Testing |
| 3 | **6610545421** | Panthut Ketphan | Authentication (V6), File Handling (V5), Deployment |
| 4 | **6410546262** | Vorakorn Leechavanan | Architecture, Cryptography (V11), Threat Modeling |

---

## 2. Functional Features

UniPlanPlus is an integrated web platform combining academic timetable scheduling and task management, connected directly with Google Classroom.

1. **Interactive Weekly Timetable:**
   - Visual drag-free weekly calendar view (Sunday through Saturday).
   - Dynamic class scheduling with room numbers, color themes, and conflict detection.
   - Timetable CSV export and import with strict file structure and MIME validation.
2. **Task & Homework Tracking:**
   - Create, edit, prioritize, archive, and complete academic assignments.
   - Link tasks directly to timetable subjects.
   - Automated status management (`NOT_STARTED`, `IN_PROCESS`, `COMPLETED`).
3. **Google Classroom Sync:**
   - Google OAuth 2.0 Single Sign-On (SSO).
   - Automatic retrieval of active courses, assignments, and student submissions.
4. **Automated Due Date Reminders:**
   - Background worker service (`send_reminders`) scanning upcoming deadlines.
   - Multi-channel notification support (Email via SMTP, In-App).

---

## 3. Security Features Mapped to OWASP ASVS

UniPlanPlus follows the **OWASP Application Security Verification Standard (ASVS) v4.0.3**, implementing Level 1 baseline and Level 2/3 controls across multiple categories, with primary emphasis on **V3 (Web Frontend Security)**, **V7 (Session Management)**, **V13 (Configuration)**, and **V14 (Data Protection)**:

### 3.1 Chapter V3: Web Frontend Security
- **V3.2.1 (L1) — Unintended Content Interpretation / Context Isolation:**
  - Implemented `SecFetchValidationMiddleware` (`backend/core/middleware.py`) which inspects `Sec-Fetch-Dest`. Any direct browser navigation (`Sec-Fetch-Dest: document`) targeting `/api/*` endpoints is blocked with HTTP 403 Forbidden, preventing attackers from tricking browsers into rendering API responses as HTML documents.
  - File downloads (e.g. CSV export) enforce `Content-Disposition: attachment; filename="timetable.csv"`.
- **V3.2.2 (L1) — Safe Text Rendering:**
  - React JSX handles all text rendering with native auto-escaping. Zero occurrences of `dangerouslySetInnerHTML` in the frontend codebase.
- **V3.3.1 & V3.3.4 (L1/L2) — Secure Cookie Attributes:**
  - Auth token is stored in an `HttpOnly`, `Secure` (in production/HTTPS), `SameSite=Lax` cookie named `__Secure-uniplan-auth`. JavaScript has zero access to this cookie, mitigating XSS token theft.
- **V3.3.2 (L2) — SameSite Protection:**
  - `SameSite=Lax` prevents CSRF attacks on authenticated cross-site requests.
- **V3.4.1 (L1) — HTTP Strict Transport Security (HSTS):**
  - Response header `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` is enforced on all HTTP responses.
- **V3.4.2 (L1) — CORS Origin Validation:**
  - `CORS_ALLOWED_ORIGINS` restricts access strictly to `http://localhost:5173` and `http://127.0.0.1:5173`. Wildcard `*` is explicitly disallowed, and `CORS_ALLOW_CREDENTIALS = True` allows credentials only for whitelisted origins.
- **V3.4.4 (L2) — MIME Type Sniffing Prevention:**
  - `X-Content-Type-Options: nosniff` header is added to every response.
- **V3.4.5 (L2) — Referrer Policy:**
  - `Referrer-Policy: strict-origin-when-cross-origin` prevents leaking sensitive URLs, paths, and query parameters to third-party domains.
- **V3.4.6 (L2) — Frame Ancestors & Clickjacking Defense:**
  - `Content-Security-Policy: frame-ancestors 'self'; object-src 'none'; base-uri 'self'` blocks unauthorized embedding in iframes.
- **V3.4.8 (L3) — Cross-Origin-Opener-Policy (COOP):**
  - `Cross-Origin-Opener-Policy: same-origin` isolates the top-level browsing context to protect against window proxy abuse (tabnabbing).
- **V3.5.1 – V3.5.3 (L1) — Origin Separation & Safe HTTP Methods:**
  - State-altering operations strictly require `POST`, `PATCH`, or `DELETE`. Safe methods (`GET`, `HEAD`) cannot modify database state.

### 3.2 Chapter V7: Session Management
- **V7.2.1 (L1) — Backend Session Verification:**
  - `SignedTokenAuthentication` (`backend/core/auth.py`) validates token authenticity and cryptographic integrity server-side using Django's HMAC-SHA256 signing system.
- **V7.2.2 & V7.2.3 (L1) — Dynamic Tokens with High Cryptographic Entropy:**
  - Session tokens are dynamically generated per authentication using `secrets.token_urlsafe(24)` in the `jti` claim, providing **192 bits of CSPRNG entropy** (exceeding the 128-bit ASVS threshold). No static API keys are ever used.
- **V7.2.4 (L1) — Session Token Regeneration:**
  - A new unique session token with a new `jti` and `iat` timestamp is generated on every Google OAuth callback.
- **V7.4.1 (L1) — Session Expiration:**
  - Token validity is bounded by `max_age=28800` (8 hours). Expired tokens are immediately rejected by `django.core.signing.loads()`.
- **V7.4.2 (L1) — Immediate Session Invalidation:**
  - The `GoogleAccount` database model includes a `token_valid_after` timestamp. When a user logs out, `POST /api/auth/logout` sets `token_valid_after = timezone.now()`. Any existing token with an issued-at time (`iat`) prior to `token_valid_after` is rejected server-side.
- **V7.4.4 (L2) — Accessible Logout:**
  - Prominent logout button is visible in the top navigation header on every authenticated screen.

### 3.3 Chapter V13: Configuration
- **V13.1.1 (L2) — Communication Architecture Documentation:**
  - Detailed mapping of all external communication flows (Google OAuth, Google Classroom API, MySQL, Gmail SMTP) documented in `SECURITY.md`.
- **V13.3.1 (L2) — Secret Management:**
  - Secrets (`DJANGO_SECRET`, `GOOGLE_CLIENT_SECRET`, `DB_PASSWORD`, `EMAIL_HOST_PASSWORD`) are loaded strictly from environment variables via `.env`. `.env` is ignored by Git, and `.env.example` provides safe templates with no hardcoded secrets.
- **V13.4.1 (L1) — Source Control Metadata Protection:**
  - `.git` and development artifacts are excluded from Docker container builds via `.dockerignore`.
- **V13.4.2 (L2) — Production Debug Mode Disabled:**
  - `DEBUG` is dynamically evaluated from `os.getenv("DEBUG", "0") == "1"`, ensuring production defaults to `DEBUG = False` to prevent stack trace leaks.
- **V13.4.3 (L2) — Directory Listing Disabled:**
  - Directory indexing is disabled by default in Django, and `SECURE_CONTENT_TYPE_NOSNIFF = True` prevents content confusion.
- **V13.4.6 (L3) — Backend Version Masking:**
  - Server identification headers are masked (`Server: UniPlan`) and `X-Powered-By` is stripped via `SecurityHeadersMiddleware`.

### 3.4 Chapter V14: Data Protection
- **V14.1.1 (L2) — Data Classification:**
  - Data classified into **High** (session tokens, Google credentials), **Medium** (user emails, timetable schedules), and **Low** (public profile name, avatar URL).
- **V14.2.1 (L1) — No Sensitive Data in URLs:**
  - **Eliminated the major vulnerability** where tokens and emails were previously exposed in query strings (`?token=...&email=...`). Replaced completely with `Set-Cookie: __Secure-uniplan-auth=...; HttpOnly; SameSite=Lax`.
- **V14.2.3 (L2) — Zero Third-Party Tracking:**
  - Verified no third-party trackers, analytics libraries, or advertising telemetry exist in the frontend bundle.
- **V14.3.1 (L1) — Client Storage Purge on Logout:**
  - Logout triggers `Clear-Site-Data: "cookies", "storage"`, deletes the auth cookie, and executes `localStorage.clear()` and `sessionStorage.clear()`.

---

## 4. Threat Modeling (STRIDE Analysis)

We performed a **STRIDE** threat model on the UniPlanPlus architecture to identify potential vulnerabilities, assess risk, and assign mitigation priorities.

| Threat Category (STRIDE) | Threat Description | Affected Asset | Priority | Implemented Mitigation / Prevention | Status |
|:---|:---|:---|:---:|:---|:---:|
| **Spoofing** | Adversary forges session token or impersonates student | User session | **High** | HMAC-SHA256 signature verification, 192-bit CSPRNG token `jti`, server-side `SignedTokenAuthentication`. | ✅ Done |
| **Tampering** | Attacker tampers with request to modify another student's task or timetable | Task & Timetable DB | **Critical** | DRF querysets strictly filtered by `user=self.request.user`. IDOR/BOLA attacks blocked. | ✅ Done |
| **Repudiation** | User denies modifying timetable entries or initiating reminder intake | Audit logs | **Medium** | Security event logging on authentication events, logout, and token rejections. | ✅ Done |
| **Information Disclosure** | Token leaked in browser history or HTTP referrer headers | Session token, User info | **Critical** | Migrated token from URL query string to HttpOnly cookie. Added `Referrer-Policy: strict-origin-when-cross-origin` and `HSTS`. | ✅ Done |
| **Denial of Service** | Malicious actor uploads oversized or corrupted file to exhaust server RAM | Server availability | **High** | 1 MB hard limit enforced in `import_csv()`, MIME validation, CSV sniffer structure check. | ✅ Done |
| **Elevation of Privilege** | Unauthenticated user navigates directly to API endpoints in browser | Backend API endpoints | **High** | `SecFetchValidationMiddleware` blocks `Sec-Fetch-Dest: document` on `/api/*`. Default DRF permission is `IsAuthenticated`. | ✅ Done |

---

## 5. Security Principles Followed in Implementation

1. **Defense in Depth:**
   - Security controls operate in layers: CORS restriction -> Sec-Fetch check -> CSRF protection -> HttpOnly cookie transmission -> HMAC signature verification -> User-scoped DB queries.
2. **Principle of Least Privilege:**
   - Google OAuth scopes are requested on a read-only basis where possible (`classroom.courses.readonly`, `classroom.student-submissions.me.readonly`).
   - Database operations are scoped strictly to the authenticated user ID (`Task.objects.filter(user=self.request.user)`).
3. **Complete Mediation:**
   - Every API request is authenticated and authorized at the trusted backend layer before any ORM query is executed.
4. **Fail Securely:**
   - When token verification encounters `BadSignature`, `SignatureExpired`, or invalid `iat`, the request fails with HTTP 401 Unauthorized immediately.
5. **Economy of Mechanism:**
   - Built on standard cryptographic primitives provided by Django (`django.core.signing`) and Python (`secrets`, `hmac`, `hashlib`), avoiding custom, untested crypto algorithms.
6. **Don't Trust User Input:**
   - String, color, time, and CSV inputs undergo serializer allowlist validation and regex matching (`TIME_RE`, `HEX_RE`).

---

## 6. Security Test Process

The security posture was validated through multiple testing methodologies:

### 6.1 Automated Security Unit & Integration Tests
Created a dedicated test suite (`backend/core/tests/test_security_v3_v7_v13_v14.py`) containing:
- `SecurityHeadersTests`: Validates HSTS, nosniff, Referrer-Policy, CSP, COOP, and Server version header masking.
- `SecFetchValidationTests`: Validates blocking of `Sec-Fetch-Dest: document` while permitting legitimate SPA fetch calls.
- `TokenAndSessionTests`: Tests token entropy uniqueness, verification, and revocation via `token_valid_after`.
- `LogoutEndpointTests`: Validates `Clear-Site-Data` header, cookie deletion, and immediate database session revocation.

### 6.2 Static Application Security Testing (SAST)
- **Ruff & AST Verification:** Automated syntax and linting checks ensure memory-safe operations and clean code.
- **CodeQL / Semgrep Scans:** Scanned for OWASP Top 10 vulnerabilities (SQL injection, XSS, CSRF, insecure deserialization). All endpoints use Django ORM parameterized queries; raw SQL is completely absent.

### 6.3 Dynamic Application Security Testing (DAST)
- **OWASP ZAP Baseline Scan:** Run against backend and frontend endpoints to verify:
  - Missing security headers (Confirmed: HSTS, CSP, X-Content-Type-Options are present).
  - Cookie security flags (Confirmed: `HttpOnly`, `Secure`, `SameSite=Lax`).
  - CORS configurations (Confirmed: No wildcard reflections).

---

## 7. Grading Criteria Checklist (18 Requirements)

| No | Criteria | Phase | Implementation in UniPlanPlus | Status |
|:---:|:---|:---:|:---|:---:|
| 1 | OWASP ASVS Security Requirements | Requirement | Followed ASVS v4.0.3 across Chapters V1, V2, V3, V5, V6, V7, V13, V14. Documented in CSV and report. | ✅ Complete |
| 2 | Threat Modeling | Design | STRIDE threat model conducted with prioritized mitigations for all assets. | ✅ Complete |
| 3 | Security Design Principles | Design | Least privilege, defense-in-depth, complete mediation, fail-safe defaults mapped to codebase. | ✅ Complete |
| 4 | Password Authentication | Implementation | Handled securely via Google OAuth 2.0 Identity Provider; local passwords not stored/used. | ✅ Complete |
| 5 | Social SSO with OAuth / OpenID | Implementation | Google OAuth 2.0 with OpenID Connect (`openid`, `userinfo.email`, `userinfo.profile`). | ✅ Complete |
| 6 | Authorization (Role / Function) | Implementation | DRF `IsAuthenticated` on all protected endpoints; anonymous access blocked by default. | ✅ Complete |
| 7 | Access Control (IDOR / Data Isolation) | Implementation | All DB operations filter by `user=request.user`; users cannot access or view other students' data. | ✅ Complete |
| 8 | Input Validation & SQLi Protection | Implementation | Django ORM used exclusively (parameterized queries). Serializer validation (`TIME_RE`, `HEX_RE`). | ✅ Complete |
| 9 | Environment Variables & Credentials | Implementation | `.env` file for secrets, `.env.example` template, no secrets in Git, `.gitignore` enforced. | ✅ Complete |
| 10 | CORS Properly Configured | Implementation | `CORS_ALLOWED_ORIGINS` explicitly set to `http://localhost:5173` and `http://127.0.0.1:5173`. No `*`. | ✅ Complete |
| 11 | Error Handling | Implementation | Structured JSON error messages returned; stack traces suppressed in production (`DEBUG=0`). | ✅ Complete |
| 12 | Logging | Implementation | Python `logging` configured for security events (login, logout, token rejection, Sec-Fetch blocks). | ✅ Complete |
| 13 | HTTP Security Headers | Implementation | `SecurityHeadersMiddleware`: HSTS, nosniff, CSP `frame-ancestors`, Referrer-Policy, COOP. | ✅ Complete |
| 14 | SAST Tool Analysis | Testing | Verified via Python AST security parser, Ruff, and Semgrep rules. | ✅ Complete |
| 15 | DAST Tool Analysis | Testing | Verified with OWASP ZAP baseline scan process on local containers. | ✅ Complete |
| 16 | Threat Model Implementation Mapping | Verification | Threat mitigations cross-referenced in Section 4; 100% of planned mitigations implemented. | ✅ Complete |
| 17 | Mapping to OWASP ASVS & Top 10 | Verification | Mapped to ASVS V3, V7, V13, V14 and OWASP Top 10 (A01:2021, A02:2021, A05:2021, A07:2021). | ✅ Complete |
| 18 | **4 Advanced Security Features** | Implementation | **1. Scope Authorization** (OAuth scopes: `classroom.courses.readonly`, etc.)<br>**2. Login / Session Timeout** (8-hour `max_age` expiry)<br>**3. Token Invalidation Management** (`token_valid_after` revocation + `Clear-Site-Data`)<br>**4. Anti-Automation & File Guard** (1MB max upload, MIME verification, CSV dialect check) | ✅ Complete |

---

## 8. OWASP ASVS Requirements Matrix (V3, V7, V13, V14)

Below is the verified status of the requirements in the project CSV (`asvs_updated_v3_v7_v13_v14.csv`):

| Req ID | Chapter & Section | Requirement Description | Plan | Done | Evidence & Implementation Details | Responsible Student |
|:---|:---|:---|:---:|:---:|:---|:---|
| **V3.2.1** | Web Frontend / Interpretation | Browser context isolation for API responses | TRUE | **TRUE** | `SecFetchValidationMiddleware` blocks `Sec-Fetch-Dest: document` on `/api/*`. CSV export uses `Content-Disposition: attachment`. | Sorasit Kateratorn |
| **V3.2.2** | Web Frontend / Interpretation | Safe text rendering functions | TRUE | **TRUE** | React JSX auto-escapes output; no `dangerouslySetInnerHTML` found in frontend. | Sorasit Kateratorn |
| **V3.3.1** | Web Frontend / Cookies | `Secure` attribute and `__Secure-` prefix | TRUE | **TRUE** | Auth cookie named `__Secure-uniplan-auth` with `Secure=True` in production and `HttpOnly=True`. | Sorasit Kateratorn |
| **V3.3.2** | Web Frontend / Cookies | `SameSite` attribute configured | TRUE | **TRUE** | `SameSite=Lax` configured on authentication cookie. | Sorasit Kateratorn |
| **V3.3.4** | Web Frontend / Cookies | `HttpOnly` attribute set on session token | TRUE | **TRUE** | `HttpOnly=True` enforced on auth cookie, preventing JavaScript DOM access. | Sorasit Kateratorn |
| **V3.4.1** | Web Frontend / Headers | Strict-Transport-Security (HSTS) | TRUE | **TRUE** | `Strict-Transport-Security: max-age=31536000; includeSubDomains` set via middleware. | Sorasit Kateratorn |
| **V3.4.2** | Web Frontend / Headers | CORS Access-Control-Allow-Origin restricted | TRUE | **TRUE** | `CORS_ALLOWED_ORIGINS` explicitly allowlists frontend origins (`localhost:5173`, `127.0.0.1:5173`); no wildcard. | Sorasit Kateratorn |
| **V3.4.4** | Web Frontend / Headers | `X-Content-Type-Options: nosniff` | TRUE | **TRUE** | Enforced on all HTTP responses via `SecurityHeadersMiddleware` and Django settings. | Sorasit Kateratorn |
| **V3.4.5** | Web Frontend / Headers | Referrer-Policy header configured | TRUE | **TRUE** | `Referrer-Policy: strict-origin-when-cross-origin` set on all responses. | Sorasit Kateratorn |
| **V3.4.6** | Web Frontend / Headers | CSP `frame-ancestors` clickjacking defense | TRUE | **TRUE** | `Content-Security-Policy: frame-ancestors 'self'; object-src 'none'; base-uri 'self'` header set. | Sorasit Kateratorn |
| **V3.4.8** | Web Frontend / Headers | Cross-Origin-Opener-Policy (COOP) | TRUE | **TRUE** | `Cross-Origin-Opener-Policy: same-origin` set on all document and API responses. | Sorasit Kateratorn |
| **V3.5.1** | Web Frontend / Origin | Anti-forgery tokens / CSRF protection | TRUE | **TRUE** | Django `CsrfViewMiddleware` active; HttpOnly cookie with `SameSite=Lax` used for API calls. | Sorasit Kateratorn |
| **V3.5.2** | Web Frontend / Origin | CORS preflight trigger protection | TRUE | **TRUE** | `django-cors-headers` validates origin and preflight headers against allowlist. | Sorasit Kateratorn |
| **V3.5.3** | Web Frontend / Origin | Restrictive HTTP methods for state change | TRUE | **TRUE** | `POST` (create), `PATCH` (update), `DELETE` (delete) enforced via DRF ViewSets. | Sorasit Kateratorn |
| **V7.2.1** | Session / Fundamental | Server-side session token verification | TRUE | **TRUE** | `SignedTokenAuthentication` cryptographically verifies token server-side via `django.core.signing`. | Sorasit Kateratorn |
| **V7.2.2** | Session / Fundamental | Dynamic session tokens (no static keys) | TRUE | **TRUE** | Tokens generated dynamically per login with unique `jti` and timestamp; no static keys. | Sorasit Kateratorn |
| **V7.2.3** | Session / Fundamental | Token CSPRNG entropy >= 128 bits | TRUE | **TRUE** | Token payload includes `jti: secrets.token_urlsafe(24)` with 192 bits of cryptographic entropy. | Sorasit Kateratorn |
| **V7.2.4** | Session / Fundamental | Token regeneration upon authentication | TRUE | **TRUE** | `_sign(email)` issues fresh token with new `jti` on every Google OAuth callback. | Sorasit Kateratorn |
| **V7.4.1** | Session / Termination | Maximum session lifetime timeout | TRUE | **TRUE** | Token expires after 8 hours (`max_age=28800`); expired tokens rejected by `loads()`. | Sorasit Kateratorn |
| **V7.4.2** | Session / Termination | Immediate session termination on logout | TRUE | **TRUE** | `token_valid_after` field on `GoogleAccount`; logout sets `token_valid_after = now()`, invalidating all active tokens. | Sorasit Kateratorn |
| **V7.4.4** | Session / Termination | Visible logout functionality on all pages | TRUE | **TRUE** | Header navigation includes a visible logout button calling `logout()` on all authenticated views. | Sorasit Kateratorn |
| **V13.1.1** | Configuration / Docs | External communications documented | TRUE | **TRUE** | All external dependencies (Google OAuth, Google Classroom, MySQL, SMTP) documented in `SECURITY.md`. | Sorasit Kateratorn |
| **V13.3.1** | Configuration / Secrets | Secret management and vault separation | TRUE | **TRUE** | All credentials isolated in `.env` (gitignored); `.env.example` provided; hardcoded fallback removed. | Sorasit Kateratorn |
| **V13.4.1** | Configuration / Leakage | Source control metadata (.git) inaccessible | TRUE | **TRUE** | `.dockerignore` excludes `.git`; web server does not serve version control directories. | Sorasit Kateratorn |
| **V13.4.2** | Configuration / Leakage | Production debug mode disabled | TRUE | **TRUE** | `DEBUG` controlled via `os.getenv("DEBUG", "0") == "1"`; defaults to disabled in production. | Sorasit Kateratorn |
| **V13.4.3** | Configuration / Leakage | Directory listings disabled | TRUE | **TRUE** | Django does not enable directory indexing; `SECURE_CONTENT_TYPE_NOSNIFF` prevents MIME attacks. | Sorasit Kateratorn |
| **V13.4.6** | Configuration / Leakage | Server version header masked | TRUE | **TRUE** | `Server: UniPlan` header set; `X-Powered-By` removed in `SecurityHeadersMiddleware`. | Sorasit Kateratorn |
| **V14.1.1** | Data Protection / Docs | Sensitive data classified into protection levels | TRUE | **TRUE** | High/Medium/Low data classification documented in `SECURITY.md`. | Sorasit Kateratorn |
| **V14.2.1** | Data Protection / General | Sensitive data not in URL query strings | TRUE | **TRUE** | Token removed from URL callback parameters; transferred securely via `HttpOnly` cookie. | Sorasit Kateratorn |
| **V14.2.3** | Data Protection / General | No sensitive data sent to untrusted parties | TRUE | **TRUE** | Audited frontend codebase; zero third-party tracking or analytics scripts exist. | Sorasit Kateratorn |
| **V14.3.1** | Data Protection / Client | Client storage cleared on session end | TRUE | **TRUE** | Logout endpoint returns `Clear-Site-Data: "cookies", "storage"`; cookie deleted; frontend clears storage. | Sorasit Kateratorn |

---

## 9. Installation and Running Instructions

To run the application locally with full security features enabled:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sorasitkateratorn/security_project.git
   cd security_project/UniPlanPlus
   ```

2. **Configure Environment Variables:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your Google OAuth credentials and a secure DJANGO_SECRET
   ```

3. **Start with Docker Compose:**
   ```bash
   docker compose up --build
   ```

4. **Access the application:**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:8000`

5. **Run Security Test Suite:**
   ```bash
   docker compose exec backend pytest core/tests/test_security_v3_v7_v13_v14.py -v
   ```
