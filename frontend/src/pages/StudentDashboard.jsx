import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import './StudentDashboard.css'

function preprocessLaTeX(content) {
  if (!content) return ''
  // Convert display math \[ ... \] to $$ ... $$
  let processed = content.replace(/\\\[([\s\S]*?)\\\]/g, (_match, eq) => `$$\n${eq.trim()}\n$$`)
  // Convert inline math \( ... \) to $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_match, eq) => `$${eq.trim()}$`)
  return processed
}

function formatContent(content) {
  if (!content) return null
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {preprocessLaTeX(content)}
    </ReactMarkdown>
  )
}

export default function StudentDashboard() {
  const navigate = useNavigate()
  const messagesEndRef = useRef(null)

  // Auth guard & user data
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(sessionStorage.getItem('user') || '{}'))

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}')
    if (user.role !== 'student') {
      navigate('/', { replace: true })
    } else {
      setCurrentUser(user)
    }
  }, [navigate])

  // Subject state: null = Subject Selection Hub View; { code, name, ... } = Chat View
  const [subjects, setSubjects] = useState([
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
    }
  ])
  const [selectedSubject, setSelectedSubject] = useState(null)

  // Conversations state (MongoDB chat history)
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)

  // Chat message & interaction state
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [level, setLevel] = useState('beginner')
  const [loading, setLoading] = useState(false)
  const [sampleQuestions, setSampleQuestions] = useState([])
  const [refreshingQuestions, setRefreshingQuestions] = useState(false)
  const [expandedSources, setExpandedSources] = useState({})
  const [imageMode, setImageMode] = useState('notes')
  const [model, setModel] = useState('openai/gpt-oss-20b')
  const [provider, setProvider] = useState('groq')
  const [cloudModels, setCloudModels] = useState([
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Default)', provider: 'groq' },
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'groq' },
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', provider: 'groq' },
  ])
  const [localModels, setLocalModels] = useState([
    { id: 'llama3.2:3b', name: 'llama3.2:3b', provider: 'local' },
  ])
  const [isCustomModel, setIsCustomModel] = useState(false)
  const [customModelInput, setCustomModelInput] = useState('')
  const [lightboxImage, setLightboxImage] = useState(null)
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const [thinkingSteps, setThinkingSteps] = useState([])

  // Load subjects & available models on mount
  useEffect(() => {
    fetch('/api/subjects')
      .then(res => res.json())
      .then(data => {
        if (data.subjects && data.subjects.length > 0) {
          setSubjects(data.subjects)
        }
      })
      .catch(err => console.warn('Could not load subjects from API:', err))

    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.cloud_models && data.cloud_models.length > 0) setCloudModels(data.cloud_models)
        if (data.local_models && data.local_models.length > 0) setLocalModels(data.local_models)
      })
      .catch(err => console.warn('Could not load dynamic models list:', err))
  }, [])

  // Fetch subject-specific sample questions
  const fetchSampleQuestions = async (subjectCode = selectedSubject?.code) => {
    setRefreshingQuestions(true)
    try {
      const seed = Math.random().toString(36).substring(2, 10)
      const res = await fetch(`/api/sample-questions?seed=${seed}&subject=${subjectCode || 'DSA'}`)
      if (!res.ok) throw new Error('Could not refresh questions')
      const data = await res.json()
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        setSampleQuestions(data.questions)
      } else {
        setSampleQuestions(getFallbackQuestions(subjectCode))
      }
    } catch {
      setSampleQuestions(getFallbackQuestions(subjectCode))
    } finally {
      setRefreshingQuestions(false)
    }
  }

  const getFallbackQuestions = (subjectCode) => {
    if (subjectCode === 'ML') {
      return [
        { question: "What is the difference between supervised and unsupervised learning?", topic: "Supervised Learning", level: "beginner" },
        { question: "Explain how gradient descent minimizes the cost function.", topic: "Optimization", level: "intermediate" },
        { question: "What is overfitting and how do regularization techniques prevent it?", topic: "Model Evaluation", level: "intermediate" },
        { question: "How does the backpropagation algorithm work in multi-layer perceptrons?", topic: "Neural Networks", level: "expert" },
      ]
    }
    return [
      { question: "What is the difference between static and dynamic arrays?", topic: "Arrays", level: "beginner" },
      { question: "Explain the concept of time complexity in algorithms.", topic: "Complexity", level: "intermediate" },
      { question: "How does a binary search tree maintain its search invariant?", topic: "Binary Search Tree", level: "intermediate" },
      { question: "What is the purpose of Dijkstra's shortest path algorithm?", topic: "Graphs", level: "expert" },
    ]
  }

  // Load conversations for a subject
  const fetchConversations = async (subjectCode) => {
    const studentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
    try {
      const res = await fetch(`/api/conversations?studentUsername=${encodeURIComponent(studentUser.username || 'student')}&subject=${encodeURIComponent(subjectCode)}`)
      const data = await res.json()
      if (data.conversations) {
        setConversations(data.conversations)
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
  }

  // Handle selecting a subject from the hub
  const selectSubject = (subj) => {
    setSelectedSubject(subj)
    setCurrentConversationId(null)
    setMessages([])
    setInput('')
    fetchSampleQuestions(subj.code)
    fetchConversations(subj.code)
  }

  // Return to the Subject Hub Dashboard
  const backToSubjects = () => {
    setSelectedSubject(null)
    setCurrentConversationId(null)
    setMessages([])
    setInput('')
  }

  // Load a saved conversation from MongoDB
  const loadConversation = async (convId) => {
    if (loading || convId === currentConversationId) return
    try {
      setLoading(true)
      const res = await fetch(`/api/conversations/${convId}`)
      const data = await res.json()
      if (data.conversation) {
        setCurrentConversationId(convId)
        setMessages(data.conversation.messages || [])
        setExpandedSources({})
      }
    } catch (err) {
      console.error('Failed to load conversation:', err)
    } finally {
      setLoading(false)
    }
  }

  // Delete a conversation from MongoDB
  const deleteConversation = async (convId, e) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this conversation?')) return
    try {
      await fetch(`/api/conversations/${convId}`, { method: 'DELETE' })
      setConversations(prev => prev.filter(c => c._id !== convId))
      if (currentConversationId === convId) {
        startNewChat()
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  // Start a new chat thread for current subject
  const startNewChat = () => {
    setCurrentConversationId(null)
    setMessages([])
    setExpandedSources({})
    setInput('')
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [messages, loading])

  // Thinking progress simulation
  useEffect(() => {
    if (!loading || thinkingSteps.length === 0) return undefined

    let activeStep = 0
    const timer = window.setInterval(() => {
      activeStep += 1
      setThinkingSteps(prev => prev.map((step, index) => ({
        ...step,
        status: index < activeStep ? 'done' : index === activeStep ? 'active' : 'pending'
      })))
      if (activeStep >= thinkingSteps.length - 1) window.clearInterval(timer)
    }, 850)

    return () => window.clearInterval(timer)
  }, [loading, thinkingSteps.length])

  const toggleSources = (index) => {
    setExpandedSources(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const handleModelChange = (e) => {
    const val = e.target.value
    if (val === 'custom_local') {
      setIsCustomModel(true)
      setProvider('local')
    } else {
      setIsCustomModel(false)
      const [prov, ...rest] = val.split(':')
      const modelId = rest.join(':')
      setProvider(prov)
      setModel(modelId)
    }
  }

  const handleAsk = async (queryText, chosenLevel = level) => {
    const query = queryText.trim()
    if (!query || loading || !selectedSubject) return

    const activeModelName = isCustomModel ? (customModelInput.trim() || 'llama3.2:3b') : model

    // Multi-turn history: send previous conversation turns
    const history = messages.map(m => ({
      role: m.role,
      content: m.content
    }))

    // Add user message to UI immediately
    setMessages(prev => [...prev, { role: 'user', content: query }])
    setInput('')
    setThinkingOpen(false)
    const steps = [
      { label: `Searching ${selectedSubject.name} curriculum`, status: 'active' },
      { label: 'Verifying course concepts', status: 'pending' },
    ]
    if (imageMode !== 'none') {
      steps.push({
        label: imageMode === 'notes' ? 'Loading diagrams from course notes' : 'Generating an AI visual diagram',
        status: 'pending'
      })
    }
    steps.push({
      label: provider === 'local' ? `Generating response with local model (${activeModelName})` : `Generating response with Groq cloud (${activeModelName})`,
      status: 'pending'
    })
    setThinkingSteps(steps)
    setLoading(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          subject: selectedSubject.code,
          studentUsername: currentUser.username || 'student',
          conversationId: currentConversationId,
          level: chosenLevel,
          model: activeModelName,
          provider,
          history,
          include_image: false
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response from tutor')
      }

      const answerText = data.response || data.answer || 'No answer generated.'
      const assistantMessageId = crypto.randomUUID()

      // Track active conversation ID and refresh sidebar list
      if (data.conversationId) {
        setCurrentConversationId(data.conversationId)
        fetchConversations(selectedSubject.code)
      }

      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: answerText,
          topic: data.topic || null,
          prerequisites: data.prerequisites || [],
          sources: data.sources || [],
          images: data.images || [],
          imagesLoading: imageMode !== 'none',
          level: chosenLevel,
          model: data.model || activeModelName,
          provider: data.provider || provider,
        },
      ])

      setLoading(false)

      if (imageMode !== 'none') {
        fetch('/api/query/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, topic: data.topic || '', mode: imageMode, subject: selectedSubject.code }),
        })
          .then(async imageRes => {
            const imageData = await imageRes.json()
            if (!imageRes.ok) throw new Error(imageData.error || 'Could not load diagrams')
            setMessages(prev => prev.map(message => (
              message.id === assistantMessageId
                ? { ...message, images: imageData.images || [], imagesLoading: false }
                : message
            )))
          })
          .catch(err => {
            console.error('Diagram loading error:', err)
            setMessages(prev => prev.map(message => (
              message.id === assistantMessageId
                ? { ...message, imagesLoading: false }
                : message
            )))
          })
      }

    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message || 'Could not reach the tutor server. Please make sure the backend is running.'}`,
          topic: null,
          prerequisites: [],
          sources: [],
          images: [],
          imagesLoading: false
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = (e) => {
    e.preventDefault()
    handleAsk(input, level)
  }

  const handleSelectSample = (sample) => {
    if (sample.level) setLevel(sample.level)
    handleAsk(sample.question, sample.level || level)
  }

  const logout = () => {
    sessionStorage.removeItem('user')
    navigate('/')
  }

  // ==========================================
  // VIEW 1: SUBJECT SELECTION HUB (DASHBOARD)
  // ==========================================
  if (!selectedSubject) {
    return (
      <div className="dashboard subject-hub-dashboard">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon">L</div>
            <span>PRAG Tutor</span>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-section-title">Navigation</div>
            <button className="nav-item active">
              <span className="nav-icon">📚</span>
              <span>Subject Hub</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">{currentUser.name?.charAt(0) || 'S'}</div>
              <div>
                <div className="user-name">{currentUser.name || 'Student'}</div>
                <div className="user-role">Student</div>
              </div>
            </div>
            <button className="btn-logout" onClick={logout}>
              <span className="nav-icon">🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <main className="main-content hub-content">
          <div className="hub-container">
            <div className="hub-header">
              <div className="hub-welcome-badge">🎓 Student Dashboard</div>
              <h1>Welcome back, {currentUser.name || 'Student'}</h1>
              <p>Select your course subject below to start personalized AI tutoring grounded in your syllabus.</p>
            </div>

            <div className="subjects-grid">
              {subjects.map(subj => (
                <div
                  key={subj.code}
                  className="subject-card"
                  onClick={() => selectSubject(subj)}
                >
                  <div className="subject-card-top">
                    <span className="subject-card-icon">{subj.icon || '📘'}</span>
                    <span className="subject-code-badge">{subj.code}</span>
                  </div>
                  <h3>{subj.name}</h3>
                  <p className="subject-card-desc">{subj.description}</p>
                  <div className="subject-card-meta">
                    <span className="subject-teacher-info">
                      👤 Faculty: <strong>{subj.teacherName || subj.teacherUsername}</strong>
                    </span>
                  </div>
                  <button className="btn-enter-subject">
                    Launch {subj.code} Tutor →
                  </button>
                </div>
              ))}
            </div>

            <div className="hub-features-row">
              <div className="hub-feature-item">
                <span className="hub-feature-icon">⚡</span>
                <div>
                  <strong>Retrieval Augmented Generation</strong>
                  <p>Fact-checked against verified course texts without hallucinating.</p>
                </div>
              </div>
              <div className="hub-feature-item">
                <span className="hub-feature-icon">💾</span>
                <div>
                  <strong>Persistent Saved Chats</strong>
                  <p>Every session is stored in MongoDB so you can resume anytime.</p>
                </div>
              </div>
              <div className="hub-feature-item">
                <span className="hub-feature-icon">💻</span>
                <div>
                  <strong>Local & Cloud Models</strong>
                  <p>Choose ultra-fast Groq cloud LLMs or offline local Ollama models.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ==========================================
  // VIEW 2: TUTOR CHAT WORKSPACE (SCOPED TO SUBJECT)
  // ==========================================
  return (
    <div className="dashboard">
      {/* ChatGPT / Claude-Style Left Sidebar with Saved Chats */}
      <aside className="sidebar chat-sidebar">
        <div className="sidebar-top">
          <button className="btn-back-hub" onClick={backToSubjects}>
            <span>←</span>
            <span>All Subjects</span>
          </button>
          
          <div className="current-subject-header">
            <span className="subject-icon-small">{selectedSubject.icon}</span>
            <div className="subject-header-text">
              <strong>{selectedSubject.code}</strong>
              <small>{selectedSubject.name}</small>
            </div>
          </div>

          <button className="btn-new-chat-chatgpt" onClick={startNewChat}>
            <span className="btn-icon">✨</span>
            <span>New Chat</span>
          </button>
        </div>

        {/* Saved Chat History List from MongoDB */}
        <div className="sidebar-chat-history">
          <div className="history-label">Saved Conversations</div>
          {conversations.length === 0 ? (
            <div className="no-history-hint">No saved chats in {selectedSubject.code} yet. Start asking a question!</div>
          ) : (
            <div className="chat-history-list">
              {conversations.map(conv => (
                <div
                  key={conv._id}
                  className={`chat-history-item ${currentConversationId === conv._id ? 'active' : ''}`}
                  onClick={() => loadConversation(conv._id)}
                >
                  <span className="chat-item-icon">💬</span>
                  <span className="chat-item-title" title={conv.title}>{conv.title}</span>
                  <button
                    className="btn-delete-chat"
                    onClick={(e) => deleteConversation(conv._id, e)}
                    title="Delete Chat"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{currentUser.name?.charAt(0) || 'S'}</div>
            <div>
              <div className="user-name">{currentUser.name || 'Student'}</div>
              <div className="user-role">Student</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>
            <span className="nav-icon">🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <main className="main-content">
        <div className="chat-container">
          
          {/* Top Status Header */}
          <div className="chat-top-header">
            <div className="chat-top-left">
              <button className="btn-back-pill" onClick={backToSubjects}>
                ← Switch Subject
              </button>
              <div className="chat-status-badge">
                <div className="status-dot"></div>
                <span>{selectedSubject.name} &bull; Syllabus Grounded</span>
              </div>
            </div>
            {messages.length > 0 && (
              <button className="btn-chat-reset" onClick={startNewChat}>
                ✨ New Chat
              </button>
            )}
          </div>

          {/* Messages Feed */}
          <div className="chat-messages">
            {messages.length === 0 && !loading && (
              <div className="welcome-message">
                <div className="welcome-icon">📚</div>
                <h3>Welcome to {selectedSubject.name} Tutor</h3>
                <p>
                  Ask any question related to {selectedSubject.code} course materials.
                  I'll explain concepts at your chosen level.
                </p>

                {(sampleQuestions.length > 0 || refreshingQuestions) && (
                  <div className="sample-questions-container">
                    <div className="sample-questions-heading">
                      <span className="sample-questions-title">
                        Sample Questions from Course Materials
                      </span>
                      <button
                        type="button"
                        className="refresh-questions"
                        onClick={() => fetchSampleQuestions(selectedSubject.code)}
                        disabled={refreshingQuestions}
                      >
                        {refreshingQuestions ? 'Refreshing...' : '🔄 Refresh Questions'}
                      </button>
                    </div>

                    <div className="sample-questions-grid">
                      {refreshingQuestions
                        ? Array.from({ length: 6 }).map((_, idx) => (
                            <div key={`skel-${idx}`} className="sample-question-card skeleton-card">
                              <div className="sample-card-header">
                                <span className="skeleton-pill" />
                                <span className="skeleton-pill skeleton-pill-sm" />
                              </div>
                              <div className="skeleton-line skeleton-line-long" />
                              <div className="skeleton-line skeleton-line-short" />
                            </div>
                          ))
                        : sampleQuestions.map((sq, idx) => (
                            <div
                              key={idx}
                              className="sample-question-card"
                              onClick={() => handleSelectSample(sq)}
                            >
                              <div className="sample-card-header">
                                <span className="sample-topic-pill">{sq.topic}</span>
                                <span className="sample-level-pill">{sq.level}</span>
                              </div>
                              <div className="sample-card-question">{sq.question}</div>
                            </div>
                          ))
                      }
                    </div>
                  </div>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <>
                    <div className="msg-badges">
                      {msg.topic && (
                        <span className="badge-chip badge-topic">
                          <span className="badge-icon">📖</span>
                          <span className="badge-label">Topic:</span>
                          <strong>{msg.topic}</strong>
                        </span>
                      )}
                      {msg.prerequisites && msg.prerequisites.length > 0 && (
                        <span className="badge-chip badge-prereq">
                          <span className="badge-icon">🔗</span>
                          <span className="badge-label">Prerequisites:</span>
                          <strong>{msg.prerequisites.join(', ')}</strong>
                        </span>
                      )}
                      {msg.level && (
                        <span className="badge-chip badge-level">
                          <span className="badge-icon">🎯</span>
                          <strong>{msg.level}</strong>
                        </span>
                      )}
                      {msg.model && (
                        <span className={`badge-chip ${msg.provider === 'local' ? 'badge-local' : 'badge-cloud'}`}>
                          <span className="badge-icon">{msg.provider === 'local' ? '💻' : '🌐'}</span>
                          <span className="badge-label">{msg.provider === 'local' ? 'Local Ollama:' : 'Cloud Groq:'}</span>
                          <strong>{msg.model}</strong>
                        </span>
                      )}
                    </div>

                    {/* Diagrams in chat */}
                    {msg.imagesLoading && (
                      <div className="image-loading-status">
                        <span className="image-loading-spinner" aria-hidden="true"></span>
                        <span>Loading relevant diagrams...</span>
                      </div>
                    )}
                    {msg.images && msg.images.length > 0 && (
                      <div className="image-gallery-section">
                        <div className="image-gallery-label">
                          <span>📊 Relevant Diagrams ({msg.images.length})</span>
                        </div>
                        <div className="image-gallery">
                          {msg.images.map((img, imgIdx) => (
                            <div
                              key={imgIdx}
                              className="image-gallery-item"
                              onClick={() => setLightboxImage(img)}
                              title="Click to expand"
                            >
                              <img
                                src={`/api${img.url}`}
                                alt={img.source === 'document' ? `Diagram from ${img.document}, page ${img.page + 1}` : 'Diagram'}
                                loading="lazy"
                              />
                              <div className="image-source-badge document">
                                <span>{img.source === 'document' ? `📄 ${img.document} (p. ${img.page + 1})` : '🤖 AI Generated'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Assistant or User Content */}
                <div className={msg.role === 'assistant' ? 'assistant-text-content' : ''}>
                  {msg.role === 'assistant' ? formatContent(msg.content) : msg.content}
                </div>

                {/* Verified Course Citations Accordion */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="sources-wrapper">
                    <button
                      type="button"
                      className={`sources-toggle-btn ${expandedSources[i] ? 'active' : ''}`}
                      onClick={() => toggleSources(i)}
                    >
                      <span className="sources-toggle-left">
                        <span className="sources-toggle-icon">📑</span>
                        <span>{expandedSources[i] ? 'Hide Verified Sources' : 'Show Verified Sources'}</span>
                      </span>
                      <span className="sources-toggle-arrow">{expandedSources[i] ? '▲' : '▼'}</span>
                    </button>

                    {expandedSources[i] && (
                      <div className="sources-list">
                        {msg.sources.map((src, sIdx) => (
                          <div key={sIdx} className="source-item">
                            <div className="source-item-header">
                              <span className="source-doc-name">{src.document}</span>
                              {src.score && (
                                <span className="source-score-badge">{src.score}% Match</span>
                              )}
                            </div>
                            <div className="source-snippet">"{src.snippet}"</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="thinking-accordion">
                <button
                  type="button"
                  className="thinking-header-btn"
                  onClick={() => setThinkingOpen(prev => !prev)}
                >
                  <span className="thinking-spinner"></span>
                  <span className="thinking-title">Thinking & Retrieval Pipeline</span>
                  <span className="thinking-arrow">{thinkingOpen ? '▲' : '▼'}</span>
                </button>

                {thinkingOpen && (
                  <div className="thinking-body">
                    <div className="thinking-steps">
                      {thinkingSteps.map((step, idx) => (
                        <div key={idx} className={`thinking-step ${step.status}`}>
                          <span className="step-icon">
                            {step.status === 'done' ? '✓' : step.status === 'active' ? '●' : '○'}
                          </span>
                          <span className="step-label">{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions during conversation */}
          {messages.length > 0 && sampleQuestions.length > 0 && (
            <div className="quick-suggestions-row">
              <span className="quick-suggestions-label">Explore next:</span>
              <div className="quick-suggestions-scroll">
                {sampleQuestions.slice(0, 4).map((sq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="quick-suggestion-chip"
                    onClick={() => handleSelectSample(sq)}
                  >
                    {sq.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="chat-input-area">
            <form className="chat-input-row" onSubmit={sendMessage}>
              <select
                className="chat-level-select"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                disabled={loading}
                aria-label="Level selection"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>

              <select
                className="chat-model-select"
                value={isCustomModel ? 'custom_local' : `${provider}:${model}`}
                onChange={handleModelChange}
                disabled={loading}
                aria-label="Model selection"
              >
                <optgroup label="🌐 Online / Cloud (Groq)">
                  {cloudModels.map(m => (
                    <option key={`groq-${m.id}`} value={`groq:${m.id}`}>
                      {m.name || m.id}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="💻 Local (Ollama)">
                  {localModels.map(m => (
                    <option key={`local-${m.id}`} value={`local:${m.id}`}>
                      {m.name || m.id} (Local)
                    </option>
                  ))}
                  <option value="custom_local">➕ Enter custom local model...</option>
                </optgroup>
              </select>

              {isCustomModel && (
                <input
                  type="text"
                  className="chat-custom-model-input"
                  placeholder="e.g. mistral, deepseek-r1:7b"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  disabled={loading}
                  title="Enter any model name installed in your local Ollama"
                />
              )}

              <select
                className="image-mode-select"
                value={imageMode}
                onChange={(e) => setImageMode(e.target.value)}
                disabled={loading}
                aria-label="Image source"
              >
                <option value="none">No image</option>
                <option value="notes">Notes images</option>
                <option value="ai">AI generated</option>
              </select>

              <input
                type="text"
                className="chat-input"
                placeholder={`Ask a question about ${selectedSubject.name}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />

              <button
                type="submit"
                className="chat-send"
                disabled={loading || !input.trim()}
              >
                Send
              </button>
            </form>
          </div>

        </div>
      </main>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="image-lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="image-lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="image-lightbox-close" onClick={() => setLightboxImage(null)}>✕</button>
            <img
              src={`/api${lightboxImage.url}`}
              alt={lightboxImage.source === 'document' ? `Diagram from ${lightboxImage.document}` : 'Diagram'}
            />
            <div className="image-lightbox-meta">
              <span>{lightboxImage.source === 'document' ? `From: ${lightboxImage.document} (Page ${lightboxImage.page + 1})` : 'AI Generated Visual'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
