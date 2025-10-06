import mongoose, { Schema, Document } from 'mongoose';
import { IDocument } from '../types';

export type DocumentProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IDocumentDocument extends IDocument, Document {
  // Custom errors property for document processing errors
  documentErrors?: Array<{
    message: string;
    timestamp: Date;
    code?: string;
    details?: Record<string, any>;
  }>;
  
  // Instance methods
  updateProcessingStatus(status: DocumentProcessingStatus): Promise<IDocumentDocument>;
  setExtractedData(data: any): Promise<IDocumentDocument>;
  addEntity(entity: any): Promise<IDocumentDocument>;
  addTable(table: any): Promise<IDocumentDocument>;
  addForm(form: any): Promise<IDocumentDocument>;
  verify(verifiedBy: string): Promise<IDocumentDocument>;
  addTag(tag: string): Promise<IDocumentDocument>;
  removeTag(tag: string): Promise<IDocumentDocument>;
  incrementRetryCount(): Promise<IDocumentDocument>;
  getFileExtension(): string;
  isImage(): boolean;
  isPDF(): boolean;
  isProcessable(): boolean;
}

const DocumentSchema: Schema = new Schema({
  documentId: {
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
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  url: String,
  documentType: {
    type: String,
    enum: [
      'W2', '1099-MISC', '1099-INT', '1099-DIV', '1099-R', '1099-G',
      'W2G', '1098', '1098-E', '1098-T', 'K1', 'receipt', 'invoice',
      'bank_statement', 'investment_statement', 'other'
    ],
    default: 'other',
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  extractedData: {
    text: String,
    structuredData: {
      type: Map,
      of: Schema.Types.Mixed,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    entities: [{
      type: String,
      value: String,
      confidence: Number,
      boundingBox: {
        x: Number,
        y: Number,
        width: Number,
        height: Number,
      },
    }],
    tables: [{
      headers: [String],
      rows: [[String]],
      confidence: Number,
    }],
    forms: [{
      formType: String,
      fields: {
        type: Map,
        of: Schema.Types.Mixed,
      },
      confidence: Number,
    }],
  },
  metadata: {
    uploadedBy: String,
    processingEngine: String,
    processingVersion: String,
    processingTime: Number,
    retryCount: {
      type: Number,
      default: 0,
    },
    tags: [String],
    notes: String,
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: String,
    verifiedAt: Date,
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  documentErrors: [{
    code: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: Schema.Types.Mixed,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: Date,
}, {
  timestamps: true,
  versionKey: false,
});

// Indexes
DocumentSchema.index({ sessionId: 1, documentType: 1 });
DocumentSchema.index({ processingStatus: 1, createdAt: -1 });
DocumentSchema.index({ 'metadata.isVerified': 1 });

// Middleware
DocumentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.processingStatus === 'completed' && !this.processedAt) {
    this.processedAt = new Date();
  }
  next();
});

// Instance methods
DocumentSchema.methods.updateProcessingStatus = function(
  status: 'pending' | 'processing' | 'completed' | 'failed',
  error?: { code: string; message: string; details?: any }
) {
  this.processingStatus = status;
  this.updatedAt = new Date();
  
  if (status === 'completed') {
    this.processedAt = new Date();
  }
  
  if (error) {
    if (!this.documentErrors) {
      this.documentErrors = [];
    }
    this.documentErrors.push({
      code: error.code,
      message: error.message,
      timestamp: new Date(),
      details: error.details,
    });
  }
};

DocumentSchema.methods.setExtractedData = function(data: any) {
  this.extractedData = { ...this.extractedData, ...data };
  this.updatedAt = new Date();
};

DocumentSchema.methods.addEntity = function(type: string, value: string, confidence: number, boundingBox?: any) {
  if (!this.extractedData.entities) {
    this.extractedData.entities = [];
  }
  
  this.extractedData.entities.push({
    type,
    value,
    confidence,
    boundingBox,
  });
  this.updatedAt = new Date();
};

DocumentSchema.methods.addTable = function(headers: string[], rows: string[][], confidence: number) {
  if (!this.extractedData.tables) {
    this.extractedData.tables = [];
  }
  
  this.extractedData.tables.push({
    headers,
    rows,
    confidence,
  });
  this.updatedAt = new Date();
};

DocumentSchema.methods.addForm = function(formType: string, fields: any, confidence: number) {
  if (!this.extractedData.forms) {
    this.extractedData.forms = [];
  }
  
  this.extractedData.forms.push({
    formType,
    fields,
    confidence,
  });
  this.updatedAt = new Date();
};

DocumentSchema.methods.verify = function(verifiedBy: string) {
  this.metadata.isVerified = true;
  this.metadata.verifiedBy = verifiedBy;
  this.metadata.verifiedAt = new Date();
  this.updatedAt = new Date();
};

DocumentSchema.methods.addTag = function(tag: string) {
  if (!this.metadata.tags.includes(tag)) {
    this.metadata.tags.push(tag);
    this.updatedAt = new Date();
  }
};

DocumentSchema.methods.removeTag = function(tag: string) {
  if (this.metadata.tags) {
    this.metadata.tags = this.metadata.tags.filter((t: string) => t !== tag);
  }
  return this.save();
};

DocumentSchema.methods.incrementRetryCount = function() {
  this.metadata.retryCount += 1;
  this.updatedAt = new Date();
};

DocumentSchema.methods.getFileExtension = function() {
  return this.filename.split('.').pop()?.toLowerCase() || '';
};

DocumentSchema.methods.isImage = function() {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return imageTypes.includes(this.mimeType);
};

DocumentSchema.methods.isPDF = function() {
  return this.mimeType === 'application/pdf';
};

DocumentSchema.methods.isProcessable = function() {
  const processableTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  return processableTypes.includes(this.mimeType);
};

// Static methods
DocumentSchema.statics.findBySessionId = function(sessionId: string) {
  return this.find({ sessionId }).sort({ createdAt: -1 });
};

DocumentSchema.statics.findByDocumentId = function(documentId: string) {
  return this.findOne({ documentId });
};

DocumentSchema.statics.findByDocumentType = function(documentType: string) {
  return this.find({ documentType }).sort({ createdAt: -1 });
};

DocumentSchema.statics.findPendingProcessing = function() {
  return this.find({ processingStatus: 'pending' }).sort({ createdAt: 1 });
};

DocumentSchema.statics.findByProcessingStatus = function(status: string) {
  return this.find({ processingStatus: status }).sort({ createdAt: -1 });
};

DocumentSchema.statics.findVerified = function() {
  return this.find({ 'metadata.isVerified': true }).sort({ 'metadata.verifiedAt': -1 });
};

DocumentSchema.statics.findUnverified = function() {
  return this.find({ 'metadata.isVerified': false }).sort({ createdAt: -1 });
};

DocumentSchema.statics.getSessionDocumentStats = function(sessionId: string) {
  return this.aggregate([
    { $match: { sessionId } },
    {
      $group: {
        _id: '$processingStatus',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' },
      }
    }
  ]);
};

DocumentSchema.statics.cleanupFailedDocuments = function(daysOld: number = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    processingStatus: 'failed',
    createdAt: { $lt: cutoffDate }
  });
};

export default mongoose.model<IDocumentDocument>('Document', DocumentSchema);