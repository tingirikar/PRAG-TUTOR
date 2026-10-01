import { randomUUID } from 'node:crypto'
import Conversation from '../models/Conversation.js'
import { isMongoReady } from '../config/db.js'
import { callPython } from '../services/pythonService.js'

export async function handleQuery(request, response) {
  const query = String(request.body?.query || request.body?.question || '').trim()
  if (!query) return response.status(400).json({ error: 'Please enter a question.' })

  const subject = String(request.body?.subject || 'DSA').trim()
  const topic = request.body?.topic ? String(request.body.topic).trim() : null
  const studentUsername = String(request.body?.studentUsername || 'student').trim()
  let conversationId = request.body?.conversationId

  try {
    // 1. Call Python RAG Backend
    const result = await callPython('/rag/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        topic: topic || undefined,
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
    if (isMongoReady()) {
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
}

export async function getModels(_request, response) {
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
}

export async function handleQueryImages(request, response) {
  const query = String(request.body?.query || request.body?.question || '').trim()
  if (!query) return response.status(400).json({ error: 'Please enter a question.' })

  const conversationId = request.body?.conversationId
  const messageId = request.body?.messageId

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

    // Persist discovered diagrams back to MongoDB conversation so they never disappear on reload
    if (isMongoReady() && conversationId && Array.isArray(result.images) && result.images.length > 0) {
      try {
        const conv = await Conversation.findById(conversationId)
        if (conv && Array.isArray(conv.messages)) {
          let updated = false
          for (let i = conv.messages.length - 1; i >= 0; i--) {
            const m = conv.messages[i]
            if (m.role === 'assistant' && (!messageId || m.id === messageId)) {
              m.images = result.images
              updated = true
              break
            }
          }
          if (updated) {
            conv.markModified('messages')
            await conv.save()
          }
        }
      } catch (err) {
        console.warn('[Notice] Could not attach diagrams to conversation:', err.message)
      }
    }

    response.json(result)
  } catch (error) {
    response.status(error.status || 503).json({ error: error.message })
  }
}

export async function getSampleQuestions(request, response) {
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
}
