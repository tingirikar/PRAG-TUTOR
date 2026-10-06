import path from 'node:path'
import fs from 'node:fs/promises'
import Document from '../models/Document.js'
import User from '../models/User.js'
import { isMongoReady } from '../config/db.js'
import { callPython, pythonUrl } from '../services/pythonService.js'
import { filesystemDocuments } from '../services/documentService.js'
import { uploadDir } from '../middleware/upload.js'

export async function uploadDocuments(request, response) {
  const files = [...(request.files?.file || []), ...(request.files?.files || [])]
  if (!files.length) return response.status(400).json({ error: 'No PDF file uploaded.' })
  const subject = String(request.body?.subject || request.query?.subject || 'DSA').trim().toUpperCase()
  const subjFolder = path.join(uploadDir, subject.toLowerCase())
  await fs.mkdir(subjFolder, { recursive: true })

  // Ensure files are in uploads/{subject.toLowerCase()}/
  for (const file of files) {
    const targetPath = path.join(subjFolder, file.filename)
    if (file.path && file.path !== targetPath) {
      const exists = await fs.stat(file.path).catch(() => null)
      if (exists) {
        await fs.rename(file.path, targetPath).catch(() => {})
      }
    }
  }

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
      if (isMongoReady()) {
        await Promise.all(files.map(file => Document.findOneAndUpdate(
          { name: file.filename, subject },
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

      if (isMongoReady()) await Document.updateMany({ name: { $in: filenames }, subject }, { status: 'Indexed' })
      sendEvent({ percent: 100, stage: 'Completed & Indexed', done: true, files: filenames, subject })
      response.end()
    } catch (error) {
      sendEvent({ error: error.message, percent: -1 })
      response.end()
    }
    return
  }

  try {
    if (isMongoReady()) {
      await Promise.all(files.map(file => Document.findOneAndUpdate(
        { name: file.filename, subject },
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
    if (isMongoReady()) await Document.updateMany({ name: { $in: filenames }, subject }, { status: 'Indexed' })
    response.json({ message: `Successfully uploaded and indexed ${files.length} document(s) for ${subject}.`, files: filenames, subject })
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message })
  }
}

export async function getDocuments(request, response) {
  try {
    const subject = request.query?.subject ? String(request.query.subject).trim() : null
    const filter = subject ? { subject } : {}
    let documents = isMongoReady()
      ? await Document.find(filter).sort({ uploadedAt: -1 }).lean()
      : []

    if (!documents || documents.length === 0) {
      documents = await filesystemDocuments(subject)
      if (isMongoReady() && documents.length > 0) {
        await Promise.all(documents.map(d => Document.findOneAndUpdate(
          { name: d.name, subject: d.subject },
          { name: d.name, subject: d.subject, size: d.size, uploadedAt: new Date(), status: d.status || 'Uploaded' },
          { upsert: true, new: true }
        ))).catch(() => {})
      }
    }

    response.json({ documents: documents.map(document => ({ ...document, id: document.id || document._id?.toString() })) })
  } catch (error) {
    return response.status(500).json({ error: error.message })
  }
}

export async function deleteDocument(request, response) {
  const filename = path.basename(String(request.body?.filename || ''))
  const subject = String(request.body?.subject || 'DSA').trim().toUpperCase()
  if (!filename) return response.status(400).json({ error: 'Filename is required.' })

  try {
    const result = await callPython('/rag/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, subject }),
      timeout: 60000, // 1 minute timeout for document deletion
    })

    // Remove PDF from uploads/<subject.toLowerCase()>/
    const subjectFile = path.join(uploadDir, subject.toLowerCase(), filename)
    await fs.unlink(subjectFile).catch(() => {})
    // Also remove extracted images: uploads/<subject.toLowerCase()>/images/<safe_name>/
    const safeName = filename.replace(/\s+/g, '_').replace(/\./g, '_')
    const imgDir = path.join(uploadDir, subject.toLowerCase(), 'images', safeName)
    await fs.rm(imgDir, { recursive: true, force: true }).catch(() => {})

    if (isMongoReady()) await Document.deleteOne({ name: filename, ...(subject ? { subject } : {}) })
    response.json({ message: `Document '${filename}' deleted successfully from ${subject}.`, ...result })
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message })
  }
}

export async function proxyImage(request, response) {
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
    const username = (request.user?.username || request.query?.u || request.headers['x-user'] || '').toString().trim()
    if (!username) {
      return response.status(401).json({ error: 'Unauthorized: login required to access course diagrams.' })
    }

    let user = null
    if (isMongoReady()) {
      user = await User.findOne({ username })
    } else {
      const demoUsers = {
        student: { username: 'student', role: 'student' },
        teacher_dsa: { username: 'teacher_dsa', role: 'teacher', subject: 'DSA' },
        teacher_ml: { username: 'teacher_ml', role: 'teacher', subject: 'ML' },
        teacher_os: { username: 'teacher_os', role: 'teacher', subject: 'OS' },
        teacher_dbms: { username: 'teacher_dbms', role: 'teacher', subject: 'DBMS' },
        teacher_networks: { username: 'teacher_networks', role: 'teacher', subject: 'NETWORKS' },
        teacher_cn: { username: 'teacher_cn', role: 'teacher', subject: 'CN' },
      }
      user = demoUsers[username] || null
    }

    if (!user) {
      return response.status(403).json({ error: 'Forbidden: invalid student or faculty account.' })
    }

    // 3. Subject Authorization Check
    const segments = imagePath.split('/').filter(Boolean)
    let docSubject = null
    if (segments.length >= 1) {
      const firstUpper = segments[0].toUpperCase()
      if (['DSA', 'ML', 'CN', 'OS', 'DBMS', 'NETWORKS'].includes(firstUpper)) {
        docSubject = firstUpper
      }
    }

    // Faculty members may only access diagrams for their own subject
    if (docSubject && user.role === 'teacher') {
      if (user.subject && user.subject.toUpperCase() !== docSubject) {
        return response.status(403).json({
          error: `Forbidden: Faculty member for ${user.subject} is not authorized to access ${docSubject} course materials.`,
        })
      }
    }

    // 4. Fast direct disk delivery if available
    const candidatePath = path.join(uploadDir, imagePath)
    const exists = await fs.stat(candidatePath).catch(() => null)
    if (exists && exists.isFile()) {
      return response.sendFile(candidatePath)
    }

    if (segments.length >= 2 && segments[1].toLowerCase() !== 'images') {
      const candidateWithImages = path.join(uploadDir, segments[0].toLowerCase(), 'images', ...segments.slice(1))
      const existsWithImages = await fs.stat(candidateWithImages).catch(() => null)
      if (existsWithImages && existsWithImages.isFile()) {
        return response.sendFile(candidateWithImages)
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
}
