import { Router } from 'express'
import { upload } from '../middleware/upload.js'
import {
  uploadDocuments,
  getDocuments,
  deleteDocument,
  proxyImage,
} from '../controllers/documentController.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.post(
  '/upload',
  requireAuth,
  requireRole('teacher'),
  upload.fields([{ name: 'file', maxCount: 20 }, { name: 'files', maxCount: 20 }]),
  uploadDocuments
)
router.get('/documents', requireAuth, getDocuments)
router.post('/documents/delete', requireAuth, requireRole('teacher'), deleteDocument)
router.get('/images/{*imagePath}', requireAuth, proxyImage)

export default router
