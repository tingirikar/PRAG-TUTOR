import { useState, useEffect } from 'react'
import { Check, ArrowRight, ArrowLeft, AlertCircle, Sparkles, Loader2 } from 'lucide-react'

export default function Quiz({
  questions = [],
  quizSetIds = [],
  conversationId = null,
  studentUsername,
  subject,
  onComplete,
  compulsory = false,
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({}) // { [question_id]: selectedOption }
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const totalQuestions = questions.length
  const currentQ = questions[currentIndex]
  const isFirstQuestion = currentIndex === 0
  const isLastQuestion = currentIndex === totalQuestions - 1
  const progressPercent = totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0
  const selectedOption = currentQ ? (answers[currentQ.question_id] || '') : ''

  const handleSelectOption = (option) => {
    if (!submitting && currentQ) {
      setAnswers((prev) => ({
        ...prev,
        [currentQ.question_id]: option,
      }))
    }
  }

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleSubmitQuiz = async () => {
    if (submitting) return

    // Ensure the current question has an answer
    if (!selectedOption) {
      setError('Please select an option before submitting.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const answersPayload = questions.map((q, idx) => ({
        questionIndex: idx,
        question_id: q.question_id,
        selectedAnswer: answers[q.question_id] || (q.question_id === currentQ?.question_id ? selectedOption : ''),
      })).filter((a) => a.selectedAnswer)

      console.log(`[QUIZ SUBMIT] Submitting ${answersPayload.length} answers for ${totalQuestions} questions`)

      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentUsername,
          subject,
          conversationId,
          quizSetIds,
          answers: answersPayload,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit quiz.')
      }

      console.log(`[QUIZ RESULT] Authoritative score: ${data.score}/${data.total}`)

      onComplete(data.score, data.total, {
        score: data.score,
        total: data.total,
        attemptId: data.attemptId,
      })
    } catch (err) {
      console.error('Quiz submission error:', err)
      setError(err.message || 'Error submitting quiz. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="quiz-card">
        <p className="quiz-desc">No questions available for this quiz.</p>
      </div>
    )
  }

  const optionLetters = ['A', 'B', 'C', 'D']

  return (
    <div className={`quiz-card ${compulsory ? 'quiz-card-compulsory' : ''}`} id="active-quiz-container">
      <div className="quiz-card-header">
        <div className="quiz-badge-wrap">
          <span className={`badge-chip ${compulsory ? 'badge-prereq' : 'badge-topic'}`}>
            {compulsory ? (
              <AlertCircle size={14} className="badge-icon" />
            ) : (
              <Sparkles size={14} className="badge-icon" />
            )}
            <span className="badge-label">
              {compulsory ? 'Compulsory Knowledge Check' : 'Concept Check'} — Question {currentIndex + 1} of {totalQuestions}
            </span>
          </span>
        </div>

        <div className="quiz-progress-track" title={`Question ${currentIndex + 1} of ${totalQuestions}`}>
          <div
            className="quiz-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="quiz-question-container">
        <h4 className="quiz-question-text" id="quiz-question-text">{currentQ?.question}</h4>

        <div className="quiz-options-list" role="radiogroup">
          {(currentQ?.options || []).map((opt, oIdx) => {
            const isSelected = selectedOption === opt
            const letter = optionLetters[oIdx] || String(oIdx + 1)

            return (
              <button
                key={oIdx}
                type="button"
                className={`quiz-option-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectOption(opt)}
                disabled={submitting}
                role="radio"
                aria-checked={isSelected}
                id={`quiz-opt-${oIdx}`}
              >
                <span className="quiz-option-letter">
                  {isSelected ? <Check size={14} /> : letter}
                </span>
                <span className="quiz-option-text">{opt}</span>
              </button>
            )
          })}
        </div>
      </div>

      {error && <div className="quiz-error-msg">{error}</div>}

      <div className="quiz-actions-row">
        {/* Previous Navigation Button */}
        <button
          type="button"
          className="quiz-btn-secondary"
          onClick={handlePrevious}
          disabled={isFirstQuestion || submitting}
          id="quiz-prev-btn"
          style={{ opacity: isFirstQuestion ? 0.4 : 1 }}
        >
          <ArrowLeft size={15} />
          <span>Previous</span>
        </button>

        {/* Next / Submit Navigation Button */}
        {isLastQuestion ? (
          <button
            type="button"
            className="quiz-btn-primary"
            onClick={handleSubmitQuiz}
            disabled={submitting || !selectedOption}
            id="quiz-submit-btn"
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="thinking-spinner" />
                <span>Scoring Quiz...</span>
              </>
            ) : (
              <>
                <span>Submit Quiz</span>
                <Check size={15} />
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            className="quiz-btn-primary"
            onClick={handleNext}
            disabled={submitting || !selectedOption}
            id="quiz-next-btn"
          >
            <span>Next</span>
            <ArrowRight size={15} />
          </button>
        )}

        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Question {currentIndex + 1} of {totalQuestions}
        </span>
      </div>
    </div>
  )
}
