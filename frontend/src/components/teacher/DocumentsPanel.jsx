import { Check, FileText, Inbox, X } from 'lucide-react'
import PageHeader from './PageHeader'
import EmptyState from './EmptyState'
import Button from '../ui/Button'

export default function DocumentsPanel({
  subject, documents, formatSize, deletingDocName, setDeletingDocName, onDelete,
}) {
  const actions = (doc) => (
    <div className="inline-flex items-center gap-1.5">
      {deletingDocName === doc.name ? (
        <div className="inline-flex items-center gap-1.5">
          <span className="text-[12.5px] font-medium text-danger">Delete?</span>
          <button type="button" onClick={() => onDelete(doc.name)} title="Confirm Delete" className="grid size-8 place-items-center rounded-lg bg-danger text-white hover:brightness-110">
            <Check size={14} />
          </button>
          <button type="button" onClick={() => setDeletingDocName(null)} title="Cancel" className="grid size-8 place-items-center rounded-lg bg-raised text-dim ring-1 ring-line-strong hover:text-fg">
            <X size={14} />
          </button>
        </div>
      ) : (
        <Button size="sm" variant="danger" onClick={() => setDeletingDocName(doc.name)} title="Delete document and remove from index">
          Delete
        </Button>
      )}
    </div>
  )

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title={`${subject} Course Documents`}
        subtitle={`All uploaded and indexed documents for ${subject}`}
      />

      {documents.length === 0 ? (
        <EmptyState icon={<Inbox size={28} />}>
          No documents uploaded for {subject} yet.<br />Go to Upload to add PDF files.
        </EmptyState>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-panel md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10.5px] tracking-[0.14em] text-mute uppercase">
                  <th className="px-5 py-3 font-normal">Name</th>
                  <th className="px-5 py-3 font-normal">Size</th>
                  <th className="px-5 py-3 font-normal">Uploaded</th>
                  <th className="px-5 py-3 font-normal">Status</th>
                  <th className="px-5 py-3 font-normal">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {documents.map((doc) => (
                  <tr key={doc.id} className="transition-colors hover:bg-raised/50">
                    <td className="max-w-[320px] px-5 py-3.5">
                      <span className="flex items-center gap-2.5 text-fg">
                        <FileText size={15} className="shrink-0 text-mute" />
                        <span className="truncate">{doc.name}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12.5px] text-dim">{formatSize(doc.size)}</td>
                    <td className="px-5 py-3.5 text-dim">{doc.uploadedAt}</td>
                    <td className="px-5 py-3.5">
                      {(() => {
                        const isIndexed = String(doc.status).toLowerCase() === 'indexed'
                        return (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium capitalize ${
                            isIndexed
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                              : 'border-sky/25 bg-sky/10 text-sky'
                          }`}>
                            <span className={`size-1.5 rounded-full ${isIndexed ? 'bg-emerald-500' : 'bg-sky'}`} />
                            {doc.status}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-5 py-3.5">{actions(doc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {documents.map((doc) => {
              const isIndexed = String(doc.status).toLowerCase() === 'indexed'
              return (
                <div key={doc.id} className="rounded-2xl border border-line bg-panel p-4 lift animate-rise">
                  <div className="flex items-start gap-3">
                    <FileText size={18} className="mt-0.5 shrink-0 text-mute" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-fg">{doc.name}</div>
                      <div className="mt-1 font-mono text-[11.5px] text-mute">{formatSize(doc.size)} · {doc.uploadedAt}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                      isIndexed
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                        : 'border-sky/25 bg-sky/10 text-sky'
                    }`}>
                      {doc.status}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">{actions(doc)}</div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
