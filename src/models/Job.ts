import mongoose, { Schema, Document } from 'mongoose';
import { IJob } from '../types';

export interface IJobDocument extends Omit<IJob, 'errors'>, Omit<Document, 'errors'> {
  errors: Array<{
    code: string;
    message: string;
    stack?: string;
    timestamp: Date;
    retryable: boolean;
    details?: any;
  }>;
}

const JobSchema: Schema = new Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'document_processing',
      'tax_calculation',
      'form_generation',
      'data_validation',
      'report_generation',
      'notification',
      'cleanup',
      'backup',
      'other'
    ],
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
    index: true,
  },
  data: {
    input: Schema.Types.Mixed,
    output: Schema.Types.Mixed,
    parameters: Schema.Types.Mixed,
    context: Schema.Types.Mixed,
  },
  progress: {
    current: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    total: {
      type: Number,
      default: 100,
    },
    message: String,
    details: Schema.Types.Mixed,
  },
  metadata: {
    createdBy: String,
    assignedWorker: String,
    estimatedDuration: Number,
    actualDuration: Number,
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    retryDelay: {
      type: Number,
      default: 5000,
    },
    timeout: {
      type: Number,
      default: 300000, // 5 minutes
    },
    tags: [String],
    dependencies: [String], // Job IDs that must complete first
    parentJobId: String,
    childJobIds: [String],
  },
  errors: [{
    code: String,
    message: String,
    stack: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    retryable: {
      type: Boolean,
      default: true,
    },
    details: Schema.Types.Mixed,
  }],
  logs: [{
    level: {
      type: String,
      enum: ['debug', 'info', 'warn', 'error'],
      default: 'info',
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    data: Schema.Types.Mixed,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  startedAt: Date,
  completedAt: Date,
  scheduledFor: Date,
  expiresAt: Date,
}, {
  timestamps: true,
  versionKey: false,
});

// Indexes
JobSchema.index({ status: 1, priority: -1, createdAt: 1 });
JobSchema.index({ sessionId: 1, status: 1 });
JobSchema.index({ type: 1, status: 1 });
JobSchema.index({ scheduledFor: 1 });
JobSchema.index({ expiresAt: 1 });

// Middleware
JobSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  if (this.status === 'running' && !this.startedAt) {
    this.startedAt = new Date();
  }
  
  if (['completed', 'failed', 'cancelled'].includes(this.status as string) && !this.completedAt) {
    this.completedAt = new Date();
    
    if (this.startedAt && this.completedAt) {
      (this.metadata as any).actualDuration = (this.completedAt as Date).getTime() - (this.startedAt as Date).getTime();
    }
  }
  
  next();
});

// Instance methods
JobSchema.methods.updateStatus = function(
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
  message?: string
) {
  this.status = status;
  this.updatedAt = new Date();
  
  if (message) {
    this.addLog('info', message);
  }
  
  if (status === 'running') {
    this.startedAt = new Date();
  } else if (['completed', 'failed', 'cancelled'].includes(status)) {
    this.completedAt = new Date();
    if (this.startedAt) {
      this.metadata.actualDuration = this.completedAt.getTime() - this.startedAt.getTime();
    }
  }
};

JobSchema.methods.updateProgress = function(current: number, message?: string, details?: any) {
  this.progress.current = Math.min(100, Math.max(0, current));
  
  if (message) {
    this.progress.message = message;
  }
  
  if (details) {
    this.progress.details = details;
  }
  
  this.updatedAt = new Date();
  this.addLog('info', `Progress: ${this.progress.current}%${message ? ` - ${message}` : ''}`);
};

JobSchema.methods.addError = function(
  code: string,
  message: string,
  stack?: string,
  retryable: boolean = true,
  details?: any
) {
  this.errors.push({
    code,
    message,
    stack,
    timestamp: new Date(),
    retryable,
    details,
  });
  
  this.addLog('error', `Error: ${code} - ${message}`, { stack, details });
  this.updatedAt = new Date();
};

JobSchema.methods.addLog = function(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  data?: any
) {
  this.logs.push({
    level,
    message,
    timestamp: new Date(),
    data,
  });
  
  // Keep only last 100 logs to prevent document size issues
  if (this.logs.length > 100) {
    this.logs = this.logs.slice(-100);
  }
  
  this.updatedAt = new Date();
};

