import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'

// Pre-given credentials
const USERS = {
  teacher: { username: 'teacher', password: 'teacher123', role: 'teacher' },
  student: { username: 'student', password: 'student123', role: 'student' },
}

export default function Login() {
  const [role, setRole] = useState('student')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')

    const creds = USERS[role]
    if (username === creds.username && password === creds.password) {
      sessionStorage.setItem('user', JSON.stringify({ username, role }))
      navigate(`/${role}`)
    } else {
      setError('Invalid credentials. Please try again.')
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-header">
          <h1>PRAG Tutor</h1>
          <p>Intelligent tutoring powered by RAG</p>
        </div>

        <div className="role-tabs">
          <button
            className={`role-tab ${role === 'student' ? 'active' : ''}`}
            onClick={() => { setRole('student'); setError('') }}
          >
            Student
          </button>
          <button
            className={`role-tab ${role === 'teacher' ? 'active' : ''}`}
            onClick={() => { setRole('teacher'); setError('') }}
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

          <button type="submit" className="btn-primary">
            Sign In as {role.charAt(0).toUpperCase() + role.slice(1)}
          </button>
        </form>

        <p className="login-hint">
          Demo — use <strong>{USERS[role].username}</strong> / <strong>{USERS[role].password}</strong>
        </p>
      </div>
    </div>
  )
}
