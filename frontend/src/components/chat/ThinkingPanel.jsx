import { Check, ChevronDown, Circle, CircleDot, Sparkles } from 'lucide-react'
import Spinner from '../ui/Spinner'

export default function ThinkingPanel({ open, onToggle, steps }) {
  return (
    <div className="flex animate-rise gap-3 sm:gap-4">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0b0f1e] text-[#a5b4ff] ring-1 ring-[#0b0f1e]/10 shadow-[0_6px_16px_-8px_#0b0f1e] animate-pulse-ring">
        <Sparkles size={15} />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="rounded-xl border border-line bg-panel p-2.5 shadow-2xs transition">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center justify-between text-left text-[12.5px] font-medium text-fg transition hover:text-accent"
          >
            <span className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Spinner className="size-3" />
              </span>
              <span className="font-semibold text-fg">Thinking & Retrieval Pipeline</span>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10.5px] font-semibold text-accent-strong animate-pulse">
                Running...
              </span>
            </span>
            <ChevronDown size={14} className={`text-mute transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="mt-2.5 space-y-2 border-t border-line pt-2.5 pl-1.5 animate-rise">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2.5 text-[12.5px] ${
                    step.status === 'done' ? 'text-dim font-normal' : step.status === 'active' ? 'text-fg font-semibold' : 'text-mute'
                  }`}
                >
                  <span className={step.status === 'done' ? 'text-emerald-600' : step.status === 'active' ? 'text-accent' : 'text-mute'}>
                    {step.status === 'done' ? <Check size={10} className="stroke-3" /> : step.status === 'active' ? <CircleDot size={11} className="animate-pulse" /> : <Circle size={10} />}
                  </span>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
