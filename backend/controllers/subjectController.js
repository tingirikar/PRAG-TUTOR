import Subject from '../models/Subject.js'
import { isMongoReady } from '../config/db.js'

export async function getSubjects(_request, response) {
  try {
    if (isMongoReady()) {
      const subjects = await Subject.find().lean()
      if (subjects.length > 0) return response.json({ subjects })
    }
    return response.json({
      degraded: true,
      warning: 'Database is unavailable or contains no subjects. Showing default subjects.',
      subjects: [
        {
          code: 'DSA',
          name: 'Data Structures & Algorithms',
          description: 'Master linear & non-linear structures, recursion, trees, graphs, sorting, and complexity analysis.',
          icon: '📘',
          teacherUsername: 'teacher_dsa',
          teacherName: 'Dr. Sarah (DSA Faculty)'
        },
        {
          code: 'ML',
          name: 'Machine Learning',
          description: 'Explore supervised & unsupervised learning, cost functions, gradient descent, neural networks, and evaluation.',
          icon: '🤖',
          teacherUsername: 'teacher_ml',
          teacherName: 'Prof. Alan (ML Faculty)'
        },
        {
          code: 'CN',
          name: 'Computer Networks',
          description: 'OSI & TCP/IP stack, routing protocols, flow control, congestion avoidance, sockets, and network security.',
          icon: '🌐',
          teacherUsername: 'teacher_cn',
          teacherName: 'Dr. Kevin (CN Faculty)'
        },
      ]
    })
  } catch (err) {
    return response.status(500).json({ error: err.message })
  }
}
