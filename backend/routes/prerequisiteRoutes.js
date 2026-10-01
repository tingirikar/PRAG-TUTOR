import { Router } from 'express'
import {
  getPrerequisites,
  createPrerequisite,
  updatePrerequisite,
  deletePrerequisite,
} from '../controllers/prerequisiteController.js'

const router = Router()

router.get('/', getPrerequisites)
router.post('/', createPrerequisite)
router.put('/', updatePrerequisite)
router.delete('/', deletePrerequisite)

export default router
