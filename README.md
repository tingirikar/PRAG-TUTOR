### Terminal 1 (Backend)
```
cd backend
py -3.14 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2 (Server)
```
cd server
npm start
```

### Terminal 3 (Frontend)
```
cd frontend
npm run dev
```
