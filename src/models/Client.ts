import mongoose, { Schema, Document, Model } from 'mongoose';
import { IClient } from '../types';

export interface IClientDocument extends IClient, Document {
  hasPermission(permission: string): boolean;
  addPermission(permission: string): void;
  removePermission(permission: string): void;
  incrementUsage(type: 'requests' | 'sessions' | 'documents' | 'tokens', amount?: number): void;
  checkRateLimit(type: 'minute' | 'hour' | 'day'): boolean;
  resetRateLimit(): void;
  isWithinBillingLimits(): { valid: boolean; exceeded: string[] };
  resetBillingUsage(): void;
  isLocked(): boolean;
  incrementFailedLogin(): void;
  resetFailedLogins(): void;
  updateLastLogin(ipAddress: string): void;
  addTag(tag: string): void;
  removeTag(tag: string): void;
}

export interface IClientModel extends Model<IClientDocument> {
  findByClientId(clientId: string): Promise<IClientDocument | null>;
  findByApiKey(apiKey: string): Promise<IClientDocument | null>;
  findByEmail(email: string): Promise<IClientDocument | null>;
  findActive(): Promise<IClientDocument[]>;
  findByPlan(plan: string): Promise<IClientDocument[]>;
  findInactive(daysInactive?: number): Promise<IClientDocument[]>;
  getUsageStats(): Promise<any>;
}

