# ⚙️ Installation & Running

1. **Clone the repository**  

```bash
git clone https://github.com/Panthutk/UniPlan
cd UniPlan
```

2. ***Create Env***

- Create file `.env` int `./backend/`

```env
DJANGO_SECRET=dev-only-change-me
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```

- Create file `.env` int `./frontend/`

``` env
VITE_API_BASE_URL=http://127.0.0.1:8000
```
3. ***Start the stack***

docker compose up -d --build

Landing page: <http://127.0.0.1:5173>
