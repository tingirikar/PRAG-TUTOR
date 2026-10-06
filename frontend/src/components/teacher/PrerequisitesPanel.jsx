import { GitFork, Plus, RefreshCw, Search } from 'lucide-react'
import PageHeader from './PageHeader'
import EmptyState from './EmptyState'
import Button from '../ui/Button'

export default function PrerequisitesPanel({ subject, prerequisites, loading, search, setSearch, onAdd, onRefresh, renderCard }) {
  const entries = Object.entries(prerequisites)
  const total = entries.length
  const foundational = Object.values(prerequisites).filter(p => !p || p.length === 0).length
  const advanced = Object.values(prerequisites).filter(p => p && p.length > 0).length

  const metrics = [
    ['Total Topics', total, 'text-accent', 'bg-accent'],
    ['Foundational (Entry Level)', foundational, 'text-sky', 'bg-sky'],
    ['Intermediate & Advanced', advanced, 'text-violet', 'bg-violet'],
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Concept graph"
        title={`${subject} Syllabus & Prerequisites`}
        subtitle={`AI-extracted learning concepts and required prerequisite dependencies for ${subject}`}
        actions={
          <>
            <Button variant="primary" onClick={onAdd}>
              <Plus size={15} /> Add New Topic
            </Button>
            <Button onClick={onRefresh} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </>
        }
      />

      <div className="mb-6 grid overflow-hidden rounded-2xl border border-line sm:grid-cols-3">
        {metrics.map(([label, value, color, bar], i) => (
          <div key={label} className={`relative bg-panel px-5 py-5 ${i > 0 ? 'border-t border-line sm:border-t-0 sm:border-l' : ''}`}>
            <div className="font-mono text-[10.5px] tracking-[0.14em] text-mute uppercase">{label}</div>
            <div className={`mt-2 text-4xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-raised">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="relative mb-5">
          <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-mute" />
          <input
            type="text"
            placeholder={`Search ${subject} topics...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-panel pr-4 pl-10 text-sm text-fg placeholder:text-mute focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none"
          />
        </div>
      )}

      {total === 0 ? (
        <EmptyState icon={<GitFork size={28} />}>
          No prerequisites generated for {subject} yet.<br />Upload course notes or syllabus PDF in the <strong className="text-fg">Upload</strong> tab to automatically build the concept graph.
        </EmptyState>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
          {entries
            .filter(([topic]) => !search || topic.toLowerCase().includes(search.toLowerCase()))
            .map(([topic, prereqs]) => renderCard(topic, prereqs))}
        </div>
      )}
    </div>
  )
}
