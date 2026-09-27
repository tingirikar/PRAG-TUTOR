import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import multer from 'multer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const uploadDir = path.join(projectRoot, 'backend', 'uploads')
const pythonUrl = process.env.PYTHON_RAG_URL || 'http://127.0.0.1:8000'
const port = Number(process.env.PORT || 5000)

await fs.mkdir(uploadDir, { recursive: true })

// Database connection: Load .env if present
async function loadEnvFiles() {
  const envCandidates = [
    path.join(projectRoot, '.env'),
    path.join(projectRoot, 'backend', '.env'),
    path.join(__dirname, '.env'),
  ]
  for (const envPath of envCandidates) {
    try {
      const content = await fs.readFile(envPath, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const match = trimmed.match(/^([^=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          let val = match[2].trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      }
    } catch {
      // file not found, continue
    }
  }
}

await loadEnvFiles()

let mongoReady = false

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher'], required: true },
  subject: { type: String, default: null }, // 'DSA' or 'ML'
  enrolledSubjects: { type: [String], default: ['DSA', 'ML'] },
}, { timestamps: true })
const User = mongoose.models.User || mongoose.model('User', userSchema)

const subjectSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // 'DSA', 'ML'
  name: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '📚' },
  teacherUsername: { type: String, default: '' },
  teacherName: { type: String, default: '' },
}, { timestamps: true })
const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema)

const messageSchema = new mongoose.Schema({
  id: { type: String, default: () => randomUUID() },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  topic: { type: String, default: null },
  prerequisites: { type: [String], default: [] },
  sources: { type: [mongoose.Schema.Types.Mixed], default: [] },
  images: { type: [mongoose.Schema.Types.Mixed], default: [] },
  model: { type: String, default: null },
  provider: { type: String, default: 'groq' },
  level: { type: String, default: 'beginner' },
  createdAt: { type: Date, default: Date.now }
})

const conversationSchema = new mongoose.Schema({
  studentUsername: { type: String, required: true, index: true },
  subject: { type: String, required: true, index: true },
  title: { type: String, required: true },
  messages: [messageSchema],
}, { timestamps: true })
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema)

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  subject: { type: String, default: 'DSA' },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'Uploaded' },
}, { versionKey: false })
const Document = mongoose.models.Document || mongoose.model('Document', documentSchema)

async function seedDatabase() {
  try {
    const userCount = await User.countDocuments()
    if (userCount === 0) {
      console.log('Seeding initial student and teacher accounts...')
      await User.insertMany([
        { username: 'student', password: 'student123', name: 'Alex (Student)', role: 'student', enrolledSubjects: ['DSA', 'ML'] },
        { username: 'teacher_dsa', password: 'dsa123', name: 'Dr. Sarah (DSA Faculty)', role: 'teacher', subject: 'DSA' },
        { username: 'teacher_ml', password: 'ml123', name: 'Prof. Alan (ML Faculty)', role: 'teacher', subject: 'ML' },
      ])
      console.log('Accounts seeded successfully.')
    }

    const subjectCount = await Subject.countDocuments()
    if (subjectCount === 0) {
      console.log('Seeding initial subjects (DSA & ML)...')
      await Subject.insertMany([
        {
          code: 'DSA',
          name: 'Data Structures & Algorithms',
          description: 'Master linear & non-linear structures, recursion, trees, graphs, sorting, and complexity analysis.',
          icon: '📘',
          teacherUsername: 'teacher_dsa',
          teacherName: 'Dr. Sarah (DSA Faculty)'
        },
        {
          code: 'ML',
          name: 'Machine Learning',
          description: 'Explore supervised & unsupervised learning, cost functions, gradient descent, neural networks, and evaluation.',
          icon: '🤖',
          teacherUsername: 'teacher_ml',
          teacherName: 'Prof. Alan (ML Faculty)'
        },
      ])
      console.log('Subjects seeded successfully.')
    }
  } catch (err) {
    console.warn('Seeding error:', err.message)
  }
}

const configuredMongoUri = process.env.MONGODB_URI
const localMongoUri = 'mongodb://127.0.0.1:27017/lpi_tutor'

if (configuredMongoUri) {
  try {
    const isAtlas = configuredMongoUri.includes('@')
    console.log(`Connecting to ${isAtlas ? 'configured MongoDB Atlas' : 'configured MongoDB'}...`)
    await mongoose.connect(configuredMongoUri, { serverSelectionTimeoutMS: 5000 })
    mongoReady = true
    console.log('MongoDB connected successfully to configured URI.')
    await seedDatabase()
  } catch (err) {
    console.warn(`Configured MongoDB connection notice: ${err.message}. Falling back to local MongoDB...`)
  }
}

