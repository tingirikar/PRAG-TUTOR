import fs from 'node:fs/promises'
import path from 'node:path'
import { uploadDir } from '../middleware/upload.js'

export async function filesystemDocuments(subject = null) {
  let entries = []
  try {
    entries = await fs.readdir(uploadDir, { withFileTypes: true })
  } catch {
    return []
  }

  const allFiles = []

  // 1. Collect PDFs from subject subfolders (e.g. uploads/dsa/)
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'images') {
      const subSubject = entry.name.toUpperCase()
      try {
        const subEntries = await fs.readdir(path.join(uploadDir, entry.name), { withFileTypes: true })
        for (const sub of subEntries) {
          if (sub.isFile() && sub.name.toLowerCase().endsWith('.pdf')) {
            allFiles.push({
              name: sub.name,
              fullPath: path.join(uploadDir, entry.name, sub.name),
              subject: subSubject,
            })
          }
        }
      } catch {}
    }
  }

  // 2. Fallback check for any PDFs directly in root uploadDir
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      allFiles.push({
        name: entry.name,
        fullPath: path.join(uploadDir, entry.name),
        subject: 'DSA',
      })
    }
  }
  const filtered = subject
    ? allFiles.filter(item => item.subject.toUpperCase() === subject.toUpperCase())
    : allFiles

  return Promise.all(filtered.map(async item => {
    const stats = await fs.stat(item.fullPath)
    return {
      id: item.name,
      name: item.name,
      size: stats.size,
      subject: item.subject,
      uploadedAt: stats.mtime.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Indexed',
    }
  }))
}
