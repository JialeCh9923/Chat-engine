import { Request, Response } from 'express';
import { documentService } from '../services/documentService';
import logger from '../utils/logger';
import { CustomApiError, asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Document controller for handling document-related API operations
 */
export class DocumentController {
  /**
   * Upload document
   */
  static async uploadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { documentType, metadata } = req.body;
      const file = req.file;

      if (!file) {
        throw new CustomApiError('No file uploaded', 400);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== sessionId) {
        throw new CustomApiError('Access denied to session', 403);
      }

      const document = await documentService.uploadDocument(
        sessionId,
        file,
        documentType,
        metadata
      );

      logger.info('Document uploaded via API', {
        documentId: document.documentId,
        sessionId,
        clientId: req.client?.clientId,
        filename: file.originalname,
      });

      res.status(201).json({
        success: true,
        data: {
          documentId: document.documentId,
          sessionId: document.sessionId,
          filename: document.filename,
          originalName: document.originalName,
          mimeType: document.mimeType,
          size: document.size,
          documentType: document.documentType,
          processingStatus: document.processingStatus,
          url: document.url,
          createdAt: document.createdAt,
          metadata: document.metadata,
        },
        message: 'Document uploaded successfully',
      });
    } catch (error) {
      logger.error('Failed to upload document via API', {
        error,
        sessionId: req.params.sessionId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to upload document', 500);
    }
  }

  /**
   * Get document by ID
   */
  static async getDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const document = await documentService.getDocument(documentId);

      if (!document) {
        throw new CustomApiError('Document not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== document.sessionId) {
        throw new CustomApiError('Access denied to document', 403);
      }

      logger.debug('Document retrieved via API', {
        documentId,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          documentId: document.documentId,
          sessionId: document.sessionId,
          filename: document.filename,
          originalName: document.originalName,
          mimeType: document.mimeType,
          size: document.size,
          documentType: document.documentType,
          processingStatus: document.processingStatus,
          url: document.url,
          extractedData: document.extractedData,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          processedAt: document.processedAt,
          metadata: document.metadata,
          errors: document.errors,
        },
      });
    } catch (error) {
      logger.error('Failed to get document via API', {
        error,
        documentId: req.params.documentId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve document', 500);
    }
  }

  /**
   * Get documents for current session
   */
  static async getDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const sessionId = req.session?.sessionId;
      
      if (!sessionId) {
        throw new CustomApiError('Session ID is required', 400);
      }

      const {
        documentType,
        processingStatus,
        status,
        page = '1',
        limit = '20',
        sort = 'createdAt',
        order = 'desc',
      } = req.query;

      // Map status parameter to processingStatus for backward compatibility
      let finalProcessingStatus = processingStatus as string;
      if (status && !processingStatus) {
        // Map 'processed' to 'completed' to match the model
        finalProcessingStatus = status === 'processed' ? 'completed' : status as string;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const sortOrder = order === 'asc' ? 1 : -1;
      const sortObj = { [sort as string]: sortOrder };

      const documents = await documentService.getDocumentsBySession(sessionId, {
        documentType: documentType as string,
        processingStatus: finalProcessingStatus,
        limit: limitNum,
        skip,
        sort: sortObj,
      });

      logger.debug('Documents retrieved for current session via API', {
        sessionId,
        count: documents.length,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        documents: documents.map(doc => ({
          documentId: doc.documentId,
          sessionId: doc.sessionId,
          filename: doc.filename,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          size: doc.size,
          documentType: doc.documentType,
          processingStatus: doc.processingStatus,
          status: doc.processingStatus === 'completed' ? 'processed' : doc.processingStatus,
          url: doc.url,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          processedAt: doc.processedAt,
          metadata: {
            ...doc.metadata,
            documentType: doc.documentType,
          },
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: documents.length,
          hasMore: documents.length === limitNum,
        },
      });
    } catch (error) {
      logger.error('Failed to get documents for current session via API', {
        error,
        sessionId: req.session?.sessionId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve documents', 500);
    }
  }

  /**
   * Get documents by session
   */
  static async getDocumentsBySession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const {
        documentType,
        processingStatus,
        page = '1',
        limit = '20',
        sort = 'createdAt',
        order = 'desc',
      } = req.query;

      // Verify session ownership
      if (req.session && req.session.sessionId !== sessionId) {
        throw new CustomApiError('Access denied to session', 403);
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const sortOrder = order === 'asc' ? 1 : -1;
      const sortObj = { [sort as string]: sortOrder };

      const documents = await documentService.getDocumentsBySession(sessionId, {
        documentType: documentType as string,
        processingStatus: processingStatus as string,
        limit: limitNum,
        skip,
        sort: sortObj,
      });

      logger.debug('Documents retrieved by session via API', {
        sessionId,
        count: documents.length,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: documents.map(doc => ({
          documentId: doc.documentId,
          sessionId: doc.sessionId,
          filename: doc.filename,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          size: doc.size,
          documentType: doc.documentType,
          processingStatus: doc.processingStatus,
          url: doc.url,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          processedAt: doc.processedAt,
          metadata: doc.metadata,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: documents.length,
          hasMore: documents.length === limitNum,
        },
      });
    } catch (error) {
      logger.error('Failed to get documents by session via API', {
        error,
        sessionId: req.params.sessionId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve documents', 500);
    }
  }

  /**
   * Update document
   */
  static async updateDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const { documentType, metadata, tags } = req.body;

      const document = await documentService.getDocument(documentId);

      if (!document) {
        throw new CustomApiError('Document not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== document.sessionId) {
        throw new CustomApiError('Access denied to document', 403);
      }

      const updatedDocument = await documentService.updateDocument(documentId, {
        documentType,
        metadata,
        tags,
      });

      if (!updatedDocument) {
        throw new CustomApiError('Failed to update document', 500);
      }

      logger.info('Document updated via API', {
        documentId,
        clientId: req.client?.clientId,
        updates: Object.keys(req.body),
      });

      res.json({
        success: true,
        data: {
          documentId: updatedDocument.documentId,
          sessionId: updatedDocument.sessionId,
          filename: updatedDocument.filename,
          originalName: updatedDocument.originalName,
          mimeType: updatedDocument.mimeType,
          size: updatedDocument.size,
          documentType: updatedDocument.documentType,
          processingStatus: updatedDocument.processingStatus,
          url: updatedDocument.url,
          extractedData: updatedDocument.extractedData,
          createdAt: updatedDocument.createdAt,
          updatedAt: updatedDocument.updatedAt,
          processedAt: updatedDocument.processedAt,
          metadata: updatedDocument.metadata,
          errors: updatedDocument.errors,
        },
        message: 'Document updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update document via API', {
        error,
        documentId: req.params.documentId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to update document', 500);
    }
  }

  /**
   * Delete document
   */
  static async deleteDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const document = await documentService.getDocument(documentId);

      if (!document) {
        throw new CustomApiError('Document not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== document.sessionId) {
        throw new CustomApiError('Access denied to document', 403);
      }

      const deleted = await documentService.deleteDocument(documentId);

      if (!deleted) {
        throw new CustomApiError('Failed to delete document', 500);
      }

      logger.info('Document deleted via API', {
        documentId,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete document via API', {
        error,
        documentId: req.params.documentId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to delete document', 500);
    }
  }

  /**
   * Process document
   */
  static async processDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const document = await documentService.getDocument(documentId);

      if (!document) {
        throw new CustomApiError('Document not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== document.sessionId) {
        throw new CustomApiError('Access denied to document', 403);
      }

      // Check if document is already being processed or completed
      if (document.processingStatus === 'processing') {
        res.json({
          success: true,
          documentId,
          status: 'processing',
          message: 'Document is already being processed',
        });
        return;
      }

      if (document.processingStatus === 'completed') {
        res.json({
          success: true,
          documentId,
          status: 'completed',
          message: 'Document has already been processed',
        });
        return;
      }

      // Trigger processing
      await documentService.processDocument(documentId);

      logger.info('Document processing triggered via API', {
        documentId,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        documentId,
        status: 'processing',
        message: 'Document processing started',
      });
    } catch (error) {
      logger.error('Failed to process document via API', {
        error,
        documentId: req.params.documentId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to process document', 500);
    }
  }

  /**
   * Verify document integrity
   */
  static async verifyDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const document = await documentService.getDocument(documentId);

      if (!document) {
        throw new CustomApiError('Document not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== document.sessionId) {
        throw new CustomApiError('Access denied to document', 403);
      }

      const isValid = await documentService.verifyDocument(documentId);

      logger.info('Document verification via API', {
        documentId,
        isValid,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          documentId,
          isValid,
          verifiedAt: new Date(),
        },
        message: isValid ? 'Document is valid' : 'Document verification failed',
      });
    } catch (error) {
      logger.error('Failed to verify document via API', {
        error,
        documentId: req.params.documentId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to verify document', 500);
    }
  }

  /**
   * Download document
   */
  static async downloadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const document = await documentService.getDocument(documentId);

      if (!document) {
        throw new CustomApiError('Document not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== document.sessionId) {
        throw new CustomApiError('Access denied to document', 403);
      }

      logger.info('Document download via API', {
        documentId,
        clientId: req.client?.clientId,
      });

      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
      res.setHeader('Content-Length', document.size.toString());

      res.sendFile(document.path);
    } catch (error) {
      logger.error('Failed to download document via API', {
        error,
        documentId: req.params.documentId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to download document', 500);
    }
  }

  /**
   * Get document statistics
   */
  static async getDocumentStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await documentService.getDocumentStats();

      logger.debug('Document statistics retrieved via API', {
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get document statistics via API', {
        error,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve document statistics', 500);
    }
  }

  /**
   * Cleanup old documents
   */
  static async cleanupOldDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { olderThanDays = '90' } = req.query;
      const days = parseInt(olderThanDays as string, 10);

      const deletedCount = await documentService.cleanupOldDocuments(days);

      logger.info('Old documents cleanup via API', {
        deletedCount,
        olderThanDays: days,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          deletedCount,
          olderThanDays: days,
        },
        message: `Cleaned up ${deletedCount} old documents`,
      });
    } catch (error) {
      logger.error('Failed to cleanup old documents via API', {
        error,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to cleanup old documents', 500);
    }
  }

  /**
   * Health check
   */
  static healthCheck = asyncHandler(async (req: Request, res: Response) => {
    const stats = await documentService.getDocumentStats();

    res.json({
      success: true,
      service: 'DocumentService',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      stats: {
        totalDocuments: stats.total,
        totalSize: stats.totalSize,
        averageSize: Math.round(stats.averageSize),
      },
    });
  });
}

export default DocumentController;