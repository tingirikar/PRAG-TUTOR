import { Router } from 'express'
import {
  handleQuery,
  getModels,
  handleQueryImages,
  getSampleQuestions,
} from '../controllers/queryController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/query', requireAuth, handleQuery)
router.post('/query/images', requireAuth, handleQueryImages)
router.get('/models', requireAuth, getModels)
router.get('/sample-questions', requireAuth, getSampleQuestions)

export default router
