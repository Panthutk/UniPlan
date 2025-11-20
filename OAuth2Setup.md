# OAuth2 Setup Guide

Follow these steps to configure **Google OAuth2** for uniplan setup.

---

## **1. Create a Google Cloud Project**

- Go to the Google Cloud Console.  
- Click the project dropdown → **New Project**  
- Enter a project name → Click **Create**

![Google OAuth Screenshot](./image/1.png)  
![Google OAuth Screenshot](./image/2.png)  
![Google OAuth Screenshot](./image/3.png)

---

## **2. Client & Project Configuration**

- After creating the project, click **Client** in the side menu and select **Get Started** to set up the OAuth consent screen.  
![Google OAuth Screenshot](./image/4.png)

- Fill in the required details, select **External**, then click **Create**.  
![Google OAuth Screenshot](./image/5.png)

---

## **3. OAuth Consent Screen Configuration**

- Go to **Overview** → Click **Create OAuth Client**  
![Google OAuth Screenshot](./image/6.png)

- Choose **Web Application** as the application type and enter your project name.

### **Authorized JavaScript Origins**

- Add the following URL:  

```
http://localhost:5173
http://127.0.0.1:5173
```

### **Authorized Redirect URIs**

- Add the following URL:  

```
http://127.0.0.1:8000/api/auth/google/callback
http://localhost:8000/api/auth/google/callback
```

- Verify everything matches the configuration below before clicking **Create**  
![Google OAuth Screenshot](./image/7.png)

- Click **Create** → Download your credentials JSON  
![Google OAuth Screenshot](./image/8.png)  
![Google OAuth Screenshot](./image/9.png)

---

## **4. Enable Google Classroom API**

- Go to **Library** → Search for **Google Classroom API**  
![Google OAuth Screenshot](./image/10.png)

- Click **Enable**  
![Google OAuth Screenshot](./image/11.png)

- Go to **OAuth Consent Screen** → **Data Access** → Click **Add Scope**  
![Google OAuth Screenshot](./image/12.png)  
![Google OAuth Screenshot](./image/13.png)

### **Add these scopes:**

```
https://www.googleapis.com/auth/userinfo.email

https://www.googleapis.com/auth/userinfo.profile

https://www.googleapis.com/auth/classroom.courses.readonly

https://www.googleapis.com/auth/classroom.student-submissions.me.readonly

https://www.googleapis.com/auth/classroom.coursework.me
```

![Google OAuth Screenshot](./image/14.png)

- Click **Update & Save**  
![Google OAuth Screenshot](./image/15.png)  
![Google OAuth Screenshot](./image/16.png)

---

## **5. Publish the App (Audience Setting)**

- Open **Audience** from the side menu  
![Google OAuth Screenshot](./image/17.png)

- Under Publishing Status → Click **Publish App** and confirm  
![Google OAuth Screenshot](./image/18.png)

---

## **6. Final Step: Add Credentials to Backend**

Copy your **Client ID** and **Client Secret** from the downloaded credentials JSON and paste them into your `.env` file:

```env
# ----------------- GOOGLE OAUTH2 CONFIGURATION ----------------
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
