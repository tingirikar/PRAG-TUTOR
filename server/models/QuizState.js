import mongoose from 'mongoose'

const quizStateSchema = new mongoose.Schema({
  studentUsername: {
    type: String,
    required: true,
    index: true,
  },
  subject: {
    type: String,
    required: true,
    index: true,
  },
  pendingQuizSetIds: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuizSet',
    }],
    default: [],
  },
  skipCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { timestamps: true })

quizStateSchema.index({ studentUsername: 1, subject: 1 }, { unique: true })

const QuizState = mongoose.models.QuizState || mongoose.model('QuizState', quizStateSchema)

export default QuizState

