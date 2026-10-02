import { useEffect, useRef, useState } from 'react'
import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import Brand from '../ui/Brand'

/**
 * Responsive two-pane shell: fixed rail on desktop, slide-in drawer on mobile.
 * On desktop the rail can be resized by dragging its edge and collapsed entirely.
 * `sidebar` is a render function receiving `close` so nav items can dismiss the drawer.
 */
export default function AppShell({ sidebar, mobileTitle, children }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const [width, setWidth] = useState(() => Number(localStorage.getItem('rail-width')) || 280)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('rail-collapsed') === '1')
  const [dragging, setDragging] = useState(false)
  const widthRef = useRef(width)

  useEffect(() => { localStorage.setItem('rail-collapsed', collapsed ? '1' : '0') }, [collapsed])

  const startResize = (e) => {
    e.preventDefault()
    setDragging(true)
    const startX = e.clientX
    const startW = widthRef.current
    const onMove = (ev) => {
      const next = Math.min(440, Math.max(220, startW + ev.clientX - startX))
      widthRef.current = next
      setWidth(next)
    }
    const onUp = () => {
      setDragging(false)
      localStorage.setItem('rail-width', String(widthRef.current))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className={`flex h-dvh overflow-hidden bg-ink text-fg ${dragging ? 'cursor-col-resize select-none' : ''} ${collapsed ? 'rail-collapsed' : ''}`} style={{ '--rail-w': `${width}px` }}>
      {/* Mobile scrim */}
      <div
        className={`fixed inset-0 z-40 bg-[#0f1630]/40 backdrop-blur-sm transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={close}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] shrink-0 flex-col rail-dark border-r border-line bg-rail transition-transform duration-300 ease-out lg:relative lg:w-[var(--rail-w)] lg:translate-x-0 lg:transition-none ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:hidden' : ''}`}
      >
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Hide sidebar"
          title="Hide sidebar"
          className="absolute top-4 right-3 z-10 hidden size-8 place-items-center rounded-lg text-mute hover:bg-hover hover:text-fg lg:grid"
        >
          <PanelLeftClose size={17} />
        </button>
        {/* Drag handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={startResize}
          onDoubleClick={() => { widthRef.current = 280; setWidth(280); localStorage.setItem('rail-width', '280') }}
          className={`absolute inset-y-0 -right-1.5 z-10 hidden w-3 cursor-col-resize lg:block after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors hover:after:bg-accent/50 ${dragging ? 'after:bg-accent' : ''}`}
        />
        <button
          type="button"
          onClick={close}
          aria-label="Close menu"
          className="absolute top-4 right-3 grid size-8 place-items-center rounded-lg text-dim hover:bg-hover hover:text-fg lg:hidden"
        >
          <X size={18} />
        </button>
        {sidebar(close)}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-rail/80 px-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid size-9 place-items-center rounded-lg text-dim hover:bg-hover hover:text-fg"
          >
            <Menu size={20} />
          </button>
          {mobileTitle || <Brand />}
        </header>
        <main className="relative min-h-0 flex-1">
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Show sidebar"
              title="Show sidebar"
              className="absolute top-2.5 left-3 z-30 hidden size-9 place-items-center rounded-lg border border-line bg-panel text-dim shadow-sm hover:bg-hover hover:text-fg lg:grid"
            >
              <PanelLeftOpen size={17} />
            </button>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
