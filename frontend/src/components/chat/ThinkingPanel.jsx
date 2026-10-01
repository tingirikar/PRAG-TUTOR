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
          className="inline-flex items-center gap-2 rounded-lg py-1 text-sm font-semibold text-slate-900 hover:text-accent"
        >
          <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 bg-[length:200%_100%] bg-clip-text font-semibold text-transparent [animation:shimmer_2.2s_linear_infinite]">
            Thinking & Retrieval Pipeline
          </span>
          <ChevronDown size={15} className={`text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="mt-2 space-y-2 border-l-2 border-slate-200 pl-4">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2.5 text-[13px] ${
                  step.status === 'done' ? 'text-slate-700 font-normal' : step.status === 'active' ? 'text-slate-950 font-semibold' : 'text-slate-400'
                }`}
              >
                <span className={step.status === 'done' ? 'text-emerald-600' : step.status === 'active' ? 'text-accent' : 'text-slate-300'}>
                  {step.status === 'done' ? <Check size={14} className="stroke-[3]" /> : step.status === 'active' ? <CircleDot size={14} className="animate-pulse" /> : <Circle size={14} />}
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
