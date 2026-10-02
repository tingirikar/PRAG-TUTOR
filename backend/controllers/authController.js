import User from '../models/User.js'
import { isMongoReady } from '../config/db.js'
import { createAuthToken } from '../middleware/auth.js'

export async function login(request, response) {
  const { username, password } = request.body || {}

  if (!username || !password) {
    return response.status(400).json({ error: 'Username and password are required.' })
  }

  try {
    if (!isMongoReady()) {
      return response.status(503).json({ error: 'Database is unavailable.' })
    }

    const user = await User.findOne({
      username: String(username).trim(),
      password: String(password).trim()
    })
    if (!user) {
      return response.status(401).json({ error: 'Invalid username or password.' })
    }
    return response.json({
      token: createAuthToken(user),
      user: {
        username: user.username,
        name: user.name,
        role: user.role,
        subject: user.subject
      }
    })
  } catch (err) {
    return response.status(500).json({ error: err.message })
  }
}
