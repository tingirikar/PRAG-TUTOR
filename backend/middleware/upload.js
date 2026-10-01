import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const uploadDir = path.resolve(__dirname, '..', '..', 'uploads')

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, callback) => {
      const subject = String(req.body?.subject || req.query?.subject || 'dsa').trim().toLowerCase()
      const targetDir = path.join(uploadDir, subject)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      callback(null, targetDir)
    },
    filename: (_request, file, callback) => {
      const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')
      callback(null, safeName)
    },
  }),
  fileFilter: (_request, file, callback) => callback(null, file.mimetype === 'application/pdf'),
})
