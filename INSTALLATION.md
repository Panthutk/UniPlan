# ⚙️ Installation & Running

1. **Clone the repository**  

```bash
git clone https://github.com/Panthutk/UniPlan
cd UniPlan
```

2. ***Create Env***

- Create file `.env` int `./backend/`

```env
DJANGO_SECRET=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
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/auth/google/callback

# ----------------- EMAIL CONFIGURATION ----------------
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
DEFAULT_FROM_EMAIL="Uniplan <uniplanlover@gmail.com>"
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=uniplanlover@gmail.com
EMAIL_HOST_PASSWORD=frfbnecxsnrormnp
EMAIL_USE_TLS=true
```

- for Google OAuth2 setup [OAuth2 Setup guide](OAuth2Setup.md)

- Create file `.env` int `./frontend/`

``` env
VITE_API_BASE_URL=http://127.0.0.1:8000
```
