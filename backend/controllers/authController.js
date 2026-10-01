import User from '../models/User.js'
import { isMongoReady } from '../config/db.js'

export async function login(request, response) {
  const { username, password } = request.body || {}
  if (!username || !password) {
    return response.status(400).json({ error: 'Username and password are required.' })
  }

  try {
    if (isMongoReady()) {
      const user = await User.findOne({
        username: String(username).trim(),
        password: String(password).trim()
      })
      if (!user) {
        return response.status(401).json({ error: 'Invalid username or password.' })
      }
      return response.json({
        user: {
          username: user.username,
          name: user.name,
          role: user.role,
          subject: user.subject
        }
      })
    }

    // In-memory fallback if Mongo offline
    const demoUsers = {
      student: { username: 'student', password: 'student123', name: 'Alex (Student)', role: 'student' },
      teacher_dsa: { username: 'teacher_dsa', password: 'dsa123', name: 'Dr. Sarah (DSA Faculty)', role: 'teacher', subject: 'DSA' },
      teacher_ml: { username: 'teacher_ml', password: 'ml123', name: 'Prof. Alan (ML Faculty)', role: 'teacher', subject: 'ML' },
      teacher_os: { username: 'teacher_os', password: 'os123', name: 'Dr. Robert (OS Faculty)', role: 'teacher', subject: 'OS' },
      teacher_dbms: { username: 'teacher_dbms', password: 'dbms123', name: 'Prof. Maya (DBMS Faculty)', role: 'teacher', subject: 'DBMS' },
      teacher_networks: { username: 'teacher_networks', password: 'networks123', name: 'Dr. Kevin (Networks Faculty)', role: 'teacher', subject: 'NETWORKS' },
      teacher_cn: { username: 'teacher_cn', password: 'cn123', name: 'Dr. Kevin (CN Faculty)', role: 'teacher', subject: 'CN' },
    }

    const matched = demoUsers[username.trim()]
    if (matched && matched.password === password.trim()) {
      const { password: _, ...userWithoutPassword } = matched
      return response.json({ user: userWithoutPassword })
    }

    return response.status(401).json({ error: 'Invalid username or password.' })
  } catch (err) {
    response.status(500).json({ error: err.message })
  }
}
