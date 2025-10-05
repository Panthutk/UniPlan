FROM node:20
WORKDIR /app

# 1) install deps using lockfile if present
COPY frontend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm i --no-audit --no-fund; fi

# 2) copy app source (node_modules will NOT be copied thanks to root .dockerignore)
COPY frontend/ ./

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
