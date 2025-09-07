# ⚙️ Installation & Running

1. **Clone the repository**  

   ```bash
   git clone https://github.com/Panthutk/UniPlan
   cd UniPlan

2. **cd backend (Django)**

```Bash
cd backend
python -m venv myenv
.\myenv\Scripts\activate   # Windows
# source myenv/bin/activate  # macOS/Linux

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

backend runt at: <http://127.0.0.1:8000>

3. **Frontend (React + Vite)**

``` bash
cd frontend
npm install
npm install react-router-dom
npm run dev
```

frontend runs at: <http://127.0.0.1:5173>

API test endpoint: <http://127.0.0.1:8000/api/hello/>
