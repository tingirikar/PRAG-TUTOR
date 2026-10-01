import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'

export default function Login() {
  const [role, setRole] = useState('student')
  const [username, setUsername] = useState(role === 'student' ? 'student' : 'teacher_dsa')
  const [password, setPassword] = useState(role === 'student' ? 'student123' : 'dsa123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

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
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in. Please verify your credentials.')
      }

      sessionStorage.setItem('user', JSON.stringify(data.user))
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

  return (
    <div className="login-wrapper">
      <aside className="auth-brand">
        <div className="auth-brand-top">
          <span className="brand-mark">PT</span>
          <span className="brand-name">PRAG Tutor</span>
        </div>
        <div className="auth-brand-mid">
          <p className="eyebrow">AI · RAG · MULTI-SUBJECT</p>
          <h1>Answers grounded in the material you actually study.</h1>
          <p className="lede">
            A personalized tutor that reads your course documents and explains
            concepts, diagrams, and derivations — subject by subject.
          </p>
        </div>
        <ul className="auth-facts">
          <li><span>01</span> Retrieval-augmented answers, tied to your sources</li>
          <li><span>02</span> Diagrams and math rendered inline</li>
          <li><span>03</span> Separate spaces for students and faculty</li>
        </ul>
      </aside>

      <main className="auth-panel">
        <div className="login-container">
          <div className="login-header">
            <p className="eyebrow">Welcome back</p>
            <h1>Sign in to continue</h1>
            <p>Choose your role, then enter your credentials.</p>
          </div>

          <div className="role-tabs">
          <button
            className={`role-tab ${role === 'student' ? 'active' : ''}`}
            onClick={() => handleRoleChange('student')}
          >
            Student
          </button>
          <button
            className={`role-tab ${role === 'teacher' ? 'active' : ''}`}
            onClick={() => handleRoleChange('teacher')}
          >
            Teacher
          </button>
        </div>

        <form className="login-card" onSubmit={handleLogin}>
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={`Enter ${role} username`}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : `Sign In as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
          </button>
        </form>

        <div className="login-hint">
          {role === 'student' ? (
            <p>Demo Student: <strong>student</strong> / <strong>student123</strong></p>
          ) : (
            <div>
              <p style={{ margin: '3px 0' }}>DSA Faculty: <strong>teacher_dsa</strong> / <strong>dsa123</strong></p>
              <p style={{ margin: '3px 0' }}>ML Faculty: <strong>teacher_ml</strong> / <strong>ml123</strong></p>
              <p style={{ margin: '3px 0' }}>CN Faculty: <strong>teacher_cn</strong> / <strong>cn123</strong></p>
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  )
}
