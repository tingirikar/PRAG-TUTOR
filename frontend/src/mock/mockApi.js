// Preview-only mock backend. Real requests always go first; the mock answers only
// when the Express server is unreachable or returns a non-JSON body.

const DAY = 86400000
const ago = (d) => new Date(Date.now() - d * DAY).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

const documents = {
  DSA: [
    { name: 'Unit1_Arrays_and_Linked_Lists.pdf', size: 2_480_112, days: 21 },
    { name: 'Unit2_Stacks_Queues.pdf', size: 1_204_890, days: 18 },
    { name: 'Unit3_Trees_BST_AVL.pdf', size: 3_912_404, days: 12 },
    { name: 'Unit4_Graph_Algorithms.pdf', size: 4_118_226, days: 6 },
    { name: 'Sorting_Complexity_Cheatsheet.pdf', size: 642_310, days: 2 },
  ],
  ML: [
    { name: 'Lecture01_Linear_Regression.pdf', size: 1_880_400, days: 25 },
    { name: 'Lecture02_Gradient_Descent.pdf', size: 2_204_100, days: 19 },
    { name: 'Lecture04_Neural_Networks.pdf', size: 5_640_920, days: 9 },
    { name: 'Model_Evaluation_Metrics.pdf', size: 980_220, days: 3 },
  ],
  CN: [
    { name: 'OSI_and_TCPIP_Models.pdf', size: 2_010_330, days: 22 },
    { name: 'Routing_Protocols_RIP_OSPF.pdf', size: 3_300_812, days: 14 },
    { name: 'Transport_Layer_TCP_Flow_Control.pdf', size: 2_744_005, days: 7 },
  ],
}
for (const subj of Object.keys(documents)) {
  documents[subj] = documents[subj].map((d, i) => ({ id: `${subj}-${i}`, name: d.name, size: d.size, uploadedAt: ago(d.days), status: 'Indexed' }))
}

const prerequisites = {
  DSA: {
    'Arrays': [], 'Recursion': [], 'Time Complexity': [],
    'Linked Lists': ['Arrays'], 'Stacks': ['Arrays', 'Linked Lists'], 'Queues': ['Arrays', 'Linked Lists'],
    'Binary Trees': ['Recursion', 'Linked Lists'], 'Binary Search Tree': ['Binary Trees'],
    'AVL Trees': ['Binary Search Tree'], 'Heaps': ['Binary Trees', 'Arrays'],
    'Graph Traversal (BFS/DFS)': ['Queues', 'Stacks', 'Recursion'], "Dijkstra's Algorithm": ['Graph Traversal (BFS/DFS)', 'Heaps'],
    'Merge Sort': ['Recursion', 'Time Complexity'], 'Dynamic Programming': ['Recursion', 'Time Complexity'],
  },
  ML: {
    'Linear Algebra Basics': [], 'Probability': [], 'Calculus Derivatives': [],
    'Linear Regression': ['Linear Algebra Basics'], 'Cost Function': ['Linear Regression'],
    'Gradient Descent': ['Cost Function', 'Calculus Derivatives'], 'Logistic Regression': ['Linear Regression', 'Probability'],
    'Overfitting & Regularization': ['Cost Function'], 'Neural Networks': ['Logistic Regression', 'Gradient Descent'],
    'Backpropagation': ['Neural Networks', 'Calculus Derivatives'], 'K-Means Clustering': ['Linear Algebra Basics'],
  },
  CN: {
    'OSI Model': [], 'Binary & Addressing': [],
    'TCP/IP Model': ['OSI Model'], 'IP Addressing & Subnetting': ['Binary & Addressing', 'TCP/IP Model'],
    'Routing Algorithms': ['IP Addressing & Subnetting'], 'OSPF': ['Routing Algorithms'],
    'TCP Handshake': ['TCP/IP Model'], 'Flow Control': ['TCP Handshake'], 'Congestion Control': ['Flow Control'],
    'Sockets': ['TCP Handshake'],
  },
}

