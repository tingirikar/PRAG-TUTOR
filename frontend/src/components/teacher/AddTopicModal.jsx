import { X } from 'lucide-react'
import { PrereqChip, ChipAdder } from './ChipInput'

export default function AddTopicModal({
  subject, onClose, onSubmit,
  newTopicName, setNewTopicName, newPrereqInput, setNewPrereqInput,
  newTopicPrereqs, onAddChip, onRemoveChip, isSubmitting,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0f1630]/40 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={onClose}>
      <div
        className="w-full max-w-[480px] animate-rise rounded-t-3xl border border-line-strong bg-panel p-6 shadow-[0_40px_80px_-24px_#1a24504d] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-fg">Add Topic to {subject} Syllabus</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-mute hover:bg-hover hover:text-fg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-dim">Topic Name *</span>
            <input
              type="text"
              placeholder="e.g. Disjoint Set Union (DSU)"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              required
              autoFocus
              className="h-10 w-full rounded-lg border border-line-strong bg-ink px-3 text-sm text-fg placeholder:text-mute focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-dim">Required Prerequisites (Optional)</span>
            <ChipAdder
              size="md"
              value={newPrereqInput}
              onChange={setNewPrereqInput}
              onAdd={onAddChip}
              placeholder="e.g. Tree Representations and Arrays"
            />
            <div className="mt-3">
              {newTopicPrereqs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {newTopicPrereqs.map((p, idx) => <PrereqChip key={idx} label={p} onRemove={() => onRemoveChip(idx)} />)}
                </div>
              ) : (
                <div className="text-[12.5px] text-mute italic">No prerequisites added yet (will be marked as Foundational).</div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-5">
            <button type="button" onClick={onClose} className="h-10 rounded-xl border border-line-strong px-4 text-sm text-dim hover:text-fg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newTopicName.trim()}
              className="h-10 rounded-xl bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
            >
              {isSubmitting ? 'Adding Topic...' : 'Add Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
