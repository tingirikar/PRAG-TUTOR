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

// Database connection: Local MongoDB by default or MONGODB_URI if set
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lpi_tutor'
let mongoReady = false

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher'], required: true },
  subject: { type: String, default: null }, // 'DSA' or 'ML'
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
        { username: 'student', password: 'student123', name: 'Alex (Student)', role: 'student' },
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

try {
  await mongoose.connect(mongoUri)
  mongoReady = true
  console.log('MongoDB connected to', mongoUri)
  await seedDatabase()
} catch (error) {
  console.warn(`MongoDB connection notice: ${error.message}`)
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
    const result = await callPython(`/rag/sample-questions?seed=${encodeURIComponent(seed)}`, {
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

  try {
    if (mongoReady) {
      await Promise.all(files.map(file => Document.findOneAndUpdate(
        { name: file.filename },
        { name: file.filename, size: file.size, uploadedAt: new Date(), status: 'Uploaded' },
        { upsert: true, new: true },
      )))
    }
    // Only process the newly uploaded files
    const filenames = files.map(file => file.filename)
    await callPython('/rag/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames }),
      timeout: 300000, // 5 minute timeout for document indexing
    })
    if (mongoReady) await Document.updateMany({ name: { $in: filenames } }, { status: 'Indexed' })
    response.json({ message: `Successfully uploaded and indexed ${files.length} document(s).`, files: filenames })
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message })
  }
})

app.get('/api/documents', async (_request, response) => {
  try {
    const documents = mongoReady ? await Document.find().sort({ uploadedAt: -1 }).lean() : await filesystemDocuments()
    response.json({ documents: documents.map(document => ({ ...document, id: document.id || document._id?.toString() })) })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

app.post('/api/documents/delete', async (request, response) => {
  const filename = path.basename(String(request.body?.filename || ''))
  if (!filename) return response.status(400).json({ error: 'Filename is required.' })

  try {
    const result = await callPython('/rag/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
      timeout: 60000, // 1 minute timeout for document deletion
    })
    if (mongoReady) await Document.deleteOne({ name: filename })
    response.json({ message: `Document '${filename}' deleted successfully.`, ...result })
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message })
  }
})

// Proxy image requests to the Python service's static image files
app.get('/api/images/{*imagePath}', async (request, response) => {
  try {
    const rawPath = request.params.imagePath || request.params[0]
    const imagePath = Array.isArray(rawPath) ? rawPath.join('/') : rawPath
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
