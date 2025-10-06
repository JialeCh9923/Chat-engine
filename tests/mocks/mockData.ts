import { Types } from 'mongoose';

// Factory functions to generate unique mock data for each test
export const createMockUser = (overrides: any = {}) => ({
  _id: new Types.ObjectId(),
  email: 'test@example.com',
  password: 'hashedPassword123',
  firstName: 'John',
  lastName: 'Doe',
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createMockSession = (overrides: any = {}) => {
  const sessionId = `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    _id: new Types.ObjectId(),
    sessionId,
    userId: new Types.ObjectId(),
    clientId: 'test-client-123',
    status: 'active',
    isActive: true,
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    metadata: {
      filingYear: 2023,
      filingType: 'individual',
      taxpayerInfo: {},
      preferences: {
        language: 'en',
        timezone: 'UTC',
        notifications: true
      },
      progress: {
        currentStep: 'initial',
        completedSteps: [],
        totalSteps: 0,
        percentComplete: 0
      },
      customData: new Map()
    },
    conversationHistory: [],
    documents: [],
    jobs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

export const createMockConversation = (sessionId?: string, overrides: any = {}) => {
  const conversationId = `test-conversation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    _id: new Types.ObjectId(),
    conversationId,
    sessionId: sessionId || `test-session-${Date.now()}`,
    userId: new Types.ObjectId(),
    title: 'Tax Filing Conversation',
    status: 'active',
    messages: [
      {
        messageId: 'msg-1',
        role: 'user',
        content: 'I need help filing my taxes',
        timestamp: new Date(),
        metadata: {}
      },
      {
        messageId: 'msg-2',
        role: 'assistant',
        content: 'I\'d be happy to help you with your tax filing. Let\'s start by gathering some basic information.',
        timestamp: new Date(),
        metadata: {}
      }
    ],
    context: {
      currentTopic: 'tax_filing',
      extractedData: new Map(),
      userIntent: 'file_taxes',
      conversationState: 'data_collection',
      pendingActions: [],
      flags: {
        requiresHumanReview: false,
        hasErrors: false,
        isComplete: false
      }
    },
    summary: 'User seeking help with tax filing',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessageAt: new Date(),
    ...overrides
  };
};

export const createMockDocument = (sessionId?: string, overrides: any = {}) => {
  const documentId = `test-document-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    _id: new Types.ObjectId(),
    documentId,
    sessionId: sessionId || `test-session-${Date.now()}`,
    userId: new Types.ObjectId(),
    filename: 'w2-form.pdf',
    originalName: 'W2_2023.pdf',
    mimeType: 'application/pdf',
    size: 1024000,
    path: '/uploads/test/w2-form.pdf',
    documentType: 'W2',
    processingStatus: 'completed',
    extractedData: {
      text: 'Sample W2 text content',
      structuredData: new Map(),
      confidence: 0.95,
      entities: []
    },
    uploadDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

export const createMockJob = (sessionId?: string, overrides: any = {}) => {
  // Generate job ID in the format expected by validation: [a-z0-9]+_[a-f0-9]+
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(16).substr(2, 12); // Generate hex string
  const jobId = `testjob${timestamp}_${randomPart}`;
  
  return {
    _id: new Types.ObjectId(),
    jobId,
    sessionId: sessionId || `test-session-${Date.now()}`,
    userId: new Types.ObjectId(),
    type: 'tax_calculation',
    status: 'completed',
    priority: 1,
    data: {
      income: 50000,
      deductions: 12000,
      filingStatus: 'single'
    },
    result: {
      taxOwed: 5000,
      refund: 0,
      effectiveRate: 10
    },
    progress: 100,
    errors: [],
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: new Date(),
    ...overrides
  };
};

// Legacy exports for backward compatibility
export const mockUser = createMockUser();
export const mockSession = createMockSession();
export const mockConversation = createMockConversation(mockSession.sessionId);
export const mockDocument = createMockDocument(mockSession.sessionId);
export const mockJob = createMockJob(mockSession.sessionId);

export const mockTaxForm = {
  formType: '1040',
  taxYear: 2023,
  fields: {
    firstName: 'John',
    lastName: 'Doe',
    ssn: '123-45-6789',
    filingStatus: 'single',
    income: 50000,
    standardDeduction: 12000
  },
  calculations: {
    adjustedGrossIncome: 50000,
    taxableIncome: 38000,
    taxOwed: 5000
  }
};

export const createMockRequest = (overrides: any = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: mockUser,
  session: mockSession,
  ...overrides
});

export const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.write = jest.fn().mockReturnValue(res);
  return res;
};