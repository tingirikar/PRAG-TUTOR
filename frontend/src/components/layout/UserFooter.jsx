import { LogOut } from 'lucide-react'

export default function UserFooter({ initial, name, role, logoutLabel, onLogout }) {
  return (
    <div className="relative p-3">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel/60 p-2.5 backdrop-blur">
        <div className="relative grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-[#4b2fd1] text-sm font-semibold text-white ring-2 ring-white/10">
          {initial}
          <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-[#141a30]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-fg">{name}</div>
          <div className="truncate font-mono text-[10.5px] tracking-wider text-mute uppercase">{role}</div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title={logoutLabel}
          aria-label={logoutLabel}
          className="press grid size-8 shrink-0 place-items-center rounded-lg text-mute transition-colors hover:bg-danger/15 hover:text-[#ff8a80]"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}
