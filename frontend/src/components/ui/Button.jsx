const variants = {
  primary:
    'bg-accent text-white hover:bg-accent-strong shadow-[0_8px_24px_-10px_#5b7cff] disabled:bg-accent/40 disabled:shadow-none disabled:text-white/60',
  secondary:
    'bg-raised text-fg border border-line-strong hover:bg-hover hover:border-[#b9c3da] disabled:opacity-50',
  ghost: 'text-dim hover:text-fg hover:bg-hover disabled:opacity-50',
  danger:
    'text-danger border border-danger/25 bg-danger/5 hover:bg-danger/15 disabled:opacity-50',
}
const sizes = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
}

export default function Button({ variant = 'secondary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
