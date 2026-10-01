import { useEffect, useRef, useState } from 'react'
import { Check, ChevronUp } from 'lucide-react'

export default function DropupSelect({
  value,
  label,
  icon,
  onChange,
  disabled = false,
  ariaLabel,
  options = [],
  align = 'left',
  minWidth = 160,
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSelect = (val) => {
    onChange(val)
    setOpen(false)
  }

  const renderItem = (opt) => (
    <button
      key={opt.value}
      type="button"
      role="option"
      aria-selected={value === opt.value}
      disabled={opt.disabled}
      onClick={() => !opt.disabled && handleSelect(opt.value)}
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
        opt.disabled
          ? 'cursor-not-allowed text-mute italic'
          : value === opt.value
            ? 'bg-accent-soft text-accent-strong'
            : 'text-dim hover:bg-hover hover:text-fg'
      }`}
    >
      <span className="min-w-0 truncate">{opt.label}</span>
      {value === opt.value && <Check size={14} className="shrink-0 text-accent" />}
    </button>
  )

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex h-8 max-w-[220px] items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
          open ? 'border-line-strong bg-hover text-fg' : 'border-transparent text-dim hover:bg-hover hover:text-fg'
        }`}
      >
        {icon && <span className="shrink-0 text-mute">{icon}</span>}
        <span className="truncate">{label}</span>
        <ChevronUp size={13} className={`shrink-0 text-mute transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{ minWidth }}
          className={`absolute bottom-[calc(100%+8px)] z-30 max-h-80 max-w-[calc(100vw-2rem)] animate-rise overflow-y-auto rounded-xl border border-line-strong bg-panel p-1.5 shadow-[0_24px_60px_-16px_#1a24503a] scroll-thin ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((item, idx) =>
            item.group ? (
              <div key={`group-${idx}`} className={idx > 0 ? 'mt-1.5 border-t border-line pt-1.5' : ''}>
                <div className="px-2.5 pt-1 pb-1.5 font-mono text-[10px] tracking-[0.14em] text-mute uppercase">{item.group}</div>
                {item.items.map(renderItem)}
              </div>
            ) : (
              renderItem(item)
            ),
          )}
        </div>
      )}
    </div>
  )
}
