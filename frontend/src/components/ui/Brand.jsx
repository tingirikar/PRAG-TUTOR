export default function Brand({ className = '' }) {
  return (
    <div className={`group flex items-center gap-2.5 ${className}`}>
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-[11px] bg-accent text-white shadow-[0_8px_24px_-8px_#3247d6] ring-1 ring-white/15">
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#ffffff55,transparent_55%)]" />
        <span className="relative font-display text-[17px] leading-none italic">P</span>
        <span className="absolute right-1.5 bottom-1.5 size-1.5 rounded-full bg-sky transition-transform duration-500 group-hover:scale-150" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-fg">
        PRAG <span className="font-display text-[18px] font-normal italic text-dim">Tutor</span>
      </span>
    </div>
  )
}
