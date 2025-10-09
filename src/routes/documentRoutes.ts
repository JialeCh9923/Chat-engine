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
 * @swagger
 * /api/documents/upload/{sessionId}:
 *   post:
 *     summary: Upload document to session
 *     description: Upload a tax-related document (PDF, image, or spreadsheet) to a specific session for processing and analysis
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID to upload document to
 *         example: "sess_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Document file to upload (PDF, JPG, PNG, DOC, DOCX, XLS, XLSX)
 *               documentType:
 *                 type: string
 *                 enum: [tax_form, receipt, invoice, statement, other]
 *                 default: "other"
 *                 description: Type of document being uploaded
 *               taxYear:
 *                 type: integer
 *                 minimum: 2020
 *                 maximum: 2030
 *                 description: Tax year this document relates to
 *                 example: 2023
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional description of the document
 *                 example: "Q4 2023 business receipts"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tags for categorization
 *                 example: ["receipt", "business", "deduction"]
 *           encoding:
 *             document:
 *               contentType: application/pdf, image/jpeg, image/png, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentId:
 *                       type: string
 *                       example: "doc_1234567890"
 *                     filename:
 *                       type: string
 *                       example: "tax_return_2023.pdf"
 *                     originalName:
 *                       type: string
 *                       example: "my_tax_return_2023.pdf"
 *                     mimeType:
 *                       type: string
 *                       example: "application/pdf"
 *                     size:
 *                       type: integer
 *                       description: File size in bytes
 *                       example: 1048576
 *                     documentType:
 *                       type: string
 *                       example: "tax_form"
 *                     taxYear:
 *                       type: integer
 *                       example: 2023
 *                     status:
 *                       type: string
 *                       enum: [uploaded, processing, processed, failed]
 *                       example: "uploaded"
 *                     uploadDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-01T12:00:00.000Z"
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         pages:
 *                           type: integer
 *                           description: Number of pages (for PDFs)
 *                         textContent:
 *                           type: string
 *                           description: Extracted text content
 *                         confidence:
 *                           type: number
 *                           description: OCR confidence score (0-1)
 *                         extractedData:
 *                           type: object
 *                           description: AI-extracted structured data
 *       400:
 *         description: Bad request - Invalid file format or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       413:
 *         description: File too large - Exceeds maximum allowed size
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       415:
 *         description: Unsupported media type - File format not allowed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error - Upload processing failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Get documents for current session
 *     description: Retrieve all documents associated with the current session, with optional filtering and pagination
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: header
 *         name: X-Session-ID
 *         schema:
 *           type: string
 *         required: true
 *         description: Session ID to get documents for
 *         example: "sess_1234567890"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of documents per page
 *       - in: query
 *         name: documentType
 *         schema:
 *           type: string
 *           enum: [tax_form, receipt, invoice, statement, other]
 *         description: Filter by document type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [uploaded, processing, processed, failed]
 *         description: Filter by document processing status
 *       - in: query
 *         name: taxYear
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *         description: Filter by tax year
 *         example: 2023
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [uploadDate, filename, size, documentType]
 *           default: uploadDate
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       documentId:
 *                         type: string
 *                         example: "doc_1234567890"
 *                       filename:
 *                         type: string
 *                         example: "tax_return_2023.pdf"
 *                       originalName:
 *                         type: string
 *                         example: "my_tax_return_2023.pdf"
 *                       mimeType:
 *                         type: string
 *                         example: "application/pdf"
 *                       size:
 *                         type: integer
 *                         description: File size in bytes
 *                         example: 1048576
 *                       documentType:
 *                         type: string
 *                         enum: [tax_form, receipt, invoice, statement, other]
 *                         example: "tax_form"
 *                       taxYear:
 *                         type: integer
 *                         example: 2023
 *                       status:
 *                         type: string
 *                         enum: [uploaded, processing, processed, failed]
 *                         example: "processed"
 *                       uploadDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-01T12:00:00.000Z"
 *                       description:
 *                         type: string
 *                         example: "Q4 2023 business receipts"
 *                       tags:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["receipt", "business", "deduction"]
 *                       metadata:
 *                         type: object
 *                         properties:
 *                           pages:
 *                             type: integer
 *                             description: Number of pages (for PDFs)
 *                           textContent:
 *                             type: string
 *                             description: Extracted text content
 *                           confidence:
 *                             type: number
 *                             description: OCR confidence score (0-1)
 *                           extractedData:
 *                             type: object
 *                             description: AI-extracted structured data
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *                     totalItems:
 *                       type: integer
 *                       example: 45
 *                     itemsPerPage:
 *                       type: integer
 *                       example: 10
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key or missing session ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/documents/stats:
 *   get:
 *     summary: Get document statistics
 *     description: Retrieve comprehensive statistics about documents across all sessions, including counts, sizes, and processing status
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Document statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalDocuments:
 *                       type: integer
 *                       description: Total number of documents
 *                       example: 1250
 *                     totalSize:
 *                       type: integer
 *                       description: Total size of all documents in bytes
 *                       example: 524288000
 *                     byStatus:
 *                       type: object
 *                       properties:
 *                         uploaded:
 *                           type: integer
 *                           example: 50
 *                         processing:
 *                           type: integer
 *                           example: 25
 *                         processed:
 *                           type: integer
 *                           example: 1150
 *                         failed:
 *                           type: integer
 *                           example: 25
 *                     byType:
 *                       type: object
 *                       properties:
 *                         tax_form:
 *                           type: integer
 *                           example: 400
 *                         receipt:
 *                           type: integer
 *                           example: 600
 *                         invoice:
 *                           type: integer
 *                           example: 150
 *                         statement:
 *                           type: integer
 *                           example: 75
 *                         other:
 *                           type: integer
 *                           example: 25
 *                     byTaxYear:
 *                       type: object
 *                       properties:
 *                         "2023":
 *                           type: integer
 *                           example: 800
 *                         "2022":
 *                           type: integer
 *                           example: 450
 *                     recentUploads:
 *                       type: integer
 *                       description: Documents uploaded in last 24 hours
 *                       example: 15
 *                     averageFileSize:
 *                       type: number
 *                       description: Average file size in bytes
 *                       example: 419430
 *                     processingMetrics:
 *                       type: object
 *                       properties:
 *                         successRate:
 *                           type: number
 *                           description: Percentage of successful processing (0-1)
 *                           example: 0.95
 *                         averageProcessingTime:
 *                           type: number
 *                           description: Average processing time in seconds
 *                           example: 45.5
 *                         ocrAccuracy:
 *                           type: number
 *                           description: Average OCR accuracy (0-1)
 *                           example: 0.92
 *                     storageMetrics:
 *                       type: object
 *                       properties:
 *                       totalStorageUsed:
 *                         type: integer
 *                         description: Total storage used in bytes
 *                         example: 524288000
 *                       compressionRatio:
 *                         type: number
 *                         description: Average compression ratio
 *                         example: 0.75
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/stats',
  authenticateApiKey,
  asyncHandler(DocumentController.getDocumentStats)
);

