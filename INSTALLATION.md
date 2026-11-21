# ⚙️ Installation & Running Guide

This guide walks you through setting up and running **UniPlan** locally with Docker.

> [!IMPORTANT]
> **Google OAuth 2.0 setup is required before running UniPlan.**
> UniPlan uses Google OAuth 2.0 for user login and Google Classroom synchronization (local passwords are not used). You **must** complete the **[OAuth2 Setup Guide](OAuth2Setup.md)** first to obtain your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

---

## 📋 Prerequisites

Before you begin, make sure you have:

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/get-started/) (with Docker Compose)
- A **Google Cloud project** configured using the **[OAuth2 Setup Guide](OAuth2Setup.md)**

---

## 1. Clone the Repository

```bash
git clone https://github.com/Sorasit-Kateratorn/UniPlanPlus.git
cd UniPlanPlus
```

---

## 2. Set Up Google OAuth 2.0 (Required)

Follow every step in **[OAuth2Setup.md](OAuth2Setup.md)** to:

1. Create a Google Cloud project and configure the OAuth consent screen.
2. Create a **Web Application** OAuth 2.0 client with the required JavaScript origins and redirect URIs.
3. Enable the **Google Classroom API** and add the required read-only scopes.
4. Publish the app and copy your **Client ID** and **Client Secret** for the next step.

---

## 3. Configure Environment Variables

> [!NOTE]
> Never commit `.env` files containing real credentials to version control.

### Backend (`backend/.env`)

Create a `.env` file in the `backend/` directory (you can also start from `backend/.env.example`) and fill in your credentials:

```env
# ----------------- DJANGO & GOOGLE OAUTH2 ----------------
DJANGO_SECRET=__CHANGE_ME__
GOOGLE_CLIENT_ID=__YOUR_GOOGLE_CLIENT_ID__
GOOGLE_CLIENT_SECRET=__YOUR_GOOGLE_CLIENT_SECRET__
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/auth/google/callback

# ----------------- EMAIL CONFIGURATION (OPTIONAL) --------
# Use console backend for local testing without SMTP, or configure Gmail SMTP below:
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
DEFAULT_FROM_EMAIL="Uniplan <your_email@example.com>"
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your_email@example.com
EMAIL_HOST_PASSWORD=__YOUR_APP_PASSWORD__
EMAIL_USE_TLS=true
```

- Replace `__CHANGE_ME__` with a strong random secret key for `DJANGO_SECRET`.
- Paste the **Client ID** and **Client Secret** you created in **[OAuth2Setup.md](OAuth2Setup.md)**.
- **Email reminders (optional):** If you do not need to send real reminder emails during local testing, set `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` so emails are printed to the backend container logs instead. For Gmail SMTP, use a Google App Password for `EMAIL_HOST_PASSWORD`.

### Frontend (`frontend/.env`)

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## 4. Build & Run with Docker

From the project root directory (where `docker-compose.yml` is located), build and start all services:

```bash
docker compose up -d --build
```

Docker Compose will automatically start the MySQL database, run Django migrations, and launch the backend API, frontend dev server, and reminder worker.

### Service URLs

| Service | URL / Port |
| --- | --- |
| **Frontend App** | `http://127.0.0.1:5173` |
| **Backend API** | `http://127.0.0.1:8000` |
| **Django Admin** | `http://127.0.0.1:8000/admin` |
| **MySQL Database** | `127.0.0.1:3307` (container port `3306`) |

> [!TIP]
> Open the app using **`http://127.0.0.1:5173`** (not `localhost:5173`) so the host matches `GOOGLE_REDIRECT_URI` (`http://127.0.0.1:8000/api/auth/google/callback`) and the OAuth state cookie is sent properly during login.

---

## 5. Create a Django Admin Superuser (Optional)

To access the Django admin panel, create a superuser account while the containers are running:

```bash
docker compose exec backend python manage.py createsuperuser
```

Then sign in at `http://127.0.0.1:8000/admin`.

---

## 🛠️ Useful Commands

- **View container logs:**
  ```bash
  docker compose logs -f
  ```

- **Stop the containers (keep database data):**
  ```bash
  docker compose down
  ```

- **Stop the containers and delete all database data:**
  ```bash
  docker compose down --volumes
  ```
