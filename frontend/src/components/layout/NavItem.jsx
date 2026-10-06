export default function NavItem({ icon, label, active, onClick, index = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${120 + index * 50}ms` }}
      className={`press group relative flex w-full animate-slide-in items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm transition-colors duration-300 ${
        active ? 'bg-accent-soft font-medium text-fg' : 'text-dim hover:bg-hover hover:text-fg'
      }`}
    >
      <span
        className={`absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent shadow-[0_0_12px_#7b93ff] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          active ? 'opacity-100' : 'h-0 opacity-0'
        }`}
      />
      <span className={`transition-all duration-300 ${active ? 'text-accent' : 'text-mute group-hover:translate-x-0.5 group-hover:text-dim'}`}>{icon}</span>
      <span className="transition-transform duration-300 group-hover:translate-x-0.5">{label}</span>
    </button>
  )
}
