import mongoose, { Schema, Document } from 'mongoose';
import { IConversation } from '../types';

export interface IConversationDocument extends IConversation, Document {
  addMessage(messageId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: any): any;
  getLastMessage(): any;
  getMessagesByRole(role: 'user' | 'assistant' | 'system'): any[];
  updateContext(updates: any): void;
  addPendingAction(action: string, parameters: any, priority?: number): void;
  removePendingAction(action: string): void;
  setFlag(flag: string, value: boolean): void;
  generateSummary(): string;
  getTokenCount(): number;
  updateStatus(status: 'active' | 'paused' | 'completed' | 'archived'): Promise<any>;
  updateSummary(summary: string): Promise<any>;
}

const MessageSchema = new Schema({
  messageId: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    tokens: Number,
    model: String,
    processingTime: Number,
    confidence: Number,
    intent: String,
    entities: [{
      type: String,
      value: String,
      confidence: Number,
    }],
    attachments: [{
      type: String,
      url: String,
      filename: String,
      mimeType: String,
    }],
  },
}, { _id: false });

const ConversationSchema: Schema = new Schema({
  conversationId: {
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
  title: {
    type: String,
    default: 'New Conversation',
  },
  messages: [MessageSchema],
  context: {
    currentTopic: String,
    extractedData: {
      type: Map,
      of: Schema.Types.Mixed,
    },
    userIntent: String,
    conversationState: {
      type: String,
      enum: ['greeting', 'data_collection', 'document_review', 'calculation', 'review', 'completion'],
      default: 'greeting',
    },
    pendingActions: [{
      action: String,
      parameters: Schema.Types.Mixed,
      priority: {
        type: Number,
        default: 1,
      },
    }],
    flags: {
      requiresHumanReview: {
        type: Boolean,
        default: false,
      },
      hasErrors: {
        type: Boolean,
        default: false,
      },
      isComplete: {
        type: Boolean,
        default: false,
      },
    },
  },
  summary: String,
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'archived'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  versionKey: false,
});

// Indexes
ConversationSchema.index({ sessionId: 1, timestamp: -1 });
ConversationSchema.index({ 'context.conversationState': 1 });
ConversationSchema.index({ status: 1 });

// Middleware
ConversationSchema.pre('save', function(this: IConversationDocument, next) {
  this.updatedAt = new Date();
  if (this.messages.length > 0) {
    this.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
  }
  next();
});

// Instance methods
ConversationSchema.methods.addMessage = function(
  this: IConversationDocument,
  messageId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: any
) {
  const message = {
    messageId,
    role,
    content,
    timestamp: new Date(),
    metadata: metadata || {},
  };
  
  this.messages.push(message);
  this.lastMessageAt = message.timestamp;
  this.updatedAt = new Date();
  
  return message;
};

ConversationSchema.methods.getLastMessage = function(this: IConversationDocument) {
  return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
};

ConversationSchema.methods.getMessagesByRole = function(this: IConversationDocument, role: 'user' | 'assistant' | 'system') {
  return this.messages.filter((message: any) => message.role === role);
};

ConversationSchema.methods.updateContext = function(this: IConversationDocument, updates: any) {
  this.context = { ...this.context, ...updates };
  this.updatedAt = new Date();
};

ConversationSchema.methods.addPendingAction = function(this: IConversationDocument, action: string, parameters: any, priority: number = 1) {
  this.context.pendingActions = this.context.pendingActions || [];
  this.context.pendingActions.push({
    action,
    parameters,
    priority,
  });
  this.updatedAt = new Date();
};

ConversationSchema.methods.removePendingAction = function(this: IConversationDocument, action: string) {
  this.context.pendingActions = this.context.pendingActions?.filter(
    (pendingAction: any) => pendingAction.action !== action
  ) || [];
  this.updatedAt = new Date();
};

ConversationSchema.methods.setFlag = function(this: IConversationDocument, flag: string, value: boolean) {
  if (!this.context.flags) {
    this.context.flags = {};
  }
  this.context.flags[flag] = value;
  this.updatedAt = new Date();
};

ConversationSchema.methods.generateSummary = function(this: IConversationDocument) {
  const userMessages = this.getMessagesByRole('user');
  const assistantMessages = this.getMessagesByRole('assistant');
  
  const summary = `Conversation with ${userMessages.length} user messages and ${assistantMessages.length} assistant responses. ` +
    `Current state: ${this.context.conversationState}. ` +
    `Topic: ${this.context.currentTopic || 'General tax filing assistance'}.`;
  
  this.summary = summary;
  return summary;
};

ConversationSchema.methods.getTokenCount = function(this: IConversationDocument) {
  return this.messages.reduce((total: number, message: any) => {
    return total + (message.metadata?.tokens || 0);
  }, 0);
};

ConversationSchema.methods.updateStatus = function(this: IConversationDocument, status: 'active' | 'paused' | 'completed' | 'archived') {
  this.status = status;
  this.updatedAt = new Date();
  return this.save();
};

ConversationSchema.methods.updateSummary = function(this: IConversationDocument, summary: string) {
  this.summary = summary;
  this.updatedAt = new Date();
  return this.save();
};

// Static methods
ConversationSchema.statics.findBySessionId = function(sessionId: string) {
  return this.find({ sessionId }).sort({ createdAt: -1 });
};

ConversationSchema.statics.findActiveBySessionId = function(sessionId: string) {
  return this.find({ sessionId, status: 'active' }).sort({ createdAt: -1 });
};

ConversationSchema.statics.findByConversationId = function(conversationId: string) {
  return this.findOne({ conversationId });
};

ConversationSchema.statics.getRecentConversations = function(sessionId: string, limit: number = 10) {
  return this.find({ sessionId })
    .sort({ lastMessageAt: -1 })
    .limit(limit);
};

ConversationSchema.statics.archiveOldConversations = function(daysOld: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.updateMany(
    { 
      lastMessageAt: { $lt: cutoffDate },
      status: { $ne: 'archived' }
    },
    { status: 'archived' }
  );
};

export default mongoose.model<IConversationDocument>('Conversation', ConversationSchema);