const ClientSchema: Schema = new Schema({
  clientId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  apiKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  permissions: [{
    type: String,
    enum: [
      'session:create',
      'session:read',
      'session:update',
      'session:delete',
      'conversation:create',
      'conversation:read',
      'document:upload',
      'document:read',
      'document:process',
      'job:create',
      'job:read',
      'job:cancel',
      'admin:read',
      'admin:write'
    ],
  }],
  rateLimits: {
    requestsPerMinute: {
      type: Number,
      default: 60,
    },
    requestsPerHour: {
      type: Number,
      default: 1000,
    },
    requestsPerDay: {
      type: Number,
      default: 10000,
    },
    concurrentSessions: {
      type: Number,
      default: 10,
    },
    maxFileSize: {
      type: Number,
      default: 10485760, // 10MB
    },
    maxFilesPerSession: {
      type: Number,
      default: 50,
    },
  },
  usage: {
    totalRequests: {
      type: Number,
      default: 0,
    },
    totalSessions: {
      type: Number,
      default: 0,
    },
    totalDocuments: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    lastRequestAt: Date,
    currentPeriodRequests: {
      type: Number,
      default: 0,
    },
    currentPeriodStart: {
      type: Date,
      default: Date.now,
    },
  },
  settings: {
    defaultSessionTimeout: {
      type: Number,
      default: 3600000, // 1 hour
    },
    allowedOrigins: [String],
    webhookUrl: String,
    webhookSecret: String,
    notificationPreferences: {
      email: {
        type: Boolean,
        default: true,
      },
      webhook: {
        type: Boolean,
        default: false,
      },
      events: [{
        type: String,
        enum: [
          'session.created',
          'session.completed',
          'document.processed',
          'job.completed',
          'error.occurred'
        ],
      }],
    },
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  billing: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free',
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    usage: {
      sessions: {
        type: Number,
        default: 0,
      },
      documents: {
        type: Number,
        default: 0,
      },
      tokens: {
        type: Number,
        default: 0,
      },
      storage: {
        type: Number,
        default: 0,
      },
    },
    limits: {
      sessions: Number,
      documents: Number,
      tokens: Number,
      storage: Number,
    },
  },
  security: {
    ipWhitelist: [String],
    lastLoginAt: Date,
    lastLoginIP: String,
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: Date,
    passwordChangedAt: Date,
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    apiKeyRotatedAt: Date,
  },
  metadata: {
    company: String,
    industry: String,
    website: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    language: {
      type: String,
      default: 'en',
    },
    tags: [String],
    notes: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  versionKey: false,
});

// Indexes
ClientSchema.index({ email: 1 });
ClientSchema.index({ isActive: 1, createdAt: -1 });
ClientSchema.index({ 'billing.plan': 1 });
ClientSchema.index({ lastActiveAt: -1 });

// Middleware
ClientSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
ClientSchema.methods.hasPermission = function(permission: string): boolean {
  return this.permissions.includes(permission) || this.permissions.includes('admin:write');
};

ClientSchema.methods.addPermission = function(permission: string) {
  if (!this.permissions.includes(permission)) {
    this.permissions.push(permission);
    this.updatedAt = new Date();
  }
};

ClientSchema.methods.removePermission = function(permission: string) {
  this.permissions = this.permissions.filter((p: string) => p !== permission);
  this.updatedAt = new Date();
};

ClientSchema.methods.incrementUsage = function(type: 'requests' | 'sessions' | 'documents' | 'tokens', amount: number = 1) {
  switch (type) {
    case 'requests':
      this.usage.totalRequests += amount;
      this.usage.currentPeriodRequests += amount;
      this.usage.lastRequestAt = new Date();
      break;
    case 'sessions':
      this.usage.totalSessions += amount;
      this.billing.usage.sessions += amount;
      break;
    case 'documents':
      this.usage.totalDocuments += amount;
      this.billing.usage.documents += amount;
      break;
    case 'tokens':
      this.usage.totalTokens += amount;
      this.billing.usage.tokens += amount;
      break;
  }
  this.lastActiveAt = new Date();
  this.updatedAt = new Date();
};

ClientSchema.methods.checkRateLimit = function(type: 'minute' | 'hour' | 'day'): boolean {
  const now = new Date();
  const periodStart = this.usage.currentPeriodStart;
  
  switch (type) {
    case 'minute':
      const minuteAgo = new Date(now.getTime() - 60000);
      return periodStart > minuteAgo ? 
        this.usage.currentPeriodRequests < this.rateLimits.requestsPerMinute : true;
    case 'hour':
      const hourAgo = new Date(now.getTime() - 3600000);
      return periodStart > hourAgo ? 
        this.usage.currentPeriodRequests < this.rateLimits.requestsPerHour : true;
    case 'day':
      const dayAgo = new Date(now.getTime() - 86400000);
      return periodStart > dayAgo ? 
        this.usage.currentPeriodRequests < this.rateLimits.requestsPerDay : true;
    default:
      return true;
  }
};

ClientSchema.methods.resetRateLimit = function() {
  this.usage.currentPeriodRequests = 0;
  this.usage.currentPeriodStart = new Date();
  this.updatedAt = new Date();
};

ClientSchema.methods.isWithinBillingLimits = function(): { valid: boolean; exceeded: string[] } {
  const exceeded: string[] = [];
  
  if (this.billing.limits.sessions && this.billing.usage.sessions >= this.billing.limits.sessions) {
    exceeded.push('sessions');
  }
  
  if (this.billing.limits.documents && this.billing.usage.documents >= this.billing.limits.documents) {
    exceeded.push('documents');
  }
  
  if (this.billing.limits.tokens && this.billing.usage.tokens >= this.billing.limits.tokens) {
    exceeded.push('tokens');
  }
  
  if (this.billing.limits.storage && this.billing.usage.storage >= this.billing.limits.storage) {
    exceeded.push('storage');
  }
  
  return {
    valid: exceeded.length === 0,
    exceeded
  };
};

ClientSchema.methods.resetBillingUsage = function() {
  this.billing.usage = {
    sessions: 0,
    documents: 0,
    tokens: 0,
    storage: 0,
  };
  this.billing.currentPeriodStart = new Date();
  
  // Set next period end based on billing cycle
  const nextPeriodEnd = new Date();
  if (this.billing.billingCycle === 'yearly') {
    nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
  } else {
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
  }
  this.billing.currentPeriodEnd = nextPeriodEnd;
  
  this.updatedAt = new Date();
};

ClientSchema.methods.isLocked = function(): boolean {
  return this.security.lockedUntil && new Date() < this.security.lockedUntil;
};

ClientSchema.methods.incrementFailedLogin = function() {
  this.security.failedLoginAttempts += 1;
  
  // Lock account after 5 failed attempts for 30 minutes
  if (this.security.failedLoginAttempts >= 5) {
    this.security.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
  }
  
  this.updatedAt = new Date();
};

ClientSchema.methods.resetFailedLogins = function() {
  this.security.failedLoginAttempts = 0;
  this.security.lockedUntil = undefined;
  this.security.lastLoginAt = new Date();
  this.updatedAt = new Date();
};

ClientSchema.methods.updateLastLogin = function(ipAddress: string) {
  this.security.lastLoginAt = new Date();
  this.security.lastLoginIP = ipAddress;
  this.lastActiveAt = new Date();
  this.resetFailedLogins();
};

ClientSchema.methods.addTag = function(tag: string) {
  if (!this.metadata.tags.includes(tag)) {
    this.metadata.tags.push(tag);
    this.updatedAt = new Date();
  }
};

ClientSchema.methods.removeTag = function(tag: string) {
  this.metadata.tags = this.metadata.tags.filter((t: string) => t !== tag);
  this.updatedAt = new Date();
};

// Static methods
ClientSchema.statics.findByClientId = function(clientId: string) {
  return this.findOne({ clientId });
};

ClientSchema.statics.findByApiKey = function(apiKey: string) {
  return this.findOne({ apiKey, isActive: true });
};

ClientSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

ClientSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ lastActiveAt: -1 });
};

ClientSchema.statics.findByPlan = function(plan: string) {
  return this.find({ 'billing.plan': plan, isActive: true });
};

ClientSchema.statics.findInactive = function(daysInactive: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
  
  return this.find({
    lastActiveAt: { $lt: cutoffDate },
    isActive: true
  });
};

ClientSchema.statics.getUsageStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$billing.plan',
        count: { $sum: 1 },
        totalSessions: { $sum: '$usage.totalSessions' },
        totalDocuments: { $sum: '$usage.totalDocuments' },
        totalTokens: { $sum: '$usage.totalTokens' },
        avgSessionsPerClient: { $avg: '$usage.totalSessions' },
      }
    }
  ]);
};

export default mongoose.model<IClientDocument, IClientModel>('Client', ClientSchema);