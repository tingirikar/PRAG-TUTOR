/**
 * Reset quiz state for a student (for testing purposes only).
 * Usage: node scripts/reset-quiz-state.mjs
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lpi_tutor'
await mongoose.connect(uri)
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
