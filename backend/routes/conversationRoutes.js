import { Router } from 'express'
import {
  getConversations,
  getConversationById,
  deleteConversation,
} from '../controllers/conversationController.js'

const router = Router()

router.get('/', getConversations)
router.get('/:id', getConversationById)
router.delete('/:id', deleteConversation)

export default router
