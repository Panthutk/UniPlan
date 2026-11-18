# UniPlan Security Documentation

## 1. External Services & Communication (V13.1.1)

| Service | Purpose | Protocol | Authentication |
|---------|---------|----------|----------------|
| Google OAuth 2.0 | User authentication (SSO) | HTTPS | OAuth 2.0 client credentials |
| Google Classroom API | Sync courses & assignments | HTTPS | OAuth 2.0 user tokens |
| MySQL 8.4 | Primary data store | TCP (3306) | Username/password via env vars |
| SMTP (Gmail) | Email reminders | TLS (587) | App-specific password via env vars |

### Connection Security
- All external API calls use HTTPS (enforced by Google client libraries).
- Database connections are internal (Docker network) — not exposed to the internet.
- SMTP uses STARTTLS encryption.

## 2. Secret Management (V13.3.1)

### Secrets Inventory
| Secret | Storage | Rotation Schedule |
|--------|---------|------------------|
| `DJANGO_SECRET` | `.env` file (not committed) | Every 6 months or on compromise |
| `GOOGLE_CLIENT_SECRET` | `.env` file | On compromise |
| `DB_PASSWORD` | `.env` file / Docker env | Every 6 months |
| `EMAIL_HOST_PASSWORD` | `.env` file | On compromise |

### Rules
1. **No secrets in source code** — all sensitive values loaded from environment variables.
2. `.env` is in `.gitignore` — never committed.
3. `.env.example` contains only placeholder values (`__CHANGE_ME__`).
4. For production: use a proper secret vault (e.g., HashiCorp Vault, AWS Secrets Manager).
5. `DJANGO_SECRET` has no hardcoded fallback — the app warns loudly if not set.

## 3. Data Protection Classification (V14.1.1 / V14.2.3)

### Sensitive Data
| Data | Level | Protection |
|------|-------|------------|
| Auth tokens | **High** | HttpOnly cookie, `Secure` flag, HMAC-SHA256 signed, 8h expiry |
| Google OAuth credentials | **High** | Encrypted at rest (DB), never sent to client |
| User email | **Medium** | Only visible to the authenticated user |
| User name / picture | **Low** | Public Google profile data |

### Third-Party Data Sharing (V14.2.3)
- **No third-party analytics or tracking scripts** are included in the frontend.
- No user data is sent to external services other than Google APIs for core functionality.
- No advertising or marketing SDKs are integrated.

## 4. Session Security (V7)

### Token Design (V7.2.3)
- Tokens are created using `django.core.signing.dumps()` with HMAC-SHA256.
- Each token contains a `jti` (JWT ID) with 192 bits of cryptographic randomness (`secrets.token_urlsafe(24)`), exceeding the 128-bit minimum requirement.
- Each token contains an `iat` (issued-at) timestamp for invalidation checks.

### Session Lifetime (V7.4.1)
- Token `max_age` = 8 hours (28,800 seconds).
- After 8 hours, the token is automatically rejected and the user must re-authenticate.

### Session Termination (V7.4.2)
- On logout, `token_valid_after` is set to `now()` on the user's `GoogleAccount`.
- All tokens issued before `token_valid_after` are rejected server-side.
- The `Clear-Site-Data` HTTP header wipes cookies and storage in the browser.

## 5. Web Frontend Security (V3)

### Cookie Security (V3.3)
| Attribute | Value | ASVS Requirement |
|-----------|-------|------------------|
| `HttpOnly` | `true` | V3.3.4 — Token not accessible to JS |
| `Secure` | `true` (production) | V3.3.1 — Only sent over HTTPS |
| `SameSite` | `Lax` | V3.3.2 — CSRF protection |
| Name prefix | `__Secure-` | V3.3.1 — Browser enforces HTTPS |
| Max size | < 4096 bytes | V3.3.5 — Within browser limits |

### HTTP Security Headers (V3.4)
| Header | Value | ASVS Requirement |
|--------|-------|------------------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | V3.4.1 |
| `X-Content-Type-Options` | `nosniff` | V3.4.4 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | V3.4.5 |
| `Content-Security-Policy` | `frame-ancestors 'self'; object-src 'none'; base-uri 'self'` | V3.4.3 / V3.4.6 |
| `Cross-Origin-Opener-Policy` | `same-origin` | V3.4.8 |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Best practice |

### CORS (V3.4.2)
- `CORS_ALLOWED_ORIGINS` is an **explicit allowlist** (not `*`).
- Only `http://localhost:5173` and `http://127.0.0.1:5173` are permitted.
- `Access-Control-Allow-Credentials: true` is set for cookie-based auth.

### Sec-Fetch Validation (V3.2.1)
- `SecFetchValidationMiddleware` rejects direct browser navigation (`Sec-Fetch-Dest: document`) to `/api/*` endpoints.
- OAuth callback paths are exempted (they are legitimate browser redirects).

### Content Rendering (V3.2.2)
- React JSX auto-escapes all rendered content.
- No usage of `dangerouslySetInnerHTML` found in the codebase.

### CSRF Protection (V3.5.1)
- Django's `CsrfViewMiddleware` is enabled.
- API calls use Bearer token / cookie authentication (not vulnerable to CSRF with `SameSite=Lax`).

## 6. Configuration Security (V13.4)

### V13.4.1 — Source Control Metadata
- `.git/` is excluded from Docker build context via `.dockerignore`.
- Django does not serve static files that could expose `.git/`.

### V13.4.2 — Debug Mode
- `DEBUG` is controlled via environment variable (default: `0` = off).
- In production, `DEBUG=0` ensures no debug info is exposed.

### V13.4.3 — Directory Listings
- Django does not serve directory listings by default.
- No `STATICFILES_DIRS` configuration exposes sensitive paths.

## 7. Client-Side Data Protection (V14.3)

### V14.3.1 — Data Clearing on Logout
1. Backend sets `Clear-Site-Data: "cookies", "storage"` header.
2. Frontend calls `localStorage.clear()` and `sessionStorage.clear()`.
3. Auth cookie is explicitly deleted server-side.
4. Logout button is **visible** on every authenticated page (header component).

### V14.2.1 — No Sensitive Data in URLs
- OAuth callback **no longer** passes `token` or `email` in URL query string.
- Token is set as an `HttpOnly` cookie via `Set-Cookie` header.
- Only non-sensitive display info (`name`, `picture`) is passed via URL.
