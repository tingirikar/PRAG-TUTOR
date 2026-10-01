import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Files, LogOut, UploadCloud, FileText, Check, X, Inbox, GitFork, Search, RefreshCw, Plus, Edit3, Trash2, Save } from 'lucide-react'
import './TeacherDashboard.css'

const sanitizeFileName = (fileName) => {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [currentUser, setCurrentUser] = useState(() => JSON.parse(sessionStorage.getItem('user') || '{}'))
  const teacherSubject = (currentUser.subject || (currentUser.username?.startsWith('teacher_') ? currentUser.username.replace('teacher_', '').toUpperCase() : 'DSA')).toUpperCase()

  // Auth guard
  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}')
    if (user.role !== 'teacher') {
      navigate('/', { replace: true })
    } else {
      setCurrentUser(user)
    }
  }, [navigate])

  const [files, setFiles] = useState([])          // staged files
  const [documents, setDocuments] = useState([])   // "uploaded" documents
  const [prerequisites, setPrerequisites] = useState({}) // subject prerequisites
  const [loadingPrereqs, setLoadingPrereqs] = useState(false)
  const [prereqSearch, setPrereqSearch] = useState('')
  const [activeTab, setActiveTab] = useState('upload')
  const [dragOver, setDragOver] = useState(false)
  const [deletingDocName, setDeletingDocName] = useState(null)

  // Prerequisite CRUD State
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [newTopicPrereqs, setNewTopicPrereqs] = useState([])
  const [newPrereqInput, setNewPrereqInput] = useState('')
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false)

  // Card Editing State
  const [editingTopic, setEditingTopic] = useState(null)
  const [editPrereqsList, setEditPrereqsList] = useState([])
  const [editNewChipInput, setEditNewChipInput] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeletingTopic, setIsDeletingTopic] = useState(false)

  const handleAddTopic = async (e) => {
    if (e) e.preventDefault()
    const trimmed = newTopicName.trim()
    if (!trimmed) {
      alert('Please enter a topic name.')
      return
    }
    setIsSubmittingTopic(true)
    try {
      const res = await fetch('/api/prerequisites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: teacherSubject,
          topic: trimmed,
          prerequisites: newTopicPrereqs,
          createdBy: currentUser.username || 'teacher'
        })
      })
      if (res.ok) {
        setNewTopicName('')
        setNewTopicPrereqs([])
        setNewPrereqInput('')
        setShowAddModal(false)
        await fetchPrerequisites()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to add topic')
      }
    } catch (err) {
      console.error('Add topic error:', err)
      alert('Error adding topic')
    } finally {
      setIsSubmittingTopic(false)
    }
  }

  const handleAddChipToNewTopic = () => {
    const trimmed = newPrereqInput.trim()
    if (trimmed && !newTopicPrereqs.includes(trimmed)) {
      setNewTopicPrereqs(prev => [...prev, trimmed])
      setNewPrereqInput('')
    }
  }

  const handleRemoveChipFromNewTopic = (index) => {
    setNewTopicPrereqs(prev => prev.filter((_, i) => i !== index))
  }

  const handleStartEdit = (topic, currentPrereqs) => {
    setEditingTopic(topic)
    setEditPrereqsList([...(currentPrereqs || [])])
    setEditNewChipInput('')
  }

  const handleCancelEdit = () => {
    setEditingTopic(null)
    setEditPrereqsList([])
    setEditNewChipInput('')
  }

  const handleRemoveChipFromEdit = (index) => {
    setEditPrereqsList(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddChipToEdit = () => {
    const trimmed = editNewChipInput.trim()
    if (trimmed && !editPrereqsList.includes(trimmed)) {
      setEditPrereqsList(prev => [...prev, trimmed])
      setEditNewChipInput('')
    }
  }

  const handleSaveEdit = async (topic) => {
    setIsSavingEdit(true)
    try {
      const res = await fetch('/api/prerequisites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: teacherSubject,
          topic,
          prerequisites: editPrereqsList
        })
      })
      if (res.ok) {
        setEditingTopic(null)
        await fetchPrerequisites()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to update prerequisites')
      }
    } catch (err) {
      console.error('Update prerequisites error:', err)
      alert('Error updating prerequisites')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteTopic = async (topic) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${topic}" from the ${teacherSubject} syllabus?`)) {
      return
    }
    setIsDeletingTopic(true)
    try {
      const res = await fetch('/api/prerequisites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: teacherSubject,
          topic
        })
      })
      if (res.ok) {
        if (editingTopic === topic) setEditingTopic(null)
        await fetchPrerequisites()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to delete topic')
      }
    } catch (err) {
      console.error('Delete topic error:', err)
      alert('Error deleting topic')
    } finally {
      setIsDeletingTopic(false)
    }
  }

  const handleFiles = (fileList) => {
    const pdfs = Array.from(fileList).filter(f => f.type === 'application/pdf')
    if (pdfs.length === 0) return
    
    // Check for duplicates with existing staged files
    const existingFileNames = new Set(files.map(f => sanitizeFileName(f.name)))
    // Check for duplicates with already uploaded documents
    const uploadedFileNames = new Set(documents.map(d => d.name))
    
    const validFiles = []
    const duplicateFiles = []
    
    pdfs.forEach(f => {
      const sanitizedName = sanitizeFileName(f.name)
      if (existingFileNames.has(sanitizedName) || uploadedFileNames.has(sanitizedName)) {
        duplicateFiles.push(f.name)
      } else {
        validFiles.push(f)
      }
    })
    
    if (duplicateFiles.length > 0) {
      alert(`The following files already exist and were skipped:\n${duplicateFiles.join('\n')}`)
    }
    
    if (validFiles.length === 0) return
    
    const newFiles = validFiles.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
      status: 'pending',   // pending | uploading | done | error
      progress: 0,
      stage: 'Ready to upload',
    }))
    setFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/documents?subject=${encodeURIComponent(teacherSubject)}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    }
  }

  const fetchPrerequisites = async () => {
    setLoadingPrereqs(true)
    try {
      const res = await fetch(`/api/prerequisites?subject=${encodeURIComponent(teacherSubject)}`)
      if (res.ok) {
        const data = await res.json()
        setPrerequisites(data.prerequisites || {})
      }
    } catch (err) {
      console.error('Failed to fetch prerequisites:', err)
    } finally {
      setLoadingPrereqs(false)
    }
  }

  const executeDeleteDocument = async (name) => {
    try {
      const res = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: sanitizeFileName(name), subject: teacherSubject }),
      })
      setDeletingDocName(null)
      if (res.ok) {
        fetchDocuments()
        fetchPrerequisites()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to delete document')
      }
    } catch (err) {
      console.error('Delete error:', err)
      setDeletingDocName(null)
      alert('Error deleting document')
    }
  }

  useEffect(() => {
    fetchDocuments()
    fetchPrerequisites()
  }, [activeTab, teacherSubject])

  const uploadSingleFile = (fileObj) => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('subject', teacherSubject)
      formData.append('file', fileObj.file)

      setFiles(prev => prev.map(x => x.id === fileObj.id ? {
        ...x,
        status: 'uploading',
        progress: 2,
        stage: 'Transferring PDF to server...'
      } : x))

      // 1. Monitor network byte transfer (0% - 20% total pipeline)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const bytePct = Math.round((event.loaded / event.total) * 100)
          const scaledPct = Math.min(20, Math.max(2, Math.round(bytePct * 0.2)))
          setFiles(prev => prev.map(x => x.id === fileObj.id ? {
            ...x,
            status: 'uploading',
            progress: scaledPct,
            stage: `Uploading bytes (${bytePct}%)...`
          } : x))
        }
      }

      // 2. Stream real AI pipeline progress from Express SSE response (20% - 100%)
      let seenIndex = 0
      xhr.onprogress = () => {
        const fullText = xhr.responseText
        const chunk = fullText.slice(seenIndex)
        const lastNewline = chunk.lastIndexOf('\n')
        if (lastNewline === -1) return
        const processable = chunk.slice(0, lastNewline)
        seenIndex += lastNewline + 1

        const lines = processable.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6))
              if (data.error) {
                setFiles(prev => prev.map(x => x.id === fileObj.id ? {
                  ...x,
                  status: 'error',
                  progress: 0,
                  stage: data.error
                } : x))
              } else if (data.percent !== undefined) {
                const overallPct = Math.min(100, Math.max(20, Math.round(20 + (data.percent * 0.8))))
                const isFinished = data.done || overallPct >= 100
                setFiles(prev => prev.map(x => x.id === fileObj.id ? {
                  ...x,
                  status: isFinished ? 'done' : 'uploading',
                  progress: isFinished ? 100 : overallPct,
                  stage: data.stage || 'Processing document...'
                } : x))
              }
            } catch {
              // Ignore partial chunk boundaries
            }
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setFiles(prev => prev.map(x => x.id === fileObj.id ? {
            ...x,
            status: 'done',
            progress: 100,
            stage: 'Completed & Indexed'
          } : x))
          fetchDocuments()
          fetchPrerequisites()
          resolve(true)
        } else {
          let errorMsg = `Server error (${xhr.status})`
          try {
            const errObj = JSON.parse(xhr.responseText)
            if (errObj.error) errorMsg = errObj.error
          } catch {}
          setFiles(prev => prev.map(x => x.id === fileObj.id ? {
            ...x,
            status: 'error',
            stage: errorMsg
          } : x))
          resolve(false)
        }
      }

      xhr.onerror = () => {
        setFiles(prev => prev.map(x => x.id === fileObj.id ? {
          ...x,
          status: 'error',
          stage: 'Network transfer failed'
        } : x))
        resolve(false)
      }

      xhr.open('POST', `/api/upload?stream=true&subject=${encodeURIComponent(teacherSubject)}`, true)
      xhr.setRequestHeader('Accept', 'text/event-stream')
      xhr.send(formData)
    })
  }

  const uploadAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0 || files.some(f => f.status === 'uploading')) return

    for (const f of pendingFiles) {
      await uploadSingleFile(f)
    }
  }

  const clearDone = () => {
    setFiles(prev => prev.filter(f => f.status !== 'done'))
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const logout = () => {
    sessionStorage.removeItem('user')
    navigate('/')
  }

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
            <div className="brand-icon">PT</div>
          <span>PRAG Tutor</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <span className="nav-icon"><Upload size={18} /></span>
            <span>Upload</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <span className="nav-icon"><Files size={18} /></span>
            <span>Documents</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'prerequisites' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('prerequisites')
              fetchPrerequisites()
            }}
          >
            <span className="nav-icon"><GitFork size={18} /></span>
            <span>Prerequisites</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{currentUser.name?.charAt(0) || 'T'}</div>
            <div>
              <div className="user-name">{currentUser.name || 'Teacher'}</div>
              <div className="user-role">{teacherSubject} Faculty</div>
            </div>
          </div>
          <button className="nav-item" onClick={logout}>
            <span className="nav-icon"><LogOut size={17} /></span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">

        {/* Upload Panel */}
        {activeTab === 'upload' && (
          <div>
            <div className="page-header">
              <h2>Upload Documents &bull; <span style={{ color: 'var(--accent)' }}>{teacherSubject}</span></h2>
              <p>Upload PDF files to create embeddings for student RAG in {teacherSubject}</p>
            </div>

            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFiles(e.dataTransfer.files)
              }}
            >
              <div className="upload-icon"><UploadCloud size={30} /></div>
              <h3>Drop {teacherSubject} PDF files here or click to browse</h3>
              <p>Only .pdf files are accepted</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <>
                <div className="file-list">
                  {files.map((f) => (
                    <div key={f.id} className="file-item">
                      <span className="file-icon"><FileText size={20} /></span>
                      <div className="file-details">
                        <div className="file-name-row">
                          <span className="file-name" title={f.name}>{f.name}</span>
                          <span className="file-size">{formatSize(f.size)}</span>
                        </div>

                        {f.status !== 'pending' && (
                          <>
                            <div className="file-progress-track">
                              <div
                                className={`file-progress-fill ${f.status}`}
                                style={{ width: `${f.progress !== undefined ? f.progress : (f.status === 'done' ? 100 : 0)}%` }}
                              />
                            </div>
                            <div className="file-stage-row">
                              <span className="file-stage-text">
                                {f.status === 'uploading' && <span className="progress-spinner" />}
                                {f.stage || (f.status === 'done' ? 'Completed & Indexed' : 'Processing...')}
                              </span>
                              <span className="file-percent-text">
                                {f.progress !== undefined ? f.progress : (f.status === 'done' ? 100 : 0)}%
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="file-actions-right">
                        <span className={`file-status ${f.status}`}>
                          {f.status === 'pending' && 'Ready'}
                          {f.status === 'uploading' && `${f.progress || 0}%`}
                          {f.status === 'done' && <><Check size={13} /> Indexed</>}
                          {f.status === 'error' && 'Error'}
                        </span>
                        {(f.status === 'pending' || f.status === 'error' || f.status === 'done') && (
                          <button
                            className="file-remove"
                            onClick={(e) => { e.stopPropagation(); removeFile(f.id) }}
                            title="Remove file"
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="upload-actions">
                  <button
                    className="btn-accent"
                    onClick={uploadAll}
                    disabled={files.some(f => f.status === 'uploading') || files.filter(f => f.status === 'pending').length === 0}
                    style={{
                      opacity: (files.some(f => f.status === 'uploading') || files.filter(f => f.status === 'pending').length === 0) ? 0.6 : 1,
                      cursor: (files.some(f => f.status === 'uploading') || files.filter(f => f.status === 'pending').length === 0) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {files.some(f => f.status === 'uploading')
                      ? 'Indexing in progress...'
                      : `Upload All to ${teacherSubject} (${files.filter(f => f.status === 'pending').length})`
                    }
                  </button>
                  {files.some(f => f.status === 'done') && !files.some(f => f.status === 'uploading') && (
                    <button className="btn-secondary" onClick={clearDone}>Clear Done</button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Documents Panel */}
        {activeTab === 'documents' && (
          <div>
            <div className="page-header">
              <h2>{teacherSubject} Course Documents</h2>
              <p>All uploaded and indexed documents for {teacherSubject}</p>
            </div>

            {documents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Inbox size={30} /></div>
                <p>No documents uploaded for {teacherSubject} yet.<br />Go to Upload to add PDF files.</p>
              </div>
            ) : (
              <div className="doc-table-card">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Size</th>
                      <th>Uploaded</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td>{doc.name}</td>
                        <td>{formatSize(doc.size)}</td>
                        <td>{doc.uploadedAt}</td>
                        <td><span className="badge badge-green">{doc.status}</span></td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                              onClick={() => {
                                setActiveTab('prerequisites')
                                fetchPrerequisites()
                              }}
                            >
                              Syllabus
                            </button>
                            {deletingDocName === doc.name ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => executeDeleteDocument(doc.name)}
                                  title="Confirm Delete"
                                  style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingDocName(null)}
                                  title="Cancel"
                                  style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className="btn-table-delete"
                                onClick={() => setDeletingDocName(doc.name)}
                                title="Delete document and remove from index"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Prerequisites & Syllabus Graph Panel */}
        {activeTab === 'prerequisites' && (
          <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2>{teacherSubject} Syllabus & Prerequisites</h2>
                <p>AI-extracted learning concepts and required prerequisite dependencies for {teacherSubject}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn-accent"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    border: 0,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={15} />
                  Add New Topic
                </button>
                <button
                  className="btn-secondary"
                  onClick={fetchPrerequisites}
                  disabled={loadingPrereqs}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.85rem' }}
                >
                  <RefreshCw size={14} className={loadingPrereqs ? 'spin' : ''} />
                  Refresh Graph
                </button>
              </div>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '16px 20px', background: 'var(--surface-1, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>Total Topics</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent, #2547ff)', marginTop: '4px' }}>
                  {Object.keys(prerequisites).length}
                </div>
              </div>
              <div style={{ padding: '16px 20px', background: 'var(--surface-1, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>Foundational (Entry Level)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                  {Object.values(prerequisites).filter(p => !p || p.length === 0).length}
                </div>
              </div>
              <div style={{ padding: '16px 20px', background: 'var(--surface-1, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>Intermediate & Advanced</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6366f1', marginTop: '4px' }}>
                  {Object.values(prerequisites).filter(p => p && p.length > 0).length}
                </div>
              </div>
            </div>

            {/* Search Filter */}
            {Object.keys(prerequisites).length > 0 && (
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim, #64748b)' }} />
                <input
                  type="text"
                  placeholder={`Search ${teacherSubject} topics...`}
                  value={prereqSearch}
                  onChange={(e) => setPrereqSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #e2e8f0)',
                    background: 'var(--surface-1, #fff)',
                    color: 'var(--text, #0f172a)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            )}

            {Object.keys(prerequisites).length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><GitFork size={30} /></div>
                <p>No prerequisites generated for {teacherSubject} yet.<br />Upload course notes or syllabus PDF in the <strong>Upload</strong> tab to automatically build the concept graph.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {Object.entries(prerequisites)
                  .filter(([topic]) => !prereqSearch || topic.toLowerCase().includes(prereqSearch.toLowerCase()))
                  .map(([topic, prereqs]) => {
                    const isFoundational = !prereqs || prereqs.length === 0
                    const isEditing = editingTopic === topic

                    return (
                      <div
                        key={topic}
                        style={{
                          padding: '18px',
                          background: 'var(--surface-1, #fff)',
                          border: isEditing ? '2px solid var(--accent, #2547ff)' : '1px solid var(--border, #e2e8f0)',
                          borderRadius: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                          boxShadow: isEditing ? '0 4px 16px rgba(37, 71, 255, 0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div>
                          {/* Card Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>{topic}</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: '999px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  background: isEditing
                                    ? 'rgba(37, 71, 255, 0.15)'
                                    : isFoundational
                                    ? 'rgba(16, 185, 129, 0.12)'
                                    : 'rgba(99, 102, 241, 0.12)',
                                  color: isEditing ? 'var(--accent, #2547ff)' : isFoundational ? '#10b981' : '#6366f1',
                                  flexShrink: 0
                                }}
                              >
                                {isEditing ? 'Editing' : isFoundational ? 'Foundational' : `${prereqs.length} Prereq${prereqs.length > 1 ? 's' : ''}`}
                              </span>

                              {!isEditing && (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button
                                    onClick={() => handleStartEdit(topic, prereqs)}
                                    title="Edit prerequisites"
                                    style={{
                                      background: 'var(--surface-2, #f1f5f9)',
                                      border: '1px solid var(--border, #e2e8f0)',
                                      borderRadius: '6px',
                                      padding: '4px 6px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      color: 'var(--text, #0f172a)'
                                    }}
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTopic(topic)}
                                    title="Delete topic from syllabus"
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.08)',
                                      border: '1px solid rgba(239, 68, 68, 0.2)',
                                      borderRadius: '6px',
                                      padding: '4px 6px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      color: '#ef4444'
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Body */}
                          <div style={{ marginTop: '12px' }}>
                            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dim, #64748b)', marginBottom: '6px', textTransform: 'uppercase' }}>
                              Required Prerequisites:
                            </div>

                            {isEditing ? (
                              <div>
                                {/* Editable Chips */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                  {editPrereqsList.length === 0 ? (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim, #64748b)', fontStyle: 'italic' }}>
                                      No prerequisites (Foundational concept)
                                    </span>
                                  ) : (
                                    editPrereqsList.map((p, idx) => (
                                      <span
                                        key={idx}
                                        style={{
                                          fontSize: '0.78rem',
                                          padding: '4px 8px',
                                          borderRadius: '6px',
                                          background: 'var(--surface-2, rgba(37, 71, 255, 0.08))',
                                          color: 'var(--text, #0f172a)',
                                          fontWeight: 500,
                                          border: '1px solid var(--border, #e2e8f0)',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px'
                                        }}
                                      >
                                        ↳ {p}
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveChipFromEdit(idx)}
                                          title="Remove prerequisite"
                                          style={{
                                            background: 'transparent',
                                            border: 0,
                                            padding: 0,
                                            cursor: 'pointer',
                                            color: '#ef4444',
                                            display: 'inline-flex',
                                            alignItems: 'center'
                                          }}
                                        >
                                          <X size={12} strokeWidth={2.5} />
                                        </button>
                                      </span>
                                    ))
                                  )}
                                </div>

                                {/* Inline Add Chip Input */}
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                                  <input
                                    type="text"
                                    placeholder="Type prerequisite & press Enter..."
                                    value={editNewChipInput}
                                    onChange={(e) => setEditNewChipInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddChipToEdit()
                                      }
                                    }}
                                    style={{
                                      flex: 1,
                                      padding: '6px 10px',
                                      fontSize: '0.8rem',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border, #e2e8f0)',
                                      background: 'var(--surface-1, #fff)',
                                      color: 'var(--text, #0f172a)',
                                      outline: 'none'
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={handleAddChipToEdit}
                                    disabled={!editNewChipInput.trim()}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      background: 'var(--surface-2, #f1f5f9)',
                                      border: '1px solid var(--border, #e2e8f0)',
                                      cursor: 'pointer',
                                      color: 'var(--text, #0f172a)'
                                    }}
                                  >
                                    + Add
                                  </button>
                                </div>

                                {/* Edit Controls */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border, #e2e8f0)' }}>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEdit(topic)}
                                      disabled={isSavingEdit}
                                      className="btn-accent"
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        color: '#fff',
                                        border: 0,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <Check size={13} /> {isSavingEdit ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEdit}
                                      style={{
                                        padding: '6px 10px',
                                        fontSize: '0.8rem',
                                        borderRadius: '6px',
                                        background: 'transparent',
                                        border: '1px solid var(--border, #e2e8f0)',
                                        cursor: 'pointer',
                                        color: 'var(--text-dim, #64748b)'
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTopic(topic)}
                                    title="Delete entire topic card"
                                    style={{
                                      padding: '6px 8px',
                                      fontSize: '0.78rem',
                                      background: 'transparent',
                                      color: '#ef4444',
                                      border: '1px solid rgba(239, 68, 68, 0.2)',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Trash2 size={12} /> Delete
                                  </button>
                                </div>
                              </div>
                            ) : isFoundational ? (
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-dim, #64748b)', fontStyle: 'italic' }}>
                                None — entry-level core concept
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {prereqs.map((p, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: '0.78rem',
                                      padding: '4px 9px',
                                      borderRadius: '6px',
                                      background: 'var(--surface-2, rgba(37, 71, 255, 0.08))',
                                      color: 'var(--text, #0f172a)',
                                      fontWeight: 500,
                                      border: '1px solid var(--border, #e2e8f0)'
                                    }}
                                  >
                                    ↳ {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* Add New Topic Modal */}
        {showAddModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={() => setShowAddModal(false)}
          >
            <div
              style={{
                background: 'var(--surface-1, #fff)',
                borderRadius: '16px',
                maxWidth: '480px',
                width: '100%',
                padding: '24px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                border: '1px solid var(--border, #e2e8f0)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                  Add Topic to {teacherSubject} Syllabus
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-dim, #64748b)' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddTopic}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text, #0f172a)', marginBottom: '6px' }}>
                    Topic Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Disjoint Set Union (DSU)"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, #e2e8f0)',
                      background: 'var(--surface-1, #fff)',
                      color: 'var(--text, #0f172a)',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text, #0f172a)', marginBottom: '6px' }}>
                    Required Prerequisites (Optional)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      placeholder="e.g. Tree Representations and Arrays"
                      value={newPrereqInput}
                      onChange={(e) => setNewPrereqInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddChipToNewTopic()
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border, #e2e8f0)',
                        background: 'var(--surface-1, #fff)',
                        color: 'var(--text, #0f172a)',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddChipToNewTopic}
                      disabled={!newPrereqInput.trim()}
                      style={{
                        padding: '8px 14px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        background: 'var(--surface-2, #f1f5f9)',
                        border: '1px solid var(--border, #e2e8f0)',
                        cursor: 'pointer',
                        color: 'var(--text, #0f172a)'
                      }}
                    >
                      + Add
                    </button>
                  </div>

                  {newTopicPrereqs.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {newTopicPrereqs.map((p, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.8rem',
                            padding: '4px 9px',
                            borderRadius: '6px',
                            background: 'var(--surface-2, rgba(37, 71, 255, 0.08))',
                            color: 'var(--text, #0f172a)',
                            border: '1px solid var(--border, #e2e8f0)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          ↳ {p}
                          <button
                            type="button"
                            onClick={() => handleRemoveChipFromNewTopic(idx)}
                            style={{
                              background: 'transparent',
                              border: 0,
                              padding: 0,
                              cursor: 'pointer',
                              color: '#ef4444',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            <X size={12} strokeWidth={2.5} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim, #64748b)', fontStyle: 'italic' }}>
                      No prerequisites added yet (will be marked as Foundational).
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{
                      padding: '9px 16px',
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      background: 'transparent',
                      border: '1px solid var(--border, #e2e8f0)',
                      cursor: 'pointer',
                      color: 'var(--text-dim, #64748b)'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTopic || !newTopicName.trim()}
                    className="btn-accent"
                    style={{
                      padding: '9px 18px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      color: '#fff',
                      border: 0,
                      cursor: 'pointer'
                    }}
                  >
                    {isSubmittingTopic ? 'Adding Topic...' : 'Add Topic'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
