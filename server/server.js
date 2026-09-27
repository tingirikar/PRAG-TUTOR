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

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'Uploaded' },
}, { versionKey: false })
const Document = mongoose.models.Document || mongoose.model('Document', documentSchema)
let mongoReady = false

if (process.env.MONGODB_URI) {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    mongoReady = true
    console.log('MongoDB connected')
  } catch (error) {
    console.warn(`MongoDB unavailable; using filesystem metadata: ${error.message}`)
  }
} else {
  console.warn('MONGODB_URI is not set; using filesystem metadata')
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

app.post('/api/query', async (request, response) => {
  const query = String(request.body?.query || request.body?.question || '').trim()
  if (!query) return response.status(400).json({ error: 'Please enter a question.' })

  try {
    const result = await callPython('/rag/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        level: request.body?.level || 'beginner',
        model: request.body?.model || 'openai/gpt-oss-20b',
        provider: request.body?.provider || 'groq',
        history: request.body?.history || [],
        include_image: request.body?.include_image !== undefined ? Boolean(request.body.include_image) : true,
      }),
      timeout: 180000, // 3 minute timeout for query processing
    })
    response.json(result)
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
