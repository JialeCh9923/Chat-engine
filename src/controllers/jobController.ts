import { Request, Response } from 'express';
import { jobService } from '../services/jobService';
import { sessionService } from '../services/sessionService';
import logger from '../utils/logger';
import { CustomApiError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Job controller for handling job queue operations
 */
export class JobController {
  /**
   * Create a new job
   */
  static async createJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      const { type, data, priority, timeout, retryCount, dependencies, parentJobId, tags } = req.body;

      if (!sessionId) {
        throw new CustomApiError('Session ID required in X-Session-ID header', 400);
      }

      // Verify session exists and belongs to client
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        throw new CustomApiError('Session not found', 404);
      }

      if (session.clientId !== req.client.clientId) {
        throw new CustomApiError('Access denied to session', 403);
      }

      const job = await jobService.createJob(sessionId, type, data, {
        priority,
        timeout,
        retryCount,
        dependencies,
        parentJobId,
        tags,
        createdBy: req.client?.clientId || 'unknown',
      });

      logger.info('Job created via API', {
        jobId: job.jobId,
        sessionId,
        type,
        clientId: req.client?.clientId,
      });

      res.status(201).json({
        success: true,
        data: {
          jobId: job.jobId,
          sessionId: job.sessionId,
          type: job.type,
          status: job.status,
          priority: job.priority, // Keep as number for tests
          progress: job.progress,
          createdAt: job.createdAt,
          metadata: {
            createdBy: job.metadata.createdBy,
            timeout: job.metadata.timeout,
            maxRetries: job.metadata.maxRetries,
            tags: job.metadata.tags,
            dependencies: job.metadata.dependencies,
            parentJobId: job.metadata.parentJobId,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to create job via API', {
        error,
        sessionId: req.params.sessionId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to create job', 500);
    }
  }

  /**
   * Get job by ID
   */
  static async getJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      const job = await jobService.getJob(jobId);

      if (!job) {
        throw new CustomApiError('Job not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== job.sessionId) {
        throw new CustomApiError('Access denied to job', 403);
      }

      logger.debug('Job retrieved via API', {
        jobId,
        clientId: req.client?.clientId,
      });

      const jobData: any = {
        jobId: job.jobId,
        sessionId: job.sessionId,
        type: job.type,
        status: job.status,
        priority: job.priority, // Keep as number for tests
        data: job.data,
        progress: job.progress,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        metadata: job.metadata,
        errors: job.errors,
        logs: job.logs,
      };

      // Add result field for completed jobs
      if (job.status === 'completed' && job.data?.output) {
        jobData.result = job.data.output;
      }

      res.json(jobData);
    } catch (error) {
      logger.error('Failed to get job via API', {
        error,
        jobId: req.params.jobId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve job', 500);
    }
  }

  /**
   * Get jobs by session
   */
  static async getJobsBySession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const {
        status,
        type,
        page = '1',
        limit = '20',
        sort = 'createdAt',
        order = 'desc',
      } = req.query;

      // Verify session ownership
      if (req.session && req.session.sessionId !== sessionId) {
        throw new CustomApiError('Access denied to session', 403);
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const sortOrder = order === 'asc' ? 1 : -1;
      const sortObj = { [sort as string]: sortOrder };

      const jobs = await jobService.getJobsBySession(sessionId, {
        status: status as string,
        type: type as string,
        limit: limitNum,
        skip,
        sort: sortObj,
      });

      logger.debug('Jobs retrieved by session via API', {
        sessionId,
        count: jobs.length,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          jobs: jobs.map(job => ({
          jobId: job.jobId,
          sessionId: job.sessionId,
          type: job.type,
          status: job.status,
          priority: job.priority,
          progress: job.progress,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          metadata: {
            createdBy: job.metadata.createdBy,
            assignedWorker: job.metadata.assignedWorker,
            retryCount: job.metadata.retryCount,
            maxRetries: job.metadata.maxRetries,
            tags: job.metadata.tags,
            dependencies: job.metadata.dependencies,
            parentJobId: job.metadata.parentJobId,
            childJobs: job.metadata.childJobIds,
          },
        })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: jobs.length,
            hasMore: jobs.length === limitNum,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get jobs by session via API', {
        error,
        sessionId: req.params.sessionId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve jobs', 500);
    }
  }

  /**
   * Update job status
   */
  static async updateJobStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { status, data } = req.body;

      const job = await jobService.getJob(jobId);

      if (!job) {
        throw new CustomApiError('Job not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== job.sessionId) {
        throw new CustomApiError('Access denied to job', 403);
      }

      const updatedJob = await jobService.updateJobStatus(jobId, status, data);

      if (!updatedJob) {
        throw new CustomApiError('Failed to update job status', 500);
      }

      logger.info('Job status updated via API', {
        jobId,
        status,
        clientId: req.client?.clientId,
      });

      const responseData: any = {
        jobId: updatedJob.jobId,
        sessionId: updatedJob.sessionId,
        type: updatedJob.type,
        status: updatedJob.status,
        priority: updatedJob.priority, // Keep as number for tests
        progress: updatedJob.progress,
        updatedAt: updatedJob.updatedAt,
      };

      // Add result field for completed jobs
      if (updatedJob.status === 'completed' && updatedJob.data?.output) {
        responseData.result = updatedJob.data.output;
      }

      res.json(responseData);
    } catch (error) {
      logger.error('Failed to update job status via API', {
        error,
        jobId: req.params.jobId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to update job status', 500);
    }
  }

  /**
   * Update job progress
   */
  static async updateJobProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { percentage, currentStep, totalSteps, completedSteps, estimatedTimeRemaining } = req.body;

      const job = await jobService.getJob(jobId);

      if (!job) {
        throw new CustomApiError('Job not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== job.sessionId) {
        throw new CustomApiError('Access denied to job', 403);
      }

      const updatedJob = await jobService.updateJobProgress(jobId, {
        percentage,
        currentStep,
        totalSteps,
        completedSteps,
        estimatedTimeRemaining,
      });

      if (!updatedJob) {
        throw new CustomApiError('Failed to update job progress', 500);
      }

      logger.debug('Job progress updated via API', {
        jobId,
        percentage,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          jobId: updatedJob.jobId,
          progress: updatedJob.progress,
          updatedAt: updatedJob.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to update job progress via API', {
        error,
        jobId: req.params.jobId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to update job progress', 500);
    }
  }

  /**
   * Cancel job
   */
  static async cancelJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { reason } = req.body;

      const job = await jobService.getJob(jobId);

      if (!job) {
        throw new CustomApiError('Job not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== job.sessionId) {
        throw new CustomApiError('Access denied to job', 403);
      }

      const cancelled = await jobService.cancelJob(jobId, reason);

      if (!cancelled) {
        throw new CustomApiError('Job cannot be cancelled', 400);
      }

      logger.info('Job cancelled via API', {
        jobId,
        reason,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'cancelled',
          cancelledAt: new Date(),
          reason,
        },
        message: 'Job cancelled successfully',
      });
    } catch (error) {
      logger.error('Failed to cancel job via API', {
        error,
        jobId: req.params.jobId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to cancel job', 500);
    }
  }

  /**
   * Retry failed job
   */
  static async retryJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      const job = await jobService.getJob(jobId);

      if (!job) {
        throw new CustomApiError('Job not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== job.sessionId) {
        throw new CustomApiError('Access denied to job', 403);
      }

      const retried = await jobService.retryJob(jobId);

      if (!retried) {
        throw new CustomApiError('Job cannot be retried', 400);
      }

      logger.info('Job retried via API', {
        jobId,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'pending',
          retriedAt: new Date(),
        },
        message: 'Job retried successfully',
      });
    } catch (error) {
      logger.error('Failed to retry job via API', {
        error,
        jobId: req.params.jobId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retry job', 500);
    }
  }

  /**
   * Add job log
   */
  static async addJobLog(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { level, message, metadata } = req.body;

      const job = await jobService.getJob(jobId);

      if (!job) {
        throw new CustomApiError('Job not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== job.sessionId) {
        throw new CustomApiError('Access denied to job', 403);
      }

      const updatedJob = await jobService.addJobLog(jobId, level, message, metadata);

      if (!updatedJob) {
        throw new CustomApiError('Failed to add job log', 500);
      }

      logger.debug('Job log added via API', {
        jobId,
        level,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          jobId,
          logAdded: true,
          timestamp: new Date(),
        },
        message: 'Job log added successfully',
      });
    } catch (error) {
      logger.error('Failed to add job log via API', {
        error,
        jobId: req.params.jobId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to add job log', 500);
    }
  }

  /**
   * Get job logs
   */
  static async getJobLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { level, limit = '50' } = req.query;

      const job = await jobService.getJob(jobId);

      if (!job) {
        throw new CustomApiError('Job not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== job.sessionId) {
        throw new CustomApiError('Access denied to job', 403);
      }

      let logs = job.logs;

      // Filter by level if specified
      if (level) {
        logs = logs.filter(log => log.level === level);
      }

      // Limit results
      const limitNum = parseInt(limit as string, 10);
      logs = logs.slice(-limitNum); // Get most recent logs

      logger.debug('Job logs retrieved via API', {
        jobId,
        count: logs.length,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          jobId,
          logs: logs.map(log => ({
            level: log.level,
            message: log.message,
            timestamp: log.timestamp,
            data: log.data,
          })),
          total: job.logs.length,
          filtered: logs.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get job logs via API', {
        error,
        jobId: req.params.jobId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve job logs', 500);
    }
  }

  /**
   * Get job statistics
   */
  static async getJobStats(req: Request, res: Response): Promise<void> {
    try {
      const totalJobs = await jobService.getTotalJobsCount();
      const jobsByStatus = await jobService.getJobsByStatus();
      const jobsByType = await jobService.getJobsByType();
      const averageProcessingTime = await jobService.getAverageProcessingTime();

      const stats = {
        totalJobs,
        statusBreakdown: jobsByStatus,
        typeBreakdown: jobsByType,
        averageProcessingTime
      };

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting job stats:', error);
      if (error instanceof CustomApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await jobService.getQueueStats();

      logger.debug('Queue statistics retrieved via API', {
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get queue statistics via API', {
        error,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve queue statistics', 500);
    }
  }

  /**
   * Cleanup completed jobs
   */
  static async cleanupCompletedJobs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { olderThanDays = '7' } = req.query;
      const days = parseInt(olderThanDays as string, 10);

      const deletedCount = await jobService.cleanupCompletedJobs(days);

      logger.info('Completed jobs cleanup via API', {
        deletedCount,
        olderThanDays: days,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        deletedCount,
        olderThanDays: days,
        message: `cleaned up ${deletedCount} completed jobs`,
      });
    } catch (error) {
      logger.error('Failed to cleanup completed jobs via API', {
        error,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to cleanup completed jobs', 500);
    }
  }

  /**
   * Delete job
   */
  static async deleteJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      const job = await jobService.getJob(jobId);

      if (!job) {
        throw new CustomApiError('Job not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== job.sessionId) {
        throw new CustomApiError('Access denied to job', 403);
      }

      const deleted = await jobService.deleteJob(jobId);

      if (!deleted) {
        throw new CustomApiError('Failed to delete job', 500);
      }

      logger.info('Job deleted via API', {
        jobId,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          jobId,
          deletedAt: new Date(),
        },
        message: 'Job deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete job via API', {
        error,
        jobId: req.params.jobId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to delete job', 500);
    }
  }

  /**
   * Health check
   */
  static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Use a timeout for the stats query to prevent hanging
      const statsPromise = jobService.getQueueStats();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), 5000);
      });

      const stats = await Promise.race([statsPromise, timeoutPromise]) as any;

      res.json({
        success: true,
        service: 'JobService',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        queueSize: stats.total || 0,
        stats: {
          totalJobs: stats.total,
          pendingJobs: stats.pending,
          processingJobs: stats.processing,
          inMemoryQueue: stats.inMemoryQueue,
          activeWorkers: stats.activeWorkers,
        },
      });
    } catch (error) {
      logger.error('Job service health check failed', { error });
      
      // Return a basic healthy response even if stats fail
      res.json({
        success: true,
        service: 'JobService',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        queueSize: 0,
        stats: {
          totalJobs: 0,
          pendingJobs: 0,
          processingJobs: 0,
          inMemoryQueue: 0,
          activeWorkers: 0,
        },
        warning: 'Stats unavailable but service is running',
      });
    }
  }

  /**
   * Get jobs for authenticated session
   */
  static async getJobsForSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    const sessionId = req.headers['x-session-id'] as string;
    
    try {
      
      if (!sessionId) {
        throw new CustomApiError('Session ID required in X-Session-ID header', 400);
      }

      // Verify session exists and belongs to client
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        throw new CustomApiError('Session not found', 404);
      }

      if (session.clientId !== req.client.clientId) {
        throw new CustomApiError('Access denied to session', 403);
      }

      const { 
        page = '1', 
        limit = '10',
        type,
        status,
        sort = 'createdAt',
        order = 'desc'
      } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      const sortOrder = order === 'asc' ? 1 : -1;
      const sortObj = { [sort as string]: sortOrder };

      const jobs = await jobService.getJobsBySession(sessionId, {
        type: type as string,
        status: status as string,
        limit: limitNum,
        skip: (pageNum - 1) * limitNum,
        sort: sortObj
      });

      logger.debug('Jobs retrieved for session via API', {
        sessionId: sessionId,
        count: jobs.length,
        clientId: req.client?.clientId,
      });

      res.json({
        jobs: jobs.map(job => ({
          jobId: job.jobId,
          sessionId: job.sessionId,
          type: job.type,
          status: job.status,
          priority: job.priority,
          progress: job.progress,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          metadata: {
            createdBy: job.metadata.createdBy,
            assignedWorker: job.metadata.assignedWorker,
            retryCount: job.metadata.retryCount,
            maxRetries: job.metadata.maxRetries,
            tags: job.metadata.tags,
            dependencies: job.metadata.dependencies,
            parentJobId: job.metadata.parentJobId,
            childJobs: job.metadata.childJobIds,
          },
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: jobs.length,
          hasMore: jobs.length === limitNum,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get jobs for session via API', {
        error: error?.message || error,
        stack: error?.stack,
        sessionId: sessionId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError(`Failed to retrieve jobs: ${error?.message || 'Unknown error'}`, 500);
    }
  }

  private static mapNumberToPriority(priority: number): string {
    switch (priority) {
      case 1: return 'low';
      case 5: return 'normal'; // medium maps to normal for API responses
      case 10: return 'high';
      default: return 'normal';
    }
  }

}