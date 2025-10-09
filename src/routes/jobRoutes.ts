import { Router, RequestHandler } from 'express';
import { JobController } from '../controllers/jobController';
import {
  validateCreateJob,
  validateJobId,
  validateSessionId,
  validateUpdateJob,
  validateCancelJob,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation';
import { jobRateLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateSessionFromHeader } from '../middleware/sessionValidation';

const router = Router();

// Type helper to cast authenticated handlers
const authHandler = (handler: (req: AuthenticatedRequest, res: any) => Promise<void>): RequestHandler => {
  return handler as RequestHandler;
};

/**
 * @swagger
 * /api/jobs/health:
 *   get:
 *     summary: Job service health check
 *     description: Check the health status of the job service and its dependencies including queue status, processing metrics, and system resources
 *     tags: [Jobs]
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
 *                   example: "job-service"
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
 *                           example: 15
 *                     queue:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "healthy"
 *                         pendingJobs:
 *                           type: integer
 *                           example: 5
 *                         activeJobs:
 *                           type: integer
 *                           example: 2
 *                         failedJobs:
 *                           type: integer
 *                           example: 1
 *                     redis:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "healthy"
 *                         responseTime:
 *                           type: number
 *                           example: 3
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
 *                   example: "job-service"
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
 *                     queue:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "unhealthy"
 *                         error:
 *                           type: string
 *                           example: "Queue connection failed"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/health',
  JobController.healthCheck
);

// Apply job-specific rate limiting to all other routes
router.use(jobRateLimiter);

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Create a new job
 *     description: Create a new processing job for documents, conversations, or other tasks. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - priority
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [document_processing, conversation_analysis, tax_calculation, data_extraction, ocr, validation]
 *                 description: Type of job to create
 *                 example: "document_processing"
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 description: Job priority level
 *                 example: "normal"
 *               data:
 *                 type: object
 *                 description: Job-specific data and parameters
 *                 properties:
 *                   documentId:
 *                     type: string
 *                     description: Document ID for document processing jobs
 *                     example: "doc_1234567890"
 *                   conversationId:
 *                     type: string
 *                     description: Conversation ID for conversation analysis jobs
 *                     example: "conv_1234567890"
 *                   taxYear:
 *                     type: integer
 *                     description: Tax year for tax calculation jobs
 *                     example: 2024
 *                   formType:
 *                     type: string
 *                     description: Tax form type
 *                     example: "1040"
 *                   processingOptions:
 *                     type: object
 *                     description: Processing options and configuration
 *                     example: { "ocr": true, "extractTables": true, "validateData": true }
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for the job
 *                 example: { "source": "api", "clientReference": "ref_123" }
 *     responses:
 *       201:
 *         description: Job created successfully
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
 *                     jobId:
 *                       type: string
 *                       description: Unique job identifier
 *                       example: "job_1234567890"
 *                     type:
 *                       type: string
 *                       description: Job type
 *                       example: "document_processing"
 *                     status:
 *                       type: string
 *                       enum: [pending, queued, processing, completed, failed, cancelled]
 *                       description: Current job status
 *                       example: "pending"
 *                     priority:
 *                       type: string
 *                       description: Job priority
 *                       example: "normal"
 *                     data:
 *                       type: object
 *                       description: Job data
 *                     progress:
 *                       type: number
 *                       description: Job progress percentage
 *                       example: 0
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Job creation timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *                     estimatedCompletion:
 *                       type: string
 *                       format: date-time
 *                       description: Estimated completion time
 *                       example: "2024-01-15T10:35:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/',
  validateCreateJob,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.createJob))
);

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: Get jobs for authenticated session
 *     description: Retrieve jobs for the authenticated session with pagination, filtering, and sorting options. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: header
 *         name: X-Session-ID
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9_-]+$'
 *         description: Session identifier for authentication
 *         example: "session_1234567890"
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
 *         description: Number of jobs per page
 *         example: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, queued, processing, completed, failed, cancelled]
 *         description: Filter jobs by status
 *         example: "processing"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [document_processing, conversation_analysis, tax_calculation, data_extraction, ocr, validation]
 *         description: Filter jobs by job type
 *         example: "document_processing"
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *         description: Filter jobs by priority
 *         example: "high"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, priority, status, type]
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
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
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
 *                       jobId:
 *                         type: string
 *                         description: Job identifier
 *                         example: "job_1234567890"
 *                       sessionId:
 *                         type: string
 *                         description: Session identifier
 *                         example: "session_1234567890"
 *                       type:
 *                         type: string
 *                         description: Job type
 *                         example: "document_processing"
 *                       status:
 *                         type: string
 *                         description: Job status
 *                         example: "processing"
 *                       priority:
 *                         type: string
 *                         description: Job priority
 *                         example: "normal"
 *                       progress:
 *                         type: number
 *                         description: Job progress percentage
 *                         example: 45
 *                       data:
 *                         type: object
 *                         description: Job input data
 *                       result:
 *                         type: object
 *                         description: Job result data
 *                       error:
 *                         type: object
 *                         description: Error details if job failed
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Job creation timestamp
 *                         example: "2024-01-15T10:30:00Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Job update timestamp
 *                         example: "2024-01-15T10:35:00Z"
 *                       estimatedCompletion:
 *                         type: string
 *                         format: date-time
 *                         description: Estimated completion time
 *                         example: "2024-01-15T10:38:00Z"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       description: Current page number
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       description: Items per page
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       description: Total number of jobs
 *                       example: 45
 *                     totalPages:
 *                       type: integer
 *                       description: Total number of pages
 *                       example: 3
 *                     hasNext:
 *                       type: boolean
 *                       description: Whether next page exists
 *                       example: true
 *                     hasPrev:
 *                       type: boolean
 *                       description: Whether previous page exists
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
  validateSessionFromHeader,
  asyncHandler(authHandler(JobController.getJobsForSession))
);

/**
 * @swagger
 * /api/jobs/stats:
 *   get:
 *     summary: Get detailed job statistics
 *     description: Retrieve comprehensive statistics about jobs including counts by status, type, priority, processing metrics, and time-based analytics. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: header
 *         name: X-Session-ID
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9_-]+$'
 *         description: Session identifier for authentication
 *         example: "session_1234567890"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter statistics from this date (ISO 8601)
 *         example: "2024-01-01T00:00:00Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter statistics until this date (ISO 8601)
 *         example: "2024-01-31T23:59:59Z"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [document_processing, conversation_analysis, tax_calculation, data_extraction, ocr, validation]
 *         description: Filter statistics by job type
 *         example: "document_processing"
 *     responses:
 *       200:
 *         description: Job statistics retrieved successfully
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
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalJobs:
 *                           type: integer
 *                           description: Total number of jobs
 *                           example: 1250
 *                         activeJobs:
 *                           type: integer
 *                           description: Currently active jobs
 *                           example: 15
 *                         completedJobs:
 *                           type: integer
 *                           description: Completed jobs
 *                           example: 1000
 *                         failedJobs:
 *                           type: integer
 *                           description: Failed jobs
 *                           example: 200
 *                         cancelledJobs:
 *                           type: integer
 *                           description: Cancelled jobs
 *                           example: 35
 *                     byStatus:
 *                       type: object
 *                       description: Job counts by status
 *                       properties:
 *                         pending:
 *                           type: integer
 *                           example: 50
 *                         queued:
 *                           type: integer
 *                           example: 25
 *                         processing:
 *                           type: integer
 *                           example: 15
 *                         completed:
 *                           type: integer
 *                           example: 1000
 *                         failed:
 *                           type: integer
 *                           example: 200
 *                         cancelled:
 *                           type: integer
 *                           example: 35
 *                     byType:
 *                       type: object
 *                       description: Job counts by type
 *                       properties:
 *                         document_processing:
 *                           type: integer
 *                           example: 500
 *                         conversation_analysis:
 *                           type: integer
 *                           example: 300
 *                         tax_calculation:
 *                           type: integer
 *                           example: 200
 *                         data_extraction:
 *                           type: integer
 *                           example: 150
 *                         ocr:
 *                           type: integer
 *                           example: 75
 *                         validation:
 *                           type: integer
 *                           example: 25
 *                     byPriority:
 *                       type: object
 *                       description: Job counts by priority
 *                       properties:
 *                         low:
 *                           type: integer
 *                           example: 200
 *                         normal:
 *                           type: integer
 *                           example: 800
 *                         high:
 *                           type: integer
 *                           example: 200
 *                         urgent:
 *                           type: integer
 *                           example: 50
 *                     processingMetrics:
 *                       type: object
 *                       properties:
 *                         averageProcessingTime:
 *                           type: number
 *                           description: Average processing time in seconds
 *                           example: 125.5
 *                         averageQueueTime:
 *                           type: number
 *                           description: Average queue time in seconds
 *                           example: 15.2
 *                         successRate:
 *                           type: number
 *                           description: Success rate percentage
 *                           example: 83.3
 *                         averageRetries:
 *                           type: number
 *                           description: Average number of retries per job
 *                           example: 0.5
 *                     timeRange:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *                           description: Statistics start date
 *                           example: "2024-01-01T00:00:00Z"
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *                           description: Statistics end date
 *                           example: "2024-01-31T23:59:59Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/stats',
  validateSessionFromHeader,
  asyncHandler(authHandler(JobController.getJobStats))
);

/**
 * @swagger
 * /api/jobs/queue/stats:
 *   get:
 *     summary: Get job queue statistics
 *     description: Retrieve detailed statistics about the job queue including pending jobs, processing capacity, queue performance metrics, and worker status. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Queue statistics retrieved successfully
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
 *                     queueStatus:
 *                       type: object
 *                       properties:
 *                         pendingJobs:
 *                           type: integer
 *                           description: Number of jobs waiting in queue
 *                           example: 25
 *                         processingJobs:
 *                           type: integer
 *                           description: Number of jobs currently being processed
 *                           example: 8
 *                         completedJobs:
 *                           type: integer
 *                           description: Number of jobs completed in the last 24 hours
 *                           example: 450
 *                         failedJobs:
 *                           type: integer
 *                           description: Number of jobs failed in the last 24 hours
 *                           example: 15
 *                     capacityMetrics:
 *                       type: object
 *                       properties:
 *                         maxConcurrentJobs:
 *                           type: integer
 *                           description: Maximum number of concurrent jobs
 *                           example: 20
 *                         currentUtilization:
 *                           type: number
 *                           description: Current utilization percentage
 *                           example: 40
 *                         availableSlots:
 *                           type: integer
 *                           description: Available processing slots
 *                           example: 12
 *                     performanceMetrics:
 *                       type: object
 *                       properties:
 *                         averageQueueTime:
 *                           type: number
 *                           description: Average time jobs spend in queue (seconds)
 *                           example: 45.2
 *                         throughputPerHour:
 *                           type: integer
 *                           description: Average jobs processed per hour
 *                           example: 75
 *                         queueGrowthRate:
 *                           type: number
 *                           description: Queue growth rate (jobs per minute)
 *                           example: 2.5
 *                     priorityDistribution:
 *                       type: object
 *                       description: Jobs distribution by priority
 *                       properties:
 *                         low:
 *                           type: integer
 *                           example: 5
 *                         normal:
 *                           type: integer
 *                           example: 15
 *                         high:
 *                           type: integer
 *                           example: 8
 *                         urgent:
 *                           type: integer
 *                           example: 2
 *                     workerStatus:
 *                       type: array
 *                       description: Status of individual workers
 *                       items:
 *                         type: object
 *                         properties:
 *                           workerId:
 *                             type: string
 *                             description: Worker identifier
 *                             example: "worker_123"
 *                           status:
 *                             type: string
 *                             description: Worker status
 *                             example: "active"
 *                           currentJob:
 *                             type: string
 *                             description: ID of job being processed
 *                             example: "job_1234567890"
 *                           jobsProcessed:
 *                             type: integer
 *                             description: Total jobs processed by this worker
 *                             example: 125
 *                           lastActivity:
 *                             type: string
 *                             format: date-time
 *                             description: Last worker activity timestamp
 *                             example: "2024-01-15T10:35:00Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/queue/stats',
  asyncHandler(authHandler(JobController.getQueueStats))
);

/**
 * @swagger
 * /api/jobs/{jobId}:
 *   get:
 *     summary: Get job by ID
 *     description: Retrieve detailed information about a specific job by its ID. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^job_[a-zA-Z0-9_-]+$'
 *         description: Job identifier
 *         example: "job_1234567890"
 *       - in: header
 *         name: X-Session-ID
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9_-]+$'
 *         description: Session identifier for additional validation
 *         example: "session_1234567890"
 *     responses:
 *       200:
 *         description: Job retrieved successfully
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
 *                     jobId:
 *                       type: string
 *                       description: Job identifier
 *                       example: "job_1234567890"
 *                     sessionId:
 *                       type: string
 *                       description: Session identifier
 *                       example: "session_1234567890"
 *                     type:
 *                       type: string
 *                       enum: [document_processing, conversation_analysis, tax_calculation, data_extraction, ocr, validation]
 *                       description: Job type
 *                       example: "document_processing"
 *                     status:
 *                       type: string
 *                       enum: [pending, queued, processing, completed, failed, cancelled]
 *                       description: Current job status
 *                       example: "processing"
 *                     priority:
 *                       type: string
 *                       enum: [low, normal, high, urgent]
 *                       description: Job priority
 *                       example: "normal"
 *                     progress:
 *                       type: number
 *                       description: Job progress percentage (0-100)
 *                       example: 45
 *                     data:
 *                       type: object
 *                       description: Job input data
 *                       example: { "documentId": "doc_123", "processingOptions": { "ocr": true } }
 *                     result:
 *                       type: object
 *                       description: Job result data (only present for completed jobs)
 *                       properties:
 *                         extractedText:
 *                           type: string
 *                           description: Extracted text content
 *                           example: "Tax document content..."
 *                         confidence:
 *                           type: number
 *                           description: Processing confidence score
 *                           example: 0.95
 *                         metadata:
 *                           type: object
 *                           description: Result metadata
 *                           example: { "pages": 5, "processingTime": 120 }
 *                     error:
 *                       type: object
 *                       description: Error details (only present for failed jobs)
 *                       properties:
 *                         message:
 *                           type: string
 *                           description: Error message
 *                           example: "Processing failed due to invalid document format"
 *                         code:
 *                           type: string
 *                           description: Error code
 *                           example: "INVALID_DOCUMENT_FORMAT"
 *                         stack:
 *                           type: string
 *                           description: Error stack trace
 *                           example: "Error: Invalid document format\n    at processDocument..."
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Job creation timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Job update timestamp
 *                       example: "2024-01-15T10:35:00Z"
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Job start timestamp
 *                       example: "2024-01-15T10:31:00Z"
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Job completion timestamp
 *                       example: "2024-01-15T10:36:00Z"
 *                     estimatedCompletion:
 *                       type: string
 *                       format: date-time
 *                       description: Estimated completion time
 *                       example: "2024-01-15T10:38:00Z"
 *                     processingTime:
 *                       type: integer
 *                       description: Actual processing time in seconds
 *                       example: 300
 *                     queueTime:
 *                       type: integer
 *                       description: Time spent in queue in seconds
 *                       example: 60
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
  '/:jobId',
  validateJobId,
  handleValidationErrors,
  validateSessionFromHeader,
  asyncHandler(authHandler(JobController.getJob))
);

/**
 * @swagger
 * /api/jobs/session/{sessionId}:
 *   get:
 *     summary: Get jobs for a session
 *     description: Retrieve all jobs associated with a specific session. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9_-]+$'
 *         description: Session identifier
 *         example: "session_1234567890"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, queued, processing, completed, failed, cancelled]
 *         description: Filter jobs by status
 *         example: "processing"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [document_processing, conversation_analysis, tax_calculation, data_extraction, ocr, validation]
 *         description: Filter jobs by job type
 *         example: "document_processing"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of jobs to return
 *         example: 25
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of jobs to skip
 *         example: 0
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, priority, status, type]
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
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
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
 *                       jobId:
 *                         type: string
 *                         description: Job identifier
 *                         example: "job_1234567890"
 *                       sessionId:
 *                         type: string
 *                         description: Session identifier
 *                         example: "session_1234567890"
 *                       type:
 *                         type: string
 *                         description: Job type
 *                         example: "document_processing"
 *                       status:
 *                         type: string
 *                         enum: [pending, queued, processing, completed, failed, cancelled]
 *                         description: Job status
 *                         example: "processing"
 *                       priority:
 *                         type: string
 *                         description: Job priority
 *                         example: "normal"
 *                       progress:
 *                         type: number
 *                         description: Job progress percentage
 *                         example: 45
 *                       data:
 *                         type: object
 *                         description: Job data
 *                       result:
 *                         type: object
 *                         description: Job result data
 *                       error:
 *                         type: object
 *                         properties:
 *                           message:
 *                             type: string
 *                             description: Error message
 *                             example: "Processing failed"
 *                           code:
 *                             type: string
 *                             description: Error code
 *                             example: "PROCESSING_ERROR"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Job creation timestamp
 *                         example: "2024-01-15T10:30:00Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Job update timestamp
 *                         example: "2024-01-15T10:35:00Z"
 *                       startedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Job start timestamp
 *                         example: "2024-01-15T10:31:00Z"
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Job completion timestamp
 *                         example: "2024-01-15T10:36:00Z"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of jobs
 *                       example: 15
 *                     limit:
 *                       type: integer
 *                       description: Items per page
 *                       example: 25
 *                     offset:
 *                       type: integer
 *                       description: Current offset
 *                       example: 0
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether more jobs are available
 *                       example: false
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
  '/session/:sessionId',
  validateSessionId,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.getJobsBySession))
);

/**
 * @swagger
 * /api/jobs/{jobId}/status:
 *   put:
 *     summary: Update job status
 *     description: Update the status of a specific job. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^job_[a-zA-Z0-9_-]+$'
 *         description: Job identifier
 *         example: "job_1234567890"
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
 *                 enum: [pending, queued, processing, completed, failed, cancelled]
 *                 description: New job status
 *                 example: "processing"
 *               result:
 *                 type: object
 *                 description: Job result data (for completed status)
 *                 properties:
 *                   extractedText:
 *                     type: string
 *                     description: Extracted text content
 *                     example: "Tax document content..."
 *                   confidence:
 *                     type: number
 *                     description: Processing confidence score
 *                     example: 0.95
 *                   metadata:
 *                     type: object
 *                     description: Result metadata
 *                     example: { "pages": 5, "processingTime": 120 }
 *               error:
 *                 type: object
 *                 description: Error details (for failed status)
 *                 properties:
 *                   message:
 *                     type: string
 *                     description: Error message
 *                     example: "Processing failed due to invalid document format"
 *                   code:
 *                     type: string
 *                     description: Error code
 *                     example: "INVALID_DOCUMENT_FORMAT"
 *                   stack:
 *                     type: string
 *                     description: Error stack trace
 *                     example: "Error: Invalid document format\n    at processDocument..."
 *     responses:
 *       200:
 *         description: Job status updated successfully
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
 *                     jobId:
 *                       type: string
 *                       description: Job identifier
 *                       example: "job_1234567890"
 *                     status:
 *                       type: string
 *                       enum: [pending, queued, processing, completed, failed, cancelled]
 *                       description: Updated job status
 *                       example: "processing"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Job update timestamp
 *                       example: "2024-01-15T10:35:00Z"
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
  '/:jobId/status',
  validateJobId,
  validateUpdateJob,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.updateJobStatus))
);

/**
 * @swagger
 * /api/jobs/{jobId}/progress:
 *   put:
 *     summary: Update job progress
 *     description: Update the progress percentage of a specific job. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^job_[a-zA-Z0-9_-]+$'
 *         description: Job identifier
 *         example: "job_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - progress
 *             properties:
 *               progress:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Job progress percentage
 *                 example: 75
 *               message:
 *                 type: string
 *                 description: Progress message or description
 *                 example: "Processing page 3 of 4..."
 *               details:
 *                 type: object
 *                 description: Additional progress details
 *                 properties:
 *                   currentStep:
 *                     type: string
 *                     description: Current processing step
 *                     example: "ocr_extraction"
 *                   totalSteps:
 *                     type: integer
 *                     description: Total number of steps
 *                     example: 4
 *                   currentItem:
 *                     type: integer
 *                     description: Current item being processed
 *                     example: 3
 *                   totalItems:
 *                     type: integer
 *                     description: Total number of items
 *                     example: 10
 *     responses:
 *       200:
 *         description: Job progress updated successfully
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
 *                     jobId:
 *                       type: string
 *                       description: Job identifier
 *                       example: "job_1234567890"
 *                     progress:
 *                       type: number
 *                       description: Updated progress percentage
 *                       example: 75
 *                     message:
 *                       type: string
 *                       description: Progress message
 *                       example: "Processing page 3 of 4..."
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Job update timestamp
 *                       example: "2024-01-15T10:35:00Z"
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
  '/:jobId/progress',
  validateJobId,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.updateJobProgress))
);

/**
 * @swagger
 * /api/jobs/{jobId}/cancel:
 *   post:
 *     summary: Cancel a job
 *     description: Cancel a specific job that is currently pending, queued, or processing. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^job_[a-zA-Z0-9_-]+$'
 *         description: Job identifier
 *         example: "job_1234567890"
 *       - in: header
 *         name: X-Session-ID
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9_-]+$'
 *         description: Session identifier for additional validation
 *         example: "session_1234567890"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *                 example: "User requested cancellation"
 *               force:
 *                 type: boolean
 *                 description: Force cancellation even if job is processing
 *                 example: false
 *     responses:
 *       200:
 *         description: Job cancelled successfully
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
 *                     jobId:
 *                       type: string
 *                       description: Job identifier
 *                       example: "job_1234567890"
 *                     status:
 *                       type: string
 *                       enum: [cancelled]
 *                       description: Updated job status
 *                       example: "cancelled"
 *                     cancelledAt:
 *                       type: string
 *                       format: date-time
 *                       description: Cancellation timestamp
 *                       example: "2024-01-15T10:35:00Z"
 *                     reason:
 *                       type: string
 *                       description: Cancellation reason
 *                       example: "User requested cancellation"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Job cannot be cancelled (already completed or failed)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: "JOB_NOT_CANCELLABLE"
 *                 message: "Job cannot be cancelled as it is already completed"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/:jobId/cancel',
  validateJobId,
  validateSessionFromHeader,
  asyncHandler(authHandler(JobController.cancelJob))
);

/**
 * @swagger
 * /api/jobs/{jobId}/retry:
 *   post:
 *     summary: Retry a failed job
 *     description: Retry a job that has previously failed. Creates a new job with the same parameters. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^job_[a-zA-Z0-9_-]+$'
 *         description: Job identifier of the failed job to retry
 *         example: "job_1234567890"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 description: Priority for the retried job (overrides original priority)
 *                 example: "high"
 *               resetProgress:
 *                 type: boolean
 *                 description: "Whether to reset progress to 0% (default: true)"
 *                 example: true
 *               retryOptions:
 *                 type: object
 *                 description: Retry-specific options
 *                 properties:
 *                   maxRetries:
 *                     type: integer
 *                     description: Maximum number of retry attempts
 *                     example: 3
 *                   retryDelay:
 *                     type: integer
 *                     description: Delay in seconds before retrying
 *                     example: 60
 *                   backoffMultiplier:
 *                     type: number
 *                     description: Backoff multiplier for retry delays
 *                     example: 2
 *     responses:
 *       201:
 *         description: Job retried successfully
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
 *                     originalJobId:
 *                       type: string
 *                       description: Original job identifier
 *                       example: "job_1234567890"
 *                     newJobId:
 *                       type: string
 *                       description: New job identifier for the retry
 *                       example: "job_0987654321"
 *                     status:
 *                       type: string
 *                       enum: [pending, queued, processing, completed, failed, cancelled]
 *                       description: New job status
 *                       example: "pending"
 *                     priority:
 *                       type: string
 *                       description: Job priority
 *                       example: "high"
 *                     retryCount:
 *                       type: integer
 *                       description: Number of times this job has been retried
 *                       example: 1
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: New job creation timestamp
 *                       example: "2024-01-15T10:40:00Z"
 *                     estimatedCompletion:
 *                       type: string
 *                       format: date-time
 *                       description: Estimated completion time
 *                       example: "2024-01-15T10:45:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Job cannot be retried (not in failed state)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: "JOB_NOT_RETRYABLE"
 *                 message: "Only failed jobs can be retried"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/:jobId/retry',
  validateJobId,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.retryJob))
);

/**
 * @swagger
 * /api/jobs/{jobId}/logs:
 *   post:
 *     summary: Add log entry to job
 *     description: Add a log entry to track job execution details, errors, or progress information. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^job_[a-zA-Z0-9_-]+$'
 *         description: Job identifier
 *         example: "job_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - level
 *               - message
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [debug, info, warn, error, critical]
 *                 description: Log level
 *                 example: "info"
 *               message:
 *                 type: string
 *                 description: Log message
 *                 example: "Started processing document page 3"
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Log timestamp (defaults to current time if not provided)
 *                 example: "2024-01-15T10:35:00Z"
 *               context:
 *                 type: object
 *                 description: Additional context data
 *                 properties:
 *                   step:
 *                     type: string
 *                     description: Current processing step
 *                     example: "ocr_extraction"
 *                   page:
 *                     type: integer
 *                     description: Current page number
 *                     example: 3
 *                   file:
 *                     type: string
 *                     description: File being processed
 *                     example: "document.pdf"
 *                   memory:
 *                     type: number
 *                     description: Memory usage in MB
 *                     example: 256
 *                   duration:
 *                     type: number
 *                     description: Duration in milliseconds
 *                     example: 1500
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *                 example: { "source": "worker", "workerId": "worker_123" }
 *     responses:
 *       201:
 *         description: Log entry added successfully
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
 *                     logId:
 *                       type: string
 *                       description: Log entry identifier
 *                       example: "log_1234567890"
 *                     jobId:
 *                       type: string
 *                       description: Job identifier
 *                       example: "job_1234567890"
 *                     level:
 *                       type: string
 *                       enum: [debug, info, warn, error, critical]
 *                       description: Log level
 *                       example: "info"
 *                     message:
 *                       type: string
 *                       description: Log message
 *                       example: "Started processing document page 3"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       description: Log timestamp
 *                       example: "2024-01-15T10:35:00Z"
 *                     context:
 *                       type: object
 *                       description: Log context data
 *                     metadata:
 *                       type: object
 *                       description: Log metadata
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
  '/:jobId/logs',
  validateJobId,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.addJobLog))
);

/**
 * @swagger
 * /api/jobs/{jobId}/logs:
 *   get:
 *     summary: Get job logs
 *     description: Retrieve log entries for a specific job, with pagination support. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^job_[a-zA-Z0-9_-]+$'
 *         description: Job identifier
 *         example: "job_1234567890"
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [debug, info, warn, error, critical]
 *         description: Filter logs by level
 *         example: "error"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Maximum number of log entries to return
 *         example: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of log entries to skip
 *         example: 0
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs from this timestamp (ISO 8601)
 *         example: "2024-01-15T10:00:00Z"
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs until this timestamp (ISO 8601)
 *         example: "2024-01-15T11:00:00Z"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order for log entries
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Job logs retrieved successfully
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
 *                       logId:
 *                         type: string
 *                         description: Log entry identifier
 *                         example: "log_1234567890"
 *                       jobId:
 *                         type: string
 *                         description: Job identifier
 *                         example: "job_1234567890"
 *                       level:
 *                         type: string
 *                         enum: [debug, info, warn, error, critical]
 *                         description: Log level
 *                         example: "info"
 *                       message:
 *                         type: string
 *                         description: Log message
 *                         example: "Started processing document page 3"
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         description: Log timestamp
 *                         example: "2024-01-15T10:35:00Z"
 *                       context:
 *                         type: object
 *                         description: Log context data
 *                         properties:
 *                           step:
 *                             type: string
 *                             description: Processing step
 *                             example: "ocr_extraction"
 *                           page:
 *                             type: integer
 *                             description: Page number
 *                             example: 3
 *                           memory:
 *                             type: number
 *                             description: Memory usage in MB
 *                             example: 256
 *                       metadata:
 *                         type: object
 *                         description: Log metadata
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of log entries
 *                       example: 150
 *                     limit:
 *                       type: integer
 *                       description: Items per page
 *                       example: 50
 *                     offset:
 *                       type: integer
 *                       description: Current offset
 *                       example: 0
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether more log entries are available
 *                       example: true
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
  '/:jobId/logs',
  validateJobId,
  validatePagination,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.getJobLogs))
);

/**
 * @swagger
 * /api/jobs/cleanup:
 *   post:
 *     summary: Clean up completed jobs
 *     description: Clean up completed jobs that are older than specified number of days. Can perform a dry run to see what would be deleted. Requires API key authentication.
 *     tags: [Jobs]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               olderThanDays:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 default: 7
 *                 description: Delete jobs older than this many days
 *                 example: 30
 *               maxJobs:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10000
 *                 default: 1000
 *                 description: Maximum number of jobs to delete in one operation
 *                 example: 500
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *                 description: If true, only count jobs that would be deleted without actually deleting them
 *                 example: true
 *     responses:
 *       200:
 *         description: Jobs cleaned up successfully
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
 *                     totalDeleted:
 *                       type: integer
 *                       description: Number of jobs deleted
 *                       example: 250
 *                     dryRun:
 *                       type: boolean
 *                       description: Whether this was a dry run
 *                       example: false
 *                     deletedJobs:
 *                       type: array
 *                       description: IDs of deleted jobs (only if dryRun is false)
 *                       items:
 *                         type: string
 *                         example: "job_1234567890"
 *                     wouldDelete:
 *                       type: array
 *                       description: IDs of jobs that would be deleted (only if dryRun is true)
 *                       items:
 *                         type: string
 *                         example: "job_1234567890"
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalJobs:
 *                           type: integer
 *                           description: Total jobs found matching criteria
 *                           example: 350
 *                         eligibleJobs:
 *                           type: integer
 *                           description: Jobs eligible for deletion
 *                           example: 250
 *                         protectedJobs:
 *                           type: integer
 *                           description: Jobs protected from deletion (too recent, in progress, etc.)
 *                           example: 100
 *                         oldestJobDate:
 *                           type: string
 *                           format: date-time
 *                           description: Date of oldest job found
 *                           example: "2024-01-01T00:00:00Z"
 *                         newestJobDate:
 *                           type: string
 *                           format: date-time
 *                           description: Date of newest job found
 *                           example: "2024-01-15T23:59:59Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/cleanup',
  asyncHandler(authHandler(JobController.cleanupCompletedJobs))
);

/**
 * @route   POST /api/jobs/queue/cleanup
 * @desc    Clean up completed jobs
 * @access  Private (API Key required)
 */
router.post(
  '/queue/cleanup',
  asyncHandler(authHandler(JobController.cleanupCompletedJobs))
);

/**
 * @route   DELETE /api/jobs/:jobId
 * @desc    Delete job
 * @access  Private (API Key required)
 */
router.delete(
  '/:jobId',
  validateJobId,
  validateSessionFromHeader,
  asyncHandler(authHandler(JobController.deleteJob))
);

export { router as jobRoutes };