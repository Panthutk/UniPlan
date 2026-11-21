# Email Setup Guide (Optional)

UniPlan uses SMTP to send due-date reminder emails via the `reminder_worker` container. Choose **Option A** to send real emails with Gmail, or **Option B** for local testing without SMTP.

---

## Option A: Gmail SMTP (Send Real Emails)

1. Open your [Google Account Security settings](https://myaccount.google.com/security) and make sure **2-Step Verification** is turned on.
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords), enter an app name (e.g., `UniPlan`), and click **Create**.
3. Copy the generated **16-character App Password** (do not use your regular Gmail password).
4. Add the following to `backend/.env`:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
DEFAULT_FROM_EMAIL="Uniplan <your_email@gmail.com>"
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_16_char_app_password
EMAIL_USE_TLS=true
```

> [!NOTE]
> `EMAIL_USE_TLS=true` enforces STARTTLS with certificate verification on port `587`. Never commit `backend/.env`.

---

## Option B: Console Mode (Local Testing Without SMTP)

If you don't need real emails during local development, set this in `backend/.env`:

```env
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL="Uniplan <no-reply@uniplan.local>"
```

Outgoing emails will be printed to the backend/worker container logs instead of sent over the network.

---

## Apply & Verify

Recreate the backend and reminder worker containers after editing `backend/.env` so the new variables take effect:

```bash
docker compose up -d backend reminder_worker
```

- **Watch reminder logs:** `docker compose logs -f reminder_worker`
- **Send a test email:** While signed in, send a `POST` request to `http://127.0.0.1:8000/api/test-email/` (requires the `email.send` permission, granted by default).
