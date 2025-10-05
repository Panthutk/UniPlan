FROM node:20
WORKDIR /app

# copy deps files from the *frontend* folder in the root context
COPY frontend/package*.json ./
# install (use lockfile if present)
RUN if [ -f package-lock.json ]; then npm ci; else npm i; fi

# now copy the rest of the frontend source
COPY frontend ./  

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
