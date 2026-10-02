/**
 *  currently we dont have admin page to manage student and teacher accounts
 *  so we are feeding initial data
**/

import User from '../models/User.js'
import Subject from '../models/Subject.js'

export async function seedDatabase() {
  try {

    // 1. Initial Teacher and Student accounts
    const users = [
      { username: 'student_cse', password: 'cse123', name: 'Alex', role: 'student', enrolled: ['DSA', 'ML', 'CN'] },
      { username: 'student_csm', passowrd: 'csm123', name: 'Diana', role: 'student', enrolled: ['ML', 'CN']},
      { username: 'teacher_dsa', password: 'dsa123', name: 'Dr. Sarah (DSA Faculty)', role: 'teacher', subject: 'DSA' },
      { username: 'teacher_ml', password: 'ml123', name: 'Prof. Alan (ML Faculty)', role: 'teacher', subject: 'ML' },
      { username: 'teacher_cn', password: 'cn123', name: 'Dr. Kevin (CN Faculty)', role: 'teacher', subject: 'CN' },
    ]

    for (const user of users) {
      await User.findOneAndUpdate({ username: user.username }, { $setOnInsert: user }, { upsert: true }).catch(() => {})
    }

    // 3. Initial Subjects (DSA, ML, CN)
    const initialSubjects = [
      {
        code: 'DSA',
        name: 'Data Structures & Algorithms',
        description: 'Master linear & non-linear structures, recursion, trees, graphs, sorting, and complexity analysis.',
        teacherUsername: 'teacher_dsa',
        teacherName: 'Dr. Sarah'
      },
      {
        code: 'ML',
        name: 'Machine Learning',
        description: 'Explore supervised & unsupervised learning, cost functions, gradient descent, neural networks, and evaluation.',
        teacherUsername: 'teacher_ml',
        teacherName: 'Prof. Alan'
      },
      {
        code: 'CN',
        name: 'Computer Networks',
        description: 'OSI & TCP/IP stack, routing protocols, flow control, congestion avoidance, sockets, and network security.',
        teacherUsername: 'teacher_cn',
        teacherName: 'Dr. Kevin'
      },
    ]
    for (const s of initialSubjects) {
      await Subject.findOneAndUpdate({ code: s.code }, { $setOnInsert: s }, { upsert: true }).catch(() => {})
    }
  } catch (err) {
    console.warn('Seeding error:', err.message)
  }
}
