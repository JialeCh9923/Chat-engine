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
 * @swagger
 * /api/conversations:
 *   post:
 *     summary: Create a new conversation
 *     description: Create a new conversation for a session with AI-powered tax filing assistance
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - title
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Session ID to associate the conversation with
 *                 example: "sess_1234567890"
 *               title:
 *                 type: string
 *                 description: Conversation title
 *                 example: "2023 Tax Filing Questions"
 *               initialMessage:
 *                 type: string
 *                 description: Optional initial message to start the conversation
 *                 example: "I need help with my 2023 tax return"
 *           examples:
 *             basic:
 *               summary: Basic conversation creation
 *               value:
 *                 sessionId: "sess_1234567890"
 *                 title: "Tax Questions"
 *             withMessage:
 *               summary: Conversation with initial message
 *               value:
 *                 sessionId: "sess_1234567890"
 *                 title: "2023 Tax Filing"
 *                 initialMessage: "I need help understanding my W-2 form"
 *     responses:
 *       201:
 *         description: Conversation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  validateCreateConversation,
  handleValidationErrors,
  ConversationController.createConversation
);

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: Get conversations for session
 *     description: Retrieve conversations for the authenticated session with pagination and filtering
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, archived, deleted]
 *         description: Filter by conversation status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, title]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Conversation'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/',
  validatePagination,
  ConversationController.getConversations
);