/**
 * @swagger
 * /api/documents/health:
 *   get:
 *     summary: Health check for document service
 *     description: Check the health status of the document service and its dependencies (database, storage, processing)
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 service:
 *                   type: string
 *                   example: document-service
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 uptime:
 *                   type: number
 *                   description: Service uptime in seconds
 *                   example: 3600
 *                 dependencies:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: healthy
 *                         responseTime:
 *                           type: number
 *                           description: Response time in milliseconds
 *                           example: 15
 *                     storage:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: healthy
 *                         availableSpace:
 *                           type: number
 *                           description: Available space in bytes
 *                           example: 10737418240
 *                         usedSpace:
 *                           type: number
 *                           description: Used space in bytes
 *                           example: 5242880000
 *                     processing:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: healthy
 *                         queueSize:
 *                           type: integer
 *                           description: Number of documents in processing queue
 *                           example: 5
 *                         activeWorkers:
 *                           type: integer
 *                           description: Number of active processing workers
 *                           example: 3
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unhealthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 service:
 *                   type: string
 *                   example: document-service
 *                 error:
 *                   type: string
 *                   example: Database connection failed
 *                 dependencies:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: unhealthy
 *                         error:
 *                           type: string
 *                           example: Connection timeout
 *                     storage:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: healthy
 *                     processing:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: unhealthy
 *                         error:
 *                           type: string
 *                           example: OCR service unavailable
 */
