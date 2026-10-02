# Setup PRAG-TUTOR on Windows

ensure u have python 3.12 version
```text
python --version
```
node.js and npm installed

### STEP 1 : clone PRAG-TUTOR repository
open command prompt, go to ur desired directory
and enter this command

(u can also open windows explorer, go to desired folder and enter ```cmd``` in path and use this command)


```bash
git clone https://github.com/tingirikar/PRAG-TUTOR.git
```

### STEP 2 : setup environment variable
there is .env.example  
create .env file and paste contents of .env.example  
now go to respective providers and get api keys

### STEP 3 : INSTALL DEPENDENCIES
```bash
py -3.12 -m pip install -r tutor\requirements.txt
```

navigate to backend directory
```bash
cd backend
npm install
```

navigate to frontend directory
```bash
cd frontend
npm install
```

### STEP 4 : RUNNING PRAG-TUTOR

in terminal-1
```bash
cd PRAG-TUTOR
py -3.12 -m uvicorn tutor.main:app --host 127.0.0.1 --port 8000 --reload
```

in terminal-2
```bash
cd backend
npm run dev
```

in terminal-3
```bash
cd frontend
npm run dev
```
