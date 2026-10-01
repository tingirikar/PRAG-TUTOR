export default function Brand({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-accent to-[#2338c9] font-mono text-[11px] font-medium tracking-wider text-white shadow-[0_6px_20px_-6px_#5b7cff] ring-1 ring-black/5">
        PT
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-fg">
        PRAG <span className="font-serif text-[17px] font-normal italic text-dim">Tutor</span>
      </span>
    </div>
  )
}
