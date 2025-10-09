import { Router } from 'express';
import { SSEController } from '../controllers/sseController';
import { handleValidationErrors, validateSessionId } from '../middleware/validation';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/sse/events:
 *   get:
 *     summary: Connect to SSE stream (alias)
 *     description: Establish a Server-Sent Events connection to receive real-time updates. This is an alias for the /connect endpoint. Requires API key authentication.
 *     tags: [SSE]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Optional session ID to filter events for specific session
 *         example: "session_1234567890"
 *     responses:
 *       200:
 *         description: SSE connection established successfully
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events stream data
 *               example: |
 *                 event: connection
 *                 data: {"connectionId":"conn_123","status":"connected"}
 *                 
 *                 event: job_update
 *                 data: {"jobId":"job_456","status":"processing","progress":45}
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/events',
  SSEController.connect
);

/**
 * @swagger
 * /api/sse/connect:
 *   get:
 *     summary: Connect to SSE stream
 *     description: Establish a Server-Sent Events connection to receive real-time updates about job status, document processing, and system events. Requires API key authentication.
 *     tags: [SSE]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Optional session ID to filter events for specific session
 *         example: "session_1234567890"
 *     responses:
 *       200:
 *         description: SSE connection established successfully
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events stream data
 *               example: |
 *                 event: connection
 *                 data: {"connectionId":"conn_123","status":"connected","timestamp":"2024-01-15T10:30:00Z"}
 *                 
 *                 event: job_created
 *                 data: {"jobId":"job_789","type":"document_processing","priority":"normal","createdAt":"2024-01-15T10:31:00Z"}
 *                 
 *                 event: job_progress
 *                 data: {"jobId":"job_789","status":"processing","progress":25,"message":"Analyzing document..."}
 *                 
 *                 event: document_processed
 *                 data: {"documentId":"doc_456","status":"completed","processingTime":12.5,"confidence":0.95}
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/connect',
  SSEController.connect
);

/**
 * @swagger
 * /api/sse/{connectionId}/subscribe:
 *   post:
 *     summary: Subscribe to specific event types
 *     description: Subscribe to specific Server-Sent Events types to filter the events received on a connection. Requires API key authentication.
 *     tags: [SSE]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The connection ID to subscribe events for
 *         example: "conn_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventTypes:
 *                 type: array
 *                 description: Array of event types to subscribe to
 *                 items:
 *                   type: string
 *                   enum: [job_created, job_progress, job_completed, job_failed, document_processed, document_uploaded, conversation_updated, system_message, connection_event]
 *                 example: ["job_progress", "job_completed", "document_processed"]
 *               unsubscribeFrom:
 *                 type: array
 *                 description: Array of event types to unsubscribe from (optional)
 *                 items:
 *                   type: string
 *                   enum: [job_created, job_progress, job_completed, job_failed, document_processed, document_uploaded, conversation_updated, system_message, connection_event]
 *                 example: ["system_message"]
 *     responses:
 *       200:
 *         description: Subscription updated successfully
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
 *                     connectionId:
 *                       type: string
 *                       example: "conn_1234567890"
 *                     subscribedEvents:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["job_progress", "job_completed", "document_processed"]
 *                     unsubscribedEvents:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["system_message"]
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/:connectionId/subscribe',
  handleValidationErrors,
  SSEController.subscribe
);

/**
 * @swagger
 * /api/sse/stats:
 *   get:
 *     summary: Get SSE connection statistics
 *     description: Retrieve detailed statistics about Server-Sent Events connections including active connections, total connections, event delivery metrics, and connection history. Requires API key authentication.
 *     tags: [SSE]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: SSE connection statistics retrieved successfully
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
 *                     connections:
 *                       type: object
 *                       properties:
 *                         active:
 *                           type: integer
 *                           description: Number of currently active SSE connections
 *                           example: 8
 *                         total:
 *                           type: integer
 *                           description: Total connections since service start
 *                           example: 1250
 *                         uniqueSessions:
 *                           type: integer
 *                           description: Number of unique session IDs
 *                           example: 45
 *                         averageDuration:
 *                           type: number
 *                           description: Average connection duration in seconds
 *                           example: 1800.5
 *                     events:
 *                       type: object
 *                       properties:
 *                         totalDelivered:
 *                           type: integer
 *                           description: Total events delivered
 *                           example: 15420
 *                         totalFailed:
 *                           type: integer
 *                           description: Total events that failed to deliver
 *                           example: 25
 *                         deliveryRate:
 *                           type: number
 *                           description: Event delivery success rate (0-1)
 *                           example: 0.998
 *                         eventsPerMinute:
 *                           type: number
 *                           description: Average events delivered per minute
 *                           example: 45.2
 *                     eventTypes:
 *                       type: object
 *                       description: Event delivery statistics by type
 *                       properties:
 *                         job_created:
 *                           type: integer
 *                           example: 1250
 *                         job_progress:
 *                           type: integer
 *                           example: 8500
 *                         job_completed:
 *                           type: integer
 *                           example: 1200
 *                         job_failed:
 *                           type: integer
 *                           example: 50
 *                         document_processed:
 *                           type: integer
 *                           example: 3200
 *                         system_message:
 *                           type: integer
 *                           example: 220
 *                     performance:
 *                       type: object
 *                       properties:
 *                         averageLatency:
 *                           type: number
 *                           description: Average event delivery latency in milliseconds
 *                           example: 25.3
 *                         maxLatency:
 *                           type: number
 *                           description: Maximum event delivery latency in milliseconds
 *                           example: 150.2
 *                         memoryUsage:
 *                           type: object
 *                           properties:
 *                             current:
 *                               type: number
 *                               description: Current memory usage in MB
 *                               example: 45.2
 *                             peak:
 *                               type: number
 *                               description: Peak memory usage in MB
 *                               example: 78.5
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/stats',
  SSEController.getConnectionStats
);

/**
 * @swagger
 * /api/sse/broadcast:
 *   post:
 *     summary: Broadcast event to all connections
 *     description: Broadcast a Server-Sent Event to all active connections. This is useful for system-wide notifications and updates. Requires API key authentication.
 *     tags: [SSE]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event type to broadcast
 *                 enum: [job_created, job_progress, job_completed, job_failed, document_processed, document_uploaded, conversation_updated, system_message, connection_event]
 *                 example: "system_message"
 *               data:
 *                 type: object
 *                 description: Event data payload
 *                 properties:
 *                   message:
 *                     type: string
 *                     example: "System maintenance scheduled for 2 AM"
 *                   level:
 *                     type: string
 *                     enum: [info, warning, error, success]
 *                     example: "warning"
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T10:30:00Z"
 *                   metadata:
 *                     type: object
 *                     description: Additional metadata
 *                     additionalProperties: true
 *             required:
 *               - event
 *               - data
 *     responses:
 *       200:
 *         description: Event broadcast successfully
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
 *                     eventId:
 *                       type: string
 *                       example: "event_1234567890"
 *                     eventType:
 *                       type: string
 *                       example: "system_message"
 *                     recipients:
 *                       type: integer
 *                       description: Number of connections that received the event
 *                       example: 8
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/broadcast',
  handleValidationErrors,
  SSEController.broadcast
);

/**
 * @swagger
 * /api/sse/send/{sessionId}:
 *   post:
 *     summary: Send event to specific session
 *     description: Send a Server-Sent Event to a specific session ID. This allows targeted communication to specific users or sessions. Requires API key authentication.
 *     tags: [SSE]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The session ID to send the event to
 *         example: "session_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event type to send
 *                 enum: [job_created, job_progress, job_completed, job_failed, document_processed, document_uploaded, conversation_updated, system_message, connection_event]
 *                 example: "job_progress"
 *               data:
 *                 type: object
 *                 description: Event data payload
 *                 properties:
 *                   jobId:
 *                     type: string
 *                     example: "job_7890123456"
 *                   status:
 *                     type: string
 *                     example: "processing"
 *                   progress:
 *                     type: integer
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 75
 *                   message:
 *                     type: string
 *                     example: "Analyzing tax form data..."
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T10:30:00Z"
 *                   metadata:
 *                     type: object
 *                     description: Additional metadata
 *                     additionalProperties: true
 *             required:
 *               - event
 *               - data
 *     responses:
 *       200:
 *         description: Event sent successfully
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
 *                     eventId:
 *                       type: string
 *                       example: "event_1234567890"
 *                     eventType:
 *                       type: string
 *                       example: "job_progress"
 *                     sessionId:
 *                       type: string
 *                       example: "session_1234567890"
 *                     delivered:
 *                       type: boolean
 *                       description: Whether the event was delivered to active connections
 *                       example: true
 *                     connectionsAffected:
 *                       type: integer
 *                       description: Number of connections that received the event
 *                       example: 2
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/send/:sessionId',
  validateSessionId,
  handleValidationErrors,
  SSEController.sendToSession
);

/**
 * @swagger
 * /api/sse/connections:
 *   get:
 *     summary: Get active connections
 *     description: Retrieve information about all active Server-Sent Events connections including connection IDs, session IDs, subscription status, and connection metadata. Requires API key authentication.
 *     tags: [SSE]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Active connections retrieved successfully
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
 *                     connections:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           connectionId:
 *                             type: string
 *                             description: Unique connection identifier
 *                             example: "conn_1234567890"
 *                           sessionId:
 *                             type: string
 *                             description: Associated session ID
 *                             example: "session_1234567890"
 *                           status:
 *                             type: string
 *                             enum: [connected, disconnected, reconnecting]
 *                             example: "connected"
 *                           connectedAt:
 *                             type: string
 *                             format: date-time
 *                             description: Connection establishment timestamp
 *                             example: "2024-01-15T10:30:00Z"
 *                           lastActivity:
 *                             type: string
 *                             format: date-time
 *                             description: Last activity timestamp
 *                             example: "2024-01-15T10:35:00Z"
 *                           subscribedEvents:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: Event types this connection is subscribed to
 *                             example: ["job_progress", "job_completed", "document_processed"]
 *                           clientInfo:
 *                             type: object
 *                             description: Client connection information
 *                             properties:
 *                               userAgent:
 *                                 type: string
 *                                 example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 *                               ip:
 *                                 type: string
 *                                 example: "192.168.1.100"
 *                     total:
 *                       type: integer
 *                       description: Total number of active connections
 *                       example: 8
 *                     summary:
 *                       type: object
 *                       properties:
 *                         byStatus:
 *                           type: object
 *                           properties:
 *                             connected:
 *                               type: integer
 *                               example: 7
 *                             reconnecting:
 *                               type: integer
 *                               example: 1
 *                         byEventSubscription:
 *                           type: object
 *                           description: Number of connections subscribed to each event type
 *                           properties:
 *                             job_progress:
 *                               type: integer
 *                               example: 6
 *                             job_completed:
 *                               type: integer
 *                               example: 5
 *                             document_processed:
 *                               type: integer
 *                               example: 4
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/connections',
  SSEController.getConnections
);

/**
 * @swagger
 * /api/sse/connections/{sessionId}:
 *   delete:
 *     summary: Close connections for specific session
 *     description: Close all Server-Sent Events connections associated with a specific session ID. This is useful for cleanup when a user logs out or a session ends. Requires API key authentication.
 *     tags: [SSE]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The session ID whose connections should be closed
 *         example: "session_1234567890"
 *     responses:
 *       200:
 *         description: Connections closed successfully
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
 *                       example: "session_1234567890"
 *                     connectionsClosed:
 *                       type: integer
 *                       description: Number of connections that were closed
 *                       example: 2
 *                     connections:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Connection IDs that were closed
 *                       example: ["conn_1234567890", "conn_0987654321"]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  '/connections/:sessionId',
  validateSessionId,
  handleValidationErrors,
  SSEController.closeSessionConnections
);

/**
 * @swagger
 * /api/sse/health:
 *   get:
 *     summary: SSE service health check
 *     description: Check the health status of the Server-Sent Events service and its dependencies
 *     tags: [SSE]
 *     responses:
 *       200:
 *         description: SSE service is healthy
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
 *                     status:
 *                       type: string
 *                       example: "healthy"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *                     service:
 *                       type: string
 *                       example: "SSE Service"
 *                     uptime:
 *                       type: number
 *                       description: Service uptime in seconds
 *                       example: 3600
 *                     version:
 *                       type: string
 *                       example: "1.0.0"
 *                     connections:
 *                       type: object
 *                       properties:
 *                         active:
 *                           type: integer
 *                           description: Number of active SSE connections
 *                           example: 5
 *                         total:
 *                           type: integer
 *                           description: Total connections since service start
 *                           example: 125
 *       503:
 *         description: SSE service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "SERVICE_UNAVAILABLE"
 *                     message:
 *                       type: string
 *                       example: "SSE service is unhealthy"
 *                     details:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "unhealthy"
 *                         reason:
 *                           type: string
 *                           example: "Connection pool exhausted"
 *                         connections:
 *                           type: object
 *                           properties:
 *                             active:
 *                               type: integer
 *                               example: 0
 *                             max:
 *                               type: integer
 *                               example: 100
 */
router.get(
  '/health',
  SSEController.healthCheck
);

export { router as sseRoutes };