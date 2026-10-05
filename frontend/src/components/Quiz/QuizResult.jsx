import { Award, ArrowRight } from 'lucide-react'

export default function QuizResult({ score = 0, total = 0, onBack }) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0
  const isGood = percentage >= 70

  return (
    <div className="quiz-result-card">
      <div className="quiz-card-header">
        <span className="badge-chip badge-topic">
          <Award size={14} className="badge-icon" />
          <span className="badge-label">Quiz Assessment Complete</span>
        </span>
      </div>

      <div className="quiz-result-content">
        <h3 className="quiz-title">Quiz Completed!</h3>
        <p className="quiz-desc">
          Here is your authoritative score calculated from the verified answers:
        </p>

        <div className="quiz-result-score-box">
          <div className={`quiz-score-circle ${isGood ? 'high' : ''}`} id="quiz-result-percentage">
            {percentage}%
          </div>
          <div className="quiz-score-info">
            <h4 id="quiz-result-score-text">
              You scored {score} out of {total}
            </h4>
            <p>
              {isGood
                ? 'Excellent work! You have demonstrated a solid understanding of this topic.'
                : 'Good attempt! You can ask PRAG-TUTOR for further clarification on this concept anytime.'}
            </p>
          </div>
        </div>
      </div>

      <div className="quiz-actions-row">
        <button
          type="button"
          className="quiz-btn-primary"
          onClick={onBack}
          id="back-to-learning-btn"
        >
          <span>Back to Learning</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}
