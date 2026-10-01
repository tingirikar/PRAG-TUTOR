export default function EmptyState({ icon, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-panel/40 px-6 py-16 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-raised text-mute">{icon}</div>
      <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-dim">{children}</p>
    </div>
  )
}
