import { Router } from 'express'
import { getSubjects } from '../controllers/subjectController.js'

const router = Router()

router.get('/', getSubjects)

export default router
