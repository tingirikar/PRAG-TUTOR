const variants = {
  primary:
    'bg-accent text-white hover:bg-accent-strong shadow-[0_10px_24px_-12px_#3247d6] hover:shadow-[0_14px_30px_-12px_#3247d6] disabled:bg-accent/40 disabled:shadow-none disabled:text-white/60',
  secondary:
    'bg-panel text-fg border border-line-strong hover:bg-raised hover:border-fg/25 disabled:opacity-50',
  ghost: 'text-dim hover:text-fg hover:bg-hover disabled:opacity-50',
  danger:
    'text-danger border border-danger/25 bg-danger/5 hover:bg-danger/12 disabled:opacity-50',
}
const sizes = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
}

export default function Button({ variant = 'secondary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`press inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-200 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
