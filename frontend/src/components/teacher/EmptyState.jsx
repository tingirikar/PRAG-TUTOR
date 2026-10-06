export default function EmptyState({ icon, children }) {
  return (
    <div className="animate-rise rounded-3xl border border-dashed border-line-strong bg-panel/50 px-6 py-16 text-center">
      <div className="mx-auto grid size-14 animate-float place-items-center rounded-2xl bg-raised text-mute ring-1 ring-line">{icon}</div>
      <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-dim">{children}</p>
    </div>
  )
}
