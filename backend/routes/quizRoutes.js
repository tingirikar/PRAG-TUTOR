import express from 'express'
import QuizSet from '../models/QuizSet.js'
import {
  buildQuiz,
  completeQuiz,
  getConversationQuizStatus,
  getPendingQuizSets,
  recordQuizSkip,
  shouldForceQuiz,
} from '../services/quizService.js'

const router = express.Router()

/**
 * Strips correctAnswer from question objects before sending to client.
 */
function sanitizeQuestions(questions) {
  if (!Array.isArray(questions)) return []
  return questions.map((q) => ({
    question_id: q.question_id,
    question: q.question,
    options: q.options,
  }))
}

/**
 * Strips correctAnswer from subdocument questions inside a QuizSet.
 */
function sanitizeQuizSet(quizSet) {
  const doc = quizSet.toObject ? quizSet.toObject() : { ...quizSet }
  if (Array.isArray(doc.questions)) {
    doc.questions = sanitizeQuestions(doc.questions)
  }
  return doc
}

/**
 * Standard error handler for quiz routes.
 */
function handleError(res, error) {
  const message = error?.message || 'Internal server error'
  if (error?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format.' })
  }
  if (message.toLowerCase().includes('not found')) {
    return res.status(404).json({ error: message })
  }
  return res.status(500).json({ error: message })
}

/**
 * 1. POST /decision
 * Records student's decision ('yes' or 'no') for the quiz.
 * - 'yes': Builds combined quiz (pending sets + current QuizSet).
 * - 'no': Adds QuizSet to pendingQuizSetIds and increments skipCount.
 */
router.post('/decision', async (req, res) => {
  try {
    const { studentUsername, subject, quizSetId, decision, conversationId } = req.body || {}

    if (!studentUsername || !subject || !decision) {
      return res.status(400).json({
        error: 'studentUsername, subject, and decision are required.',
      })
    }

    const normalizedDecision = String(decision).trim().toLowerCase()
    if (normalizedDecision !== 'yes' && normalizedDecision !== 'no') {
      return res.status(400).json({
        error: 'decision must be either "yes" or "no".',
      })
    }

    if (normalizedDecision === 'yes') {
      const quiz = await buildQuiz(studentUsername, subject, quizSetId)
      return res.status(200).json({
        success: true,
        decision: 'yes',
        conversationId: conversationId || null,
        quizSetIds: quiz.quizSetIds,
        questions: sanitizeQuestions(quiz.questions),
        total: quiz.total,
      })
    }

    // decision === 'no'
    const updatedState = await recordQuizSkip(studentUsername, subject, quizSetId)
    const isCompulsory = await shouldForceQuiz(studentUsername, subject)

    return res.status(200).json({
      success: true,
      decision: 'no',
      conversationId: conversationId || null,
      quizSetId,
      skipCount: updatedState.skipCount,
      compulsory: isCompulsory,
    })
  } catch (error) {
    return handleError(res, error)
  }
})

/**
 * 2. GET /pending
 * Retrieves all pending QuizSets for the student without exposing correctAnswer.
 */
router.get('/pending', async (req, res) => {
  try {
    const studentUsername = req.query.studentUsername || req.body?.studentUsername
    const subject = req.query.subject || req.body?.subject

    if (!studentUsername || !subject) {
      return res.status(400).json({
        error: 'studentUsername and subject are required.',
      })
    }

    const pendingSets = await getPendingQuizSets(studentUsername, subject)

    return res.status(200).json({
      success: true,
      pendingQuizSets: pendingSets.map(sanitizeQuizSet),
      count: pendingSets.length,
    })
  } catch (error) {
    return handleError(res, error)
  }
})

/**
 * 3. POST /start
 * Starts a combined quiz for the given student without exposing correctAnswer.
 */
router.post('/start', async (req, res) => {
  try {
    const { studentUsername, subject, quizSetId, conversationId } = req.body || {}

    if (!studentUsername || !subject) {
      return res.status(400).json({
        error: 'studentUsername and subject are required.',
      })
    }

    const quiz = await buildQuiz(studentUsername, subject, quizSetId)

    return res.status(200).json({
      success: true,
      conversationId: conversationId || null,
      quizSetIds: quiz.quizSetIds,
      questions: sanitizeQuestions(quiz.questions),
      total: quiz.total,
    })
  } catch (error) {
    return handleError(res, error)
  }
})

/**
 * 4. GET /status
 * Returns authoritative quiz status for a student + subject.
 */
router.get('/status', async (req, res) => {
  try {
    const studentUsername = req.query.studentUsername || req.body?.studentUsername
    const subject = req.query.subject || req.body?.subject

    if (!studentUsername || !subject) {
      return res.status(400).json({
        error: 'studentUsername and subject are required.',
      })
    }

    const status = await getConversationQuizStatus(studentUsername, subject)

    return res.status(200).json({
      success: true,
      ...status,
      questions: sanitizeQuestions(status.questions),
    })
  } catch (error) {
    return handleError(res, error)
  }
})

/**
 * 5. POST /presented
 * Lightweight presentation tracking endpoint.
 */
router.post('/presented', async (_req, res) => {
  return res.status(200).json({ success: true })
})

/**
 * 6. POST /submit
 * Submits student answers, scores authoritatively on the server,
 * marks included QuizSets as completed, removes them from pendingQuizSetIds,
 * resets skipCount to 0, and saves QuizAttempt.
 */
router.post('/submit', async (req, res) => {
  try {
    const { studentUsername, subject, quizSetIds, answers, conversationId } = req.body || {}

    if (!studentUsername || !subject) {
      return res.status(400).json({
        error: 'studentUsername and subject are required.',
      })
    }

    if (!Array.isArray(quizSetIds) || quizSetIds.length === 0) {
      return res.status(400).json({
        error: 'quizSetIds array is required.',
      })
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        error: 'answers must be an array of answer objects.',
      })
    }

    const result = await completeQuiz({
      studentUsername,
      subject,
      quizSetIds,
      answers,
      conversationId,
    })

    return res.status(200).json({
      success: true,
      attemptId: result.attempt?._id,
      conversationId: result.attempt?.conversationId || conversationId,
      score: result.score,
      total: result.total,
      correctCount: result.score,
    })
  } catch (error) {
    return handleError(res, error)
  }
})

export { shouldForceQuiz }
export default router

