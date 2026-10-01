import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, MessageSquare, SquarePen, Trash2 } from 'lucide-react'
import SubjectIcon from '../ui/SubjectIcon'
import UserFooter from '../layout/UserFooter'

export default function ChatSidebar({
  subject, conversations, currentConversationId, deletingConvId,
  onBack, onNewChat, onLoad, onAskDelete, onConfirmDelete, onCancelDelete,
  user, onLogout, close,
}) {
  const [anchor, setAnchor] = useState(null)
  const target = conversations.find(c => c._id === deletingConvId)

  return (
    <>
      <div className="space-y-3 p-3 pt-4">
        <button
          type="button"
          onClick={() => { onBack(); close() }}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
        >
          <ArrowLeft size={15} />
          <span>All Subjects</span>
        </button>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <SubjectIcon code={subject.code} size={18} />
          </span>
          <div className="min-w-0">
            <strong className="block font-mono text-[12px] font-semibold tracking-wider text-accent">{subject.code}</strong>
            <small className="block truncate text-[13px] font-medium text-slate-900">{subject.name}</small>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { onNewChat(); close() }}
          className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs transition hover:border-accent hover:bg-accent-soft hover:text-accent-strong"
        >
          <SquarePen size={16} className="text-accent" />
          <span>New Chat</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 scroll-thin">
        <div className="px-2 pt-3 pb-2 font-mono text-[10.5px] font-semibold tracking-[0.16em] text-slate-600 uppercase">Saved Conversations</div>
        {conversations.length === 0 ? (
          <div className="px-2 py-2 text-[13px] leading-relaxed text-slate-500">No saved chats in {subject.code} yet. Start asking a question!</div>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conv) => {
              const active = currentConversationId === conv._id
              const confirming = deletingConvId === conv._id
              return (
                <div
                  key={conv._id}
                  onClick={() => {
                    if (confirming) return
                    onLoad(conv._id)
                    close()
                  }}
                  className={`group flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors ${
                    confirming ? 'bg-slate-100 text-slate-900 font-medium' : active ? 'bg-blue-50/90 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-white hover:text-slate-950'
                  }`}
                >
                  <MessageSquare size={14} className={`shrink-0 ${active ? 'text-accent' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1 truncate" title={conv.title}>{conv.title}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setAnchor(e.currentTarget.getBoundingClientRect())
                      onAskDelete(conv._id)
                    }}
                    title="Delete Chat"
                    className={`grid size-6 shrink-0 place-items-center rounded-md transition hover:bg-danger/15 hover:text-danger ${
                      confirming ? 'bg-danger/15 text-danger opacity-100' : 'text-mute opacity-100 lg:opacity-0 lg:group-hover:opacity-100'
                    }`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {target && anchor && (
        <DeletePopover
          anchor={anchor}
          title={target.title}
          onConfirm={(e) => onConfirmDelete(target._id, e)}
          onCancel={() => onCancelDelete({ stopPropagation() {} })}
        />
      )}

      <UserFooter
        initial={user.name?.charAt(0) || 'S'}
        name={user.name || 'Student'}
        role="Student"
        logoutLabel="Sign Out"
        onLogout={onLogout}
      />
    </>
  )
}

/** Floating confirm card anchored to the right of the trash button. */
function DeletePopover({ anchor, title, onConfirm, onCancel }) {
  const ref = useRef(null)
  const W = 260
  const left = Math.min(anchor.right + 10, window.innerWidth - W - 12)
  const top = Math.min(Math.max(12, anchor.top - 12), window.innerHeight - 170)

  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onCancel()
    const onKey = (e) => e.key === 'Escape' && onCancel()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onCancel)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onCancel)
    }
  }, [onCancel])

  return createPortal(
    <div
      ref={ref}
      role="alertdialog"
      aria-label="Delete chat"
      style={{ left, top, width: W }}
      className="fixed z-[120] animate-rise rounded-2xl border border-line bg-panel p-4 shadow-[0_24px_60px_-16px_#1a24504d]"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
          <Trash2 size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-fg">Delete chat?</p>
          <p className="mt-0.5 truncate text-[12.5px] text-mute" title={title}>“{title}”</p>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-dim">This conversation will be permanently removed.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-8 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-dim hover:bg-hover hover:text-fg">
          Cancel
        </button>
        <button type="button" onClick={onConfirm} className="h-8 rounded-lg bg-danger px-3 text-[13px] font-medium text-white hover:brightness-110">
          Delete
        </button>
      </div>
    </div>,
    document.body
  )
}
