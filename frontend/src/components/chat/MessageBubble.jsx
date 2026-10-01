import { useState } from 'react'
import { BookOpen, Check, ChevronDown, Cpu, FileText, Files, Globe, Images, Sparkles, Target } from 'lucide-react'
import Markdown from './Markdown'
import Spinner from '../ui/Spinner'

function Chip({ icon, label, value, tone = 'default' }) {
  const tones = {
    default: 'border-line bg-raised/60 text-dim',
    accent: 'border-accent/25 bg-accent-soft text-accent-strong',
    sky: 'border-sky/20 bg-sky/10 text-sky',
    violet: 'border-violet/20 bg-violet/10 text-violet',
  }
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${tones[tone]}`}>
      <span className="shrink-0 opacity-80">{icon}</span>
      {label && <span className="shrink-0 opacity-70">{label}</span>}
      <strong className="truncate font-medium capitalize">{value}</strong>
    </span>
  )
}

/** Collapsed record of the thinking & retrieval steps that produced this answer. */
function ThoughtTrace({ thinking }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg py-0.5 text-[13px] text-mute transition hover:text-fg"
      >
        <span className="font-medium">Thinking & Retrieval Pipeline</span>
        <span className="text-mute/80">· {thinking.seconds}s</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 animate-rise space-y-2 border-l border-line pl-4">
          {thinking.steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2.5 text-[13px] text-dim">
              <Check size={14} className="shrink-0 text-sky" />
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MessageBubble({ msg, index, expanded, onToggleSources, onOpenImage, username }) {
  if (msg.role === 'user') {
    return (
      <div className="flex animate-rise justify-end">
        <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-raised px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-fg ring-1 ring-line-strong sm:max-w-[75%]">
          {msg.content}
        </div>
      </div>
    )
  }

  const isError = typeof msg.content === 'string' && msg.content.startsWith('Error:')

  return (
    <div className="flex animate-rise gap-3 sm:gap-4">
      <div className={`grid size-8 shrink-0 place-items-center rounded-full ring-1 ${isError ? 'bg-danger/10 text-danger ring-danger/30' : 'bg-gradient-to-br from-accent to-[#2338c9] text-white ring-black/5'}`}>
        <Sparkles size={15} />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        {msg.thinking?.steps?.length > 0 && <ThoughtTrace thinking={msg.thinking} />}
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
                    src={`/api${img.url}?u=${encodeURIComponent(username || 'student')}`}
                    alt={img.source === 'document' ? `Diagram from ${img.document}, page ${img.page + 1}` : 'Diagram'}
                    loading="lazy"
                    className="size-full object-contain transition-transform group-hover:scale-[1.03]"
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 truncate bg-gradient-to-t from-black/85 to-transparent px-2.5 pt-6 pb-2 text-left text-[11px] text-white">
                    <FileText size={11} className="shrink-0" />
                    <span className="truncate">{img.document} (p. {img.page + 1})</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={isError ? 'rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger' : ''}>
          <Markdown content={msg.content} />
        </div>

        {msg.sources && msg.sources.length > 0 && (
          <div className="rounded-xl border border-line bg-panel/60">
            <button
              type="button"
              onClick={() => onToggleSources(index)}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] text-dim hover:text-fg"
            >
              <span className="flex items-center gap-2">
                <Files size={14} className="text-accent" />
                <span>{expanded ? 'Hide Verified Sources' : 'Show Verified Sources'}</span>
                <span className="rounded-md bg-raised px-1.5 font-mono text-[10.5px] text-mute">{msg.sources.length}</span>
              </span>
              <ChevronDown size={15} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
              <div className="divide-y divide-line border-t border-line">
                {msg.sources.map((src, sIdx) => (
                  <div key={sIdx} className="px-3.5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-fg">
                        <FileText size={13} className="shrink-0 text-mute" />
                        <span className="truncate">{src.document}</span>
                      </span>
                      {src.score && (
                        <span className="shrink-0 rounded-full bg-sky/10 px-2 py-0.5 font-mono text-[10.5px] text-sky">{src.score}% Match</span>
                      )}
                    </div>
                    <div className="mt-1.5 line-clamp-4 text-[13px] leading-relaxed text-mute italic">"{src.snippet}"</div>
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
