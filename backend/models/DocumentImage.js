import mongoose from 'mongoose'

const documentImageSchema = new mongoose.Schema({
  document: { type: String, required: true },
  subject: { type: String, required: true, index: true },
  filename: { type: String, required: true },
  pageNumber: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  sizeBytes: { type: Number, required: true },
  qualityScore: { type: Number, required: true },
  relativePath: { type: String, required: true },
}, { timestamps: true, versionKey: false })

documentImageSchema.index({ subject: 1, document: 1, filename: 1 }, { unique: true })
documentImageSchema.index({ subject: 1, document: 1, pageNumber: 1 })

const DocumentImage = mongoose.models.DocumentImage || mongoose.model('DocumentImage', documentImageSchema)

export default DocumentImage
