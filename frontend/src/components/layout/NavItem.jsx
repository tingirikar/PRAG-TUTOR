export default function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? 'bg-accent-soft text-accent-strong' : 'text-dim hover:bg-hover hover:text-fg'
      }`}
    >
      {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-accent" />}
      <span className={active ? 'text-accent' : 'text-mute group-hover:text-dim'}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