const samples = {
  DSA: [
    { question: 'How does an AVL tree stay balanced after insertion?', topic: 'AVL Trees', level: 'intermediate' },
    { question: 'Explain the difference between BFS and DFS with an example.', topic: 'Graph Traversal (BFS/DFS)', level: 'beginner' },
    { question: 'Why is merge sort O(n log n) in every case?', topic: 'Merge Sort', level: 'intermediate' },
    { question: "Walk me through Dijkstra's algorithm step by step.", topic: "Dijkstra's Algorithm", level: 'expert' },
  ],
  ML: [
    { question: 'What is gradient descent and how does the learning rate affect it?', topic: 'Gradient Descent', level: 'beginner' },
    { question: 'Derive the cost function for linear regression.', topic: 'Cost Function', level: 'intermediate' },
    { question: 'How does backpropagation compute gradients?', topic: 'Backpropagation', level: 'expert' },
    { question: 'How can I tell if my model is overfitting?', topic: 'Overfitting & Regularization', level: 'beginner' },
  ],
  CN: [
    { question: 'Explain the TCP three-way handshake.', topic: 'TCP Handshake', level: 'beginner' },
    { question: 'How does OSPF choose the shortest path?', topic: 'OSPF', level: 'intermediate' },
    { question: 'Compare flow control and congestion control.', topic: 'Congestion Control', level: 'intermediate' },
    { question: 'Subnet 192.168.10.0/24 into 4 equal networks.', topic: 'IP Addressing & Subnetting', level: 'expert' },
  ],
}

const answers = {
  DSA: {
    topic: 'AVL Trees',
    prerequisites: ['Binary Search Tree', 'Binary Trees'],
    content: `An **AVL tree** is a self-balancing binary search tree. For every node, the heights of its left and right subtrees differ by at most one.

## Balance factor

$$
\\text{BF}(n) = h(n_{left}) - h(n_{right}), \\quad \\text{BF} \\in \\{-1, 0, 1\\}
$$

After an insertion, walk back up toward the root and recompute the balance factor at every node. The first node where $|\\text{BF}| = 2$ needs a rotation.

| Case | Imbalance | Fix |
|---|---|---|
| LL | Left child's left subtree | Single right rotation |
| RR | Right child's right subtree | Single left rotation |
| LR | Left child's right subtree | Left rotate child, then right rotate |
| RL | Right child's left subtree | Right rotate child, then left rotate |

\`\`\`mermaid
graph TD
  A[30 BF=+2] --> B[20 BF=+1]
  A --> C[ ]
  B --> D[10]
  B --> E[ ]
  style C fill:none,stroke:none
  style E fill:none,stroke:none
\`\`\`

\`\`\`python
def rotate_right(y):
    x = y.left
    y.left, x.right = x.right, y
    update_height(y); update_height(x)
    return x
\`\`\`

> Rotations are $O(1)$, so insertion stays $O(\\log n)$ overall.`,
    sources: [
      { document: 'Unit3_Trees_BST_AVL.pdf', score: 94, snippet: 'An AVL tree maintains the invariant that for every node the heights of the two child subtrees differ by at most one. Rebalancing is achieved through single and double rotations…' },
      { document: 'Unit3_Trees_BST_AVL.pdf', score: 87, snippet: 'Case LR: the inserted key lies in the right subtree of the left child. Perform a left rotation on the child followed by a right rotation on the unbalanced node.' },
    ],
  },
  ML: {
    topic: 'Gradient Descent',
    prerequisites: ['Cost Function', 'Calculus Derivatives'],
    content: `**Gradient descent** repeatedly moves the parameters a small step in the direction that lowers the cost the fastest, which is the negative gradient.

## Update rule

$$
\\theta_j := \\theta_j - \\alpha \\, \\frac{\\partial}{\\partial \\theta_j} J(\\theta)
$$

- **$\\alpha$ too small**: converges reliably but slowly.
- **$\\alpha$ too large**: overshoots the minimum and may diverge.
- **Just right**: the cost falls steadily each epoch.

\`\`\`mermaid
graph LR
  A[Init θ] --> B[Compute J θ]
  B --> C[Compute ∇J]
  C --> D[θ ← θ − α∇J]
  D --> E{Converged?}
  E -- no --> B
  E -- yes --> F[Done]
\`\`\`

\`\`\`python
for epoch in range(epochs):
    grad = X.T @ (X @ theta - y) / m
    theta -= alpha * grad
\`\`\``,
    sources: [
      { document: 'Lecture02_Gradient_Descent.pdf', score: 92, snippet: 'Batch gradient descent computes the gradient of the cost with respect to all parameters over the entire training set and updates simultaneously…' },
      { document: 'Lecture01_Linear_Regression.pdf', score: 78, snippet: 'The squared-error cost J(θ) is convex for linear regression, guaranteeing that gradient descent converges to the global minimum for a suitable α.' },
    ],
  },
  CN: {
    topic: 'TCP Handshake',
    prerequisites: ['TCP/IP Model'],
    content: `TCP opens a reliable connection with a **three-way handshake**, which synchronizes the starting sequence numbers on both sides.

1. **SYN**: the client sends \`SYN, seq = x\`.
2. **SYN-ACK**: the server replies with \`SYN, ACK, seq = y, ack = x + 1\`.
3. **ACK**: the client confirms with \`ACK, ack = y + 1\`. The connection is now **ESTABLISHED**.

\`\`\`mermaid
sequenceDiagram
  Client->>Server: SYN (seq=x)
  Server->>Client: SYN-ACK (seq=y, ack=x+1)
  Client->>Server: ACK (ack=y+1)
\`\`\`

Using random initial sequence numbers protects against stale segments and spoofed connections.`,
    sources: [
      { document: 'Transport_Layer_TCP_Flow_Control.pdf', score: 96, snippet: 'Connection establishment in TCP uses a three-way handshake in which each side chooses an initial sequence number and acknowledges the other…' },
    ],
  },
}