/**
 * @swagger
 * /api/conversations/session/{sessionId}:
 *   get:
 *     summary: Get conversations by session ID
 *     description: Retrieve all conversations for a specific session
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID to get conversations for
 *         example: "sess_1234567890"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, archived, deleted]
 *         description: Filter by conversation status
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Conversation'
 *                     sessionId:
 *                       type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       400:
 *         description: Invalid session ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/session/:sessionId',
  validateSessionId,
  validatePagination,
  ConversationController.getConversationsBySession
);

/**
 * @swagger
 * /api/conversations/stats:
 *   get:
 *     summary: Get conversation statistics
 *     description: Retrieve comprehensive statistics about conversations including counts, activity metrics, and performance indicators. Requires API key authentication.
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics (YYYY-MM-DD)
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics (YYYY-MM-DD)
 *         example: "2024-12-31"
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Filter statistics by specific session ID
 *         example: "sess_1234567890"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, paused, completed, archived, deleted]
 *         description: Filter statistics by conversation status
 *         example: "active"
 *     responses:
 *       200:
 *         description: Conversation statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalConversations:
 *                       type: integer
 *                       description: Total number of conversations
 *                       example: 1250
 *                     activeConversations:
 *                       type: integer
 *                       description: Number of active conversations
 *                       example: 342
 *                     completedConversations:
 *                       type: integer
 *                       description: Number of completed conversations
 *                       example: 891
 *                     archivedConversations:
 *                       type: integer
 *                       description: Number of archived conversations
 *                       example: 17
 *                     averageMessagesPerConversation:
 *                       type: number
 *                       description: Average messages per conversation
 *                       example: 8.5
 *                     averageResponseTime:
 *                       type: number
 *                       description: Average AI response time in seconds
 *                       example: 2.3
 *                     totalMessages:
 *                       type: integer
 *                       description: Total number of messages across all conversations
 *                       example: 10625
 *                     userSatisfaction:
 *                       type: object
 *                       description: User satisfaction metrics
 *                       properties:
 *                         averageRating:
 *                           type: number
 *                           description: Average user rating (1-5)
 *                           example: 4.2
 *                         totalRatings:
 *                           type: integer
 *                           description: Total number of ratings
 *                           example: 450
 *                         positiveFeedback:
 *                           type: integer
 *                           description: Number of positive feedback responses
 *                           example: 380
 *                     topCategories:
 *                       type: array
 *                       description: Most common conversation categories
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                             description: Conversation category
 *                             example: "deductions"
 *                           count:
 *                             type: integer
 *                             description: Number of conversations in category
 *                             example: 285
 *                           percentage:
 *                             type: number
 *                             description: Percentage of total conversations
 *                             example: 22.8
 *                     dailyActivity:
 *                       type: array
 *                       description: Daily activity metrics
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                             description: Date
 *                             example: "2024-01-15"
 *                           conversations:
 *                             type: integer
 *                             description: Number of conversations on date
 *                             example: 45
 *                           messages:
 *                             type: integer
 *                             description: Number of messages on date
 *                             example: 380
 *                     aiPerformance:
 *                       type: object
 *                       description: AI performance metrics
 *                       properties:
 *                         accuracy:
 *                           type: number
 *                           description: AI response accuracy percentage
 *                           example: 94.5
 *                         helpfulness:
 *                           type: number
 *                           description: AI helpfulness score (1-10)
 *                           example: 8.7
 *                         relevance:
 *                           type: number
 *                           description: AI response relevance score (1-10)
 *                           example: 9.1
 *                     timeRange:
 *                       type: object
 *                       description: Statistics time range
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *                           description: Start timestamp
 *                           example: "2024-01-01T00:00:00Z"
 *                         end:
 *                           type: string
 *                           format: date-time
 *                           description: End timestamp
 *                           example: "2024-12-31T23:59:59Z"
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/stats',
  ConversationController.getConversationStats
);

/**
 * @swagger
 * /api/conversations/archive:
 *   post:
 *     summary: Archive conversations
 *     description: Archive multiple conversations by their IDs. Archived conversations are moved to long-term storage and can be restored later. Requires API key authentication.
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationIds
 *             properties:
 *               conversationIds:
 *                 type: array
 *                 description: Array of conversation IDs to archive
 *                 minItems: 1
 *                 maxItems: 100
 *                 items:
 *                   type: string
 *                   pattern: '^conv_[a-zA-Z0-9]+$'
 *                   example: "conv_1234567890"
 *                 example: ["conv_1234567890", "conv_0987654321"]
 *               reason:
 *                 type: string
 *                 description: Optional reason for archiving
 *                 maxLength: 500
 *                 example: "Completed tax season 2024"
 *               archiveMetadata:
 *                 type: object
 *                 description: Optional metadata for archiving
 *                 properties:
 *                   retentionPeriod:
 *                     type: integer
 *                     description: Days to retain before permanent deletion
 *                     minimum: 30
 *                     maximum: 3650
 *                     example: 365
 *                   category:
 *                     type: string
 *                     description: Archive category
 *                     enum: [completed, expired, manual, system]
 *                     example: "completed"
 *             example:
 *               conversationIds: ["conv_1234567890", "conv_0987654321"]
 *               reason: "Completed tax season 2024"
 *               archiveMetadata:
 *                 retentionPeriod: 365
 *                 category: "completed"
 *     responses:
 *       200:
 *         description: Conversations archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     archivedCount:
 *                       type: integer
 *                       description: Number of conversations archived
 *                       example: 2
 *                     failedCount:
 *                       type: integer
 *                       description: Number of conversations that failed to archive
 *                       example: 0
 *                     archivedIds:
 *                       type: array
 *                       description: IDs of successfully archived conversations
 *                       items:
 *                         type: string
 *                         example: "conv_1234567890"
 *                       example: ["conv_1234567890", "conv_0987654321"]
 *                     failedIds:
 *                       type: array
 *                       description: IDs of conversations that failed to archive
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Conversation ID
 *                             example: "conv_failed_123"
 *                           reason:
 *                             type: string
 *                             description: Reason for failure
 *                             example: "Conversation not found"
 *                     archiveLocation:
 *                       type: string
 *                       description: Storage location for archived conversations
 *                       example: "s3://tax-engine-archive/conversations/2024/"
 *                     retentionExpiry:
 *                       type: string
 *                       format: date-time
 *                       description: Date when archived conversations will be permanently deleted
 *                       example: "2025-12-31T23:59:59Z"
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       413:
 *         description: Too many conversations requested (max 100)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/archive',
  ConversationController.archiveOldConversations
);

/**
 * @swagger
 * /api/conversations/health:
 *   get:
 *     summary: Conversation service health check
 *     description: Check the health status of the conversation service and its dependencies
 *     tags: [Conversations]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     service:
 *                       type: string
 *                       example: "conversation-service"
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                       example: "healthy"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-01T12:00:00.000Z"
 *                     uptime:
 *                       type: number
 *                       description: Service uptime in seconds
 *                       example: 3600
 *                     dependencies:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [connected, disconnected, error]
 *                               example: "connected"
 *                             responseTime:
 *                               type: number
 *                               description: Database response time in ms
 *                               example: 15
 *                         cache:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [connected, disconnected, error]
 *                               example: "connected"
 *                             responseTime:
 *                               type: number
 *                               description: Cache response time in ms
 *                               example: 5
 *                         aiService:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [available, unavailable, error]
 *                               example: "available"
 *                             responseTime:
 *                               type: number
 *                               description: AI service response time in ms
 *                               example: 250
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/health',
  ConversationController.healthCheck
);

/**
 * @swagger
 * /api/conversations/{conversationId}:
 *   get:
 *     summary: Get conversation by ID
 *     description: Retrieve a specific conversation by its ID with all messages and metadata
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID to retrieve
 *         example: "conv_1234567890"
 *     responses:
 *       200:
 *         description: Conversation retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: Invalid conversation ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/:conversationId',
  validateConversationId,
  handleValidationErrors,
  ConversationController.getConversation
);

/**
 * @swagger
 * /api/conversations/{conversationId}:
 *   put:
 *     summary: Update conversation
 *     description: Update conversation metadata such as title, status, or tax year
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID to update
 *         example: "conv_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Conversation title
 *                 example: "Q4 2023 Tax Questions"
 *               status:
 *                 type: string
 *                 enum: [active, paused, completed, archived]
 *                 description: Conversation status
 *                 example: "active"
 *               taxYear:
 *                 type: number
 *                 minimum: 2020
 *                 maximum: 2030
 *                 description: Tax year for this conversation
 *                 example: 2023
 *               metadata:
 *                 type: object
 *                 description: Additional conversation metadata
 *                 additionalProperties: true
 *                 example:
 *                   priority: "high"
 *                   category: "deductions"
 *           examples:
 *             updateTitle:
 *               summary: Update title only
 *               value:
 *                 title: "Home Office Deduction Discussion"
 *             updateStatus:
 *               summary: Update status only
 *               value:
 *                 status: "completed"
 *             updateMultiple:
 *               summary: Update multiple fields
 *               value:
 *                 title: "2023 Tax Filing Questions"
 *                 status: "active"
 *                 taxYear: 2023
 *                 metadata:
 *                   priority: "urgent"
 *                   category: "filing"
 *     responses:
 *       200:
 *         description: Conversation updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:conversationId',
  validateConversationId,
  handleValidationErrors,
  ConversationController.updateConversation
);

/**
 * @swagger
 * /api/conversations/{conversationId}:
 *   delete:
 *     summary: Delete conversation
 *     description: Permanently delete a conversation and all its associated messages
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID to delete
 *         example: "conv_1234567890"
 *     responses:
 *       200:
 *         description: Conversation deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Conversation and associated messages deleted successfully"
 *       400:
 *         description: Invalid conversation ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  '/:conversationId',
  validateConversationId,
  handleValidationErrors,
  ConversationController.deleteConversation
);

/**
 * @swagger
 * /api/conversations/{conversationId}/messages:
 *   post:
 *     summary: Add message to conversation
 *     description: Add a new message to an existing conversation and get AI response
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID to add message to
 *         example: "conv_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - sender
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message content
 *                 example: "What deductions can I claim for my home office?"
 *               sender:
 *                 type: string
 *                 enum: [user, assistant, system]
 *                 description: Message sender type
 *                 example: "user"
 *               messageType:
 *                 type: string
 *                 enum: [text, question, answer, clarification, suggestion]
 *                 default: "text"
 *                 description: Type of message
 *           examples:
 *             userQuestion:
 *               summary: User tax question
 *               value:
 *                 content: "Can I deduct my home office expenses?"
 *                 sender: "user"
 *                 messageType: "question"
 *             clarification:
 *               summary: Request for clarification
 *               value:
 *                 content: "What type of business entity do you have?"
 *                 sender: "assistant"
 *                 messageType: "clarification"
 *     responses:
 *       201:
 *         description: Message added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         content:
 *                           type: string
 *                         sender:
 *                           type: string
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                     aiResponse:
 *                       type: object
 *                       description: AI-generated response to the message
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:conversationId/messages',
  validateConversationId,
  validateAddMessage,
  handleValidationErrors,
  ConversationController.addMessage
);

/**
 * @swagger
 * /api/conversations/{conversationId}/messages/stream:
 *   post:
 *     summary: Stream message response
 *     description: Add a message to conversation and receive AI response as a stream
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID to stream message to
 *         example: "conv_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - sender
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message content to stream response for
 *                 example: "Explain tax deduction rules for small businesses"
 *               sender:
 *                 type: string
 *                 enum: [user, assistant, system]
 *                 description: Message sender type
 *                 example: "user"
 *               messageType:
 *                 type: string
 *                 enum: [text, question, answer, clarification, suggestion]
 *                 default: "text"
 *                 description: Type of message
 *               streamOptions:
 *                 type: object
 *                 properties:
 *                   includeMetadata:
 *                     type: boolean
 *                     default: true
 *                     description: Include metadata in stream
 *                   chunkSize:
 *                     type: number
 *                     default: 100
 *                     description: Size of text chunks in stream
 *     responses:
 *       200:
 *         description: Stream started successfully
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-sent events stream with AI response chunks
 *             example: |
 *               data: {"type":"chunk","content":"Tax deduction rules","timestamp":"2024-01-01T12:00:00Z"}
 *               data: {"type":"chunk","content":" for small businesses include","timestamp":"2024-01-01T12:00:01Z"}
 *               data: {"type":"complete","content":"","metadata":{"totalTokens":150,"processingTime":2500},"timestamp":"2024-01-01T12:00:02Z"}
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:conversationId/messages/stream',
  validateConversationId,
  validateAddMessage,
  handleValidationErrors,
  ConversationController.addMessageWithStreaming
);

/**
 * @swagger
 * /api/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get conversation messages
 *     description: Retrieve all messages from a specific conversation with optional filtering
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID to get messages from
 *         example: "conv_1234567890"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of messages to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of messages to skip
 *       - in: query
 *         name: sender
 *         schema:
 *           type: string
 *           enum: [user, assistant, system]
 *         description: Filter messages by sender type
 *       - in: query
 *         name: messageType
 *         schema:
 *           type: string
 *           enum: [text, question, answer, clarification, suggestion]
 *         description: Filter messages by type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter messages created after this date (ISO 8601 format)
 *         example: "2024-01-01T00:00:00Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter messages created before this date (ISO 8601 format)
 *         example: "2024-12-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       conversationId:
 *                         type: string
 *                       content:
 *                         type: string
 *                       sender:
 *                         type: string
 *                         enum: [user, assistant, system]
 *                       messageType:
 *                         type: string
 *                         enum: [text, question, answer, clarification, suggestion]
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       metadata:
 *                         type: object
 *                         additionalProperties: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of messages
 *                     limit:
 *                       type: integer
 *                       description: Current limit
 *                     offset:
 *                       type: integer
 *                       description: Current offset
 *       400:
 *         description: Invalid conversation ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/:conversationId/messages',
  validateConversationId,
  validatePagination,
  handleValidationErrors,
  ConversationController.getMessages
);

/**
 * @swagger
 * /api/conversations/{conversationId}/status:
 *   put:
 *     summary: Update conversation status
 *     description: Update the status of a conversation (active, paused, completed, archived)
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID to update status
 *         example: "conv_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, paused, completed, archived]
 *                 description: New conversation status
 *                 example: "completed"
 *               reason:
 *                 type: string
 *                 description: Optional reason for status change
 *                 example: "Tax filing completed successfully"
 *           examples:
 *             complete:
 *               summary: Mark as completed
 *               value:
 *                 status: "completed"
 *                 reason: "All questions answered"
 *             pause:
 *               summary: Pause conversation
 *               value:
 *                 status: "paused"
 *                 reason: "Waiting for additional documents"
 *             reactivate:
 *               summary: Reactivate conversation
 *               value:
 *                 status: "active"
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversationId:
 *                       type: string
 *                     previousStatus:
 *                       type: string
 *                     newStatus:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:conversationId/status',
  validateConversationId,
  handleValidationErrors,
  ConversationController.updateStatus
);

/**
 * @swagger
 * /api/conversations/{conversationId}/summary:
 *   post:
 *     summary: Generate conversation summary
 *     description: Generate an AI-powered summary of the conversation including key topics and insights
 *     tags: [Conversations]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID to generate summary for
 *         example: "conv_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               summaryType:
 *                 type: string
 *                 enum: [brief, detailed, topics, action_items]
 *                 default: "detailed"
 *                 description: Type of summary to generate
 *               maxLength:
 *                 type: integer
 *                 minimum: 50
 *                 maximum: 2000
 *                 default: 500
 *                 description: Maximum length of summary in characters
 *               includeMetadata:
 *                 type: boolean
 *                 default: true
 *                 description: Include metadata like word count, topics, sentiment
 *           examples:
 *             brief:
 *               summary: Generate brief summary
 *               value:
 *                 summaryType: "brief"
 *                 maxLength: 200
 *             detailed:
 *               summary: Generate detailed summary
 *               value:
 *                 summaryType: "detailed"
 *                 maxLength: 1000
 *                 includeMetadata: true
 *             topics:
 *               summary: Generate topic-based summary
 *               value:
 *                 summaryType: "topics"
 *                 includeMetadata: true
 *     responses:
 *       200:
 *         description: Summary generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: string
 *                       description: Generated summary text
 *                       example: "This conversation focused on home office deductions for 2023 tax year..."
 *                     summaryType:
 *                       type: string
 *                       description: Type of summary generated
 *                       example: "detailed"
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         wordCount:
 *                           type: integer
 *                           description: Number of words in summary
 *                         topics:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Key topics identified
 *                         sentiment:
 *                           type: string
 *                           description: Overall sentiment of conversation
 *                         keyEntities:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Important entities mentioned
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: When summary was generated
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:conversationId/summary',
  validateConversationId,
  handleValidationErrors,
  ConversationController.generateSummary
);

export { router as conversationRoutes };
