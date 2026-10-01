import { Router } from 'express'
import {
  handleQuery,
  getModels,
  handleQueryImages,
  getSampleQuestions,
} from '../controllers/queryController.js'

const router = Router()

router.post('/query', handleQuery)
router.post('/query/images', handleQueryImages)
router.get('/models', getModels)
router.get('/sample-questions', getSampleQuestions)

export default router
