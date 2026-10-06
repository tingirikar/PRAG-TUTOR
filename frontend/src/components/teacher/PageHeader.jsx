export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-10 flex animate-rise flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-accent uppercase">
            <span className="size-1.5 rounded-full bg-accent" /> {eyebrow}
          </p>
        )}
        <h2 className="text-[clamp(1.9rem,3.2vw,2.6rem)] leading-[1.05] text-fg font-display">{title}</h2>
        <p className="mt-2.5 max-w-xl text-[15px] text-dim">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
