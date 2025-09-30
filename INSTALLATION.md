# ⚙️ Installation & Running

1. **Clone the repository**  

```bash
git clone https://github.com/Panthutk/UniPlan
cd UniPlan
```

2. ***Create Env***

- Create file `.env` int `./backend/`

```env
DJANGO_SECRET=your_django_secret_key_here
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/auth/google/callback
```

- Create file `.env` int `./frontend/`

``` env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

3. **cd backend (Django)**

```Bash
cd backend
python -m venv myenv
.\myenv\Scripts\activate   # Windows
# source myenv/bin/activate  # macOS/Linux

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

3. **Frontend (React + Vite)**

``` bash
cd frontend
npm install
npm install react-router-dom
npm run dev
```

Landing page: <http://127.0.0.1:5173>
