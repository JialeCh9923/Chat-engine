import { Router, Request, Response, NextFunction } from 'express';
import { DocumentController } from '../controllers/documentController';
import {
  validateDocumentUpload,
  validateDocumentId,
  validateSessionId,
  validateUpdateDocument,
  validatePagination,
  handleValidationErrors,
  validateFileUpload,
} from '../middleware/validation';
import { uploadRateLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest, authenticateApiKey } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { CustomApiError, asyncHandler } from '../middleware/errorHandler';
import { validateSessionFromHeader } from '../middleware/sessionValidation';

const router = Router();

/**
 * @route   POST /api/documents/upload/:sessionId
 * @desc    Upload document to session
 * @access  Private (API Key required)
 */
router.post(
  '/upload/:sessionId',
  authenticateApiKey,
  uploadRateLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    uploadSingle(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new CustomApiError('File size exceeds maximum allowed limit', 413, 'FILE_TOO_LARGE'));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new CustomApiError('Unexpected file field', 400, 'UNEXPECTED_FILE_FIELD'));
        }
        if (err.message && err.message.includes('File type not allowed')) {
          return next(err); // Pass through the custom error from multer fileFilter
        }
        return next(new CustomApiError('File upload failed', 400, 'FILE_UPLOAD_ERROR'));
      }
      next();
    });
  },
  validateSessionId,
  validateDocumentUpload,
  validateFileUpload,
  handleValidationErrors,
  asyncHandler(DocumentController.uploadDocument)
);

/**
 * @route   GET /api/documents
 * @desc    Get documents for current session
 * @access  Private (API Key required)
 */
router.get(
  '/',
  authenticateApiKey,
  validateSessionFromHeader,
  validatePagination,
  handleValidationErrors,
  asyncHandler(DocumentController.getDocuments)
);

/**
 * @route   GET /api/documents/stats
 * @desc    Get document statistics
 * @access  Private (API Key required)
 */
router.get(
  '/stats',
  authenticateApiKey,
  asyncHandler(DocumentController.getDocumentStats)
);

/**
 * @route   GET /api/documents/health
 * @desc    Document service health check
 * @access  Public
 */
router.get(
  '/health',
  asyncHandler(DocumentController.healthCheck)
);

/**
 * @route   GET /api/documents/session/:sessionId
 * @desc    Get documents by session ID
 * @access  Private (API Key required)
 */
router.get(
  '/session/:sessionId',
  authenticateApiKey,
  validateSessionId,
  validatePagination,
  handleValidationErrors,
  asyncHandler(DocumentController.getDocumentsBySession)
);

/**
 * @route   GET /api/documents/:documentId
 * @desc    Get document by ID
 * @access  Private (API Key required)
 */
router.get(
  '/:documentId',
  authenticateApiKey,
  validateSessionFromHeader,
  validateDocumentId,
  handleValidationErrors,
  asyncHandler(DocumentController.getDocument)
);

/**
 * @route   PUT /api/documents/:documentId
 * @desc    Update document metadata
 * @access  Private (API Key required)
 */
router.put(
  '/:documentId',
  authenticateApiKey,
  validateDocumentId,
  validateUpdateDocument,
  handleValidationErrors,
  asyncHandler(DocumentController.updateDocument)
);

/**
 * @route   DELETE /api/documents/:documentId
 * @desc    Delete document
 * @access  Private (API Key required)
 */
router.delete(
  '/:documentId',
  authenticateApiKey,
  validateSessionFromHeader,
  validateDocumentId,
  handleValidationErrors,
  asyncHandler(DocumentController.deleteDocument)
);

/**
 * @route   POST /api/documents/:documentId/process
 * @desc    Trigger document processing
 * @access  Private (API Key required)
 */
router.post(
  '/:documentId/process',
  authenticateApiKey,
  validateSessionFromHeader,
  validateDocumentId,
  handleValidationErrors,
  asyncHandler(DocumentController.processDocument)
);

/**
 * @route   POST /api/documents/:documentId/verify
 * @desc    Verify document integrity
 * @access  Private (API Key required)
 */
router.post(
  '/:documentId/verify',
  authenticateApiKey,
  validateDocumentId,
  handleValidationErrors,
  asyncHandler(DocumentController.verifyDocument)
);

/**
 * @route   GET /api/documents/:documentId/download
 * @desc    Download document
 * @access  Private (API Key required)
 */
router.get(
  '/:documentId/download',
  authenticateApiKey,
  validateDocumentId,
  handleValidationErrors,
  asyncHandler(DocumentController.downloadDocument)
);

/**
 * @route   POST /api/documents/cleanup
 * @desc    Clean up old documents
 * @access  Private (API Key required)
 */
router.post(
  '/cleanup',
  authenticateApiKey,
  asyncHandler(DocumentController.cleanupOldDocuments)
);

export { router as documentRoutes };