/**
 * Reset quiz state for a student (for testing purposes only).
 * Usage: node scripts/reset-quiz-state.mjs
 */
import mongoose from 'mongoose'

await mongoose.connect('mongodb://127.0.0.1:27017/lpi_tutor')
const db = mongoose.connection.db

const res = await db.collection('quizstates').updateMany(
  {},
  { $set: { skipCount: 0, pendingQuizSetIds: [] } }
)

console.log('Quiz states reset:', res.modifiedCount, 'documents updated')

const states = await db.collection('quizstates').find({}).toArray()
console.log('Current states:')
for (const s of states) {
  console.log(`  ${s.studentUsername}/${s.subject}: skipCount=${s.skipCount}, pending=${s.pendingQuizSetIds.length}`)
}

await mongoose.disconnect()
console.log('Done.')
