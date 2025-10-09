import { Router, RequestHandler } from 'express';
import { ClientController } from '../controllers/clientController';
import {
  validateCreateClient,
  validateClientId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation';
import { clientRateLimiter, sensitiveOperationRateLimiter } from '../middleware';
import { authenticateApiKey, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Type helper to cast authenticated handlers
const authHandler = (handler: (req: AuthenticatedRequest, res: any) => Promise<void>): RequestHandler => {
  return handler as RequestHandler;
};

// Apply client-specific rate limiting
// router.use(clientRateLimiter);

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Create a new client
 *     description: Create a new client account. No authentication required for initial setup.
 *     tags: [Clients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Client's full name or organization name
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *                 description: Client's email address (must be unique)
 *                 example: "john.doe@example.com"
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *                 description: Client's phone number
 *                 example: "+1-555-123-4567"
 *               company:
 *                 type: string
 *                 maxLength: 200
 *                 description: Client's company or organization name
 *                 example: "ABC Tax Services"
 *               metadata:
 *                 type: object
 *                 description: Additional client metadata
 *                 example: { "taxId": "123-45-6789", "preferredContact": "email" }
 *     responses:
 *       201:
 *         description: Client created successfully
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
 *                     clientId:
 *                       type: string
 *                       description: Unique client identifier
 *                       example: "clt_1234567890"
 *                     name:
 *                       type: string
 *                       description: Client's name
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       format: email
 *                       description: Client's email
 *                       example: "john.doe@example.com"
 *                     apiKey:
 *                       type: string
 *                       description: Client's API key for authentication
 *                       example: "sk_test_1234567890abcdef"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Client creation timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/',
  // sensitiveOperationRateLimiter, // Apply sensitive operation rate limiting
  validateCreateClient,
  handleValidationErrors,
  ClientController.createClient
);

/**
 * @swagger
 * /api/clients/health:
 *   get:
 *     summary: Client service health check
 *     description: Check the health status of the client service and its dependencies
 *     tags: [Clients]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *                 service:
 *                   type: string
 *                   example: "client-service"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 dependencies:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "healthy"
 *                         responseTime:
 *                           type: number
 *                           example: 25
 *                     cache:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "healthy"
 *                         responseTime:
 *                           type: number
 *                           example: 5
 *       503:
 *         description: Service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *                 service:
 *                   type: string
 *                   example: "client-service"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 dependencies:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "unhealthy"
 *                         error:
 *                           type: string
 *                           example: "Connection timeout"
 *                     cache:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "healthy"
 *                         responseTime:
 *                           type: number
 *                           example: 5
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/health',
  ClientController.healthCheck
);

// Apply authentication to all routes below
router.use(authenticateApiKey);

/**
 * @swagger
 * /api/clients/{clientId}:
 *   get:
 *     summary: Get client by ID
 *     description: Retrieve client information by client ID. Requires API key authentication.
 *     tags: [Clients]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^clt_[a-zA-Z0-9]+$"
 *         description: Unique client identifier
 *         example: "clt_1234567890"
 *     responses:
 *       200:
 *         description: Client retrieved successfully
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
 *                     clientId:
 *                       type: string
 *                       description: Unique client identifier
 *                       example: "clt_1234567890"
 *                     name:
 *                       type: string
 *                       description: Client's name
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       format: email
 *                       description: Client's email
 *                       example: "john.doe@example.com"
 *                     phone:
 *                       type: string
 *                       description: Client's phone number
 *                       example: "+1-555-123-4567"
 *                     company:
 *                       type: string
 *                       description: Client's company
 *                       example: "ABC Tax Services"
 *                     status:
 *                       type: string
 *                       enum: [active, inactive, suspended]
 *                       description: Client account status
 *                       example: "active"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Client creation timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Last update timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *                     metadata:
 *                       type: object
 *                       description: Additional client metadata
 *                       example: { "taxId": "123-45-6789", "preferredContact": "email" }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/:clientId',
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.getClient)
);

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Get all clients
 *     description: Retrieve all clients with pagination. Admin API key required.
 *     tags: [Clients]
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
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *         example: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, email, createdAt, updatedAt, status]
 *           default: createdAt
 *         description: Field to sort by
 *         example: "createdAt"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: "desc"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         description: Filter by client status
 *         example: "active"
 *     responses:
 *       200:
 *         description: Clients retrieved successfully
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
 *                       clientId:
 *                         type: string
 *                         description: Unique client identifier
 *                         example: "clt_1234567890"
 *                       name:
 *                         type: string
 *                         description: Client's name
 *                         example: "John Doe"
 *                       email:
 *                         type: string
 *                         format: email
 *                         description: Client's email
 *                         example: "john.doe@example.com"
 *                       phone:
 *                         type: string
 *                         description: Client's phone number
 *                         example: "+1-555-123-4567"
 *                       company:
 *                         type: string
 *                         description: Client's company
 *                         example: "ABC Tax Services"
 *                       status:
 *                         type: string
 *                         enum: [active, inactive, suspended]
 *                         description: Client account status
 *                         example: "active"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Client creation timestamp
 *                         example: "2024-01-15T10:30:00Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Last update timestamp
 *                         example: "2024-01-15T10:30:00Z"
 *                       metadata:
 *                         type: object
 *                         description: Additional client metadata
 *                         example: { "taxId": "123-45-6789", "preferredContact": "email" }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 150
 *                     totalPages:
 *                       type: integer
 *                       example: 8
 *                     hasNext:
 *                       type: boolean
 *                       example: true
 *                     hasPrev:
 *                       type: boolean
 *                       example: false
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/',
  validatePagination,
  handleValidationErrors,
  authHandler(ClientController.getAllClients)
);

/**
 * @swagger
 * /api/clients/{clientId}:
 *   put:
 *     summary: Update client
 *     description: Update client information. Requires API key authentication (own client or admin).
 *     tags: [Clients]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^clt_[a-zA-Z0-9]+$"
 *         description: Unique client identifier
 *         example: "clt_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Client's full name or organization name
 *                 example: "John Doe Updated"
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *                 description: Client's email address (must be unique)
 *                 example: "john.updated@example.com"
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *                 description: Client's phone number
 *                 example: "+1-555-987-6543"
 *               company:
 *                 type: string
 *                 maxLength: 200
 *                 description: Client's company or organization name
 *                 example: "XYZ Tax Solutions"
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *                 description: Client account status (admin only)
 *                 example: "active"
 *               metadata:
 *                 type: object
 *                 description: Additional client metadata
 *                 example: { "taxId": "987-65-4321", "preferredContact": "phone" }
 *     responses:
 *       200:
 *         description: Client updated successfully
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
 *                     clientId:
 *                       type: string
 *                       description: Unique client identifier
 *                       example: "clt_1234567890"
 *                     name:
 *                       type: string
 *                       description: Client's name
 *                       example: "John Doe Updated"
 *                     email:
 *                       type: string
 *                       format: email
 *                       description: Client's email
 *                       example: "john.updated@example.com"
 *                     phone:
 *                       type: string
 *                       description: Client's phone number
 *                       example: "+1-555-987-6543"
 *                     company:
 *                       type: string
 *                       description: Client's company
 *                       example: "XYZ Tax Solutions"
 *                     status:
 *                       type: string
 *                       enum: [active, inactive, suspended]
 *                       description: Client account status
 *                       example: "active"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Last update timestamp
 *                       example: "2024-01-15T11:45:00Z"
 *                     metadata:
 *                       type: object
 *                       description: Additional client metadata
 *                       example: { "taxId": "987-65-4321", "preferredContact": "phone" }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  '/:clientId',
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.updateClient)
);

/**
 * @swagger
 * /api/clients/{clientId}:
 *   delete:
 *     summary: Delete client
 *     description: Delete a client account. Admin API key required.
 *     tags: [Clients]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^clt_[a-zA-Z0-9]+$"
 *         description: Unique client identifier
 *         example: "clt_1234567890"
 *     responses:
 *       200:
 *         description: Client deleted successfully
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
 *                   example: "Client deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                       description: Deleted client identifier
 *                       example: "clt_1234567890"
 *                     deletedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Deletion timestamp
 *                       example: "2024-01-15T12:00:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  '/:clientId',
  // sensitiveOperationRateLimiter,
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.deleteClient)
);

/**
 * @swagger
 * /api/clients/{clientId}/regenerate-key:
 *   post:
 *     summary: Regenerate API key
 *     description: Regenerate a new API key for the client. Requires API key authentication (own client or admin).
 *     tags: [Clients]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^clt_[a-zA-Z0-9]+$"
 *         description: Unique client identifier
 *         example: "clt_1234567890"
 *     responses:
 *       200:
 *         description: API key regenerated successfully
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
 *                   example: "API key regenerated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                       description: Client identifier
 *                       example: "clt_1234567890"
 *                     apiKey:
 *                       type: string
 *                       description: New API key
 *                       example: "sk_test_9876543210fedcba"
 *                     oldApiKey:
 *                       type: string
 *                       description: Previous API key (partially masked)
 *                       example: "sk_test_1234..."
 *                     regeneratedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Regeneration timestamp
 *                       example: "2024-01-15T13:15:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/:clientId/regenerate-key',
  // sensitiveOperationRateLimiter,
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.regenerateApiKey)
);

/**
 * @swagger
 * /api/clients/{clientId}/usage:
 *   get:
 *     summary: Get client usage statistics
 *     description: Retrieve client usage statistics including API calls, storage, and processing metrics. Requires API key authentication (own client or admin).
 *     tags: [Clients]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^clt_[a-zA-Z0-9]+$"
 *         description: Unique client identifier
 *         example: "clt_1234567890"
 *     responses:
 *       200:
 *         description: Client usage statistics retrieved successfully
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
 *                     clientId:
 *                       type: string
 *                       description: Client identifier
 *                       example: "clt_1234567890"
 *                     period:
 *                       type: string
 *                       description: Statistics period
 *                       example: "current_month"
 *                     apiCalls:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           description: Total API calls
 *                           example: 1250
 *                         successful:
 *                           type: integer
 *                           description: Successful API calls
 *                           example: 1200
 *                         failed:
 *                           type: integer
 *                           description: Failed API calls
 *                           example: 50
 *                         byEndpoint:
 *                           type: object
 *                           description: API calls breakdown by endpoint
 *                           example: { "/api/conversations": 500, "/api/documents": 750 }
 *                     storage:
 *                       type: object
 *                       properties:
 *                         totalDocuments:
 *                           type: integer
 *                           description: Total number of documents
 *                           example: 45
 *                         totalSize:
 *                           type: integer
 *                           description: Total storage size in bytes
 *                           example: 15728640
 *                         averageSize:
 *                           type: integer
 *                           description: Average document size in bytes
 *                           example: 349525
 *                     processing:
 *                       type: object
 *                       properties:
 *                         totalJobs:
 *                           type: integer
 *                           description: Total processing jobs
 *                           example: 25
 *                         completedJobs:
 *                           type: integer
 *                           description: Successfully completed jobs
 *                           example: 23
 *                         failedJobs:
 *                           type: integer
 *                           description: Failed jobs
 *                           example: 2
 *                         averageProcessingTime:
 *                           type: number
 *                           description: Average processing time in seconds
 *                           example: 12.5
 *                     limits:
 *                       type: object
 *                       properties:
 *                         apiCallsPerMonth:
 *                           type: integer
 *                           description: Monthly API call limit
 *                           example: 10000
 *                         storageLimit:
 *                           type: integer
 *                           description: Storage limit in bytes
 *                           example: 1073741824
 *                         processingJobsPerMonth:
 *                           type: integer
 *                           description: Monthly processing job limit
 *                           example: 100
 *                     usagePercentage:
 *                       type: object
 *                       properties:
 *                         apiCalls:
 *                           type: number
 *                           description: API calls usage percentage
 *                           example: 12.5
 *                         storage:
 *                           type: number
 *                           description: Storage usage percentage
 *                           example: 1.5
 *                         processingJobs:
 *                           type: number
 *                           description: Processing jobs usage percentage
 *                           example: 25.0
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/:clientId/usage',
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.getClientUsage)
);

/**
 * @swagger
 * /api/clients/{clientId}/usage:
 *   put:
 *     summary: Update client usage
 *     description: Update client usage statistics. Requires API key authentication (own client only).
 *     tags: [Clients]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^clt_[a-zA-Z0-9]+$"
 *         description: Unique client identifier
 *         example: "clt_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               apiCalls:
 *                 type: object
 *                 description: API calls usage data
 *                 properties:
 *                   increment:
 *                   type: integer
 *                   description: Number to increment total API calls
 *                   example: 1
 *                   successful:
 *                     type: integer
 *                     description: Number to increment successful calls
 *                     example: 1
 *                   failed:
 *                     type: integer
 *                     description: Number to increment failed calls
 *                     example: 0
 *               storage:
 *                 type: object
 *                 description: Storage usage data
 *                 properties:
 *                   documentsAdded:
 *                     type: integer
 *                     description: Number of documents added
 *                     example: 2
 *                   documentsRemoved:
 *                     type: integer
 *                     description: Number of documents removed
 *                     example: 1
 *                   sizeAdded:
 *                     type: integer
 *                     description: Storage size added in bytes
 *                     example: 5242880
 *                   sizeRemoved:
 *                     type: integer
 *                     description: Storage size removed in bytes
 *                     example: 1048576
 *               processing:
 *                 type: object
 *                 description: Processing job data
 *                 properties:
 *                   jobsCompleted:
 *                     type: integer
 *                     description: Number of jobs completed
 *                     example: 3
 *                   jobsFailed:
 *                     type: integer
 *                     description: Number of jobs failed
 *                     example: 1
 *                   processingTime:
 *                     type: number
 *                     description: Total processing time in seconds
 *                     example: 45.2
 *     responses:
 *       200:
 *         description: Client usage updated successfully
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
 *                   example: "Client usage updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                       description: Client identifier
 *                       example: "clt_1234567890"
 *                     updatedFields:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Fields that were updated
 *                       example: ["apiCalls", "storage"]
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Update timestamp
 *                       example: "2024-01-15T14:30:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  '/:clientId/usage',
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.updateClientUsage)
);

export { router as clientRoutes };