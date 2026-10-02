/**
 *  message Schema
 *  conversation Schema
**/

import mongoose from 'mongoose'
import { randomUUID } from 'node:crypto'

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
  createdAt: { type: Date, default: Date.now },
})

const conversationSchema = new mongoose.Schema({
  studentUsername: { type: String, required: true, index: true },
  subject: { type: String, required: true, index: true },
  title: { type: String, required: true },
  messages: [messageSchema],
}, { timestamps: true })

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema)

export default Conversation
