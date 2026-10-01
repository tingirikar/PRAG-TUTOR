import { Check, FileText, UploadCloud, X } from 'lucide-react'
import PageHeader from './PageHeader'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'

const statusPill = {
  pending: 'border-line-strong text-dim',
  uploading: 'border-accent/30 bg-accent-soft text-accent-strong',
  done: 'border-sky/25 bg-sky/10 text-sky',
  error: 'border-danger/30 bg-danger/10 text-danger',
}
const barColor = {
  uploading: 'bg-gradient-to-r from-accent to-sky',
  done: 'bg-sky',
  error: 'bg-danger',
}

export default function UploadPanel({
  subject, files, dragOver, setDragOver, fileInputRef, handleFiles,
  removeFile, uploadAll, clearDone, formatSize,
}) {
  const isUploading = files.some(f => f.status === 'uploading')
  const pendingCount = files.filter(f => f.status === 'pending').length

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge base"
        title={<>Upload Documents &bull; <span className="text-accent">{subject}</span></>}
        subtitle={`Upload PDF files to create embeddings for student RAG in ${subject}`}
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`dot-grid group flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all sm:py-20 ${
          dragOver ? 'border-accent bg-accent-soft' : 'border-line-strong bg-panel/40 hover:border-accent/40 hover:bg-panel'
        }`}
      >
        <div className={`grid size-16 place-items-center rounded-2xl ring-1 transition ${dragOver ? 'bg-accent text-white ring-accent' : 'bg-raised text-accent ring-line-strong group-hover:-translate-y-1'}`}>
          <UploadCloud size={30} />
        </div>
        <h3 className="mt-5 text-base font-medium text-fg sm:text-lg">Drop {subject} PDF files here or click to browse</h3>
        <p className="mt-1.5 font-mono text-xs text-mute">Only .pdf files are accepted</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
            {files.map((f) => {
              const pct = f.progress !== undefined ? f.progress : (f.status === 'done' ? 100 : 0)
              return (
                <div key={f.id} className="flex items-start gap-3 p-4 sm:items-center sm:gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-raised text-dim">
                    <FileText size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className="truncate text-sm font-medium text-fg" title={f.name}>{f.name}</span>
                      <span className="shrink-0 font-mono text-[11px] text-mute">{formatSize(f.size)}</span>
                    </div>

                    {f.status !== 'pending' && (
                      <>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
                          <div className={`h-full rounded-full transition-all duration-500 ${barColor[f.status] || 'bg-accent'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-3 text-[12px]">
                          <span className={`flex min-w-0 items-center gap-1.5 truncate ${f.status === 'error' ? 'text-danger' : 'text-mute'}`}>
                            {f.status === 'uploading' && <Spinner className="size-3" />}
                            {f.stage || (f.status === 'done' ? 'Completed & Indexed' : 'Processing...')}
                          </span>
                          <span className="shrink-0 font-mono text-mute">{pct}%</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${statusPill[f.status]}`}>
                      {f.status === 'pending' && 'Ready'}
                      {f.status === 'uploading' && `${f.progress || 0}%`}
                      {f.status === 'done' && <><Check size={12} /> Indexed</>}
                      {f.status === 'error' && 'Error'}
                    </span>
                    {(f.status === 'pending' || f.status === 'error' || f.status === 'done') && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(f.id) }}
                        title="Remove file"
                        className="grid size-7 place-items-center rounded-md text-mute hover:bg-hover hover:text-fg"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={uploadAll} disabled={isUploading || pendingCount === 0}>
              {isUploading && <Spinner className="size-3.5 border-white/30 border-t-white" />}
              {isUploading ? 'Indexing in progress...' : `Upload All to ${subject} (${pendingCount})`}
            </Button>
            {files.some(f => f.status === 'done') && !isUploading && (
              <Button onClick={clearDone}>Clear Done</Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