let convSeq = 100
const conversations = [
  { _id: 'c1', subject: 'DSA', title: 'AVL tree rotations explained', days: 0 },
  { _id: 'c2', subject: 'DSA', title: 'BFS vs DFS on weighted graphs', days: 1 },
  { _id: 'c3', subject: 'DSA', title: 'Heap sort complexity', days: 4 },
  { _id: 'c4', subject: 'ML', title: 'Learning rate intuition', days: 0 },
  { _id: 'c5', subject: 'ML', title: 'Bias–variance tradeoff', days: 3 },
  { _id: 'c6', subject: 'CN', title: 'TCP three-way handshake', days: 2 },
].map(c => ({ ...c, updatedAt: new Date(Date.now() - c.days * DAY).toISOString(), messages: null }))

const buildReply = (subject, level = 'intermediate') => {
  const a = answers[subject] || answers.DSA
  return { role: 'assistant', id: crypto.randomUUID(), content: a.content, topic: a.topic, prerequisites: a.prerequisites, sources: a.sources, images: [], level, model: 'llama-3.3-70b-versatile', provider: 'groq' }
}
const messagesFor = (c) => c.messages || (c.messages = [
  { role: 'user', content: c.title.endsWith('?') ? c.title : `Can you explain: ${c.title.toLowerCase()}?` },
  buildReply(c.subject),
])

let backendDown = false
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const wait = (ms) => new Promise(r => setTimeout(r, ms))

