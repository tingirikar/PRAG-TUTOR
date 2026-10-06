import mongoose from 'mongoose'

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    required: true,
  },
  correctAnswer: {
    type: String,
    required: true,
  },
})

const answerSchema = new mongoose.Schema({
  questionIndex: {
    type: Number,
    required: true,
  },
  selectedAnswer: {
    type: String,
    required: true,
  },
})

const quizAttemptSchema = new mongoose.Schema({
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
  conversationId: {
    type: String,
    default: null,
    index: true,
  },
  quizSetIds: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuizSet',
    }],
    default: [],
  },
  questions: {
    type: [questionSchema],
    default: [],
  },
  answers: {
    type: [answerSchema],
    default: [],
  },
  score: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true })

const QuizAttempt = mongoose.models.QuizAttempt || mongoose.model('QuizAttempt', quizAttemptSchema)

export default QuizAttempt
