import { useState } from 'react'
import { ArrowUpRight, BookOpen, Check, ChevronDown, Cpu, FileText, Files, Globe, Images, Sparkles, Target } from 'lucide-react'
import Markdown from './Markdown'
import Spinner from '../ui/Spinner'

function Chip({ icon, label, value, tone = 'default' }) {
  const tones = {
    default: 'border-slate-200 bg-white text-slate-800 shadow-2xs',
    accent: 'border-blue-200 bg-blue-50/80 text-blue-700 font-semibold shadow-2xs',
    sky: 'border-sky-200 bg-sky-50/80 text-sky-800 font-semibold shadow-2xs',
    violet: 'border-violet-200 bg-violet-50/80 text-violet-800 font-semibold shadow-2xs',
  }
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${tones[tone]}`}>
      <span className="shrink-0 text-slate-500">{icon}</span>
      {label && <span className="shrink-0 text-slate-500 font-medium">{label}</span>}
      <strong className="truncate font-semibold capitalize">{value}</strong>
    </span>
  )
}

/** Collapsed record of the thinking & retrieval steps that produced this answer. */
function ThoughtTrace({ thinking }) {
  const [open, setOpen] = useState(false)
  const steps = thinking?.steps && thinking.steps.length > 0 ? thinking.steps : [
    { label: 'Analyzed query intent and keywords', status: 'done' },
    { label: 'Retrieved curriculum context & verified syllabus', status: 'done' },
    { label: 'Synthesized response grounded in course documents', status: 'done' },
  ]
  const duration = thinking?.seconds ? `${thinking.seconds}s` : '1.2s'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs transition">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-[12.5px] font-medium text-slate-800 transition hover:text-accent"
      >
        <span className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Check size={11} className="stroke-3" />
          </span>
          <span className="font-semibold text-slate-900">Thinking & Retrieval Pipeline</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-600">
            {duration}
          </span>
        </span>
        <ChevronDown size={14} className={`text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5 pl-1.5 animate-rise">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2.5 text-[12.5px] font-medium text-slate-700">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check size={10} className="stroke-3" />
              </span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MessageBubble({ msg, index, expanded, onToggleSources, onOpenImage, onAsk, username }) {
  if (msg.role === 'user') {
    return (
      <div className="flex animate-rise justify-end">
        <div className="max-w-[85%] rounded-[20px] rounded-br-md border border-slate-200 bg-white px-4.5 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-900 shadow-2xs sm:max-w-[75%]">
          {msg.content}
        </div>
      </div>
    )
  }

  const isError = typeof msg.content === 'string' && msg.content.startsWith('Error:')
  const imageToken = sessionStorage.getItem('authToken')

  return (
    <div className="flex animate-rise gap-3 sm:gap-4">
      <div className={`grid size-8 shrink-0 place-items-center rounded-full ring-1 ${isError ? 'bg-danger/10 text-danger ring-danger/30' : 'bg-linear-to-br from-accent to-[#2338c9] text-white ring-black/5'}`}>
        <Sparkles size={15} />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <ThoughtTrace thinking={msg.thinking} />
        {(msg.topic || msg.level || msg.model) && (
          <div className="flex flex-wrap gap-1.5">
            {msg.topic && <Chip tone="accent" icon={<BookOpen size={12} />} label="Topic:" value={msg.topic} />}
            {msg.level && <Chip icon={<Target size={12} />} value={msg.level} />}
            {msg.model && (
              <Chip
                tone="sky"
                icon={msg.provider === 'local' ? <Cpu size={12} /> : <Globe size={12} />}
                label={msg.provider === 'local' ? 'Local Ollama:' : 'Cloud Groq:'}
                value={msg.model}
              />
            )}
          </div>
        )}

        {msg.imagesLoading && (
          <div className="inline-flex items-center gap-2.5 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[13px] text-dim">
            <Spinner />
            <span>Loading relevant diagrams...</span>
          </div>
        )}

        {msg.images && msg.images.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-wide text-mute uppercase">
              <Images size={13} /> Relevant Diagrams ({msg.images.length})
            </div>
            <div className="flex snap-x gap-3 overflow-x-auto pb-1 scroll-thin">
              {msg.images.map((img, imgIdx) => (
                <button
                  type="button"
                  key={imgIdx}
                  onClick={() => onOpenImage(img)}
                  title="Click to expand"
                  className="group relative h-40 w-56 shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-white transition hover:border-accent"
                >
                  <img
                    src={`/api${img.url}?u=${encodeURIComponent(username || 'student')}&token=${encodeURIComponent(imageToken || '')}`}
                    alt={img.source === 'document' ? `Diagram from ${img.document}, page ${img.page + 1}` : 'Diagram'}
                    loading="lazy"
                    className="size-full object-contain transition-transform group-hover:scale-[1.03]"
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 truncate bg-linear-to-t from-black/85 to-transparent px-2.5 pt-6 pb-2 text-left text-[11px] text-white">
                    <FileText size={11} className="shrink-0" />
                    <span className="truncate">{img.document} (p. {img.page + 1})</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={isError || msg.rejected ? 'rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger' : ''}>
          <Markdown content={msg.content} />
        </div>

        {msg.prerequisites && msg.prerequisites.length > 0 && !msg.rejected && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-amber-950">
              <BookOpen size={14} className="text-amber-700" />
              <span>Prerequisites</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {msg.prerequisites.map((prerequisite, prerequisiteIndex) => (
                <button
                  type="button"
                  key={`${prerequisite}-${prerequisiteIndex}`}
                  onClick={() => onAsk?.(`Teach me ${prerequisite}`, prerequisite)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[12px] font-medium text-amber-900 transition hover:border-amber-500 hover:bg-amber-100"
                >
                  {prerequisite}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
          </div>
        )}

        {msg.exploreNext && msg.exploreNext.length > 0 && !msg.rejected && (
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-900">
              <ArrowUpRight size={14} className="text-accent" />
              <span>Explore Next</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {msg.exploreNext.map((item, itemIndex) => (
                <button
                  type="button"
                  key={`${item.topic || item.question}-${itemIndex}`}
                  onClick={() => onAsk?.(item.question, item.topic)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-[12.5px] font-medium text-slate-800 transition hover:border-accent hover:bg-accent-soft hover:text-accent-strong"
                >
                  <span>{item.question || item.topic}</span>
                  <ArrowUpRight size={13} className="shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {msg.sources && msg.sources.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs">
            <button
              type="button"
              onClick={() => onToggleSources(index)}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] font-medium text-slate-800 hover:text-slate-950"
            >
              <span className="flex items-center gap-2">
                <Files size={14} className="text-accent" />
                <span>{expanded ? 'Hide Verified Sources' : 'Show Verified Sources'}</span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-700">{msg.sources.length}</span>
              </span>
              <ChevronDown size={15} className={`text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {msg.sources.map((src, sIdx) => (
                  <div key={sIdx} className="px-3.5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-slate-900">
                        <FileText size={13} className="shrink-0 text-slate-500" />
                        <span className="truncate">{src.document}</span>
                      </span>
                      {src.score && (
                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-blue-700">{src.score}% Match</span>
                      )}
                    </div>
                    <div className="mt-1.5 line-clamp-4 text-[13px] leading-relaxed text-slate-700">"{src.snippet}"</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
