import { Router } from 'express';
import { SessionController } from '../controllers/sessionController';
import {
  validateCreateSession,
  validateUpdateSession,
  validateSessionId,
  validatePagination,
  validateDateRange,
  handleValidationErrors,
} from '../middleware/validation';
import { sessionRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply session-specific rate limiting
router.use(sessionRateLimiter);

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Create a new session
 *     description: Create a new tax filing session for a client
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *               - filingType
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: Client ID
 *               filingType:
 *                 type: string
 *                 enum: [individual, business, nonprofit]
 *                 description: Type of tax filing
 *               metadata:
 *                 type: object
 *                 description: Additional session metadata
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  validateCreateSession,
  handleValidationErrors,
  SessionController.createSession
);

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Get all sessions
 *     description: Retrieve all sessions with optional filtering and pagination
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
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
 *           enum: [active, completed, expired, archived]
 *         description: Filter by session status
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *         description: Filter by client ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions created after this date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions created before this date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/',
  validatePagination,
  validateDateRange,
  handleValidationErrors,
  SessionController.getSessions
);



/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     summary: Get session by ID
 *     description: Retrieve a specific session by its unique identifier
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique session identifier
 *     responses:
 *       200:
 *         description: Session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Session'
 *       400:
 *         description: Invalid session ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
 */
router.get(
  '/:sessionId',
  validateSessionId,
  handleValidationErrors,
  SessionController.getSession
);

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   put:
 *     summary: Update session
 *     description: Update an existing session with new data
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique session identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: Client identifier
 *               status:
 *                 type: string
 *                 enum: [active, completed, expired, archived]
 *                 description: Session status
 *               metadata:
 *                 type: object
 *                 description: Additional session metadata
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Session expiration timestamp
 *     responses:
 *       200:
 *         description: Session updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Session'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
 */
router.put(
  '/:sessionId',
  validateSessionId,
  validateUpdateSession,
  handleValidationErrors,
  SessionController.updateSession
);

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   delete:
 *     summary: Delete session
 *     description: Delete a session and all associated data
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique session identifier
 *     responses:
 *       200:
 *         description: Session deleted successfully
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
 *                   example: Session deleted successfully
 *       400:
 *         description: Invalid session ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
 */
router.delete(
  '/:sessionId',
  validateSessionId,
  handleValidationErrors,
  SessionController.deleteSession
);

/**
 * @swagger
 * /api/sessions/{sessionId}/extend:
 *   post:
 *     summary: Extend session expiration
 *     description: Extend the expiration time of an active session
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique session identifier
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               duration:
 *                 type: integer
 *                 description: Extension duration in minutes (default: 60)
 *                 minimum: 1
 *                 maximum: 1440
 *                 default: 60
 *     responses:
 *       200:
 *         description: Session extended successfully
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
 *                     sessionId:
 *                       type: string
 *                     newExpiryTime:
 *                       type: string
 *                       format: date-time
 *                     extensionDuration:
 *                       type: integer
 *                       description: Extension duration in minutes
 *       400:
 *         description: Invalid session ID format or extension duration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
 */
router.post(
  '/:sessionId/extend',
  validateSessionId,
  handleValidationErrors,
  SessionController.extendSession
);

/**
 * @swagger
 * /api/sessions/{sessionId}/progress:
 *   put:
 *     summary: Update session progress
 *     description: Update the progress percentage and status of a session
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique session identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               progress:
 *                 type: number
 *                 description: Progress percentage (0-100)
 *                 minimum: 0
 *                 maximum: 100
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, failed]
 *                 description: Session processing status
 *               message:
 *                 type: string
 *                 description: Progress message or status description
 *             required:
 *               - progress
 *     responses:
 *       200:
 *         description: Progress updated successfully
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
 *                     sessionId:
 *                       type: string
 *                     progress:
 *                       type: number
 *                     status:
 *                       type: string
 *                     message:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
 */
router.put(
  '/:sessionId/progress',
  validateSessionId,
  handleValidationErrors,
  SessionController.updateProgress
);

