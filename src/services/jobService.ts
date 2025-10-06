import Job, { IJobDocument } from '../models/Job';
import logger from '../utils/logger';
import { AuthUtils } from '../utils/auth';
import { EventEmitter } from 'events';

/**
 * Job queue service for background processing
 */
export class JobService extends EventEmitter {
  private static instance: JobService;
  private jobQueue: Map<string, IJobDocument> = new Map();
  private workers: Map<string, NodeJS.Timeout> = new Map();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly maxConcurrentJobs = 5;
  private readonly processingIntervalMs = 1000; // 1 second

  constructor() {
    super();
    this.startProcessing();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  /**
   * Initialize the job service
   */
  async initialize(): Promise<void> {
    try {
      // Load pending jobs from database into memory queue
      const pendingJobs = await Job.find({ status: 'pending' });
      for (const job of pendingJobs) {
        this.jobQueue.set(job.jobId, job);
      }

      // Cleanup old completed jobs
      await this.cleanupCompletedJobs(7);

      logger.info('Job service initialized successfully', {
        pendingJobs: pendingJobs.length,
        queueSize: this.jobQueue.size,
      });
    } catch (error) {
      logger.error('Failed to initialize job service', { error });
      throw error;
    }
  }

  /**
   * Create a new job
   */
  async createJob(
    sessionId: string,
    type: string,
    data: any,
    options: {
      priority?: 'low' | 'medium' | 'high';
      timeout?: number;
      retryCount?: number;
      dependencies?: string[];
      parentJobId?: string;
      tags?: string[];
      createdBy?: string;
    } = {}
  ): Promise<IJobDocument> {
    try {
      const jobId = AuthUtils.generateUniqueId();

      const jobData = {
        jobId,
        sessionId,
        type,
        status: 'pending',
        priority: this.mapPriorityToNumber(options.priority || 'medium'),
        data: {
          input: data,
          output: null,
          parameters: {},
          context: {},
        },
        progress: {
          percentage: 0,
          currentStep: '',
          totalSteps: 0,
          completedSteps: 0,
          estimatedTimeRemaining: null,
        },
        metadata: {
          createdBy: options.createdBy || 'system',
          assignedWorker: null,
          durations: {
            queued: 0,
            processing: 0,
            total: 0,
          },
          retryCount: 0,
          maxRetries: options.retryCount || 3,
          timeout: options.timeout || 300000, // 5 minutes default
          tags: options.tags || [],
          dependencies: options.dependencies || [],
          parentJobId: options.parentJobId || null,
          childJobs: [],
        },
        errors: [],
        logs: [],
      };

      const job = new Job(jobData);
      await job.save();

      // Add to in-memory queue
      this.jobQueue.set(jobId, job);

      // Emit job created event
      this.emit('jobCreated', job);

      logger.info('Job created', {
        jobId,
        sessionId,
        type,
        priority: options.priority,
      });

      return job;
    } catch (error) {
      logger.error('Failed to create job', { error, sessionId, type });
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<IJobDocument | null> {
    try {
      // Check in-memory queue first
      const queuedJob = this.jobQueue.get(jobId);
      if (queuedJob) {
        return queuedJob;
      }

      // Check database
      const job = await Job.findOne({ jobId });
      
      if (job) {
        logger.debug('Job retrieved', { jobId });
      }

      return job;
    } catch (error) {
      logger.error('Failed to get job', { error, jobId });
      throw error;
    }
  }

  /**
   * Get jobs by session
   */
  async getJobsBySession(
    sessionId: string,
    options: {
      status?: string;
      type?: string;
      limit?: number;
      skip?: number;
      sort?: any;
    } = {}
  ): Promise<IJobDocument[]> {
    try {
      logger.debug('Getting jobs by session', { sessionId, options });
      
      const query: any = { sessionId };
      
      if (options.status) {
        query.status = options.status;
      }

      if (options.type) {
        query.type = options.type;
      }

      logger.debug('Executing job query', { query });
      
      const jobs = await Job.find(query)
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);

      logger.debug('Jobs retrieved by session', {
        sessionId,
        count: jobs.length,
        options,
      });

      return jobs;
    } catch (error) {
      logger.error('Failed to get jobs by session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
    data?: any
  ): Promise<IJobDocument | null> {
    try {
      const job = await this.getJob(jobId);
      
      if (!job) {
        return null;
      }

      const oldStatus = job.status;
      job.status = status;
      if (data) {
        job.data.output = data;
      }
      job.updatedAt = new Date();
      await job.save();

      // Update in-memory queue
      if (this.jobQueue.has(jobId)) {
        this.jobQueue.set(jobId, job);
      }

      // Remove from queue if completed, failed, or cancelled
      if (['completed', 'failed', 'cancelled'].includes(status)) {
        this.jobQueue.delete(jobId);
      }

      // Emit status change event
      this.emit('jobStatusChanged', { job, oldStatus, newStatus: status });

      logger.info('Job status updated', {
        jobId,
        oldStatus,
        newStatus: status,
      });

      return job;
    } catch (error) {
      logger.error('Failed to update job status', { error, jobId, status });
      throw error;
    }
  }

  /**
   * Update job progress
   */
  async updateJobProgress(
    jobId: string,
    progress: {
      percentage?: number;
      currentStep?: string;
      totalSteps?: number;
      completedSteps?: number;
      estimatedTimeRemaining?: number;
    }
  ): Promise<IJobDocument | null> {
    try {
      const job = await this.getJob(jobId);
      
      if (!job) {
        return null;
      }

      if (progress.percentage !== undefined) {
        job.progress.current = progress.percentage;
      }
      if (progress.currentStep) {
        job.progress.message = progress.currentStep;
      }
      if (progress.totalSteps !== undefined) {
        job.progress.total = progress.totalSteps;
      }
      job.updatedAt = new Date();
      await job.save();

      // Update in-memory queue
      if (this.jobQueue.has(jobId)) {
        this.jobQueue.set(jobId, job);
      }

      // Emit progress update event
      this.emit('jobProgressUpdated', { job, progress });

      logger.debug('Job progress updated', {
        jobId,
        percentage: progress.percentage,
        currentStep: progress.currentStep,
      });

      return job;
    } catch (error) {
      logger.error('Failed to update job progress', { error, jobId });
      throw error;
    }
  }

  /**
   * Add job log
   */
  async addJobLog(
    jobId: string,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    metadata?: any
  ): Promise<IJobDocument | null> {
    try {
      const job = await this.getJob(jobId);
      
      if (!job) {
        return null;
      }

      job.logs.push({
        level,
        message,
        timestamp: new Date(),
        data: metadata
      });
      job.updatedAt = new Date();
      await job.save();

      // Update in-memory queue
      if (this.jobQueue.has(jobId)) {
        this.jobQueue.set(jobId, job);
      }

      logger.debug('Job log added', {
        jobId,
        level,
        message,
      });

      return job;
    } catch (error) {
      logger.error('Failed to add job log', { error, jobId });
      throw error;
    }
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string, reason?: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      
      if (!job) {
        return false;
      }

      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        return false; // Already finished
      }

      await this.updateJobStatus(jobId, 'cancelled');

      if (reason) {
        await this.addJobLog(jobId, 'info', `Job cancelled: ${reason}`);
      }

      // Stop worker if running
      const worker = this.workers.get(jobId);
      if (worker) {
        clearTimeout(worker);
        this.workers.delete(jobId);
      }

      logger.info('Job cancelled', { jobId, reason });

      return true;
    } catch (error) {
      logger.error('Failed to cancel job', { error, jobId });
      throw error;
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      
      if (!job) {
        return false;
      }

      if (job.status !== 'failed') {
        return false; // Can only retry failed jobs
      }

      if (job.metadata.retryCount >= job.metadata.maxRetries) {
        return false; // Max retries exceeded
      }

      // Reset job status and increment retry count
      job.status = 'pending';
      job.metadata.retryCount = (job.metadata.retryCount || 0) + 1;
      job.updatedAt = new Date();
      await job.save();

      // Add back to queue
      this.jobQueue.set(jobId, job);

      logger.info('Job retried', {
        jobId,
        retryCount: job.metadata.retryCount,
      });

      return true;
    } catch (error) {
      logger.error('Failed to retry job', { error, jobId });
      throw error;
    }
  }

  /**
   * Start job processing
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processJobs();
    }, this.processingIntervalMs);

    logger.info('Job processing started');
  }

  /**
   * Stop job processing
   */
  stopProcessing(): void {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Stop all workers
    for (const [jobId, worker] of this.workers) {
      clearTimeout(worker);
      this.workers.delete(jobId);
    }

    logger.info('Job processing stopped');
  }

  /**
   * Process jobs in queue
   */
  private async processJobs(): Promise<void> {
    try {
      if (this.workers.size >= this.maxConcurrentJobs) {
        return; // Max concurrent jobs reached
      }

      // Get pending jobs sorted by priority and creation time
      const pendingJobs = Array.from(this.jobQueue.values())
        .filter(job => job.status === 'pending')
        .sort((a, b) => {
          // Priority order: higher number = higher priority
          const priorityDiff = b.priority - a.priority;
          
          if (priorityDiff !== 0) {
            return priorityDiff;
          }
          
          // If same priority, sort by creation time (FIFO)
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

      // Process jobs up to max concurrent limit
      const jobsToProcess = pendingJobs.slice(0, this.maxConcurrentJobs - this.workers.size);

      for (const job of jobsToProcess) {
        this.processJob(job);
      }
    } catch (error) {
      logger.error('Error in job processing loop', { error });
    }
  }

  /**
   * Process individual job
   */
  private async processJob(job: IJobDocument): Promise<void> {
    try {
      const jobId = job.jobId;

      // Update status to running
    await this.updateJobStatus(jobId, 'running');
      await this.addJobLog(jobId, 'info', 'Job processing started');

      // Create worker timeout
      const worker = setTimeout(async () => {
        try {
          await this.executeJob(job);
        } catch (error) {
          logger.error('Job execution failed', { error, jobId });
          await this.handleJobError(jobId, error);
        } finally {
          this.workers.delete(jobId);
        }
      }, 100); // Small delay to allow status update

      this.workers.set(jobId, worker);

      logger.info('Job processing started', {
        jobId,
        type: job.type,
        priority: job.priority,
      });
    } catch (error) {
      logger.error('Failed to start job processing', { error, jobId: job.jobId });
      await this.handleJobError(job.jobId, error);
    }
  }

  /**
   * Execute job based on type
   */
  private async executeJob(job: IJobDocument): Promise<void> {
    const jobId = job.jobId;

    try {
      switch (job.type) {
        case 'document_processing':
          await this.executeDocumentProcessing(job);
          break;
        
        case 'tax_calculation':
          await this.executeTaxCalculation(job);
          break;
        
        case 'form_generation':
          await this.executeFormGeneration(job);
          break;
        
        case 'data_validation':
          await this.executeDataValidation(job);
          break;
        
        case 'report_generation':
          await this.executeReportGeneration(job);
          break;
        
        case 'notification':
          await this.executeNotification(job);
          break;
        
        case 'cleanup':
          await this.executeCleanup(job);
          break;
        
        case 'backup':
          await this.executeBackup(job);
          break;
        
        case 'other':
          await this.executeOther(job);
          break;
        
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Mark job as completed
      await this.updateJobStatus(jobId, 'completed');
      await this.addJobLog(jobId, 'info', 'Job completed successfully');

      logger.info('Job executed successfully', {
        jobId,
        type: job.type,
        duration: Date.now() - job.createdAt.getTime(),
      });
    } catch (error) {
      throw error; // Re-throw to be handled by processJob
    }
  }

  /**
   * Execute document processing job
   */
  private async executeDocumentProcessing(job: IJobDocument): Promise<void> {
    const { documentId } = job.data.input;

    await this.updateJobProgress(job.jobId, {
      percentage: 10,
      currentStep: 'Starting document processing',
      totalSteps: 5,
      completedSteps: 0,
    });

    // Simulate document processing steps
    await this.simulateProcessingStep(job.jobId, 'Extracting text', 1, 5, 30);
    await this.simulateProcessingStep(job.jobId, 'Analyzing content', 2, 5, 50);
    await this.simulateProcessingStep(job.jobId, 'Extracting entities', 3, 5, 70);
    await this.simulateProcessingStep(job.jobId, 'Validating data', 4, 5, 90);
    await this.simulateProcessingStep(job.jobId, 'Finalizing results', 5, 5, 100);

    // Set output data
    job.data.output = {
      documentId,
      processed: true,
      extractedText: 'Sample extracted text...',
      entities: ['Entity1', 'Entity2'],
      confidence: 0.95,
    };

    await job.save();
  }

  /**
   * Execute tax calculation job
   */
  private async executeTaxCalculation(job: IJobDocument): Promise<void> {
    const { formData } = job.data.input;

    await this.updateJobProgress(job.jobId, {
      percentage: 10,
      currentStep: 'Validating form data',
      totalSteps: 4,
      completedSteps: 0,
    });

    await this.simulateProcessingStep(job.jobId, 'Calculating income', 1, 4, 35);
    await this.simulateProcessingStep(job.jobId, 'Calculating deductions', 2, 4, 65);
    await this.simulateProcessingStep(job.jobId, 'Calculating tax liability', 3, 4, 85);
    await this.simulateProcessingStep(job.jobId, 'Generating results', 4, 4, 100);

    // Set output data
    job.data.output = {
      calculations: {
        totalIncome: 50000,
        totalDeductions: 12000,
        taxableIncome: 38000,
        taxLiability: 4560,
        refund: 0,
      },
      isValid: true,
    };

    await job.save();
  }

  /**
   * Execute form validation job
   */
  private async executeFormGeneration(job: IJobDocument): Promise<void> {
    const { formId } = job.data.input;

    await this.updateJobProgress(job.jobId, {
      percentage: 20,
      currentStep: 'Loading form data',
      totalSteps: 3,
      completedSteps: 0,
    });

    await this.simulateProcessingStep(job.jobId, 'Validating fields', 1, 3, 60);
    await this.simulateProcessingStep(job.jobId, 'Checking business rules', 2, 3, 85);
    await this.simulateProcessingStep(job.jobId, 'Generating validation report', 3, 3, 100);

    // Set output data
    job.data.output = {
      formId,
      isValid: true,
      errors: [],
      warnings: ['Consider reviewing deduction amounts'],
      completeness: 95,
    };

    await job.save();
  }

  /**
   * Execute data export job
   */
  private async executeDataValidation(job: IJobDocument): Promise<void> {
    const { sessionId, format } = job.data.input;

    await this.updateJobProgress(job.jobId, {
      percentage: 10,
      currentStep: 'Gathering data',
      totalSteps: 4,
      completedSteps: 0,
    });

    await this.simulateProcessingStep(job.jobId, 'Formatting data', 1, 4, 40);
    await this.simulateProcessingStep(job.jobId, 'Generating file', 2, 4, 70);
    await this.simulateProcessingStep(job.jobId, 'Compressing data', 3, 4, 90);
    await this.simulateProcessingStep(job.jobId, 'Finalizing export', 4, 4, 100);

    // Set output data
    job.data.output = {
      sessionId,
      format,
      fileUrl: `/exports/${sessionId}_${Date.now()}.${format}`,
      fileSize: 1024000,
      recordCount: 150,
    };

    await job.save();
  }

  /**
   * Execute email notification job
   */
  private async executeReportGeneration(job: IJobDocument): Promise<void> {
    const { recipient, subject, template } = job.data.input;

    await this.updateJobProgress(job.jobId, {
      percentage: 25,
      currentStep: 'Preparing email',
      totalSteps: 3,
      completedSteps: 0,
    });

    await this.simulateProcessingStep(job.jobId, 'Rendering template', 1, 3, 60);
    await this.simulateProcessingStep(job.jobId, 'Sending email', 2, 3, 85);
    await this.simulateProcessingStep(job.jobId, 'Confirming delivery', 3, 3, 100);

    // Set output data
    job.data.output = {
      recipient,
      subject,
      messageId: `msg_${Date.now()}`,
      sent: true,
      deliveredAt: new Date(),
    };

    await job.save();
  }

  /**
   * Execute cleanup job
   */
  private async executeCleanup(job: IJobDocument): Promise<void> {
    const { type, olderThanDays } = job.data.input;

    await this.updateJobProgress(job.jobId, {
      percentage: 10,
      currentStep: 'Scanning for old data',
      totalSteps: 3,
      completedSteps: 0,
    });

    await this.simulateProcessingStep(job.jobId, 'Cleaning up files', 1, 3, 50);
    await this.simulateProcessingStep(job.jobId, 'Updating database', 2, 3, 80);
    await this.simulateProcessingStep(job.jobId, 'Finalizing cleanup', 3, 3, 100);

    // Set output data
    job.data.output = {
      type,
      olderThanDays,
      itemsDeleted: Math.floor(Math.random() * 100),
      spaceFreed: Math.floor(Math.random() * 1000000),
    };

    await job.save();
  }

  /**
   * Execute notification job
   */
  private async executeNotification(job: IJobDocument): Promise<void> {
    const { recipient, subject, template } = job.data.input;

    await this.updateJobProgress(job.jobId, {
      percentage: 10,
      currentStep: 'Preparing notification',
      totalSteps: 3,
      completedSteps: 0,
    });

    await this.simulateProcessingStep(job.jobId, 'Sending notification', 1, 3, 50);
    await this.simulateProcessingStep(job.jobId, 'Confirming delivery', 2, 3, 80);
    await this.simulateProcessingStep(job.jobId, 'Logging result', 3, 3, 100);

    // Set output data
    job.data.output = {
      recipient,
      subject,
      template,
      sentAt: new Date(),
      status: 'sent'
    };

    await job.save();
  }

  /**
   * Execute backup job
   */
  private async executeBackup(job: IJobDocument): Promise<void> {
    const { type, target } = job.data.input;

    await this.updateJobProgress(job.jobId, {
      percentage: 10,
      currentStep: 'Preparing backup',
      totalSteps: 4,
      completedSteps: 0,
    });

    await this.simulateProcessingStep(job.jobId, 'Creating backup archive', 1, 4, 30);
    await this.simulateProcessingStep(job.jobId, 'Compressing data', 2, 4, 60);
    await this.simulateProcessingStep(job.jobId, 'Uploading to storage', 3, 4, 90);
    await this.simulateProcessingStep(job.jobId, 'Verifying backup', 4, 4, 100);

    // Set output data
    job.data.output = {
      type,
      target,
      backupId: `backup_${Date.now()}`,
      size: Math.floor(Math.random() * 1000000),
      createdAt: new Date()
    };

    await job.save();
  }

  /**
   * Execute other job types
   */
  private async executeOther(job: IJobDocument): Promise<void> {
    const { operation } = job.data.input;

    await this.updateJobProgress(job.jobId, {
      percentage: 10,
      currentStep: 'Processing operation',
      totalSteps: 2,
      completedSteps: 0,
    });

    await this.simulateProcessingStep(job.jobId, 'Executing operation', 1, 2, 70);
    await this.simulateProcessingStep(job.jobId, 'Finalizing', 2, 2, 100);

    // Set output data
    job.data.output = {
      operation,
      result: 'completed',
      processedAt: new Date()
    };

    await job.save();
  }

  /**
   * Map priority string to number
   */
  private mapPriorityToNumber(priority: 'low' | 'medium' | 'high'): number {
    const priorityMap = {
      low: 1,
      medium: 5,
      high: 10
    };
    return priorityMap[priority];
  }

  /**
   * Simulate processing step with delay
   */
  private async simulateProcessingStep(
    jobId: string,
    stepName: string,
    completedSteps: number,
    totalSteps: number,
    percentage: number
  ): Promise<void> {
    await this.updateJobProgress(jobId, {
      percentage,
      currentStep: stepName,
      totalSteps,
      completedSteps,
    });

    await this.addJobLog(jobId, 'info', `Step completed: ${stepName}`);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  }

  /**
   * Handle job error
   */
  private async handleJobError(jobId: string, error: any): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      
      if (!job) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      job.errors.push({
        code: 'EXECUTION_ERROR',
        message: errorMessage,
        stack: error.stack,
        timestamp: new Date(),
        retryable: true,
        details: error
      });
      job.updatedAt = new Date();
      await job.save();
      await this.addJobLog(jobId, 'error', `Job failed: ${errorMessage}`);

      // Check if we should retry
      if (job.metadata.retryCount < job.metadata.maxRetries) {
        logger.info('Job will be retried', {
          jobId,
          retryCount: job.metadata.retryCount,
          maxRetries: job.metadata.maxRetries,
        });
        
        // Schedule retry after delay
        setTimeout(async () => {
          await this.retryJob(jobId);
        }, 5000 * (job.metadata.retryCount + 1)); // Exponential backoff
      } else {
        await this.updateJobStatus(jobId, 'failed');
        logger.error('Job failed permanently', {
          jobId,
          error: errorMessage,
          retryCount: job.metadata.retryCount,
        });
      }
    } catch (handlingError) {
      logger.error('Failed to handle job error', {
        handlingError,
        originalError: error,
        jobId,
      });
    }
  }

  /**
   * Get total jobs count
   */
  async getTotalJobsCount(): Promise<number> {
    try {
      return await Job.countDocuments();
    } catch (error) {
      logger.error('Failed to get total jobs count', { error });
      throw error;
    }
  }

  /**
   * Get jobs grouped by status
   */
  async getJobsByStatus(): Promise<Record<string, number>> {
    try {
      const statusCounts = await Job.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result: Record<string, number> = {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      };

      statusCounts.forEach(item => {
        if (item._id) {
          result[item._id] = item.count;
        }
      });

      return result;
    } catch (error) {
      logger.error('Failed to get jobs by status', { error });
      throw error;
    }
  }

  /**
   * Get jobs grouped by type
   */
  async getJobsByType(): Promise<Record<string, number>> {
    try {
      const typeCounts = await Job.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);

      const result: Record<string, number> = {};
      typeCounts.forEach(item => {
        if (item._id) {
          result[item._id] = item.count;
        }
      });

      return result;
    } catch (error) {
      logger.error('Failed to get jobs by type', { error });
      throw error;
    }
  }

  /**
   * Get average processing time for completed jobs
   */
  async getAverageProcessingTime(): Promise<number> {
    try {
      const result = await Job.aggregate([
        {
          $match: {
            status: 'completed',
            startedAt: { $exists: true },
            completedAt: { $exists: true }
          }
        },
        {
          $project: {
            processingTime: {
              $subtract: ['$completedAt', '$startedAt']
            }
          }
        },
        {
          $group: {
            _id: null,
            avgProcessingTime: { $avg: '$processingTime' }
          }
        }
      ]);

      return result.length > 0 ? Math.round(result[0].avgProcessingTime || 0) : 0;
    } catch (error) {
      logger.error('Failed to get average processing time', { error });
      throw error;
    }
  }

  /**
   * Get job queue statistics
   */
  async getQueueStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    inMemoryQueue: number;
    activeWorkers: number;
  }> {
    try {
      const [
        total,
        pending,
        running,
        completed,
        failed,
        cancelled,
      ] = await Promise.all([
        Job.countDocuments(),
        Job.countDocuments({ status: 'pending' }),
        Job.countDocuments({ status: 'running' }),
        Job.countDocuments({ status: 'completed' }),
        Job.countDocuments({ status: 'failed' }),
        Job.countDocuments({ status: 'cancelled' }),
      ]);

      return {
        total,
        pending,
        processing: running,
        completed,
        failed,
        cancelled,
        inMemoryQueue: this.jobQueue.size,
        activeWorkers: this.workers.size,
      };
    } catch (error) {
      logger.error('Failed to get queue statistics', { error });
      throw error;
    }
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string): Promise<boolean> {
    try {
      const job = await Job.findOne({ jobId });

      if (!job) {
        return false;
      }

      // Cancel job if it's running
      if (job.status === 'running' || job.status === 'pending') {
        await this.cancelJob(jobId, 'Job deleted');
      }

      // Remove from workers if active
      if (this.workers.has(jobId)) {
        const worker = this.workers.get(jobId);
        if (worker) {
          clearTimeout(worker);
        }
        this.workers.delete(jobId);
      }

      // Delete from database
      const result = await Job.deleteOne({ jobId });

      logger.info('Job deleted', { jobId, deletedCount: result.deletedCount });

      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Failed to delete job', { error, jobId });
      throw error;
    }
  }

  /**
   * Cleanup completed jobs
   */
  async cleanupCompletedJobs(olderThanDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await Job.deleteMany({
        status: { $in: ['completed', 'cancelled'] },
        updatedAt: { $lt: cutoffDate },
      });

      logger.info('Completed jobs cleaned up', {
        deletedCount: result.deletedCount,
        olderThanDays,
      });

      return result.deletedCount || 0;
    } catch (error) {
      logger.error('Failed to cleanup completed jobs', { error, olderThanDays });
      throw error;
    }
  }
}

// Export singleton instance
export const jobService = JobService.getInstance();