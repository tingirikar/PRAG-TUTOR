import { Router } from 'express'
import { getSubjects } from '../controllers/subjectController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, getSubjects)

export default router
