import User from '../models/User.js'
import Subject from '../models/Subject.js'
import Document from '../models/Document.js'

export async function seedDatabase() {
  try {
    // 1. Drop old global unique index on name if it exists to allow compound { subject, name } uniqueness
    try {
      await Document.collection.dropIndex('name_1').catch(() => {})
      await Document.syncIndexes().catch(() => {})
    } catch {}

    // 2. Initial Faculty Accounts and Demo Student
    const initialTeachers = [
      { username: 'student', password: 'student123', name: 'Alex (Student)', role: 'student' },
      { username: 'teacher_dsa', password: 'dsa123', name: 'Dr. Sarah (DSA Faculty)', role: 'teacher', subject: 'DSA' },
      { username: 'teacher_ml', password: 'ml123', name: 'Prof. Alan (ML Faculty)', role: 'teacher', subject: 'ML' },
      { username: 'teacher_cn', password: 'cn123', name: 'Dr. Kevin (CN Faculty)', role: 'teacher', subject: 'CN' },
    ]
    for (const u of initialTeachers) {
      await User.findOneAndUpdate({ username: u.username }, { $setOnInsert: u }, { upsert: true }).catch(() => {})
    }

    // 3. Initial Subjects (DSA, ML, CN)
    const initialSubjects = [
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
    for (const s of initialSubjects) {
      await Subject.findOneAndUpdate({ code: s.code }, { $setOnInsert: s }, { upsert: true }).catch(() => {})
    }
  } catch (err) {
    console.warn('Seeding error:', err.message)
  }
}
