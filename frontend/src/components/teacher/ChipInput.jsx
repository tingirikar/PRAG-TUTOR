import { X } from 'lucide-react'

export function PrereqChip({ label, onRemove }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-[12.5px] text-fg ring-1 ring-line">
      <span className="truncate">{label}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} title="Remove prerequisite" className="text-mute hover:text-danger">
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </span>
  )
}

export function ChipAdder({ value, onChange, onAdd, placeholder, size = 'sm' }) {
  const h = size === 'sm' ? 'h-8 text-[12.5px]' : 'h-10 text-sm'
  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onAdd()
          }
        }}
        className={`min-w-0 flex-1 rounded-lg border border-line-strong bg-ink px-3 text-fg placeholder:text-mute focus:border-accent focus:outline-none ${h}`}
      />
      <button
        type="button"
        onClick={onAdd}
        disabled={!value.trim()}
        className={`shrink-0 rounded-lg border border-line-strong bg-raised px-3 font-medium text-fg hover:bg-hover disabled:opacity-40 ${h}`}
      >
        + Add
      </button>
    </div>
  )
}
