import { useState } from 'react'
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react'

export default function QuizInvite({
  quizSetId,
  conversationId = null,
  studentUsername,
  subject,
  total = 9,
  onYes,
  onNo,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleDecision = async (decision) => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/quiz/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentUsername,
          subject,
          quizSetId,
          conversationId,
          decision,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record decision')
      }

      if (decision === 'yes') {
        onYes({
          quizSetIds: data.quizSetIds,
          questions: data.questions,
          total: data.total,
        })
      } else {
        onNo()
      }
    } catch (err) {
      console.error('Quiz decision error:', err)
      setError(err.message || 'Error processing quiz decision')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="quiz-invite-card">
      <div className="quiz-card-header">
        <span className="badge-chip badge-topic">
          <Sparkles size={14} className="badge-icon" />
          <span className="badge-label">Concept Check ({total} Questions)</span>
        </span>
      </div>

      <div className="quiz-invite-content">
        <h3 className="quiz-title">Do you want to attempt a quiz?</h3>
        <p className="quiz-desc">
          Test your understanding of the concepts covered in this explanation with a quick {total}-question assessment based strictly on this lesson.
        </p>
      </div>

      {error && (
        <div className="quiz-error-msg">{error}</div>
      )}

      <div className="quiz-actions-row">
        <button
          type="button"
          className="quiz-btn-primary"
          onClick={() => handleDecision('yes')}
          disabled={loading}
          id="quiz-invite-yes-btn"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="thinking-spinner" />
              <span>Starting Quiz...</span>
            </>
          ) : (
            <>
              <span>YES</span>
              <ArrowRight size={15} />
            </>
          )}
        </button>

        <button
          type="button"
          className="quiz-btn-secondary"
          onClick={() => handleDecision('no')}
          disabled={loading}
          id="quiz-invite-no-btn"
        >
          <span>NO</span>
        </button>
      </div>
    </div>
  )
}
