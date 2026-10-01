import { X } from 'lucide-react'

export default function Lightbox({ image, username, onClose }) {
  if (!image) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="relative max-h-full w-full max-w-5xl animate-rise" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-12 right-0 grid size-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X size={20} />
        </button>
        <img
          src={`/api${image.url}?u=${encodeURIComponent(username || 'student')}`}
          alt={image.source === 'document' ? `Diagram from ${image.document}` : 'Diagram'}
          className="mx-auto max-h-[78vh] rounded-xl bg-white object-contain"
        />
        <div className="mt-3 text-center font-mono text-xs text-dim">
          <span>From: {image.document} (Page {image.page + 1})</span>
        </div>
      </div>
    </div>
  )
}
