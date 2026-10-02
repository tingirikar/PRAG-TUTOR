import { Router } from 'express'
import {
  getConversations,
  getConversationById,
  deleteConversation,
} from '../controllers/conversationController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, getConversations)
router.get('/:id', requireAuth, getConversationById)
router.delete('/:id', requireAuth, deleteConversation)

export default router
