import { Router } from 'express';
import { ConversationController } from '../controllers/conversationController';
import {
  validateCreateConversation,
  validateAddMessage,
  validateConversationId,
  validateSessionId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation';
import { conversationRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply conversation-specific rate limiting
router.use(conversationRateLimiter);

/**
 * @route   POST /api/conversations
 * @desc    Create a new conversation
 * @access  Private (API Key required)
 */
router.post(
  '/',
  validateCreateConversation,
  handleValidationErrors,
  ConversationController.createConversation
);

/**
 * @route   GET /api/conversations
 * @desc    Get conversations for session
 * @access  Private (API Key required)
 */
router.get(
  '/',
  validatePagination,
  ConversationController.getConversations
);

/**
 * @route   GET /api/conversations/session/:sessionId
 * @desc    Get conversations by session
 * @access  Private (API Key required)
 */
router.get(
  '/session/:sessionId',
  validateSessionId,
  validatePagination,
  ConversationController.getConversationsBySession
);

/**
 * @route   GET /api/conversations/stats
 * @desc    Get conversation statistics
 * @access  Private (API Key required)
 */
router.get(
  '/stats',
  ConversationController.getConversationStats
);

/**
 * @route   POST /api/conversations/archive
 * @desc    Archive old conversations
 * @access  Private (API Key required)
 */
router.post(
  '/archive',
  ConversationController.archiveOldConversations
);

/**
 * @route   GET /api/conversations/health
 * @desc    Conversation service health check
 * @access  Public
 */
router.get(
  '/health',
  ConversationController.healthCheck
);

/**
 * @route   GET /api/conversations/:conversationId
 * @desc    Get conversation by ID
 * @access  Private (API Key required)
 */
router.get(
  '/:conversationId',
  validateConversationId,
  handleValidationErrors,
  ConversationController.getConversation
);

/**
 * @route   PUT /api/conversations/:conversationId
 * @desc    Update conversation
 * @access  Private (API Key required)
 */
router.put(
  '/:conversationId',
  validateConversationId,
  handleValidationErrors,
  ConversationController.updateConversation
);

/**
 * @route   DELETE /api/conversations/:conversationId
 * @desc    Delete conversation
 * @access  Private (API Key required)
 */
router.delete(
  '/:conversationId',
  validateConversationId,
  handleValidationErrors,
  ConversationController.deleteConversation
);

/**
 * @route   POST /api/conversations/:conversationId/messages
 * @desc    Add message to conversation
 * @access  Private (API Key required)
 */
router.post(
  '/:conversationId/messages',
  validateConversationId,
  validateAddMessage,
  handleValidationErrors,
  ConversationController.addMessage
);

/**
 * @route   POST /api/conversations/:conversationId/messages/stream
 * @desc    Add message and get streaming AI response
 * @access  Private (API Key required)
 */
router.post(
  '/:conversationId/messages/stream',
  validateConversationId,
  validateAddMessage,
  handleValidationErrors,
  ConversationController.addMessageWithStreaming
);

/**
 * @route   GET /api/conversations/:conversationId/messages
 * @desc    Get messages from conversation
 * @access  Private (API Key required)
 */
router.get(
  '/:conversationId/messages',
  validateConversationId,
  validatePagination,
  handleValidationErrors,
  ConversationController.getMessages
);

/**
 * @route   PUT /api/conversations/:conversationId/status
 * @desc    Update conversation status
 * @access  Private (API Key required)
 */
router.put(
  '/:conversationId/status',
  validateConversationId,
  handleValidationErrors,
  ConversationController.updateStatus
);

/**
 * @route   POST /api/conversations/:conversationId/summary
 * @desc    Generate conversation summary
 * @access  Private (API Key required)
 */
router.post(
  '/:conversationId/summary',
  validateConversationId,
  handleValidationErrors,
  ConversationController.generateSummary
);

export { router as conversationRoutes };