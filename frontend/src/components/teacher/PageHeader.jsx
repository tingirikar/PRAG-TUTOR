export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-accent uppercase">{eyebrow}</p>}
        <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">{title}</h2>
        <p className="mt-1.5 text-sm text-dim">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
