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
 * @route   POST /api/sessions
 * @desc    Create a new session
 * @access  Private (API Key required)
 */
router.post(
  '/',
  validateCreateSession,
  handleValidationErrors,
  SessionController.createSession
);

/**
 * @route   GET /api/sessions
 * @desc    Get all sessions with filtering and pagination
 * @access  Private (API Key required)
 */
router.get(
  '/',
  validatePagination,
  validateDateRange,
  handleValidationErrors,
  SessionController.getSessions
);



/**
 * @route   GET /api/sessions/:sessionId
 * @desc    Get session by ID
 * @access  Private (API Key required)
 */
router.get(
  '/:sessionId',
  validateSessionId,
  handleValidationErrors,
  SessionController.getSession
);

/**
 * @route   PUT /api/sessions/:sessionId
 * @desc    Update session
 * @access  Private (API Key required)
 */
router.put(
  '/:sessionId',
  validateSessionId,
  validateUpdateSession,
  handleValidationErrors,
  SessionController.updateSession
);

/**
 * @route   DELETE /api/sessions/:sessionId
 * @desc    Delete session
 * @access  Private (API Key required)
 */
router.delete(
  '/:sessionId',
  validateSessionId,
  handleValidationErrors,
  SessionController.deleteSession
);

/**
 * @route   POST /api/sessions/:sessionId/extend
 * @desc    Extend session expiration
 * @access  Private (API Key required)
 */
router.post(
  '/:sessionId/extend',
  validateSessionId,
  handleValidationErrors,
  SessionController.extendSession
);

/**
 * @route   PUT /api/sessions/:sessionId/progress
 * @desc    Update session progress
 * @access  Private (API Key required)
 */
router.put(
  '/:sessionId/progress',
  validateSessionId,
  handleValidationErrors,
  SessionController.updateProgress
);

/**
 * @route   GET /api/sessions/client/:clientId
 * @desc    Get sessions by client ID
 * @access  Private (API Key required)
 */
router.get(
  '/client/:clientId',
  validatePagination,
  handleValidationErrors,
  SessionController.getSessionsByClient
);

/**
 * @route   GET /api/sessions/stats
 * @desc    Get session statistics
 * @access  Private (API Key required)
 */
router.get(
  '/stats',
  SessionController.getSessionStats
);

/**
 * @route   POST /api/sessions/cleanup
 * @desc    Clean up expired sessions
 * @access  Private (API Key required)
 */
router.post(
  '/cleanup',
  SessionController.cleanupExpiredSessions
);

/**
 * @route   POST /api/sessions/cache/warm
 * @desc    Warm up session cache
 * @access  Private (API Key required)
 */
router.post(
  '/cache/warm',
  SessionController.warmUpCache
);

/**
 * @route   POST /api/sessions/cache/clear
 * @desc    Clear session cache
 * @access  Private (API Key required)
 */
router.post(
  '/cache/clear',
  SessionController.clearCache
);

/**
 * @route   GET /api/sessions/health
 * @desc    Session service health check
 * @access  Public
 */
router.get(
  '/health',
  SessionController.healthCheck
);

export { router as sessionRoutes };