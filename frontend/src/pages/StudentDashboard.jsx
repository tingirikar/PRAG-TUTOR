import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import mermaid from 'mermaid'
import {
  LayoutGrid, LogOut, GraduationCap, User, ArrowRight, ArrowLeft, Zap, Database,
  Cpu, Globe, SquarePen, Check, X, MessageSquare, Trash2, BookOpen, RefreshCw,
  FolderOpen, Link2, Target, FileText, Files, Network, Brain, Binary,
  ChevronUp, ChevronDown, CircleDot, Circle, Images,
} from 'lucide-react'
import './StudentDashboard.css'

// Real vector icon per subject (replaces stored emoji)
function SubjectIcon({ code, size = 22 }) {
  if (code === 'ML') return <Brain size={size} strokeWidth={1.75} />
  if (code === 'DSA') return <Binary size={size} strokeWidth={1.75} />
  return <BookOpen size={size} strokeWidth={1.75} />
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  themeVariables: {
    darkMode: true,
    background: '#131b2e',
    primaryColor: '#2563eb',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#3b82f6',
    lineColor: '#60a5fa',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a'
  }
})

function MermaidBlock({ code }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(false)
  const idRef = useRef(`mermaid-${Math.random().toString(36).substring(2, 9)}`)

  useEffect(() => {
    let isMounted = true
    const cleanCode = (code || '').trim()
    if (!cleanCode) return

    mermaid.render(idRef.current, cleanCode)
      .then(({ svg }) => {
        if (isMounted) {
          setSvg(svg)
          setError(false)
        }
      })
      .catch((err) => {
        console.warn('Mermaid render error:', err)
        if (isMounted) {
          setError(true)
        }
      })

    return () => {
      isMounted = false
      const el = document.getElementById(idRef.current)
      if (el) el.remove()
    }
  }, [code])

  if (error) {
    return (
      <div className="mermaid-fallback-box">
        <div className="mermaid-header">
          <span className="mermaid-badge"><Network size={14} /> Mermaid Diagram (Syntax Preview)</span>
        </div>
        <pre className="mermaid-code-pre"><code>{code}</code></pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="mermaid-loading-box">
        <span className="image-loading-spinner" aria-hidden="true"></span>
        <span>Rendering interactive diagram...</span>
      </div>
    )
  }

  return (
    <div className="mermaid-container-card">
      <div className="mermaid-header">
        <span className="mermaid-badge"><Network size={14} /> Interactive Mermaid Diagram</span>
      </div>
      <div
        className="mermaid-rendered-svg"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

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
      components={{
        code({ node, inline, className, children, ...props }) {
          const codeText = String(children || '').replace(/\n$/, '')
          const match = /language-(\w+)/.exec(className || '')
          const isMermaid = (match && match[1] === 'mermaid') || (!inline && /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)\b/.test(codeText))
          if (!inline && isMermaid) {
            return <MermaidBlock code={codeText} />
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        }
      }}
    >
      {preprocessLaTeX(content)}
    </ReactMarkdown>
  )
}

