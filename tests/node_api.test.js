import test from 'node:test'
import assert from 'node:assert/strict'

const apiUrl = process.env.API_URL || 'http://127.0.0.1:5000'

async function getJson(path, options) {
  const response = await fetch(`${apiUrl}${path}`, options)
  const body = await response.json()
  return { response, body }
}

test('Node API reports healthy', async () => {
  const { response, body } = await getJson('/health')

  assert.equal(response.status, 200)
  assert.equal(body.status, 'ok')
})

test('sample questions endpoint returns tutor questions', async () => {
  const { response, body } = await getJson('/api/sample-questions')

  assert.equal(response.status, 200)
  assert.ok(Array.isArray(body.questions))
  assert.ok(body.questions.length > 0)
  assert.ok(body.questions.every(question => question.question && question.level))
})

test('prerequisites endpoint returns the course mapping', async () => {
  const { response, body } = await getJson('/api/prerequisites')

  assert.equal(response.status, 200)
  assert.ok(body.count > 0)
  assert.deepEqual(body.prerequisites['Binary Search'], ['Searching Algorithms', 'Sorting Techniques'])
})

test('query endpoint rejects an empty question', async () => {
  const { response, body } = await getJson('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '' }),
  })

  assert.equal(response.status, 400)
  assert.equal(body.error, 'Please enter a question.')
})
