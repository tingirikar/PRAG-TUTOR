import { Check, ChevronDown, Circle, CircleDot } from 'lucide-react'
import Spinner from '../ui/Spinner'

export default function ThinkingPanel({ open, onToggle, steps }) {
  return (
    <div className="flex animate-rise gap-3 sm:gap-4">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft ring-1 ring-accent/30">
        <Spinner className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-lg py-1 text-sm text-dim hover:text-fg"
        >
          <span className="bg-gradient-to-r from-dim via-fg to-dim bg-[length:200%_100%] bg-clip-text font-medium text-transparent [animation:shimmer_2.2s_linear_infinite]">
            Thinking & Retrieval Pipeline
          </span>
          <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="mt-2 space-y-2 border-l border-line pl-4">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2.5 text-[13px] ${
                  step.status === 'done' ? 'text-dim' : step.status === 'active' ? 'text-fg' : 'text-mute'
                }`}
              >
                <span className={step.status === 'done' ? 'text-sky' : step.status === 'active' ? 'text-accent' : ''}>
                  {step.status === 'done' ? <Check size={14} /> : step.status === 'active' ? <CircleDot size={14} className="animate-pulse" /> : <Circle size={14} />}
                </span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