router.get(
  '/health',
  asyncHandler(DocumentController.healthCheck)
);

/**
 * @swagger
 * /api/documents/session/{sessionId}:
 *   get:
 *     summary: Get documents by session ID
 *     description: Retrieve all documents associated with a specific session, with optional pagination and filtering
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9-_]{8,}$'
 *         description: Unique session identifier
 *       - in: header
 *         name: x-session-id
 *         schema:
 *           type: string
 *         description: Session ID for validation (optional)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: documentType
 *         schema:
 *           type: string
 *           enum: [tax_form, receipt, invoice, statement, other]
 *         description: Filter by document type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [uploaded, processing, processed, failed]
 *         description: Filter by processing status
 *       - in: query
 *         name: taxYear
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *         description: Filter by tax year
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [uploadedAt, processedAt, fileName, fileSize, documentType]
 *           default: uploadedAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 45
 *                     pages:
 *                       type: integer
 *                       example: 3
 *                     hasNext:
 *                       type: boolean
 *                       example: true
 *                     hasPrev:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Bad request - Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/documents/{documentId}:
 *   get:
 *     summary: Get document by ID
 *     description: Retrieve a specific document by its unique ID with full metadata and processing information
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9-_]{8,}$'
 *         description: Unique document identifier
 *       - in: header
 *         name: x-session-id
 *         schema:
 *           type: string
 *         description: Session ID for validation
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Document'
 *       400:
 *         description: Bad request - Invalid document ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/documents/{documentId}:
 *   put:
 *     summary: Update document metadata
 *     description: Update document metadata including description, tags, tax year, and other properties
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9-_]{8,}$'
 *         description: Unique document identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Updated document description
 *                 example: "Updated W-2 form for 2023 tax year"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *                 description: Updated list of tags
 *                 example: ["w2", "2023", "employment", "updated"]
 *               taxYear:
 *                 type: integer
 *                 minimum: 2020
 *                 maximum: 2030
 *                 description: Updated tax year
 *                 example: 2023
 *               documentType:
 *                 type: string
 *                 enum: [tax_form, receipt, invoice, statement, other]
 *                 description: Updated document type
 *                 example: "tax_form"
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *                 example: { "ocrConfidence": 0.95, "reviewed": true }
 *             minProperties: 1
 *           examples:
 *             updateDescription:
 *               summary: Update description only
 *               value:
 *                 description: "Updated W-2 form for 2023 tax year"
 *             updateTags:
 *               summary: Update tags only
 *               value:
 *                 tags: ["w2", "2023", "employment", "updated"]
 *             updateTaxYear:
 *               summary: Update tax year only
 *               value:
 *                 taxYear: 2023
 *             fullUpdate:
 *               summary: Update multiple fields
 *               value:
 *                 description: "Updated W-2 form for 2023 tax year"
 *                 tags: ["w2", "2023", "employment", "updated"]
 *                 taxYear: 2023
 *                 documentType: "tax_form"
 *                 metadata: { "ocrConfidence": 0.95, "reviewed": true }
 *     responses:
 *       200:
 *         description: Document updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Document'
 *       400:
 *         description: Bad request - Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/documents/{documentId}:
 *   delete:
 *     summary: Delete document
 *     description: Permanently delete a document and its associated files from storage
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9-_]{8,}$'
 *         description: Unique document identifier
 *       - in: header
 *         name: x-session-id
 *         schema:
 *           type: string
 *         description: Session ID for validation
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Document deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentId:
 *                       type: string
 *                       example: "doc_12345678"
 *                     fileName:
 *                       type: string
 *                       example: "w2_2023.pdf"
 *                     deletedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       400:
 *         description: Bad request - Invalid document ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/documents/{documentId}/process:
 *   post:
 *     summary: Trigger document processing
 *     description: Initiate processing of a document including OCR, text extraction, and AI analysis
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9-_]{8,}$'
 *         description: Unique document identifier
 *       - in: header
 *         name: x-session-id
 *         schema:
 *           type: string
 *         description: Session ID for validation
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: Force reprocessing even if already processed
 *                 example: false
 *               processingOptions:
 *                 type: object
 *                 properties:
 *                   extractText:
 *                     type: boolean
 *                     default: true
 *                     description: Extract text content using OCR
 *                   extractMetadata:
 *                     type: boolean
 *                     default: true
 *                     description: Extract document metadata
 *                   classifyDocument:
 *                     type: boolean
 *                     default: true
 *                     description: Classify document type
 *                   extractEntities:
 *                     type: boolean
 *                     default: true
 *                     description: Extract entities (names, amounts, dates)
 *                   validateFormat:
 *                     type: boolean
 *                     default: true
 *                     description: Validate document format and quality
 *           examples:
 *             default:
 *               summary: Default processing
 *               value: {}
 *             forceReprocess:
 *               summary: Force reprocessing
 *               value:
 *                 force: true
 *             customOptions:
 *               summary: Custom processing options
 *               value:
 *                 processingOptions:
 *                   extractText: true
 *                   extractMetadata: false
 *                   classifyDocument: true
 *                   extractEntities: true
 *                   validateFormat: true
 *     responses:
 *       200:
 *         description: Document processing initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Document processing initiated"
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentId:
 *                       type: string
 *                       example: "doc_12345678"
 *                     processingId:
 *                       type: string
 *                       example: "proc_abcdef123456"
 *                     status:
 *                       type: string
 *                       enum: [processing, queued]
 *                       example: "processing"
 *                     estimatedTime:
 *                       type: integer
 *                       description: Estimated processing time in seconds
 *                       example: 45
 *       400:
 *         description: Bad request - Invalid document ID or already processing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflict - Document already being processed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/documents/{documentId}/verify:
 *   post:
 *     summary: Verify document integrity
 *     description: Verify document integrity including checksum validation, format verification, and content authenticity checks
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9-_]{8,}$'
 *         description: Unique document identifier
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verificationLevel:
 *                 type: string
 *                 enum: [basic, standard, comprehensive]
 *                 default: standard
 *                 description: Level of verification to perform
 *                 example: "standard"
 *               checkIntegrity:
 *                 type: boolean
 *                 default: true
 *                 description: Check file integrity using stored checksum
 *               checkFormat:
 *                 type: boolean
 *                 default: true
 *                 description: Validate document format and structure
 *               checkContent:
 *                 type: boolean
 *                 default: false
 *                 description: Perform content verification (slower)
 *           examples:
 *             basic:
 *               summary: Basic verification
 *               value:
 *                 verificationLevel: "basic"
 *             standard:
 *               summary: Standard verification
 *               value:
 *                 verificationLevel: "standard"
 *             comprehensive:
 *               summary: Comprehensive verification
 *               value:
 *                 verificationLevel: "comprehensive"
 *                 checkContent: true
 *     responses:
 *       200:
 *         description: Document verification completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentId:
 *                       type: string
 *                       example: "doc_12345678"
 *                     verificationLevel:
 *                       type: string
 *                       example: "standard"
 *                     status:
 *                       type: string
 *                       enum: [valid, invalid, corrupted, unknown]
 *                       example: "valid"
 *                     checks:
 *                       type: object
 *                       properties:
 *                         integrity:
 *                           type: object
 *                           properties:
 *                             passed:
 *                               type: boolean
 *                               example: true
 *                             checksum:
 *                               type: string
 *                               example: "sha256:abcdef123456..."
 *                             verifiedAt:
 *                               type: string
 *                               format: date-time
 *                               example: "2024-01-15T10:30:00.000Z"
 *                         format:
 *                           type: object
 *                           properties:
 *                             passed:
 *                               type: boolean
 *                               example: true
 *                             format:
 *                               type: string
 *                               example: "application/pdf"
 *                             version:
 *                               type: string
 *                               example: "1.7"
 *                             pages:
 *                               type: integer
 *                               example: 2
 *                             size:
 *                               type: integer
 *                               description: File size in bytes
 *                               example: 524288
 *                         content:
 *                           type: object
 *                           properties:
 *                             passed:
 *                               type: boolean
 *                               example: true
 *                             issues:
 *                               type: array
 *                               items:
 *                                 type: string
 *                               example: []
 *                             warnings:
 *                               type: array
 *                               items:
 *                                 type: string
 *                               example: ["Low resolution detected"]
 *                     verifiedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *                     processingTime:
 *                       type: integer
 *                       description: Verification time in milliseconds
 *                       example: 1250
 *       400:
 *         description: Bad request - Invalid document ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:documentId/verify',
  authenticateApiKey,
  validateDocumentId,
  handleValidationErrors,
  asyncHandler(DocumentController.verifyDocument)
);

/**
 * @swagger
 * /api/documents/{documentId}/download:
 *   get:
 *     summary: Download document
 *     description: Download the original document file with proper content headers and filename preservation
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9-_]{8,}$'
 *         description: Unique document identifier
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [original, processed, ocr]
 *           default: original
 *         description: Download format (original file, processed version, or OCR text)
 *     responses:
 *       200:
 *         description: Document file downloaded successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *               description: PDF document file
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *               description: JPEG image file
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *               description: PNG image file
 *           application/vnd.openxmlformats-officedocument.wordprocessingml.document:
 *             schema:
 *               type: string
 *               format: binary
 *               description: Word document file
 *           text/plain:
 *             schema:
 *               type: string
 *               format: binary
 *               description: Text file (for OCR results)
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: attachment; filename="w2_2023.pdf"
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: application/pdf
 *           Content-Length:
 *             schema:
 *               type: integer
 *               example: 524288
 *       400:
 *         description: Bad request - Invalid document ID or format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/:documentId/download',
  authenticateApiKey,
  validateDocumentId,
  handleValidationErrors,
  asyncHandler(DocumentController.downloadDocument)
);

/**
 * @swagger
 * /api/documents/cleanup:
 *   post:
 *     summary: Clean up old documents
 *     description: Remove old documents and their associated files based on configurable retention policies
 *     tags: [Documents]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               olderThanDays:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 default: 30
 *                 description: Remove documents older than this many days
 *                 example: 30
 *               status:
 *                 type: string
 *                 enum: [uploaded, processing, processed, failed, all]
 *                 default: all
 *                 description: Filter by document status
 *                 example: "failed"
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *                 description: If true, only count documents without deleting
 *                 example: false
 *               batchSize:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000
 *                 default: 100
 *                 description: Number of documents to process per batch
 *                 example: 100
 *           examples:
 *             default:
 *               summary: Default cleanup (30 days)
 *               value: {}
 *             aggressive:
 *               summary: Aggressive cleanup (7 days)
 *               value:
 *                 olderThanDays: 7
 *             failedOnly:
 *               summary: Clean up failed documents
 *               value:
 *                 status: "failed"
 *                 olderThanDays: 1
 *             dryRun:
 *               summary: Dry run to count documents
 *               value:
 *                 dryRun: true
 *                 olderThanDays: 30
 *     responses:
 *       200:
 *         description: Cleanup operation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cleanup completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalProcessed:
 *                       type: integer
 *                       description: Total number of documents processed
 *                       example: 125
 *                     deleted:
 *                       type: integer
 *                       description: Number of documents actually deleted
 *                       example: 85
 *                     skipped:
 *                       type: integer
 *                       description: Number of documents skipped
 *                       example: 40
 *                     errors:
 *                       type: integer
 *                       description: Number of documents that failed to delete
 *                       example: 0
 *                     spaceRecovered:
 *                       type: integer
 *                       description: Storage space recovered in bytes
 *                       example: 5368709120
 *                     dryRun:
 *                       type: boolean
 *                       description: Whether this was a dry run
 *                       example: false
 *                     oldestDocument:
 *                       type: string
 *                       format: date-time
 *                       description: Date of oldest processed document
 *                       example: "2023-12-01T00:00:00.000Z"
 *                     newestDocument:
 *                       type: string
 *                       format: date-time
 *                       description: Date of newest processed document
 *                       example: "2023-12-15T00:00:00.000Z"
 *                     operationTime:
 *                       type: integer
 *                       description: Total operation time in milliseconds
 *                       example: 5234
 *       400:
 *         description: Bad request - Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/cleanup',
  authenticateApiKey,
  asyncHandler(DocumentController.cleanupOldDocuments)
);

export { router as documentRoutes };
