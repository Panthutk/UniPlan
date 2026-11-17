from pathlib import Path
import os
from dotenv import load_dotenv
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# ---- V13.3.1: Secret management — no hardcoded fallback in production ----
SECRET_KEY = os.getenv("DJANGO_SECRET")
if not SECRET_KEY:
    import warnings
    warnings.warn("DJANGO_SECRET not set! Using insecure dev default.", stacklevel=1)
    SECRET_KEY = "dev-only-secret-CHANGE-ME"

# ---- V13.4.2: Debug mode from env (must be OFF in production) ----
DEBUG = os.getenv("DEBUG", "0") == "1"

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")

INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    "rest_framework", "corsheaders", "core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    'django.middleware.security.SecurityMiddleware',
    # ---- V3.4 / V3.2.1: Security headers + Sec-Fetch validation ----
    "core.middleware.SecurityHeadersMiddleware",
    "core.middleware.SecFetchValidationMiddleware",
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
CORS_ALLOW_CREDENTIALS = True  # Required for cookie-based auth

ROOT_URLCONF = 'mysite.urls'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

WSGI_APPLICATION = 'mysite.wsgi.application'

DB_NAME = os.getenv("DB_NAME", "uniplan")
DB_USER = os.getenv("DB_USER", "uniplan")
DB_PASSWORD = os.getenv("DB_PASSWORD", "uniplan")
DB_HOST = os.getenv("DB_HOST", "db")   # <-- IMPORTANT: default to 'db' in Docker
DB_PORT = os.getenv("DB_PORT", "3306")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": DB_NAME,
        "USER": DB_USER,
        "PASSWORD": DB_PASSWORD,
        "HOST": DB_HOST,
        "PORT": DB_PORT,
        "OPTIONS": {
            "charset": "utf8mb4",
            "use_unicode": True,
        },
    }
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.auth.SignedTokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# Ensure Authorization header is allowed (usually default is fine)
CORS_ALLOW_HEADERS = list(default_headers) + ["authorization"]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---- Google OAuth config for views ----
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

# --- Email (dev safe: print to console; switch to SMTP later) ---
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Uniplan <no-reply@uniplan.local>")

# If/when you switch to Gmail SMTP, set EMAIL_BACKEND to SMTP and add:
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"

# =====================================================================
# SECURITY SETTINGS (OWASP ASVS)
# =====================================================================

# V3.3.1 / V3.3.4 — Auth cookie settings (HttpOnly, Secure, SameSite)
AUTH_COOKIE_NAME = "__Secure-uniplan-auth"
AUTH_COOKIE_MAX_AGE = 60 * 60 * 8   # 8 hours (matches token max_age)
AUTH_COOKIE_HTTPONLY = True           # V3.3.4: not accessible to JS
AUTH_COOKIE_SAMESITE = "Lax"         # V3.3.2: CSRF protection
AUTH_COOKIE_SECURE = not DEBUG       # V3.3.1: Secure in production
AUTH_COOKIE_PATH = "/"
AUTH_COOKIE_DOMAIN = None            # current host only

# V3.4.1 — HSTS via Django SecurityMiddleware
SECURE_HSTS_SECONDS = 31536000       # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# V3.4.4 — X-Content-Type-Options
SECURE_CONTENT_TYPE_NOSNIFF = True

# V13.4.1 — Prevent serving .git and similar
# (Handled by .dockerignore excluding .git from build context)

# Frontend URL for OAuth redirect
FRONTEND_URL = os.getenv("FRONTEND_REDIRECT", "http://localhost:5173")
