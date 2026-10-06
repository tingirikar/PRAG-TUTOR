# ARCHITECTURE

/// MERMAID VISUAL DIAGRAM ///

# HIGH LEVEL FOLDER STRUCTURE

```text
PRAG-TUTOR
|
|__ README.md
|__ SETUP.md
|__ ARCHITECTURE.md
|__ TECHSTACK.md
|
|__ .gitignore
|__ .env
|__ .env.example
|__ assets/             # images of prag-tutor's website
|
|__ frontend/           # ReactJS
|__ backend/            # NodeJS, ExpressJS, MongoDB
|__ tutor/              # FastAPI
|__ uploads/            # teacher uploaded documents and extracted images
```

# |__tutor/

### HIGH LEVEL

```text
tutor/
|
|__ requirements.txt        # required libararies
|__ main.py                 # entry point
|
|__ config/
|__ document_processing/
|__ query_processing/
|__ learner_modelling/
```

### LOW LEVEL

```text
config/
|
|__ db.py
```

```text
document_processing/
|
|__ chunking.py
|__ embedding.py
|__ indexing.py
|__ image_extracter.py
```

```text
query_processing/
|
|__ query_analyzer.py
|__ image_handler.py
|__ response_generator.py
```

```text
learner_modelling/
|
|__ ?
```

# |__backend/

### HIGH LEVEL (Model-Router-Model Architecture)

```text
backend/
|
|__ server.js
|__ package.json
|__ package-lock.json
|__ node_modules/
|
|__ config/
|__ models/
|__ routes/
|__ middleware/
|__ controllers/
|__ services/
```

### LOW LEVEL

```text
config/
|
|__ db.js
|__ seed.js
```

```text
models/
|
|__ User.js
|__ Subject.js
|__ Document.js
|__ Prerequisite.js
|__ Conversation.js
```

```text
routes/
|
|__ authRoutes.js
|__ subjectRoutes.js
|__ queryRoutes.js
|__ conversationRoutes.js
|__ prerequisiteRoutes.js
|__ documentRoutes.js
```

```text
middleware/
|
|__ upload.js
```

```text
controllers/
|
|__ authController.js
|__ subjectsController.js
|__ queryController.js
|__ conversationController.js
|__ prerequistesController.js
|__ documentController.js
```

```text
services/
|
|__ pythonService.js
|__ documentService.js
```

# |__uploads/

```text
uploads/
|
|__ dsa/
|  |__ documents/
|  |__ images/
|
|__ ml/
|  |__ documents/
|  |__ images/
|
|__ ..
```

# |__frontend/

### HIGH LEVEL

```text
frontend/
|
|__ index.html
|__ package.json
|__ package-lock.json
|__ tsconfig.json
|__ vite.config.ts
|__ node_modules/
|
|__ src/
   |
   |__ App.?? 
   |
   |__ components/
   |__ pages/
```
