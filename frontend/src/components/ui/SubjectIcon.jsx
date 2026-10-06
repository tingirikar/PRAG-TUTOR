import { Brain, Binary, Globe, BookOpen } from 'lucide-react'

// Real vector icon per subject
export default function SubjectIcon({ code, size = 22 }) {
  if (code === 'ML') return <Brain size={size} strokeWidth={1.6} />
  if (code === 'DSA') return <Binary size={size} strokeWidth={1.6} />
  if (code === 'CN' || code === 'NETWORKS') return <Globe size={size} strokeWidth={1.6} />
  return <BookOpen size={size} strokeWidth={1.6} />
}