/**
 * @swagger
 * /api/sessions/client/{clientId}:
 *   get:
 *     summary: Get sessions by client ID
 *     description: Retrieve all sessions for a specific client with optional filtering and pagination
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client identifier
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
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
 *           enum: [active, completed, expired, archived]
 *         description: Filter by session status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions created after this date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions created before this date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/client/:clientId',
  validatePagination,
  handleValidationErrors,
  SessionController.getSessionsByClient
);

/**
 * @swagger
 * /api/sessions/stats:
 *   get:
 *     summary: Get session statistics
 *     description: Retrieve comprehensive statistics about all sessions
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Session statistics retrieved successfully
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
 *                     totalSessions:
 *                       type: integer
 *                       description: Total number of sessions
 *                     activeSessions:
 *                       type: integer
 *                       description: Number of active sessions
 *                     completedSessions:
 *                       type: integer
 *                       description: Number of completed sessions
 *                     expiredSessions:
 *                       type: integer
 *                       description: Number of expired sessions
 *                     archivedSessions:
 *                       type: integer
 *                       description: Number of archived sessions
 *                     averageSessionDuration:
 *                       type: number
 *                       description: Average session duration in minutes
 *                     sessionsByStatus:
 *                       type: object
 *                       description: Session count grouped by status
 *                     recentSessions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Session'
 *                     topClients:
 *                       type: array
 *                       description: Top clients by session count
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/stats',
  SessionController.getSessionStats
);

/**
 * @swagger
 * /api/sessions/cleanup:
 *   post:
 *     summary: Clean up expired sessions
 *     description: Remove all expired sessions and their associated data
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxAge:
 *                 type: integer
 *                 description: Maximum age in hours for sessions to keep (default: 24)
 *                 minimum: 1
 *                 default: 24
 *               dryRun:
 *                 type: boolean
 *                 description: If true, only count sessions without deleting (default: false)
 *                 default: false
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
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
 *                     deletedCount:
 *                       type: integer
 *                       description: Number of sessions deleted
 *                     dryRun:
 *                       type: boolean
 *                       description: Whether this was a dry run
 *                     message:
 *                       type: string
 *                       example: Cleanup completed successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/cleanup',
  SessionController.cleanupExpiredSessions
);

/**
 * @swagger
 * /api/sessions/cache/warm:
 *   post:
 *     summary: Warm up session cache
 *     description: Pre-populate the session cache with frequently accessed data
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Specific session IDs to warm up (optional)
 *               limit:
 *                 type: integer
 *                 description: Maximum number of sessions to warm up (default: 100)
 *                 minimum: 1
 *                 maximum: 1000
 *                 default: 100
 *     responses:
 *       200:
 *         description: Cache warmed up successfully
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
 *                     warmedSessions:
 *                       type: integer
 *                       description: Number of sessions warmed up
 *                     message:
 *                       type: string
 *                       example: Cache warmed up successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/cache/warm',
  SessionController.warmUpCache
);

/**
 * @swagger
 * /api/sessions/cache/clear:
 *   post:
 *     summary: Clear session cache
 *     description: Clear all cached session data from memory
 *     tags: [Sessions]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Specific session IDs to clear from cache (optional)
 *     responses:
 *       200:
 *         description: Cache cleared successfully
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
 *                     clearedSessions:
 *                       type: integer
 *                       description: Number of sessions cleared from cache
 *                     message:
 *                       type: string
 *                       example: Cache cleared successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/cache/clear',
  SessionController.clearCache
);

/**
 * @swagger
 * /api/sessions/health:
 *   get:
 *     summary: Session service health check
 *     description: Check the health status of the session service
 *     tags: [Sessions]
 *     responses:
 *       200:
 *         description: Session service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                   example: sessions
 *                 uptime:
 *                   type: number
 *                   description: Service uptime in seconds
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *       503:
 *         description: Session service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: string
 *                   example: unhealthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 error:
 *                   type: string
 *                   description: Error message
 */
router.get(
  '/health',
  SessionController.healthCheck
);

export { router as sessionRoutes };