so whenever u modify code
push to github
to see changes on live
here's what to do

### step 1.

```
git add .
git commit -m "describe what you changed"
git push origin main
```

### step 2.
```
ssh -i prag-tutor-key.pem ubuntu@54.196.42.106
```

```
cd /home/ubuntu/PRAG-TUTOR && git pull origin main && cd frontend && npm run build && pm2 restart all
```

### if installed a new library
```
cd /home/ubuntu/PRAG-TUTOR/backend && npm install && pm2 restart prag-node
```

### if you added a new python package
```
/home/ubuntu/PRAG-TUTOR/tutor/venv/bin/pip install -r /home/ubuntu/PRAG-TUTOR/tutor/requirements.txt && pm2 restart prag-python
```
