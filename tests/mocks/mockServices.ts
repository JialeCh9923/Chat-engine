// Mock OpenAI Service
export const mockOpenAIService = {
  generateResponse: jest.fn().mockResolvedValue({
    content: 'This is a mock AI response for tax filing assistance.',
    usage: {
      prompt_tokens: 50,
      completion_tokens: 25,
      total_tokens: 75
    }
  }),
  
  analyzeDocument: jest.fn().mockResolvedValue({
    documentType: 'W2',
    extractedData: {
      employer: 'Test Company Inc.',
      wages: 50000,
      federalTaxWithheld: 5000
    },
    confidence: 0.95
  }),
  
  calculateTax: jest.fn().mockResolvedValue({
    taxOwed: 5000,
    refund: 0,
    effectiveRate: 10,
    marginalRate: 12
  })
};

// Mock Email Service
export const mockEmailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendTaxFilingConfirmation: jest.fn().mockResolvedValue(true)
};

// Mock File Storage Service
export const mockFileStorageService = {
  uploadFile: jest.fn().mockResolvedValue({
    filename: 'test-file.pdf',
    path: '/uploads/test/test-file.pdf',
    size: 1024000
  }),
  
  deleteFile: jest.fn().mockResolvedValue(true),
  
  getFileUrl: jest.fn().mockReturnValue('/uploads/test/test-file.pdf')
};

// Mock External Tax API
export const mockTaxAPI = {
  submitTaxReturn: jest.fn().mockResolvedValue({
    submissionId: 'TAX-2023-123456',
    status: 'accepted',
    confirmationNumber: 'CONF-789012'
  }),
  
  getSubmissionStatus: jest.fn().mockResolvedValue({
    status: 'processed',
    refundAmount: 1500,
    processingDate: new Date()
  }),
  
  validateTaxpayerInfo: jest.fn().mockResolvedValue({
    isValid: true,
    taxpayerId: 'TP-123456789'
  })
};

// Mock Redis Cache
export const mockRedisCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1)
};

// Mock WebSocket Service
export const mockWebSocketService = {
  emit: jest.fn(),
  broadcast: jest.fn(),
  sendToSession: jest.fn(),
  sendToUser: jest.fn()
};

// Reset all mocks
export const resetAllMocks = () => {
  Object.values(mockOpenAIService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockEmailService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockFileStorageService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockTaxAPI).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockRedisCache).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockWebSocketService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
};