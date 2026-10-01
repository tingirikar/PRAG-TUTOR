import mongoose from 'mongoose'

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true, default: 'DSA', index: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'Uploaded' },
}, { versionKey: false })

// Compound uniqueness: file name is unique within its subject, allowing different subjects to have files with the same name
documentSchema.index({ subject: 1, name: 1 }, { unique: true })

const Document = mongoose.models.Document || mongoose.model('Document', documentSchema)

export default Document
