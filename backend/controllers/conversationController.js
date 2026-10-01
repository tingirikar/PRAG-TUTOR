import Conversation from '../models/Conversation.js'
import { isMongoReady } from '../config/db.js'

export async function getConversations(request, response) {
  try {
    const studentUsername = String(request.query.studentUsername || 'student').trim()
    const subject = String(request.query.subject || '').trim()
    const filter = { studentUsername }
    if (subject) filter.subject = subject

    if (isMongoReady()) {
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
}

export async function getConversationById(request, response) {
  try {
    if (isMongoReady()) {
      const conversation = await Conversation.findById(request.params.id).lean()
      if (!conversation) return response.status(404).json({ error: 'Conversation not found.' })
      return response.json({ conversation })
    }
    return response.status(404).json({ error: 'Conversation not found.' })
  } catch (err) {
    response.status(500).json({ error: err.message })
  }
}

export async function deleteConversation(request, response) {
  try {
    if (isMongoReady()) {
      await Conversation.findByIdAndDelete(request.params.id)
      return response.json({ success: true, id: request.params.id })
    }
    return response.json({ success: true, id: request.params.id })
  } catch (err) {
    response.status(500).json({ error: err.message })
  }
}
