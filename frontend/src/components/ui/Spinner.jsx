export default function Spinner({ className = 'size-3.5' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent ${className}`}
    />
  )
}
