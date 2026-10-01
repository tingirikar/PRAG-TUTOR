import { Router } from 'express'
import { upload } from '../middleware/upload.js'
import {
  uploadDocuments,
  getDocuments,
  deleteDocument,
  proxyImage,
} from '../controllers/documentController.js'

const router = Router()

router.post(
  '/upload',
  upload.fields([{ name: 'file', maxCount: 20 }, { name: 'files', maxCount: 20 }]),
  uploadDocuments
)
router.get('/documents', getDocuments)
router.post('/documents/delete', deleteDocument)
router.get('/images/{*imagePath}', proxyImage)

export default router