async function mockFetch(url, init = {}) {
  const u = new URL(url, location.origin)
  const path = u.pathname.replace(/^.*?\/api/, '/api')
  const method = (init.method || 'GET').toUpperCase()
  const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : {}
  const q = (k) => u.searchParams.get(k)

  if (path === '/api/auth/login') return null // handled by Login's own demo fallback
  if (path === '/api/models') return json({
    cloud_models: [], local_models: [], ollama_online: false,
  })
  if (path === '/api/sample-questions') {
    await wait(350)
    const list = [...(samples[q('subject')] || samples.DSA)].sort(() => Math.random() - 0.5)
    return json({ questions: list })
  }
  if (path === '/api/conversations' && method === 'GET') {
    return json({ conversations: conversations.filter(c => c.subject === q('subject')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) })
  }
  const convMatch = path.match(/^\/api\/conversations\/(.+)$/)
  if (convMatch) {
    const idx = conversations.findIndex(c => c._id === convMatch[1])
    if (method === 'DELETE') { if (idx > -1) conversations.splice(idx, 1); return json({ ok: true }) }
    if (idx === -1) return json({ error: 'Not found' }, 404)
    return json({ conversation: { ...conversations[idx], messages: messagesFor(conversations[idx]) } })
  }
  if (path === '/api/query') {
    await wait(1600)
    const reply = buildReply(body.subject, body.level)
    let conv = conversations.find(c => c._id === body.conversationId)
    if (!conv) {
      conv = { _id: `c${++convSeq}`, subject: body.subject, title: body.query.slice(0, 48), messages: [], updatedAt: '' }
      conversations.push(conv)
    }
    conv.updatedAt = new Date().toISOString()
    messagesFor(conv).push({ role: 'user', content: body.query }, reply)
    return json({ response: reply.content, topic: reply.topic, prerequisites: reply.prerequisites, sources: reply.sources, images: [], model: body.model || reply.model, provider: body.provider || reply.provider, conversationId: conv._id })
  }
  if (path === '/api/query/images') { await wait(900); return json({ images: [] }) }
  if (path === '/api/documents') return json({ documents: documents[q('subject')] || [] })
  if (path === '/api/documents/delete') {
    const list = documents[body.subject] || []
    const i = list.findIndex(d => d.name === body.filename || d.name.replace(/[^\w.-]/g, '_') === body.filename)
    if (i > -1) list.splice(i, 1)
    return json({ ok: true })
  }
  if (path === '/api/prerequisites') {
    if (method === 'GET') return json({ prerequisites: prerequisites[q('subject')] || {} })
    const map = (prerequisites[body.subject] ||= {})
    if (method === 'DELETE') delete map[body.topic]
    else {
      if (body.oldTopic && body.oldTopic !== body.topic) delete map[body.oldTopic]
      map[body.topic] = body.prerequisites || []
    }
    return json({ ok: true, prerequisites: map })
  }
  return null
}

export function installMockApi() {
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    if (!/(^|\/)api\//.test(url)) return realFetch(input, init)
    if (!backendDown) {
      try {
        const res = await realFetch(input, init)
        const type = res.headers.get('content-type') || ''
        if (type.includes('json') || type.includes('event-stream')) return res
      } catch { /* unreachable */ }
      backendDown = true
    }
    return (await mockFetch(url, init)) || realFetch(input, init)
  }

  // Simulated PDF upload with SSE-style progress
  const open = XMLHttpRequest.prototype.open
  const send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__mockUrl = url
    return open.call(this, method, url, ...rest)
  }
  XMLHttpRequest.prototype.send = function (body) {
    if (!backendDown || !String(this.__mockUrl).includes('/api/upload')) return send.call(this, body)
    const xhr = this
    const subject = new URL(this.__mockUrl, location.origin).searchParams.get('subject') || 'DSA'
    const file = body instanceof FormData ? body.get('file') : null
    let text = ''
    Object.defineProperty(xhr, 'responseText', { get: () => text })
    Object.defineProperty(xhr, 'status', { get: () => 200 })
    const stages = ['Extracting text from PDF...', 'Chunking document...', 'Generating embeddings...', 'Indexing vectors...', 'Building prerequisite graph...']
    let tick = 0
    const timer = setInterval(() => {
      tick++
      if (tick <= 5) {
        xhr.upload.onprogress?.({ lengthComputable: true, loaded: tick * 20, total: 100 })
        return
      }
      const pct = Math.min(100, (tick - 5) * 10)
      text += `data: ${JSON.stringify({ percent: pct, stage: stages[Math.min(4, Math.floor(pct / 21))], done: pct >= 100 })}\n`
      xhr.onprogress?.()
      if (pct >= 100) {
        clearInterval(timer)
        if (file) (documents[subject] ||= []).unshift({ id: crypto.randomUUID(), name: file.name, size: file.size, uploadedAt: ago(0), status: 'Indexed' })
        xhr.onload?.()
      }
    }, 280)
  }
}