if (!mongoReady) {
  try {
    console.log('Connecting to local MongoDB (127.0.0.1:27017)...')
    await mongoose.connect(localMongoUri, { serverSelectionTimeoutMS: 3000 })
    mongoReady = true
    console.log('MongoDB connected to local instance.')
    await seedDatabase()
  } catch (error) {
    console.warn(`Local MongoDB connection notice: ${error.message}`)
  }
}

const app = express()
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_request, file, callback) => {
      const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')
      callback(null, safeName)
    },
  }),
  fileFilter: (_request, file, callback) => callback(null, file.mimetype === 'application/pdf'),
})

app.use(cors())
app.use(express.json())
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON request payload' })
  }
  next(err)
})

async function callPython(endpoint, options = {}) {
  const timeout = options.timeout || 120000 // Default 2 minute timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(`${pythonUrl}${endpoint}`, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.detail || payload.error || `Python service returned ${response.status}`)
      error.status = response.status
      throw error
    }
    return payload
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Python service request timed out after ${timeout}ms`)
      timeoutError.status = 504
      throw timeoutError
    }
    throw error
  }
}

async function filesystemDocuments() {
  const entries = await fs.readdir(uploadDir, { withFileTypes: true })
  let processed = {}
  try {
    processed = JSON.parse(await fs.readFile(path.join(uploadDir, 'processed_files.json'), 'utf8'))
  } catch {
    // The tracking file is optional until the first successful indexing run.
  }

  return Promise.all(entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map(async entry => {
      const filePath = path.join(uploadDir, entry.name)
      const stats = await fs.stat(filePath)
      return {
        id: entry.name,
        name: entry.name,
        size: stats.size,
        uploadedAt: stats.mtime.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        status: processed[entry.name] ? 'Indexed' : 'Uploaded',
      }
    }))
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', mongo: mongoReady })
})

// === Auth Endpoint ===
app.post('/api/auth/login', async (request, response) => {
  const { username, password } = request.body || {}
  if (!username || !password) {
    return response.status(400).json({ error: 'Username and password are required.' })
  }

  try {
    if (mongoReady) {
      const user = await User.findOne({ username: String(username).trim(), password: String(password).trim() })
      if (!user) {
        return response.status(401).json({ error: 'Invalid username or password.' })
      }
      return response.json({
        user: {
          username: user.username,
          name: user.name,
          role: user.role,
          subject: user.subject
        }
      })
    }

    // In-memory fallback if Mongo offline
    if (username === 'student' && password === 'student123') {
      return response.json({ user: { username: 'student', name: 'Alex (Student)', role: 'student' } })
    }
    if (username === 'teacher_dsa' && password === 'dsa123') {
      return response.json({ user: { username: 'teacher_dsa', name: 'Dr. Sarah (DSA Faculty)', role: 'teacher', subject: 'DSA' } })
    }
    if (username === 'teacher_ml' && password === 'ml123') {
      return response.json({ user: { username: 'teacher_ml', name: 'Prof. Alan (ML Faculty)', role: 'teacher', subject: 'ML' } })
    }
    return response.status(401).json({ error: 'Invalid username or password.' })
  } catch (err) {
    response.status(500).json({ error: err.message })
  }
})

// === Subjects Endpoint ===
app.get('/api/subjects', async (_request, response) => {
  try {
    if (mongoReady) {
      const subjects = await Subject.find().lean()
      if (subjects.length > 0) return response.json({ subjects })
    }
    return response.json({
      subjects: [
        {
          code: 'DSA',
          name: 'Data Structures & Algorithms',
          description: 'Master linear & non-linear structures, recursion, trees, graphs, sorting, and complexity analysis.',
          icon: '📘',
          teacherUsername: 'teacher_dsa',
          teacherName: 'Dr. Sarah (DSA Faculty)'
        },
        {
          code: 'ML',
          name: 'Machine Learning',
          description: 'Explore supervised & unsupervised learning, cost functions, gradient descent, neural networks, and evaluation.',
          icon: '🤖',
          teacherUsername: 'teacher_ml',
          teacherName: 'Prof. Alan (ML Faculty)'
        }
      ]
    })
  } catch (err) {
    response.status(500).json({ error: err.message })
  }
})

// === Conversations Endpoints ===
app.get('/api/conversations', async (request, response) => {
  try {
    const studentUsername = String(request.query.studentUsername || 'student').trim()
    const subject = String(request.query.subject || '').trim()
    const filter = { studentUsername }
    if (subject) filter.subject = subject

    if (mongoReady) {
      const conversations = await Conversation.find(filter)
        .select('_id title subject studentUsername updatedAt createdAt')
        .sort({ updatedAt: -1 })
        .lean()
      return response.json({ conversations })
    }
    return response.json({ conversations: [] })
  } catch (err) {
    response.status(500).json({ error: err.message })
  }
})

app.get('/api/conversations/:id', async (request, response) => {
  try {
    if (mongoReady) {
      const conversation = await Conversation.findById(request.params.id).lean()
      if (!conversation) return response.status(404).json({ error: 'Conversation not found.' })
      return response.json({ conversation })
    }
    return response.status(404).json({ error: 'Conversation not found.' })
  } catch (err) {
    response.status(500).json({ error: err.message })
  }
})

app.post('/api/conversations', async (request, response) => {
  try {
    const studentUsername = String(request.body?.studentUsername || 'student').trim()
    const subject = String(request.body?.subject || 'DSA').trim()
    const title = String(request.body?.title || 'New Conversation').trim()

    if (mongoReady) {
      const conversation = await Conversation.create({
        studentUsername,
        subject,
        title,
        messages: []
      })
      return response.json({ conversation })
    }
    return response.json({
      conversation: { _id: randomUUID(), studentUsername, subject, title, messages: [] }
    })
  } catch (err) {
    response.status(500).json({ error: err.message })
  }
})

app.delete('/api/conversations/:id', async (request, response) => {
  try {
    if (mongoReady) {
      await Conversation.findByIdAndDelete(request.params.id)
      return response.json({ success: true, id: request.params.id })
    }
    return response.json({ success: true, id: request.params.id })
  } catch (err) {
    response.status(500).json({ error: err.message })
  }
})

app.post('/api/query', async (request, response) => {
  const query = String(request.body?.query || request.body?.question || '').trim()
  if (!query) return response.status(400).json({ error: 'Please enter a question.' })

  const subject = String(request.body?.subject || 'DSA').trim()
  const studentUsername = String(request.body?.studentUsername || 'student').trim()
  let conversationId = request.body?.conversationId

  try {
    // 1. Call Python RAG Backend
    const result = await callPython('/rag/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        subject,
        level: request.body?.level || 'beginner',
        model: request.body?.model || 'openai/gpt-oss-20b',
        provider: request.body?.provider || 'groq',
        history: request.body?.history || [],
        include_image: request.body?.include_image !== undefined ? Boolean(request.body.include_image) : true,
        image_mode: request.body?.image_mode || 'notes',
      }),
      timeout: 180000, // 3 minute timeout for query processing
    })

    // 2. Persist to MongoDB conversation if available
    if (mongoReady) {
      let conversation = null
      if (conversationId) {
        conversation = await Conversation.findById(conversationId)
      }
      if (!conversation) {
        const title = query.length > 38 ? `${query.slice(0, 38)}...` : query
        conversation = await Conversation.create({
          studentUsername,
          subject,
          title,
          messages: []
        })
        conversationId = conversation._id.toString()
      }

      const userMsg = {
        id: randomUUID(),
        role: 'user',
        content: query,
        createdAt: new Date()
      }
      const assistantMsg = {
        id: randomUUID(),
        role: 'assistant',
        content: result.response || result.answer || '',
        topic: result.topic || null,
        prerequisites: result.prerequisites || [],
        sources: result.sources || [],
        images: result.images || [],
        model: result.model || request.body?.model,
        provider: result.provider || request.body?.provider,
        level: request.body?.level || 'beginner',
        createdAt: new Date()
      }

      conversation.messages.push(userMsg, assistantMsg)
      conversation.updatedAt = new Date()
      await conversation.save()
    }

    response.json({ ...result, conversationId })
  } catch (error) {
    response.status(error.status || 503).json({ error: error.message })
  }
})

app.get('/api/models', async (_request, response) => {
  try {
    const result = await callPython('/rag/models', { timeout: 10000 })
    response.json(result)
  } catch (error) {
    response.json({
      models: [
        { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Default)' },
        { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B' },
        { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B' },
      ],
      default: 'openai/gpt-oss-20b'
    })
  }
})

app.post('/api/query/images', async (request, response) => {
  const query = String(request.body?.query || request.body?.question || '').trim()
  if (!query) return response.status(400).json({ error: 'Please enter a question.' })

  try {
    const result = await callPython('/rag/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        topic: request.body?.topic || '',
        mode: request.body?.mode || 'notes',
        subject: request.body?.subject || 'DSA',
      }),
      timeout: 120000, // 2 minute timeout for image loading
    })
    response.json(result)
  } catch (error) {
    response.status(error.status || 503).json({ error: error.message })
  }
})

app.get('/api/sample-questions', async (request, response) => {
  try {
    const seed = request.query.seed || randomUUID()
    const subject = request.query.subject || ''
    const result = await callPython(`/rag/sample-questions?seed=${encodeURIComponent(seed)}&subject=${encodeURIComponent(subject)}`, {
      timeout: 60000, // 1 minute timeout for sample questions
    })
    response.json(result)
  } catch (error) {
    response.status(error.status || 503).json({ error: error.message })
  }
})

app.get('/api/prerequisites', async (_request, response) => {
  try {
    const result = await callPython('/rag/prerequisites', {
      timeout: 30000, // 30 second timeout for prerequisites
    })
    response.json(result)
  } catch (error) {
    response.status(503).json({ error: error.message })
  }
})

app.post('/api/upload', upload.fields([{ name: 'file', maxCount: 20 }, { name: 'files', maxCount: 20 }]), async (request, response) => {
  const files = [...(request.files?.file || []), ...(request.files?.files || [])]
  if (!files.length) return response.status(400).json({ error: 'No PDF file uploaded.' })
  const subject = String(request.body?.subject || request.query?.subject || 'DSA').trim()

  const wantsStream = request.headers.accept?.includes('text/event-stream') || request.query?.stream === 'true'

  if (wantsStream) {
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')
    if (typeof response.flushHeaders === 'function') response.flushHeaders()

    const sendEvent = (data) => {
      response.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    sendEvent({ percent: 5, stage: 'File received. Registering in database...' })

    try {
      if (mongoReady) {
        await Promise.all(files.map(file => Document.findOneAndUpdate(
          { name: file.filename },
          { name: file.filename, size: file.size, subject, uploadedAt: new Date(), status: 'Uploaded' },
          { upsert: true, new: true },
        )))
      }

      sendEvent({ percent: 10, stage: 'Connected to AI processing engine...' })
      const filenames = files.map(file => file.filename)

      const pyRes = await fetch(`${pythonUrl}/rag/index/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames, subject }),
      })

      if (!pyRes.ok) {
        const errText = await pyRes.text().catch(() => '')
        throw new Error(`Python indexing service error (${pyRes.status}): ${errText}`)
      }

      const reader = pyRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6))
              sendEvent(parsed)
            } catch {
              // ignore partial json
            }
          }
        }
      }

      if (mongoReady) await Document.updateMany({ name: { $in: filenames } }, { status: 'Indexed' })
      sendEvent({ percent: 100, stage: 'Completed & Indexed', done: true, files: filenames, subject })
      response.end()
    } catch (error) {
      sendEvent({ error: error.message, percent: -1 })
      response.end()
    }
    return
  }

  try {
    if (mongoReady) {
      await Promise.all(files.map(file => Document.findOneAndUpdate(
        { name: file.filename },
        { name: file.filename, size: file.size, subject, uploadedAt: new Date(), status: 'Uploaded' },
        { upsert: true, new: true },
      )))
    }
    // Only process the newly uploaded files for the given subject
    const filenames = files.map(file => file.filename)
    await callPython('/rag/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames, subject }),
      timeout: 300000, // 5 minute timeout for document indexing
    })
    if (mongoReady) await Document.updateMany({ name: { $in: filenames } }, { status: 'Indexed' })
    response.json({ message: `Successfully uploaded and indexed ${files.length} document(s) for ${subject}.`, files: filenames, subject })
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message })
  }
})

