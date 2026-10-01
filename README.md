# PRAG - TUTOR
personalized rag intelligent tutoring system

# HOW TO RUN

## STEP 1 : .env file
=> .env.example -> rename to .env
=> fill api keys

## STEP 2 : tutor/
=> pip install requirements.txt

## STEP 3 : running the project

### Terminal 1 : cd tutor/
```bash
py -3.12 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
we are using python version 3.12

### Terminal 2 : cd backend/
```bash
node server.js
```

### Terminal 3 : cd frontend/
```bash
npm run dev
```

# Folder Structure

```text
prag_tutor/
  ├── .env
  ├── .env.example
  ├── .gitignore
  ├── README.md
  │
  ├── frontend/
  │    ├── package.json
  │    ├── vite.config.js
  │    ├── index.html
  │    └── src/
  │
  ├── backend/
  │    ├── package.json
  │    ├── server.js
  │    ├── config/
  │    ├── controllers/
  │    ├── models/
  │    ├── routes/
  │    ├── middleware/
  │    └── services/
  │
  ├── tutor/
  │    ├── main.py
  │    ├── requirements.txt
  │    └── ...
  │
  └── uploads/
       ├── dsa/
       └── ml/
       └── ..
```
