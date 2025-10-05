# backend/Dockerfile
FROM python:3.13-slim

WORKDIR /app

# system deps (curl just for convenience; you can drop it)
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential default-libmysqlclient-dev curl \
 && rm -rf /var/lib/apt/lists/*

# install Python deps
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# copy backend code
COPY backend /app

EXPOSE 8000
CMD ["python", "manage.py", "migrate", "--noinput", "&&", "python", "manage.py", "runserver", "0.0.0.0:8000"]
