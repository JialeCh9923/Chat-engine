import { Router } from 'express';
import { SSEController } from '../controllers/sseController';
import { handleValidationErrors, validateSessionId } from '../middleware/validation';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/sse/events
 * @desc    Connect to SSE stream (alias for connect)
 * @access  Private (API Key required)
 * @query   sessionId - Optional session ID to filter events
 */
router.get(
  '/events',
  SSEController.connect
);

/**
 * @route   GET /api/sse/connect
 * @desc    Connect to SSE stream
 * @access  Private (API Key required)
 * @query   sessionId - Optional session ID to filter events
 */
router.get(
  '/connect',
  SSEController.connect
);

/**
 * @route   POST /api/sse/:connectionId/subscribe
 * @desc    Subscribe to specific event types
 * @access  Private (API Key required)
 * @body    eventTypes - Array of event types to subscribe to
 */
router.post(
  '/:connectionId/subscribe',
  handleValidationErrors,
  SSEController.subscribe
);

/**
 * @route   GET /api/sse/stats
 * @desc    Get SSE connection statistics
 * @access  Private (API Key required)
 */
router.get(
  '/stats',
  SSEController.getConnectionStats
);

/**
 * @route   POST /api/sse/broadcast
 * @desc    Broadcast event to all connections
 * @access  Private (API Key required)
 * @body    event - Event type, data - Event data
 */
router.post(
  '/broadcast',
  handleValidationErrors,
  SSEController.broadcast
);

/**
 * @route   POST /api/sse/send/:sessionId
 * @desc    Send event to specific session
 * @access  Private (API Key required)
 * @body    event - Event type, data - Event data
 */
router.post(
  '/send/:sessionId',
  validateSessionId,
  handleValidationErrors,
  SSEController.sendToSession
);

/**
 * @route   GET /api/sse/connections
 * @desc    Get active connections
 * @access  Private (API Key required)
 */
router.get(
  '/connections',
  SSEController.getConnections
);

/**
 * @route   DELETE /api/sse/connections/:sessionId
 * @desc    Close connections for specific session
 * @access  Private (API Key required)
 */
router.delete(
  '/connections/:sessionId',
  validateSessionId,
  handleValidationErrors,
  SSEController.closeSessionConnections
);

/**
 * @route   GET /api/sse/health
 * @desc    SSE service health check
 * @access  Public
 */
router.get(
  '/health',
  SSEController.healthCheck
);

export { router as sseRoutes };