function DropupSelect({
  value,
  label,
  onChange,
  disabled = false,
  ariaLabel,
  options = [],
  align = 'left',
  minWidth = 160,
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSelect = (val) => {
    onChange(val)
    setOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={`dropup-container ${open ? 'open' : ''}`}
    >
      <button
        type="button"
        className={`dropup-trigger ${open ? 'active' : ''}`}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="dropup-trigger-label">{label}</span>
        <ChevronUp size={13} className={`dropup-arrow ${open ? 'rotate' : ''}`} />
      </button>

      {open && (
        <div
          className={`dropup-menu dropup-align-${align}`}
          role="listbox"
          style={{ minWidth }}
        >
          {options.map((item, idx) => {
            if (item.group) {
              return (
                <div key={`group-${idx}`} className="dropup-group">
                  <div className="dropup-group-title">{item.group}</div>
                  {item.items.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={value === opt.value}
                      disabled={opt.disabled}
                      className={`dropup-item ${value === opt.value ? 'selected' : ''} ${opt.disabled ? 'disabled' : ''}`}
                      onClick={() => !opt.disabled && handleSelect(opt.value)}
                    >
                      <span className="dropup-item-text">{opt.label}</span>
                      {value === opt.value && <Check size={14} className="dropup-check" />}
                    </button>
                  ))}
                </div>
              )
            }
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={value === item.value}
                disabled={item.disabled}
                className={`dropup-item ${value === item.value ? 'selected' : ''} ${item.disabled ? 'disabled' : ''}`}
                onClick={() => !item.disabled && handleSelect(item.value)}
              >
                <span className="dropup-item-text">{item.label}</span>
                {value === item.value && <Check size={14} className="dropup-check" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
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
      teacherUsername: 'teacher_dsa',
      teacherName: 'Dr. Sarah (DSA Faculty)'
    },
    {
      code: 'ML',
      name: 'Machine Learning',
      description: 'Explore supervised & unsupervised learning, cost functions, gradient descent, neural networks, and evaluation.',
      teacherUsername: 'teacher_ml',
      teacherName: 'Prof. Alan (ML Faculty)'
    }
  ])
  const [selectedSubject, setSelectedSubject] = useState(null)

  // Conversations state (MongoDB chat history)
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [deletingConvId, setDeletingConvId] = useState(null)

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

  const [ollamaOnline, setOllamaOnline] = useState(false)

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
        setOllamaOnline(Boolean(data.ollama_online))
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
        setSampleQuestions([])
      }
    } catch {
      setSampleQuestions([])
    } finally {
      setRefreshingQuestions(false)
    }
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

  // Inline delete handlers (zero popups)
  const confirmDelete = async (convId, e) => {
    e.stopPropagation()
    try {
      await fetch(`/api/conversations/${convId}`, { method: 'DELETE' })
      setConversations(prev => prev.filter(c => c._id !== convId))
      setDeletingConvId(null)
      if (currentConversationId === convId) {
        startNewChat()
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
      setDeletingConvId(null)
    }
  }

  const cancelDelete = (e) => {
    e.stopPropagation()
    setDeletingConvId(null)
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

  const handleModelChange = (eOrVal) => {
    const val = typeof eOrVal === 'string' ? eOrVal : eOrVal?.target?.value
    if (!val) return
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
    if (imageMode === 'mermaid') {
      steps.push({
        label: 'Generating interactive Mermaid diagram',
        status: 'pending'
      })
    } else if (imageMode === 'notes') {
      steps.push({
        label: 'Checking course notes for genuine diagrams',
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
          include_image: false,
          image_mode: imageMode,
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
          imagesLoading: imageMode === 'notes',
          level: chosenLevel,
          model: data.model || activeModelName,
          provider: data.provider || provider,
        },
      ])

      setLoading(false)

      if (imageMode === 'notes') {
        fetch('/api/query/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, topic: data.topic || '', mode: 'notes', subject: selectedSubject.code }),
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
            <div className="brand-icon">PT</div>
            <span>PRAG Tutor</span>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-section-title">Navigation</div>
            <button className="nav-item active">
              <span className="nav-icon"><LayoutGrid size={18} /></span>
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
              <span className="nav-icon"><LogOut size={17} /></span>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <main className="main-content hub-content">
          <div className="hub-container">
            <div className="hub-header">
              <div className="hub-welcome-badge"><GraduationCap size={15} /> Student Dashboard</div>
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
                    <span className="subject-card-icon"><SubjectIcon code={subj.code} size={24} /></span>
                    <span className="subject-code-badge">{subj.code}</span>
                  </div>
                  <h3>{subj.name}</h3>
                  <p className="subject-card-desc">{subj.description}</p>
                  <div className="subject-card-meta">
                    <span className="subject-teacher-info">
                      <User size={14} /> Faculty: <strong>{subj.teacherName || subj.teacherUsername}</strong>
                    </span>
                  </div>
                  <button className="btn-enter-subject">
                    Launch {subj.code} Tutor <ArrowRight size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="hub-features-row">
              <div className="hub-feature-item">
                <span className="hub-feature-icon"><Zap size={20} /></span>
                <div>
                  <strong>Retrieval Augmented Generation</strong>
                  <p>Fact-checked against verified course texts without hallucinating.</p>
                </div>
              </div>
              <div className="hub-feature-item">
                <span className="hub-feature-icon"><Database size={20} /></span>
                <div>
                  <strong>Persistent Saved Chats</strong>
                  <p>Every session is stored in MongoDB so you can resume anytime.</p>
                </div>
              </div>
              <div className="hub-feature-item">
                <span className="hub-feature-icon"><Cpu size={20} /></span>
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

  // Dropup options and formatted display labels
  const levelOptions = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'expert', label: 'Expert' },
  ]
  const currentLevelLabel = levelOptions.find(o => o.value === level)?.label || 'Beginner'

  const modelOptions = [
    {
      group: 'Online / Cloud (Groq)',
      items: cloudModels.map(m => ({
        value: `groq:${m.id}`,
        label: m.name || m.id,
      })),
    },
    ollamaOnline ? {
      group: 'Local (Ollama - Online)',
      items: [
        ...localModels.map(m => ({
          value: `local:${m.id}`,
          label: `${m.name || m.id} (Local)`,
        })),
        { value: 'custom_local', label: '+ Enter custom local model...' },
      ],
    } : {
      group: 'Local (Ollama - Not Running)',
      items: [
        { value: 'offline', label: "Ollama offline (Start with 'ollama serve')", disabled: true },
      ],
    },
  ]

  let currentModelLabel = 'Select Model'
  if (isCustomModel) {
    currentModelLabel = customModelInput ? `Custom: ${customModelInput}` : '+ Enter custom local model...'
  } else {
    const currentVal = `${provider}:${model}`
    const cloudMatch = cloudModels.find(m => `groq:${m.id}` === currentVal)
    if (cloudMatch) {
      currentModelLabel = cloudMatch.name || cloudMatch.id
    } else {
      const localMatch = localModels.find(m => `local:${m.id}` === currentVal)
      if (localMatch) {
        currentModelLabel = `${localMatch.name || localMatch.id} (Local)`
      } else if (model) {
        currentModelLabel = model
      }
    }
  }

  const diagramOptions = [
    { value: 'none', label: 'No diagrams' },
    { value: 'notes', label: 'Notes diagrams (PDF)' },
    { value: 'mermaid', label: 'Mermaid diagrams (Interactive)' },
  ]
  const currentDiagramLabel = diagramOptions.find(o => o.value === imageMode)?.label || 'Diagrams'

  // ==========================================
  // VIEW 2: TUTOR CHAT WORKSPACE (SCOPED TO SUBJECT)
  // ==========================================
  return (
    <div className="dashboard">
      {/* ChatGPT / Claude-Style Left Sidebar with Saved Chats */}
      <aside className="sidebar chat-sidebar">
        <div className="sidebar-top">
          <button className="btn-back-hub" onClick={backToSubjects}>
            <ArrowLeft size={16} />
            <span>All Subjects</span>
          </button>

          <div className="current-subject-header">
            <span className="subject-icon-small"><SubjectIcon code={selectedSubject.code} size={18} /></span>
            <div className="subject-header-text">
              <strong>{selectedSubject.code}</strong>
              <small>{selectedSubject.name}</small>
            </div>
          </div>

          <button className="btn-new-chat-chatgpt" onClick={startNewChat}>
            <span className="btn-icon"><SquarePen size={16} /></span>
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
                  className={`chat-history-item ${currentConversationId === conv._id ? 'active' : ''} ${deletingConvId === conv._id ? 'confirming-delete' : ''}`}
                  onClick={() => {
                    if (deletingConvId === conv._id) return
                    loadConversation(conv._id)
                  }}
                >
                  {deletingConvId === conv._id ? (
                    <div className="inline-delete-confirm" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-delete-text">Delete?</span>
                      <div className="inline-delete-actions">
                        <button
                          type="button"
                          className="btn-inline-confirm"
                          onClick={(e) => confirmDelete(conv._id, e)}
                          title="Confirm Delete"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-inline-cancel"
                          onClick={cancelDelete}
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="chat-item-icon"><MessageSquare size={15} /></span>
                      <span className="chat-item-title" title={conv.title}>{conv.title}</span>
                      <button
                        type="button"
                        className="btn-delete-chat"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingConvId(conv._id)
                        }}
                        title="Delete Chat"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
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
            <span className="nav-icon"><LogOut size={17} /></span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <main className="main-content">
        <div className="chat-container">

          {/* Messages Feed */}
          <div className="chat-messages">
            {messages.length === 0 && !loading && (
              <div className="welcome-message">
                <div className="welcome-icon"><BookOpen size={30} /></div>
                <h3>Welcome to {selectedSubject.name} Tutor</h3>
                <p>
                  Ask any question related to {selectedSubject.code} course materials.
                  I'll explain concepts at your chosen level.
                </p>

                {refreshingQuestions || sampleQuestions.length > 0 ? (
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
                        {refreshingQuestions ? 'Refreshing...' : <><RefreshCw size={13} /> Refresh Questions</>}
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
                ) : (
                  <div className="no-sources-empty-state">
                    <div className="no-sources-icon"><FolderOpen size={28} /></div>
                    <h4>No Course Materials Added Yet</h4>
                    <p>
                      No source files or syllabus documents have been uploaded for <strong>{selectedSubject.name}</strong> yet.
                      Questions and grounded tutoring will appear once faculty adds course files.
                    </p>
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
                          <span className="badge-icon"><BookOpen size={13} /></span>
                          <span className="badge-label">Topic:</span>
                          <strong>{msg.topic}</strong>
                        </span>
                      )}
                      {msg.prerequisites && msg.prerequisites.length > 0 && (
                        <span className="badge-chip badge-prereq">
                          <span className="badge-icon"><Link2 size={13} /></span>
                          <span className="badge-label">Prerequisites:</span>
                          <strong>{msg.prerequisites.join(', ')}</strong>
                        </span>
                      )}
                      {msg.level && (
                        <span className="badge-chip badge-level">
                          <span className="badge-icon"><Target size={13} /></span>
                          <strong>{msg.level}</strong>
                        </span>
                      )}
                      {msg.model && (
                        <span className={`badge-chip ${msg.provider === 'local' ? 'badge-local' : 'badge-cloud'}`}>
                          <span className="badge-icon">{msg.provider === 'local' ? <Cpu size={13} /> : <Globe size={13} />}</span>
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
                          <span><Images size={15} /> Relevant Diagrams ({msg.images.length})</span>
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
                                src={`/api${img.url}?u=${encodeURIComponent(currentUser.username || 'student')}`}
                                alt={img.source === 'document' ? `Diagram from ${img.document}, page ${img.page + 1}` : 'Diagram'}
                                loading="lazy"
                              />
                              <div className="image-source-badge document">
                                <span><FileText size={12} /> {img.document} (p. {img.page + 1})</span>
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
                        <span className="sources-toggle-icon"><Files size={15} /></span>
                        <span>{expandedSources[i] ? 'Hide Verified Sources' : 'Show Verified Sources'}</span>
                      </span>
                      <span className="sources-toggle-arrow">{expandedSources[i] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
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
                  <span className="thinking-arrow">{thinkingOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
                </button>

                {thinkingOpen && (
                  <div className="thinking-body">
                    <div className="thinking-steps">
                      {thinkingSteps.map((step, idx) => (
                        <div key={idx} className={`thinking-step ${step.status}`}>
                          <span className="step-icon">
                            {step.status === 'done' ? <Check size={14} /> : step.status === 'active' ? <CircleDot size={14} /> : <Circle size={14} />}
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
            <form className="composer" onSubmit={sendMessage}>
              {/* Controls live in a compact toolbar above the prompt */}
              <div className="composer-toolbar">
                <DropupSelect
                  value={level}
                  label={currentLevelLabel}
                  options={levelOptions}
                  onChange={setLevel}
                  disabled={loading}
                  ariaLabel="Level selection"
                  minWidth={150}
                />

                <DropupSelect
                  value={isCustomModel ? 'custom_local' : `${provider}:${model}`}
                  label={currentModelLabel}
                  options={modelOptions}
                  onChange={handleModelChange}
                  disabled={loading}
                  ariaLabel="Model selection"
                  minWidth={250}
                />

                {isCustomModel && ollamaOnline && (
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

                <DropupSelect
                  value={imageMode}
                  label={currentDiagramLabel}
                  options={diagramOptions}
                  onChange={setImageMode}
                  disabled={loading}
                  ariaLabel="Diagrams mode"
                  minWidth={220}
                />
              </div>

              {/* Clean, full-width prompt */}
              <div className="composer-input-row">
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
              </div>
            </form>
          </div>

        </div>
      </main>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="image-lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="image-lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="image-lightbox-close" onClick={() => setLightboxImage(null)}><X size={20} /></button>
            <img
              src={`/api${lightboxImage.url}?u=${encodeURIComponent(currentUser.username || 'student')}`}
              alt={lightboxImage.source === 'document' ? `Diagram from ${lightboxImage.document}` : 'Diagram'}
            />
            <div className="image-lightbox-meta">
              <span>From: {lightboxImage.document} (Page {lightboxImage.page + 1})</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
