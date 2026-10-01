import mongoose from 'mongoose'

const prerequisiteSchema = new mongoose.Schema({
  subject: { type: String, required: true, index: true },
  topic: { type: String, required: true },
  prerequisites: { type: [String], default: [] },
  isCustom: { type: Boolean, default: false },
  document: { type: String, default: 'Manual' },
  createdBy: { type: String, default: 'system' },
}, { timestamps: true })

// Compound uniqueness: each topic is strictly unique within its subject
prerequisiteSchema.index({ subject: 1, topic: 1 }, { unique: true })

const Prerequisite = mongoose.models.Prerequisite || mongoose.model('Prerequisite', prerequisiteSchema)

export default Prerequisite
