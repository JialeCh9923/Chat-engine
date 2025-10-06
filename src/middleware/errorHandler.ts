import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { AuthUtils } from '../utils/auth';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Custom error class for API errors
 */
export class CustomApiError extends Error implements ApiError {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'CustomApiError';
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.details = details;
  }
}

/**
 * Error handler middleware
 */
export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    code: error.code,
    url: req.url,
    method: req.method,
    clientId: req.client?.clientId,
    sessionId: req.session?.sessionId,
    userAgent: req.headers['user-agent'],
    ip: AuthUtils.getClientIP(req),
    body: AuthUtils.maskSensitiveData(req.body),
    query: AuthUtils.maskSensitiveData(req.query),
  };

  if (error.statusCode && error.statusCode < 500) {
    logger.warn('Client error:', errorInfo);
  } else {
    logger.error('Server error:', errorInfo);
  }

  // Determine status code
  const statusCode = error.statusCode || 500;
  
  // Determine error code
  const errorCode = error.code || getErrorCodeFromStatus(statusCode);

  // Prepare error response
  const errorResponse: any = {
    error: errorCode,
    message: error.message,
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
  };

  // Add request ID if available
  if (req.headers['x-request-id']) {
    errorResponse.requestId = req.headers['x-request-id'];
  }

  // Add details for development environment
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = error.details;
    errorResponse.stack = error.stack;
  }

  // Add details for client errors (4xx)
  if (statusCode >= 400 && statusCode < 500 && error.details) {
    errorResponse.details = error.details;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new CustomApiError(
    `Route ${req.method} ${req.url} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );

  logger.warn('Route not found:', {
    method: req.method,
    url: req.url,
    ip: AuthUtils.getClientIP(req),
    userAgent: req.headers['user-agent'],
  });

  res.status(404).json({
    error: error.code,
    message: error.message,
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
  });
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
export const validationErrorHandler = (errors: any[]): CustomApiError => {
  const details = errors.map(error => ({
    field: error.path || error.param,
    message: error.msg || error.message,
    value: error.value,
    location: error.location,
  }));

  return new CustomApiError(
    'Validation failed',
    400,
    'VALIDATION_ERROR',
    { errors: details }
  );
};

/**
 * Database error handler
 */
export const handleDatabaseError = (error: any): CustomApiError => {
  // MongoDB duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'field';
    return new CustomApiError(
      `Duplicate value for ${field}`,
      409,
      'DUPLICATE_ENTRY',
      { field, value: error.keyValue?.[field] }
    );
  }

  // MongoDB validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value,
    }));

    return new CustomApiError(
      'Database validation failed',
      400,
      'DATABASE_VALIDATION_ERROR',
      { errors }
    );
  }

  // MongoDB cast error
  if (error.name === 'CastError') {
    return new CustomApiError(
      `Invalid ${error.path}: ${error.value}`,
      400,
      'INVALID_DATA_TYPE',
      { field: error.path, value: error.value, expectedType: error.kind }
    );
  }

  // Generic database error
  return new CustomApiError(
    'Database operation failed',
    500,
    'DATABASE_ERROR',
    process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined
  );
};

/**
 * OpenAI API error handler
 */
export const handleOpenAIError = (error: any): CustomApiError => {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 401:
        return new CustomApiError(
          'OpenAI API authentication failed',
          500,
          'OPENAI_AUTH_ERROR'
        );
      case 429:
        return new CustomApiError(
          'OpenAI API rate limit exceeded',
          429,
          'OPENAI_RATE_LIMIT'
        );
      case 400:
        return new CustomApiError(
          'Invalid request to OpenAI API',
          400,
          'OPENAI_BAD_REQUEST',
          { details: data?.error?.message }
        );
      default:
        return new CustomApiError(
          'OpenAI API error',
          500,
          'OPENAI_ERROR',
          { status, message: data?.error?.message }
        );
    }
  }

  return new CustomApiError(
    'OpenAI service unavailable',
    503,
    'OPENAI_UNAVAILABLE'
  );
};

/**
 * File upload error handler
 */
export const handleFileUploadError = (error: any): CustomApiError => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new CustomApiError(
      'File size exceeds maximum allowed limit',
      413,
      'FILE_TOO_LARGE',
      { maxSize: error.limit }
    );
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return new CustomApiError(
      'Too many files uploaded',
      413,
      'TOO_MANY_FILES',
      { maxCount: error.limit }
    );
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new CustomApiError(
      'Unexpected file field',
      400,
      'UNEXPECTED_FILE_FIELD',
      { field: error.field }
    );
  }

  return new CustomApiError(
    'File upload failed',
    400,
    'FILE_UPLOAD_ERROR',
    { originalError: error.message }
  );
};

/**
 * Get error code from HTTP status
 */
function getErrorCodeFromStatus(status: number): string {
  const statusCodes: { [key: number]: string } = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT',
  };

  return statusCodes[status] || 'UNKNOWN_ERROR';
}

/**
 * Create standardized error responses
 */
export const createError = {
  badRequest: (message: string, details?: any) => 
    new CustomApiError(message, 400, 'BAD_REQUEST', details),
  
  unauthorized: (message: string = 'Authentication required') => 
    new CustomApiError(message, 401, 'UNAUTHORIZED'),
  
  forbidden: (message: string = 'Access denied') => 
    new CustomApiError(message, 403, 'FORBIDDEN'),
  
  notFound: (message: string = 'Resource not found') => 
    new CustomApiError(message, 404, 'NOT_FOUND'),
  
  conflict: (message: string, details?: any) => 
    new CustomApiError(message, 409, 'CONFLICT', details),
  
  tooManyRequests: (message: string = 'Rate limit exceeded') => 
    new CustomApiError(message, 429, 'TOO_MANY_REQUESTS'),
  
  internal: (message: string = 'Internal server error', details?: any) => 
    new CustomApiError(message, 500, 'INTERNAL_SERVER_ERROR', details),
  
  serviceUnavailable: (message: string = 'Service temporarily unavailable') => 
    new CustomApiError(message, 503, 'SERVICE_UNAVAILABLE'),
};

// Aliases for backward compatibility
export const openaiErrorHandler = handleOpenAIError;
export const fileUploadErrorHandler = handleFileUploadError;
export const databaseErrorHandler = handleDatabaseError;

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler,
  handleDatabaseError,
  handleOpenAIError,
  handleFileUploadError,
  CustomApiError,
  createError,
};