export interface ISessionMetadata {
  filingYear?: number;
  filingType?: 'individual' | 'business' | 'partnership' | 'corporation';
  taxpayerInfo?: {
    name?: string;
    ssn?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  preferences?: {
    language?: string;
    timezone?: string;
    notifications?: boolean;
  };
  progress?: {
    currentStep?: string;
    completedSteps?: string[];
    totalSteps?: number;
    percentComplete?: number;
  };
  customData?: Map<string, any>;
}

export interface ISession {
  sessionId: string;
  clientId: string;
  userId?: string;
  status: 'active' | 'inactive' | 'completed' | 'expired';
  metadata: ISessionMetadata;
  conversationHistory: Array<{
    conversationId: string;
    timestamp: Date;
    summary?: string;
  }>;
  documents: Array<{
    documentId: string;
    filename?: string;
    uploadedAt: Date;
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  }>;
  jobs: Array<{
    jobId: string;
    type?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  isExpired(): boolean;
  isActive(): boolean;
  addConversation(conversationId: string, summary?: string): void;
  addDocument(documentId: string, filename: string): void;
  addJob(jobId: string, type: string): void;
  updateProgress(step: string, percentComplete?: number): void;
}

export interface IMessage {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    tokens?: number;
    model?: string;
    processingTime?: number;
    confidence?: number;
    intent?: string;
    entities?: Array<{
      type: string;
      value: string;
      confidence: number;
    }>;
    attachments?: Array<{
      type: string;
      url: string;
      filename: string;
      mimeType: string;
    }>;
    usage?: any;
    finishReason?: string;
    error?: boolean;
    fallback?: boolean;
    streaming?: boolean;
  };
}

export interface IConversationContext {
  currentTopic?: string;
  extractedData?: Map<string, any>;
  userIntent?: string;
  conversationState?: 'greeting' | 'data_collection' | 'document_review' | 'calculation' | 'review' | 'completion';
  pendingActions?: Array<{
    action: string;
    parameters: any;
    priority: number;
  }>;
  flags?: {
    requiresHumanReview?: boolean;
    hasErrors?: boolean;
    isComplete?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface IConversation {
  conversationId: string;
  sessionId: string;
  title?: string;
  messages: IMessage[];
  context: IConversationContext;
  summary?: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

export interface IDocument {
  documentId: string;
  sessionId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url?: string;
  documentType: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  extractedData: {
    text?: string;
    structuredData?: Record<string, any>;
    confidence?: number;
    entities?: Array<{
      type: string;
      value: string;
      confidence: number;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
    tables?: Array<{
      headers: string[];
      rows: string[][];
      confidence: number;
    }>;
    forms?: Array<{
      formType: string;
      fields: Record<string, any>;
      confidence: number;
    }>;
  };
  metadata: {
    uploadedBy?: string;
    processingEngine?: string;
    processingVersion?: string;
    processingTime?: number;
    retryCount?: number;
    tags?: string[];
    notes?: string;
    isVerified?: boolean;
    verifiedBy?: string;
    verifiedAt?: Date;
    customFields?: Record<string, any>;
    fileHash?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

export interface IJob {
  jobId: string;
  sessionId: string;
  type: 'document_processing' | 'tax_calculation' | 'form_generation' | 'data_validation' | 'report_generation' | 'notification' | 'cleanup' | 'backup' | 'other';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  data: {
    input?: any;
    output?: any;
    parameters?: any;
    context?: any;
  };
  progress: {
    current: number;
    total: number;
    message?: string;
    details?: any;
  };
  metadata: {
    createdBy?: string;
    assignedWorker?: string;
    estimatedDuration?: number;
    actualDuration?: number;
    retryCount: number;
    maxRetries: number;
    retryDelay: number;
    timeout: number;
    tags?: string[];
    dependencies?: string[];
    parentJobId?: string;
    childJobIds?: string[];
  };
  errors: Array<{
    code?: string;
    message?: string;
    stack?: string;
    timestamp: Date;
    retryable: boolean;
    details?: any;
  }>;
  logs: Array<{
    level: 'debug' | 'info' | 'warn' | 'error';
    message?: string;
    timestamp: Date;
    data?: any;
  }>;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  scheduledFor?: Date;
  expiresAt?: Date;
}

export interface IClient {
  clientId: string;
  name: string;
  email: string;
  apiKey: string;
  isActive: boolean;
  permissions: string[];
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    concurrentSessions: number;
    maxFileSize: number;
    maxFilesPerSession: number;
  };
  usage: {
    totalRequests: number;
    totalSessions: number;
    totalDocuments: number;
    totalTokens: number;
    lastRequestAt?: Date;
    currentPeriodRequests: number;
    currentPeriodStart: Date;
  };
  settings: {
    defaultSessionTimeout: number;
    allowedOrigins: string[];
    webhookUrl?: string;
    webhookSecret?: string;
    notificationPreferences: {
      email: boolean;
      webhook: boolean;
      events: string[];
    };
    customFields: Map<string, any>;
  };
  billing: {
    plan: 'free' | 'basic' | 'premium' | 'enterprise';
    billingCycle: 'monthly' | 'yearly';
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    usage: {
      sessions: number;
      documents: number;
      tokens: number;
      storage: number;
    };
    limits: {
      sessions?: number;
      documents?: number;
      tokens?: number;
      storage?: number;
    };
  };
  security: {
    ipWhitelist: string[];
    lastLoginAt?: Date;
    lastLoginIP?: string;
    failedLoginAttempts: number;
    lockedUntil?: Date;
    passwordChangedAt?: Date;
    twoFactorEnabled: boolean;
    apiKeyRotatedAt?: Date;
  };
  metadata: {
    company?: string;
    industry?: string;
    website?: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    timezone: string;
    language: string;
    tags: string[];
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

export interface ITaxForm {
  formId: string;
  sessionId: string;
  formType: string;
  taxYear: number;
  filingStatus?: string;
  status: 'draft' | 'in_progress' | 'review' | 'completed' | 'filed' | 'amended';
  data: {
    personalInfo: any;
    income: any;
    deductions: any;
    credits: any;
    calculations: any;
    customFields?: any;
  };
  validation: {
    errors: any[];
    warnings: any[];
    isValid: boolean;
    lastValidatedAt?: Date;
  };
  metadata: {
    createdBy?: string;
    lastModifiedBy?: string;
    version: number;
    revisionHistory: any[];
    tags: string[];
    notes?: string;
    estimatedCompletionTime?: number;
    actualCompletionTime?: number;
    complexity?: string;
    confidence?: number;
    reviewRequired?: boolean;
    reviewedBy?: string;
    reviewedAt?: Date;
    approvedBy?: string;
    approvedAt?: Date;
  };
  attachments: any[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  filedAt?: Date;
}

// API Request/Response Types
export interface CreateSessionRequest {
  clientId: string;
  userId: string;
  taxYear: number;
  filingType: string;
  configuration?: {
    language?: string;
    complexity?: string;
    preferences?: Record<string, any>;
  };
}

export interface CreateSessionResponse {
  sessionId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface ChatRequest {
  message: string;
  messageType?: 'text' | 'command' | 'file_reference';
  context?: Record<string, any>;
}

export interface ChatResponse {
  response: string;
  suggestions: string[];
  extractedData: Record<string, any>;
  nextStep: string;
  confidence: number;
}

export interface UploadDocumentRequest {
  documentType: string;
  description?: string;
}

export interface UploadDocumentResponse {
  documentId: string;
  extractedData: Record<string, any>;
  confidence: number;
  processingStatus: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: string;
  progress: number;
  result?: Record<string, any>;
  error?: string;
}

// SSE Event Types
export interface SSEEvent {
  type: 'session_update' | 'job_progress' | 'conversation_response' | 'document_processed' | 'error';
  data: Record<string, any>;
  timestamp: Date;
}

// Cache Types
export interface CacheConfig {
  ttl: number;
  max: number;
  updateAgeOnGet: boolean;
}

// Error Types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

// Authentication Types
export interface JWTPayload {
  clientId: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  client?: IClient;
  token?: string;
}