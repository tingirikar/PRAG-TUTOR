import { LogOut } from 'lucide-react'

export default function UserFooter({ initial, name, role, logoutLabel, onLogout }) {
  return (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-[#2338c9] text-sm font-semibold text-white ring-1 ring-black/5">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-fg">{name}</div>
          <div className="truncate text-xs text-mute">{role}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-dim transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <LogOut size={16} />
        <span>{logoutLabel}</span>
      </button>
    </div>
  )
}
