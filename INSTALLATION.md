# UniPlan

## 📖 Background

University students often need a timetable for classes and a task tracker for homework. Most tools keep these separate, forcing students to manually connect assignments with the related class. This leads to missed deadlines, confusion, and extra work.

## 🎯 Objective

To address the issue of missed deadlines, overwhelm, and confusion caused by the need to manage multiple timetables, particularly for university students, because most existing tools keep class schedules and task deadlines separate.  

UniPlan aims to provide an **all-in-one application** that integrates both class schedules and task tracking into a single, unified timetable.

## 📂 Documents

- [📄 GoogleDoc](https://docs.google.com/document/d/1DCrA-3688mUq6HGsNAnI9CS53ziWLud2McELJog4sqA/edit?usp=sharing) — Project write-up  
- [🎨 MockUp UI](https://www.canva.com/design/DAGxuHuyKDU/g_PNCcumdICsxAvOEeKd9A/edit?utm_content=DAGxuHuyKDU&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton) — Canva prototype  
- [🛠 Jira Board](https://ku-team-panthut.atlassian.net/jira/software/projects/TAW/settings/access) — Project management  

## 👥 Team Members

1. **Pannawit Mahacharoensiri** — 6610545855  
2. **Jongchana Khachatrokphai** — 6610545774  
3. **Panthut Ketphan** — 6610545421  
4. **Sorasit Kateratorn** — 6610545944  

## 🚀 Tech Stack

- **Frontend**: React + Vite + Tailwind CSS  
- **Backend**: Django REST Framework (DRF)  
- **Database**: SQLite (development) → upgradeable to PostgreSQL/MySQL  
- **Project Management**: Jira  

## ⚙️ Installation & Running

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
npm run dev
```

frontend runs at: <http://127.0.0.1:5173>

API test endpoint: <http://127.0.0.1:8000/api/hello/>
