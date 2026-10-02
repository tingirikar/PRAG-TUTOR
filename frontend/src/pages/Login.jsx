import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, GraduationCap, Presentation } from 'lucide-react'
import Brand from '../components/ui/Brand'
import Spinner from '../components/ui/Spinner'

const DEMO_USERS = {
  student: { password: 'student123', user: { username: 'student', name: 'Student', role: 'student' } },
  teacher_dsa: { password: 'dsa123', user: { username: 'teacher_dsa', name: 'Dr. Sarah', role: 'teacher', subject: 'DSA' } },
  teacher_ml: { password: 'ml123', user: { username: 'teacher_ml', name: 'Prof. Alan', role: 'teacher', subject: 'ML' } },
  teacher_cn: { password: 'cn123', user: { username: 'teacher_cn', name: 'Dr. Kevin', role: 'teacher', subject: 'CN' } },
}

export default function Login() {
  const [role, setRole] = useState('student')
  const [username, setUsername] = useState(role === 'student' ? 'student' : 'teacher_dsa')
  const [password, setPassword] = useState(role === 'student' ? 'student123' : 'dsa123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  // Sliding tab pill: follows the cursor while hovering, snaps back to the active role on leave
  const tabsRef = useRef(null)
  const [pillX, setPillX] = useState(null)
  const trackPill = (e) => {
    const r = tabsRef.current.getBoundingClientRect()
    const half = (r.width - 8) / 2
    setPillX(Math.min(half, Math.max(0, e.clientX - r.left - 4 - half / 2)))
  }

  const handleRoleChange = (newRole) => {
    setRole(newRole)
    setError('')
    if (newRole === 'student') {
      setUsername('student')
      setPassword('student123')
    } else {
      setUsername('teacher_dsa')
      setPassword('dsa123')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      })
      // No backend reachable (e.g. design preview): accept the demo accounts locally
      let data = await res.json().catch(() => null)
      if (!data) {
        const demo = DEMO_USERS[username.trim()]
        if (!demo || demo.password !== password.trim()) {
          throw new Error('Could not reach the tutor server. Please make sure the backend is running.')
        }
        data = { user: demo.user }
      } else if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in. Please verify your credentials.')
      }

      sessionStorage.setItem('user', JSON.stringify(data.user))
        if (data.token) sessionStorage.setItem('authToken', data.token)
      if (data.user.role === 'teacher') {
        navigate('/teacher')
      } else {
        navigate('/student')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'h-11 w-full rounded-xl border border-line-strong bg-panel px-3.5 text-[15px] text-fg placeholder:text-mute transition focus:border-accent focus:bg-panel focus:ring-4 focus:ring-accent/15 focus:outline-none'

  return (
    <div className="grid min-h-dvh bg-ink text-fg lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <aside className="rail-dark dot-grid relative hidden flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16">
        <Brand />
        <div className="max-w-xl">
          <p className="font-mono text-[11px] tracking-[0.25em] text-accent">AI · RAG · MULTI-SUBJECT</p>
          <h1 className="mt-6 text-[clamp(2.4rem,3.6vw,3.6rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-fg">
            Answers grounded in the material you <span className="font-serif font-normal italic text-accent">actually</span> study.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-dim">
            A personalized tutor that reads your course documents and explains
            concepts, diagrams, and derivations — subject by subject.
          </p>
        </div>
        <ul className="grid gap-0 border-t border-line">
          {[
            ['01', 'Retrieval-augmented answers, tied to your sources'],
            ['02', 'Diagrams and math rendered inline'],
            ['03', 'Separate spaces for students and faculty'],
          ].map(([n, t]) => (
            <li key={n} className="flex items-baseline gap-5 border-b border-line py-4 text-sm text-dim">
              <span className="font-mono text-xs text-accent">{n}</span> {t}
            </li>
          ))}
        </ul>
      </aside>

      {/* Form panel */}
      <main className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="pointer-events-none absolute inset-0 grain lg:hidden" />
        <div className="relative w-full max-w-[420px] animate-rise lg:-mt-10">
          <Brand className="mb-10 lg:hidden" />
          <p className="font-mono text-[11px] tracking-[0.22em] text-mute uppercase">Welcome back</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg">Sign in to continue</h1>
          <p className="mt-2 text-sm text-dim">Choose your role, then enter your credentials.</p>

          <div
            ref={tabsRef}
            role="tablist"
            onPointerMove={(e) => e.pointerType === 'mouse' && trackPill(e)}
            onPointerLeave={() => setPillX(null)}
            className="relative mt-8 grid grid-cols-2 rounded-xl border border-line bg-raised p-1">
            <span
              aria-hidden
              style={{ transform: pillX === null ? `translateX(${role === 'teacher' ? '100%' : '0'})` : `translateX(${pillX}px)` }}
              className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-panel shadow-[0_1px_2px_#0f16301a,0_4px_12px_-4px_#1a245033,inset_0_0_0_1px_#dbe0ec] transition-transform ease-[cubic-bezier(0.3,0.9,0.3,1)] ${
                pillX === null ? 'duration-300' : 'duration-150'
              }`}
            />
            {[
              ['student', 'Student', GraduationCap],
              ['teacher', 'Teacher', Presentation],
            ].map(([key, label, Ico]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={role === key}
                onClick={() => { handleRoleChange(key); setPillX(null) }}
                className={`relative z-10 flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-300 ${
                  role === key ? 'text-fg' : 'text-mute hover:text-dim'
                }`}
              >
                <Ico size={15} className={`transition-colors duration-300 ${role === key ? 'text-accent' : ''}`} />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="mt-5 space-y-4 rounded-2xl border border-line bg-panel/70 p-5 sm:p-6">
            {error && (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-dim">Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={`Enter ${role} username`}
                autoComplete="username"
                required
                className={inputCls}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-dim">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
                className={inputCls}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-medium text-white shadow-[0_10px_30px_-12px_#5b7cff] transition hover:bg-accent-strong disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Spinner className="size-4 border-white/30 border-t-white" /> Signing in...
                </>
              ) : (
                <>
                  {`Sign In as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 min-h-[98px] rounded-xl border border-dashed border-line-strong px-4 py-3 font-mono text-xs leading-6 text-mute">
            {role === 'student' ? (
              <p key="s" className="animate-rise cursor-pointer transition hover:text-fg" onClick={() => { setUsername('student'); setPassword('student123'); setError('') }}>
                Demo Student: <strong className="text-dim">student</strong> / <strong className="text-dim">student123</strong> <span className="opacity-60">(click to fill)</span>
              </p>
            ) : (
              <div key="t" className="animate-rise space-y-1">
                <p className="cursor-pointer transition hover:text-fg" onClick={() => { setUsername('teacher_dsa'); setPassword('dsa123'); setError('') }}>
                  DSA Faculty: <strong className="text-dim">teacher_dsa</strong> / <strong className="text-dim">dsa123</strong> <span className="opacity-60">(click to fill)</span>
                </p>
                <p className="cursor-pointer transition hover:text-fg" onClick={() => { setUsername('teacher_ml'); setPassword('ml123'); setError('') }}>
                  ML Faculty: <strong className="text-dim">teacher_ml</strong> / <strong className="text-dim">ml123</strong> <span className="opacity-60">(click to fill)</span>
                </p>
                <p className="cursor-pointer transition hover:text-fg" onClick={() => { setUsername('teacher_cn'); setPassword('cn123'); setError('') }}>
                  CN Faculty: <strong className="text-dim">teacher_cn</strong> / <strong className="text-dim">cn123</strong> <span className="opacity-60">(click to fill)</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
