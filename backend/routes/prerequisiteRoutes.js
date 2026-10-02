import { Router } from 'express'
import {
  getPrerequisites,
  createPrerequisite,
  updatePrerequisite,
  deletePrerequisite,
} from '../controllers/prerequisiteController.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, getPrerequisites)
router.post('/', requireAuth, requireRole('teacher'), createPrerequisite)
router.put('/', requireAuth, requireRole('teacher'), updatePrerequisite)
router.delete('/', requireAuth, requireRole('teacher'), deletePrerequisite)

export default router