JobSchema.methods.incrementRetryCount = function() {
  this.metadata.retryCount += 1;
  this.updatedAt = new Date();
  this.addLog('info', `Retry attempt ${this.metadata.retryCount}/${this.metadata.maxRetries}`);
};

JobSchema.methods.canRetry = function() {
  if (this.status !== 'failed') return false;
  if (this.metadata.retryCount >= this.metadata.maxRetries) return false;
  
  // Check if the last error is retryable
  const lastError = this.errors[this.errors.length - 1];
  return !lastError || lastError.retryable;
};

JobSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

JobSchema.methods.isTimedOut = function() {
  if (!this.startedAt || this.status !== 'running') return false;
  const elapsed = new Date().getTime() - this.startedAt.getTime();
  return elapsed > this.metadata.timeout;
};

JobSchema.methods.getElapsedTime = function() {
  if (!this.startedAt) return 0;
  const endTime = this.completedAt || new Date();
  return endTime.getTime() - this.startedAt.getTime();
};

JobSchema.methods.getEstimatedTimeRemaining = function() {
  if (!this.startedAt || this.progress.current === 0) {
    return this.metadata.estimatedDuration || 0;
  }
  
  const elapsed = this.getElapsedTime();
  const progressRatio = this.progress.current / 100;
  const estimatedTotal = elapsed / progressRatio;
  
  return Math.max(0, estimatedTotal - elapsed);
};

JobSchema.methods.addDependency = function(jobId: string) {
  if (!this.metadata.dependencies.includes(jobId)) {
    this.metadata.dependencies.push(jobId);
    this.updatedAt = new Date();
  }
};

JobSchema.methods.removeDependency = function(jobId: string) {
  this.metadata.dependencies = this.metadata.dependencies.filter((id: string) => id !== jobId);
  this.updatedAt = new Date();
};

JobSchema.methods.addChildJob = function(jobId: string) {
  if (!this.metadata.childJobIds.includes(jobId)) {
    this.metadata.childJobIds.push(jobId);
    this.updatedAt = new Date();
  }
};

JobSchema.methods.addTag = function(tag: string) {
  if (!this.metadata.tags.includes(tag)) {
    this.metadata.tags.push(tag);
    this.updatedAt = new Date();
  }
};

// Static methods
JobSchema.statics.findByJobId = function(jobId: string) {
  return this.findOne({ jobId });
};

JobSchema.statics.findBySessionId = function(sessionId: string) {
  return this.find({ sessionId }).sort({ createdAt: -1 });
};

JobSchema.statics.findByStatus = function(status: string) {
  return this.find({ status }).sort({ priority: -1, createdAt: 1 });
};

JobSchema.statics.findByType = function(type: string) {
  return this.find({ type }).sort({ createdAt: -1 });
};

JobSchema.statics.findPending = function() {
  return this.find({ 
    status: 'pending',
    $or: [
      { scheduledFor: { $exists: false } },
      { scheduledFor: { $lte: new Date() } }
    ]
  }).sort({ priority: -1, createdAt: 1 });
};

JobSchema.statics.findRunning = function() {
  return this.find({ status: 'running' }).sort({ startedAt: 1 });
};

JobSchema.statics.findRetryable = function() {
  return this.find({
    status: 'failed',
    'metadata.retryCount': { $lt: 3 },
    'errors.retryable': true
  }).sort({ priority: -1, createdAt: 1 });
};

JobSchema.statics.findExpired = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    status: { $in: ['pending', 'running'] }
  });
};

JobSchema.statics.findTimedOut = function() {
  const timeoutThreshold = new Date(Date.now() - 300000); // 5 minutes ago
  return this.find({
    status: 'running',
    startedAt: { $lt: timeoutThreshold }
  });
};

JobSchema.statics.getQueueStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$metadata.actualDuration' },
        avgRetries: { $avg: '$metadata.retryCount' }
      }
    }
  ]);
};

JobSchema.statics.cleanupOldJobs = function(daysOld: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    status: { $in: ['completed', 'failed', 'cancelled'] },
    completedAt: { $lt: cutoffDate }
  });
};

export default mongoose.model<IJobDocument>('Job', JobSchema);