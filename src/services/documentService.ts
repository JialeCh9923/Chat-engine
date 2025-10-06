import Document, { IDocumentDocument } from '../models/Document';
import { sessionService } from './sessionService';
import { openaiService } from './openaiService';
import logger from '../utils/logger';
import { AuthUtils } from '../utils/auth';
import { config } from '../config';
import { CustomApiError } from '../middleware/errorHandler';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Document service for file upload and processing
 */
export class DocumentService {
  private static instance: DocumentService;
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDirectory();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DocumentService {
    if (!DocumentService.instance) {
      DocumentService.instance = new DocumentService();
    }
    return DocumentService.instance;
  }

  /**
   * Initialize the document service
   */
  async initialize(): Promise<void> {
    try {
      // Ensure upload directory exists
      await this.ensureUploadDirectory();
      
      // Cleanup old documents on startup
      await this.cleanupOldDocuments(90);
      
      logger.info('Document service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize document service', { error });
      throw error;
    }
  }

  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      logger.info('Upload directory created', { uploadDir: this.uploadDir });
    }
  }

  /**
   * Upload and process document
   */
  async uploadDocument(
    sessionId: string,
    file: Express.Multer.File,
    documentType?: string,
    metadata?: any
  ): Promise<IDocumentDocument> {
    try {
      // Verify session exists
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        throw new CustomApiError('Session not found', 400, 'SESSION_NOT_FOUND');
      }

      // Generate unique document ID and filename
      const documentId = AuthUtils.generateUniqueId();
      const fileExtension = path.extname(file.originalname);
      const filename = `${documentId}${fileExtension}`;
      const filePath = path.join(this.uploadDir, filename);

      // Save file to disk
      await fs.writeFile(filePath, file.buffer);

      // Calculate file hash for integrity
      const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

      // Create document record
      const documentData = {
        documentId,
        sessionId,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: filePath,
        url: `/uploads/${filename}`,
        documentType: documentType || this.detectDocumentType(file.originalname, file.mimetype),
        processingStatus: 'pending',
        extractedData: {
          text: '',
          structuredData: {},
          confidence: 0,
          entities: [],
          tables: [],
          forms: [],
        },
        metadata: {
          uploadedBy: session.clientId,
          processingEngine: 'openai',
          retryCount: 0,
          tags: metadata?.tags || [],
          isVerified: false,
          fileHash,
          ...metadata,
        },
        errors: [],
      };

      const document = new Document(documentData);
      await document.save();

      // Add document to session
      await sessionService.addDocument(sessionId, documentId);

      // Start processing asynchronously
      this.processDocumentAsync(documentId);

      logger.info('Document uploaded', {
        documentId,
        sessionId,
        filename: file.originalname,
        size: file.size,
        type: documentData.documentType,
      });

      return document;
    } catch (error) {
      logger.error('Failed to upload document', { error, sessionId });
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<IDocumentDocument | null> {
    try {
      const document = await Document.findOne({ documentId });
      
      if (document) {
        logger.debug('Document retrieved', { documentId });
      }

      return document;
    } catch (error) {
      logger.error('Failed to get document', { error, documentId });
      throw error;
    }
  }

  /**
   * Get documents by session
   */
  async getDocumentsBySession(
    sessionId: string,
    options: {
      documentType?: string;
      processingStatus?: string;
      limit?: number;
      skip?: number;
      sort?: any;
    } = {}
  ): Promise<IDocumentDocument[]> {
    try {
      const query: any = { sessionId };
      
      if (options.documentType) {
        query.documentType = options.documentType;
      }

      if (options.processingStatus) {
        query.processingStatus = options.processingStatus;
      }

      const documents = await Document.find(query)
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);

      logger.debug('Documents retrieved by session', {
        sessionId,
        count: documents.length,
        options,
      });

      return documents;
    } catch (error) {
      logger.error('Failed to get documents by session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Process document (public method)
   */
  async processDocument(documentId: string): Promise<void> {
    await this.processDocumentAsync(documentId);
  }

  /**
   * Process document asynchronously
   */
  private async processDocumentAsync(documentId: string): Promise<void> {
    try {
      const document = await this.getDocument(documentId);
      
      if (!document) {
        logger.error('Document not found for processing', { documentId });
        return;
      }

      // Update status to processing
      await document.updateProcessingStatus('processing');

      // Extract text from document
      const extractedText = await this.extractTextFromFile(document.path, document.mimeType);

      // Process with AI if text was extracted
      let structuredData = {};
      let entities: any[] = [];
      let confidence = 0;

      if (extractedText) {
        const aiAnalysis = await this.analyzeDocumentWithAI(extractedText, document.documentType);
        structuredData = aiAnalysis.structuredData;
        entities = aiAnalysis.entities;
        confidence = aiAnalysis.confidence;
      }

      // Update document with extracted data
      document.extractedData = {
        text: extractedText,
        structuredData,
        confidence,
        entities,
        tables: [], // TODO: Implement table extraction
        forms: [], // TODO: Implement form detection
      };

      document.processedAt = new Date();
      await document.updateProcessingStatus('completed');

      logger.info('Document processed successfully', {
        documentId,
        textLength: extractedText.length,
        entitiesCount: entities.length,
        confidence,
      });
    } catch (error) {
      logger.error('Failed to process document', { error, documentId });
      
      // Update document with error
      const document = await this.getDocument(documentId);
      if (document) {
        if (!document.documentErrors) {
          document.documentErrors = [];
        }
        document.documentErrors.push({
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          code: 'PROCESSING_ERROR',
        });
        
        await document.updateProcessingStatus('failed');
      }
    }
  }

  /**
   * Extract text from file based on MIME type
   */
  private async extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
    try {
      switch (mimeType) {
        case 'text/plain':
          return await fs.readFile(filePath, 'utf-8');
        
        case 'application/pdf':
          // TODO: Implement PDF text extraction using pdf-parse or similar
          logger.warn('PDF text extraction not implemented', { filePath });
          return '';
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          // TODO: Implement Word document text extraction
          logger.warn('Word document text extraction not implemented', { filePath });
          return '';
        
        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
          // TODO: Implement OCR using Tesseract or cloud OCR service
          logger.warn('Image OCR not implemented', { filePath });
          return '';
        
        default:
          logger.warn('Unsupported file type for text extraction', { mimeType, filePath });
          return '';
      }
    } catch (error) {
      logger.error('Failed to extract text from file', { error, filePath, mimeType });
      return '';
    }
  }

  /**
   * Analyze document with AI
   */
  private async analyzeDocumentWithAI(
    text: string,
    documentType: string
  ): Promise<{
    structuredData: any;
    entities: any[];
    confidence: number;
  }> {
    try {
      const systemPrompt = `You are a tax document analysis AI. Analyze the provided document text and extract structured data relevant to tax filing.

Document type: ${documentType}

Extract:
1. Key tax-related information (income, deductions, credits, etc.)
2. Named entities (names, dates, amounts, form numbers)
3. Structured data in JSON format
4. Confidence score (0-1)

Respond in JSON format only.`;

      const completion = await openaiService.generateChatCompletion([
        { messageId: '', role: 'system', content: systemPrompt, timestamp: new Date(), metadata: {} },
        { messageId: '', role: 'user', content: text, timestamp: new Date(), metadata: {} },
      ], undefined, {
        temperature: 0.1,
        maxTokens: 2000,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new Error('No response from AI analysis');
      }

      const analysis = JSON.parse(response);

      logger.debug('Document analyzed with AI', {
        documentType,
        textLength: text.length,
        confidence: analysis.confidence,
      });

      return {
        structuredData: analysis.structuredData || {},
        entities: analysis.entities || [],
        confidence: analysis.confidence || 0.5,
      };
    } catch (error) {
      logger.error('Failed to analyze document with AI', { error, documentType });
      
      return {
        structuredData: {},
        entities: [],
        confidence: 0,
      };
    }
  }

  /**
   * Detect document type from filename and MIME type
   */
  private detectDocumentType(filename: string, mimeType: string): string {
    const lowerFilename = filename.toLowerCase();
    
    // Check for specific tax forms
    if (lowerFilename.includes('w2') || lowerFilename.includes('w-2')) {
      return 'Form W-2';
    }
    
    if (lowerFilename.includes('1099')) {
      return 'Form 1099-MISC';
    }
    
    if (lowerFilename.includes('1040')) {
      return '1040';
    }
    
    // Check by MIME type
    if (mimeType.startsWith('image/')) {
      return 'other'; // Could be a scanned document
    }
    
    if (mimeType === 'application/pdf') {
      return 'other'; // Generic PDF document
    }
    
    return 'other';
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: string,
    updates: {
      documentType?: string;
      metadata?: any;
      tags?: string[];
    }
  ): Promise<IDocumentDocument | null> {
    try {
      const document = await this.getDocument(documentId);
      
      if (!document) {
        return null;
      }

      if (updates.documentType) {
        document.documentType = updates.documentType;
      }

      if (updates.metadata) {
        document.metadata = { ...document.metadata, ...updates.metadata };
      }

      if (updates.tags) {
        document.metadata.tags = updates.tags;
      }

      await document.save();

      logger.info('Document updated', { documentId, updates: Object.keys(updates) });

      return document;
    } catch (error) {
      logger.error('Failed to update document', { error, documentId });
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      const document = await this.getDocument(documentId);
      
      if (!document) {
        return false;
      }

      // Delete file from disk
      try {
        await fs.unlink(document.path);
      } catch (error) {
        logger.warn('Failed to delete file from disk', { error, path: document.path });
      }

      // Delete document record
      await Document.deleteOne({ documentId });

      logger.info('Document deleted', { documentId });

      return true;
    } catch (error) {
      logger.error('Failed to delete document', { error, documentId });
      throw error;
    }
  }

  /**
   * Verify document integrity
   */
  async verifyDocument(documentId: string): Promise<boolean> {
    try {
      const document = await this.getDocument(documentId);
      
      if (!document) {
        return false;
      }

      // Check if file exists
      try {
        await fs.access(document.path);
      } catch {
        logger.error('Document file not found', { documentId, path: document.path });
        return false;
      }

      // Verify file hash if available
      if (document.metadata.fileHash) {
        const fileBuffer = await fs.readFile(document.path);
        const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        
        if (currentHash !== document.metadata.fileHash) {
          logger.error('Document file hash mismatch', {
            documentId,
            expectedHash: document.metadata.fileHash,
            actualHash: currentHash,
          });
          return false;
        }
      }

      // Mark as verified
      document.metadata.isVerified = true;
      await document.save();

      logger.info('Document verified', { documentId });

      return true;
    } catch (error) {
      logger.error('Failed to verify document', { error, documentId });
      return false;
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    totalSize: number;
    averageSize: number;
  }> {
    try {
      const [
        total,
        typeStats,
        statusStats,
        sizeStats,
      ] = await Promise.all([
        Document.countDocuments(),
        Document.aggregate([
          { $group: { _id: '$documentType', count: { $sum: 1 } } },
        ]),
        Document.aggregate([
          { $group: { _id: '$processingStatus', count: { $sum: 1 } } },
        ]),
        Document.aggregate([
          {
            $group: {
              _id: null,
              totalSize: { $sum: '$size' },
              averageSize: { $avg: '$size' },
            },
          },
        ]),
      ]);

      const byType: Record<string, number> = {};
      typeStats.forEach((stat: any) => {
        byType[stat._id] = stat.count;
      });

      const byStatus: Record<string, number> = {};
      statusStats.forEach((stat: any) => {
        byStatus[stat._id] = stat.count;
      });

      const totalSize = sizeStats[0]?.totalSize || 0;
      const averageSize = sizeStats[0]?.averageSize || 0;

      return {
        total,
        byType,
        byStatus,
        totalSize,
        averageSize,
      };
    } catch (error) {
      logger.error('Failed to get document statistics', { error });
      throw error;
    }
  }

  /**
   * Cleanup old documents
   */
  async cleanupOldDocuments(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const oldDocuments = await Document.find({
        createdAt: { $lt: cutoffDate },
      });

      let deletedCount = 0;

      for (const document of oldDocuments) {
        try {
          await fs.unlink(document.path);
        } catch (error) {
          logger.warn('Failed to delete old document file', {
            error,
            documentId: document.documentId,
            path: document.path,
          });
        }

        await Document.deleteOne({ _id: document._id });
        deletedCount++;
      }

      logger.info('Old documents cleaned up', { deletedCount, olderThanDays });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old documents', { error, olderThanDays });
      throw error;
    }
  }
}

// Export singleton instance
export const documentService = DocumentService.getInstance();