app.get('/api/documents', async (request, response) => {
  try {
    const subject = request.query?.subject ? String(request.query.subject).trim() : null
    const filter = subject ? { subject } : {}
    const documents = mongoReady ? await Document.find(filter).sort({ uploadedAt: -1 }).lean() : await filesystemDocuments()
    response.json({ documents: documents.map(document => ({ ...document, id: document.id || document._id?.toString() })) })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

app.post('/api/documents/delete', async (request, response) => {
  const filename = path.basename(String(request.body?.filename || ''))
  const subject = request.body?.subject ? String(request.body.subject).trim() : 'DSA'
  if (!filename) return response.status(400).json({ error: 'Filename is required.' })

  try {
    const result = await callPython('/rag/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, subject }),
      timeout: 60000, // 1 minute timeout for document deletion
    })
    if (mongoReady) await Document.deleteOne({ name: filename, ...(subject ? { subject } : {}) })
    response.json({ message: `Document '${filename}' deleted successfully from ${subject}.`, ...result })
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message })
  }
})

// Proxy image requests to the Python service with authentication, subject authorization, and path safety checks (Ghost 8 Fix)
app.get('/api/images/{*imagePath}', async (request, response) => {
  try {
    const rawPath = request.params.imagePath || request.params[0]
    let imagePath = Array.isArray(rawPath) ? rawPath.join('/') : rawPath
    if (!imagePath) {
      return response.status(400).json({ error: 'Image path is required.' })
    }

    // Try decoding URI component to prevent encoded traversal attacks (%2e%2e)
    try {
      imagePath = decodeURIComponent(imagePath)
    } catch {
      return response.status(400).json({ error: 'Malformed image path encoding.' })
    }

    // 1. Path traversal security check
    if (imagePath.includes('..') || path.isAbsolute(imagePath)) {
      return response.status(400).json({ error: 'Invalid or unsafe image path.' })
    }

    // 2. Authentication check: user must provide valid student or teacher credentials
    const username = (request.query?.u || request.headers['x-user'] || '').toString().trim()
    if (!username) {
      return response.status(401).json({ error: 'Unauthorized: login required to access course diagrams.' })
    }

    let user = null
    if (mongoReady) {
      user = await User.findOne({ username })
    } else {
      const demoUsers = {
        student: { username: 'student', role: 'student', enrolledSubjects: ['DSA', 'ML'] },
        teacher_dsa: { username: 'teacher_dsa', role: 'teacher', subject: 'DSA' },
        teacher_ml: { username: 'teacher_ml', role: 'teacher', subject: 'ML' },
      }
      user = demoUsers[username] || null
    }

    if (!user) {
      return response.status(403).json({ error: 'Forbidden: invalid student or faculty account.' })
    }

    // 3. Document and Subject Authorization Check
    const segments = imagePath.split('/').filter(Boolean)
    if (segments.length >= 1) {
      const folderStem = segments[0]
      let docSubject = null

      if (mongoReady) {
        const docMatch = await Document.findOne({
          $or: [
            { name: { $regex: new RegExp(folderStem.replace(/_pdf$/i, ''), 'i') } },
            { name: folderStem },
          ],
        })
        if (docMatch) {
          docSubject = docMatch.subject
        }
      }

      // Infer subject from folder stem if not in database
      if (!docSubject) {
        if (/dsa/i.test(folderStem)) docSubject = 'DSA'
        else if (/ml/i.test(folderStem)) docSubject = 'ML'
      }

      // Enforce role-based subject authorization before any disk lookup
      if (docSubject) {
        if (user.role === 'teacher') {
          if (user.subject && user.subject.toUpperCase() !== docSubject.toUpperCase()) {
            return response.status(403).json({
              error: `Forbidden: Faculty member for ${user.subject} is not authorized to access ${docSubject} course materials.`,
            })
          }
        } else if (user.role === 'student') {
          const enrolled = (user.enrolledSubjects && user.enrolledSubjects.length > 0)
            ? user.enrolledSubjects.map(s => s.toUpperCase())
            : ['DSA', 'ML']
          if (!enrolled.includes(docSubject.toUpperCase())) {
            return response.status(403).json({
              error: `Forbidden: Student is not enrolled in ${docSubject}.`,
            })
          }
        }
      }

      // 4. Document / Diagram Existence Check
      if (mongoReady) {
        const docExists = await Document.findOne({
          $or: [
            { name: { $regex: new RegExp(folderStem.replace(/_pdf$/i, ''), 'i') } },
            { name: folderStem },
          ],
        })
        if (!docExists) {
          const localFolder = path.join(uploadDir, 'images', folderStem)
          const folderExists = await fs.stat(localFolder).catch(() => null)
          if (!folderExists) {
            return response.status(404).json({ error: 'Course diagram not found or document was removed.' })
          }
        }
      }
    }

    const imageUrl = `${pythonUrl}/images/${imagePath}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const upstream = await fetch(imageUrl, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!upstream.ok) return response.status(upstream.status).end()
    const contentType = upstream.headers.get('content-type') || 'image/png'
    response.setHeader('Content-Type', contentType)
    response.setHeader('Cache-Control', 'public, max-age=3600')
    const buffer = Buffer.from(await upstream.arrayBuffer())
    response.send(buffer)
  } catch (error) {
    if (error.name === 'AbortError') {
      return response.status(504).json({ error: 'Image fetch timed out' })
    }
    response.status(502).json({ error: 'Could not fetch image from RAG service.' })
  }
})

app.listen(port, () => console.log(`Node API server listening on http://127.0.0.1:${port}`))
