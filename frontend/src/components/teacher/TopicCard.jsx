import { Check, Edit3, Trash2 } from 'lucide-react'
import { PrereqChip, ChipAdder } from './ChipInput'

export default function TopicCard({
  topic, prereqs, isEditing,
  editPrereqsList, editNewChipInput, setEditNewChipInput,
  onStartEdit, onCancelEdit, onSave, onDelete, onAddChip, onRemoveChip, isSavingEdit,
}) {
  const isFoundational = !prereqs || prereqs.length === 0

  return (
    <div
      className={`group flex flex-col gap-3.5 rounded-2xl border bg-panel p-5 transition-all ${
        isEditing ? 'border-accent shadow-[0_0_0_4px_#3b5bfd1a]' : 'border-line hover:border-line-strong hover:shadow-[0_10px_30px_-20px_#1a245059]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[15.5px] leading-snug font-semibold tracking-tight text-fg">{topic}</h4>
          <p className={`mt-1 text-[12px] font-medium ${isEditing ? 'text-accent' : isFoundational ? 'text-sky' : 'text-mute'}`}>
            {isEditing ? 'Editing prerequisites' : isFoundational ? 'Foundational concept' : `${prereqs.length} prerequisite${prereqs.length > 1 ? 's' : ''}`}
          </p>
        </div>
        {!isEditing && (
          <div className="flex shrink-0 items-center gap-0.5 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
            <button type="button" onClick={onStartEdit} title="Edit prerequisites" className="grid size-8 place-items-center rounded-lg text-mute hover:bg-hover hover:text-fg">
              <Edit3 size={14} />
            </button>
            <button type="button" onClick={onDelete} title="Delete topic from syllabus" className="grid size-8 place-items-center rounded-lg text-mute hover:bg-danger/10 hover:text-danger">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className={isEditing || !isFoundational ? 'border-t border-line pt-3.5' : ''}>
        {(isEditing || !isFoundational) && <div className="mb-2 text-[11.5px] text-mute">Required prerequisites</div>}

        {isEditing ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {editPrereqsList.length === 0 ? (
                <span className="text-[12.5px] text-mute italic">No prerequisites (Foundational concept)</span>
              ) : (
                editPrereqsList.map((p, idx) => <PrereqChip key={idx} label={p} onRemove={() => onRemoveChip(idx)} />)
              )}
            </div>
            <ChipAdder
              value={editNewChipInput}
              onChange={setEditNewChipInput}
              onAdd={onAddChip}
              placeholder="Type prerequisite & press Enter..."
            />
            <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSavingEdit}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong disabled:opacity-60"
                >
                  <Check size={13} /> {isSavingEdit ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={onCancelEdit} className="h-8 rounded-lg border border-line-strong px-3 text-[12.5px] text-dim hover:text-fg">
                  Cancel
                </button>
              </div>
              <button
                type="button"
                onClick={onDelete}
                title="Delete entire topic card"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-danger/25 px-2.5 text-[12.5px] text-danger hover:bg-danger/10"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        ) : isFoundational ? (
          <p className="text-[13px] text-mute">None — entry-level core concept</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {prereqs.map((p, idx) => <PrereqChip key={idx} label={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
