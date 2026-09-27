import test from 'node:test'
import assert from 'node:assert/strict'

const apiUrl = process.env.API_URL || 'http://127.0.0.1:5000'

async function getJson(path, options) {
  const response = await fetch(`${apiUrl}${path}`, options)
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

test('Node API reports healthy', async () => {
  const { response, body } = await getJson('/health')
  assert.equal(response.status, 200)
  assert.equal(body.status, 'ok')
})

test('subjects endpoint returns course catalog', async () => {
  const { response, body } = await getJson('/api/subjects')
  assert.equal(response.status, 200)
  assert.ok(Array.isArray(body.subjects))
  assert.ok(body.subjects.some(s => s.code === 'DSA'))
  assert.ok(body.subjects.some(s => s.code === 'ML'))
})

test('sample questions endpoint returns array without crashing', async () => {
  const { response, body } = await getJson('/api/sample-questions?subject=DSA')
  assert.equal(response.status, 200)
  assert.ok(Array.isArray(body.questions))
})

test('documents endpoint returns document list', async () => {
  const { response, body } = await getJson('/api/documents?subject=DSA')
  assert.equal(response.status, 200)
  assert.ok(Array.isArray(body.documents))
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

test('image proxy rejects unauthenticated requests (Ghost 8)', async () => {
  const { response, body } = await getJson('/api/images/syllabus_dsa_pdf/page_0_img_0.png')
  assert.equal(response.status, 401)
  assert.ok(body.error.includes('Unauthorized'))
})

test('image proxy rejects invalid users (Ghost 8)', async () => {
  const { response, body } = await getJson('/api/images/syllabus_dsa_pdf/page_0_img_0.png?u=unregistered_user')
  assert.equal(response.status, 403)
  assert.ok(body.error.includes('Forbidden'))
})

test('image proxy rejects directory traversal (Ghost 8)', async () => {
  const { response, body } = await getJson('/api/images/%2e%2e%2fbackend/.env?u=student')
  assert.equal(response.status, 400)
  assert.ok(body.error.includes('Invalid or unsafe'))
})

test('image proxy rejects teacher accessing unauthorized subject (Ghost 8)', async () => {
  const { response, body } = await getJson('/api/images/syllabus_dsa_pdf/page_0_img_0.png?u=teacher_ml')
  assert.equal(response.status, 403)
  assert.ok(body.error.includes('Faculty member for ML is not authorized'))
})

test('image proxy allows teacher accessing their authorized subject (Ghost 8)', async () => {
  const { response } = await getJson('/api/images/syllabus_dsa_pdf/page_0_img_0.png?u=teacher_dsa')
  // Should NOT be rejected with 401 or 403
  assert.notEqual(response.status, 401)
  assert.notEqual(response.status, 403)
})

test('image proxy allows enrolled student accessing course diagrams (Ghost 8)', async () => {
  const { response } = await getJson('/api/images/syllabus_dsa_pdf/page_0_img_0.png?u=student')
  // Should NOT be rejected with 401 or 403
  assert.notEqual(response.status, 401)
  assert.notEqual(response.status, 403)
})
