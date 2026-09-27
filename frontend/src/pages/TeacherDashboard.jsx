import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './TeacherDashboard.css'

const sanitizeFileName = (fileName) => {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [currentUser, setCurrentUser] = useState(() => JSON.parse(sessionStorage.getItem('user') || '{}'))
  const teacherSubject = currentUser.subject || (currentUser.username === 'teacher_ml' ? 'ML' : 'DSA')

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
  const [activeTab, setActiveTab] = useState('upload')
  const [dragOver, setDragOver] = useState(false)
  const [deletingDocName, setDeletingDocName] = useState(null)

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
  }, [activeTab, teacherSubject])

  const uploadAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0) return

    for (const f of pendingFiles) {
      setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: 'uploading' } : x))

      try {
        const formData = new FormData()
        formData.append('file', f.file)
        formData.append('subject', teacherSubject)

        // Add timeout to prevent hanging indefinitely
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Upload failed')
        }

        setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: 'done' } : x))
        fetchDocuments()
      } catch (err) {
        console.error('Upload error:', err)
        const errorMessage = err.name === 'AbortError' 
          ? 'Upload timed out (file may be too large or server busy)' 
          : err.message
        setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: 'error' } : x))
        alert(`Upload failed for ${f.name}: ${errorMessage}`)
      }
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
            <div className="brand-icon">L</div>
          <span>PRAG Tutor</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <span className="nav-icon">+</span>
            <span>Upload</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <span className="nav-icon">•</span>
            <span>Documents</span>
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
            <span className="nav-icon">→</span>
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
              <div className="upload-icon">PDF</div>
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
                      <span className="file-icon">PDF</span>
                      <div className="file-details">
                        <div className="file-name">{f.name}</div>
                        <div className="file-size">{formatSize(f.size)}</div>
                      </div>
                      <span className={`file-status ${f.status}`}>
                        {f.status === 'pending' && 'Ready'}
                        {f.status === 'uploading' && 'Uploading…'}
                        {f.status === 'done' && '✓ Done'}
                        {f.status === 'error' && 'Error'}
                      </span>
                      {f.status === 'pending' && (
                        <button className="file-remove" onClick={(e) => { e.stopPropagation(); removeFile(f.id) }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="upload-actions">
                  <button className="btn-accent" onClick={uploadAll}>
                    Upload All to {teacherSubject} ({files.filter(f => f.status === 'pending').length})
                  </button>
                  {files.some(f => f.status === 'done') && (
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
                <div className="empty-icon">📭</div>
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
                          {deletingDocName === doc.name ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>Delete?</span>
                              <button
                                type="button"
                                onClick={() => executeDeleteDocument(doc.name)}
                                title="Confirm Delete"
                                style={{ padding: '3px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingDocName(null)}
                                title="Cancel"
                                style={{ padding: '3px 8px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                              >
                                ✕
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
