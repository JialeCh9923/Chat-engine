import mongoose, { Schema, Document, Model } from 'mongoose';
import { ISession } from '../types';

export interface ISessionDocument extends ISession, Document {}

export interface ISessionModel extends Model<ISessionDocument> {
  findBySessionId(sessionId: string): Promise<ISessionDocument | null>;
  findActiveByClientId(clientId: string): Promise<ISessionDocument[]>;
  findByUserId(userId: string): Promise<ISessionDocument[]>;
  cleanupExpired(): Promise<any>;
}

const SessionSchema: Schema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  clientId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: false,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed', 'expired'],
    default: 'active',
    index: true,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
  conversationHistory: [{
    conversationId: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    summary: String,
  }],
  documents: [{
    documentId: {
      type: String,
      required: true,
    },
    filename: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
  }],
  jobs: [{
    jobId: {
      type: String,
      required: true,
    },
    type: String,
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  versionKey: false,
});

// Middleware to update lastActivity and updatedAt
SessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.lastActivity = new Date();
  next();
});

// Instance methods
SessionSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

SessionSchema.methods.isActive = function(): boolean {
  return this.status === 'active' && !this.isExpired();
};

SessionSchema.methods.addConversation = function(conversationId: string, summary?: string) {
  this.conversationHistory.push({
    conversationId,
    timestamp: new Date(),
    summary,
  });
  this.lastActivity = new Date();
};

SessionSchema.methods.addDocument = function(documentId: string, filename: string) {
  this.documents.push({
    documentId,
    filename,
    uploadedAt: new Date(),
    processingStatus: 'pending',
  });
  this.lastActivity = new Date();
};

SessionSchema.methods.addJob = function(jobId: string, type: string) {
  this.jobs.push({
    jobId,
    type,
    status: 'pending',
    createdAt: new Date(),
  });
  this.lastActivity = new Date();
};

SessionSchema.methods.updateProgress = function(step: string, percentComplete?: number) {
  if (!this.metadata.progress.completedSteps.includes(step)) {
    this.metadata.progress.completedSteps.push(step);
  }
  this.metadata.progress.currentStep = step;
  if (percentComplete !== undefined) {
    this.metadata.progress.percentComplete = Math.min(100, Math.max(0, percentComplete));
  }
  this.lastActivity = new Date();
};

// Static methods
SessionSchema.statics.findBySessionId = function(sessionId: string) {
  return this.findOne({ sessionId });
};

SessionSchema.statics.findActiveByClientId = function(clientId: string) {
  return this.find({ 
    clientId, 
    status: 'active',
    expiresAt: { $gt: new Date() }
  });
};

SessionSchema.statics.findByUserId = function(userId: string) {
  return this.find({ userId });
};

SessionSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { status: 'expired' }
    ]
  });
};

export default mongoose.model<ISessionDocument, ISessionModel>('Session', SessionSchema);