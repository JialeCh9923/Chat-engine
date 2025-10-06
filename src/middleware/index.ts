// Authentication middleware
export {
  authenticateApiKey,
  authenticateJWT,
  optionalAuth,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  validateSessionOwnership,
} from './auth';

// Error handling middleware
export {
  CustomApiError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler,
  databaseErrorHandler,
  openaiErrorHandler,
  fileUploadErrorHandler,
} from './errorHandler';

// Validation middleware
export {
  handleValidationErrors,
  validateCreateSession,
  validateUpdateSession,
  validateSessionId,
  validateCreateConversation,
  validateAddMessage,
  validateConversationId,
  validateDocumentUpload,
  validateDocumentId,
  validateUpdateDocument,
  validateCreateJob,
  validateJobId,
  validateUpdateJob,
  validateCreateTaxForm,
  validateFormId,
  validateUpdateTaxForm,
  validateCreateClient,
  validateClientId,
  validatePagination,
  validateDateRange,
  validateFileUpload,
  customValidators,
} from './validation';

// Rate limiting middleware
export {
  createRateLimiter,
  globalRateLimiter,
  apiRateLimiter,
  uploadRateLimiter,
  conversationRateLimiter,
  sessionRateLimiter,
  jobRateLimiter,
  clientRateLimiter,
  AdaptiveRateLimiter,
  burstRateLimiter,
  sensitiveOperationRateLimiter,
} from './rateLimiter';