import { Award, ArrowRight } from 'lucide-react'

export default function QuizResult({ score = 0, total = 0, onBack }) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0
  const isGood = percentage >= 70

  return (
    <div className="quiz-result-card w-full max-w-2xl rounded-2xl border border-line bg-panel p-6 shadow-xs animate-rise">
      <div className="quiz-card-header flex items-center justify-between gap-3 mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
          <Award size={13} className="text-accent" />
          <span>Quiz Assessment Complete</span>
        </span>
      </div>

      <div className="quiz-result-content space-y-3 mb-5">
        <h3 className="text-base font-semibold text-fg tracking-tight">Quiz Completed!</h3>
        <p className="text-sm leading-relaxed text-dim">
          Here is your authoritative score calculated from the verified answers:
        </p>

        <div className="quiz-result-score-box flex items-center gap-5 rounded-xl border border-line bg-raised p-4 my-3">
          <div
            className={`quiz-score-circle flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 text-xl font-bold font-mono transition ${
              isGood
                ? 'high border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                : 'border-accent/40 bg-accent-soft text-accent-strong'
            }`}
            id="quiz-result-percentage"
          >
            {percentage}%
          </div>
          <div className="quiz-score-info space-y-1">
            <h4 className="text-sm font-semibold text-fg" id="quiz-result-score-text">
              You scored {score} out of {total}
            </h4>
            <p className="text-xs text-dim leading-relaxed">
              {isGood
                ? 'Excellent work! You have demonstrated a solid understanding of this topic.'
                : 'Good attempt! You can ask PRAG-TUTOR for further clarification on this concept anytime.'}
            </p>
          </div>
        </div>
      </div>

      <div className="quiz-actions-row flex items-center gap-3">
        <button
          type="button"
          className="quiz-btn-primary inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-accent-strong"
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
