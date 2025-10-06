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
 * @route   GET /api/jobs/health
 * @desc    Job service health check
 * @access  Public (no rate limiting)
 */
router.get(
  '/health',
  JobController.healthCheck
);

// Apply job-specific rate limiting to all other routes
router.use(jobRateLimiter);

/**
 * @route   POST /api/jobs
 * @desc    Create a new job
 * @access  Private (API Key required)
 */
router.post(
  '/',
  validateCreateJob,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.createJob))
);

/**
 * @route   GET /api/jobs
 * @desc    Get jobs for authenticated session
 * @access  Private (API Key required)
 */
router.get(
  '/',
  validatePagination,
  validateSessionFromHeader,
  asyncHandler(authHandler(JobController.getJobsForSession))
);

/**
 * @route   GET /api/jobs/stats
 * @desc    Get detailed job statistics
 * @access  Private (API Key required)
 */
router.get(
  '/stats',
  validateSessionFromHeader,
  asyncHandler(authHandler(JobController.getJobStats))
);

/**
 * @route   GET /api/jobs/queue/stats
 * @desc    Get job queue statistics
 * @access  Private (API Key required)
 */
router.get(
  '/queue/stats',
  asyncHandler(authHandler(JobController.getQueueStats))
);

/**
 * @route   GET /api/jobs/:jobId
 * @desc    Get job by ID
 * @access  Private (API Key required)
 */
router.get(
  '/:jobId',
  validateJobId,
  handleValidationErrors,
  validateSessionFromHeader,
  asyncHandler(authHandler(JobController.getJob))
);

/**
 * @route   GET /api/jobs/session/:sessionId
 * @desc    Get jobs by session ID
 * @access  Private (API Key required)
 */
router.get(
  '/session/:sessionId',
  validateSessionId,
  validatePagination,
  asyncHandler(authHandler(JobController.getJobsBySession))
);

/**
 * @route   PUT /api/jobs/:jobId/status
 * @desc    Update job status
 * @access  Private (API Key required)
 */
router.put(
  '/:jobId/status',
  validateJobId,
  validateUpdateJob,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.updateJobStatus))
);

/**
 * @route   PUT /api/jobs/:jobId/progress
 * @desc    Update job progress
 * @access  Private (API Key required)
 */
router.put(
  '/:jobId/progress',
  validateJobId,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.updateJobProgress))
);

/**
 * @route   POST /api/jobs/:jobId/cancel
 * @desc    Cancel a job
 * @access  Private (API Key required)
 */
router.post(
  '/:jobId/cancel',
  validateJobId,
  validateSessionFromHeader,
  asyncHandler(authHandler(JobController.cancelJob))
);

/**
 * @route   POST /api/jobs/:jobId/retry
 * @desc    Retry a failed job
 * @access  Private (API Key required)
 */
router.post(
  '/:jobId/retry',
  validateJobId,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.retryJob))
);

/**
 * @route   POST /api/jobs/:jobId/logs
 * @desc    Add log entry to job
 * @access  Private (API Key required)
 */
router.post(
  '/:jobId/logs',
  validateJobId,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.addJobLog))
);

/**
 * @route   GET /api/jobs/:jobId/logs
 * @desc    Get job logs
 * @access  Private (API Key required)
 */
router.get(
  '/:jobId/logs',
  validateJobId,
  validatePagination,
  handleValidationErrors,
  asyncHandler(authHandler(JobController.getJobLogs))
);

/**
 * @route   POST /api/jobs/cleanup
 * @desc    Clean up completed jobs
 * @access  Private (API Key required)
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