import request from 'supertest';
import { ChatEngineApp } from '../../src/app';
import TestHelper, { dbTestUtils, apiTestUtils } from '../utils/testUtils';
import { mockDocument } from '../mocks/mockData';

describe('Document API Endpoints', () => {
  let app: any;
  let testHelper: TestHelper;
  let testSessionId: string;

  beforeAll(async () => {
    const chatApp = new ChatEngineApp();
    await chatApp.initialize();
    app = chatApp.getApp();
    testHelper = new TestHelper(app);
  });

  beforeEach(async () => {
    const session = await dbTestUtils.createTestSession();
    testSessionId = session.sessionId;
  });

  describe('POST /api/documents/upload', () => {
    it('should upload document successfully', async () => {
      const testFile = testHelper.createTestFileBuffer('Test PDF content');
      
      const response = await testHelper.sessionRequest('post', `/api/documents/upload/${testSessionId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .attach('document', testFile, 'test-w2.pdf')
        .field('documentType', 'W2')
        .field('description', 'Test W2 form');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.documentId).toBeDefined();
      expect(response.body.data.filename).toBeDefined();
      expect(response.body.data.size).toBeDefined();
      expect(response.body.data.originalName).toBe('test-w2.pdf');
      expect(response.body.data.processingStatus).toBe('pending');
      expect(response.body.data.documentType).toBe('W2');
    });

    it('should validate file type', async () => {
      const testFile = testHelper.createTestFileBuffer('Invalid content');
      
      const response = await testHelper.sessionRequest('post', `/api/documents/upload/${testSessionId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .attach('document', testFile, 'test.txt')
        .field('documentType', 'W2')
        .expect(400);

      testHelper.validateErrorResponse(response, 400, 'File type not allowed');
    });

    it('should validate file size', async () => {
      const largeFile = Buffer.alloc(11 * 1024 * 1024); // 11MB file
      
      const response = await testHelper.sessionRequest('post', `/api/documents/upload/${testSessionId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .attach('document', largeFile, 'large-file.pdf')
        .field('documentType', 'W2')
        .expect(413);

      testHelper.validateErrorResponse(response, 413, 'File size exceeds maximum allowed limit');
    });

    it('should require session ID', async () => {
      const testFile = testHelper.createTestFileBuffer('Test content');
      
      const response = await request(app)
        .post('/api/documents/upload/invalid-session')
        .set('X-API-Key', 'test-api-key')
        .attach('document', testFile, 'test.pdf')
        .field('documentType', 'W2')
        .expect(400);

      testHelper.validateErrorResponse(response, 400);
    });

    it('should require API key', async () => {
      const testFile = testHelper.createTestFileBuffer('Test content');
      
      const response = await request(app)
        .post(`/api/documents/upload/${testSessionId}`)
        .set('X-Session-ID', testSessionId)
        .attach('document', testFile, 'test.pdf')
        .field('documentType', 'W2')
        .expect(401);

      testHelper.validateErrorResponse(response, 401);
    });

    it('should require document type', async () => {
      const testFile = testHelper.createTestFileBuffer('Test content');
      
      const response = await testHelper.sessionRequest('post', `/api/documents/upload/${testSessionId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .attach('document', testFile, 'test.pdf')
        .expect(400);

      testHelper.validateErrorResponse(response, 400);
    });

    it('should process document after upload', async () => {
      const testFile = testHelper.createTestFileBuffer('Test PDF content');
      
      const response = await testHelper.sessionRequest('post', `/api/documents/upload/${testSessionId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .attach('document', testFile, 'test-w2.pdf')
        .field('documentType', 'W2')
        .expect(201);

      // Wait for processing
      await testHelper.waitFor(1000);

      // Check document status
      const statusResponse = await testHelper.sessionRequest('get', `/api/documents/${response.body.data.documentId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(['pending', 'processing', 'completed']).toContain(statusResponse.body.data.processingStatus);
    });
  });

  describe('GET /api/documents/:documentId', () => {
    let testDocumentId: string;

    beforeEach(async () => {
      const document = await dbTestUtils.createTestDocument({ sessionId: testSessionId });
      testDocumentId = document.documentId;
    });

    it('should get document by ID', async () => {
      const response = await testHelper.sessionRequest('get', `/api/documents/${testDocumentId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      testHelper.validateApiResponse(response, 200, ['data']);
      expect(response.body.data.documentId).toBe(testDocumentId);
    });

    it('should include metadata in response', async () => {
      const response = await testHelper.sessionRequest('get', `/api/documents/${testDocumentId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.data).toHaveProperty('metadata');
      expect(response.body.data).toHaveProperty('documentType');
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'get', `/api/documents/${testDocumentId}`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', `/api/documents/${testDocumentId}`);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await testHelper.sessionRequest('get', `/api/documents/${fakeId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(404);

      testHelper.validateErrorResponse(response, 404, 'Document not found');
    });
  });

  describe('GET /api/documents', () => {
    beforeEach(async () => {
      // Create multiple documents for testing
      await dbTestUtils.createTestDocument({ sessionId: testSessionId, filename: 'w2-2023.pdf' });
      await dbTestUtils.createTestDocument({ sessionId: testSessionId, filename: '1099-2023.pdf' });
    });

    it('should get documents for session', async () => {
      const response = await testHelper.sessionRequest('get', '/api/documents', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body.documents)).toBe(true);
      expect(response.body.documents.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should support pagination', async () => {
      const response = await testHelper.sessionRequest('get', '/api/documents?page=1&limit=1', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.documents.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 1);
    });

    it('should filter by document type', async () => {
      const response = await testHelper.sessionRequest('get', '/api/documents?documentType=W2', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body.documents)).toBe(true);
      // All returned documents should be W2 type
      response.body.documents.forEach((doc: any) => {
        expect(doc.metadata.documentType).toBe('W2');
      });
    });

    it('should filter by status', async () => {
      const response = await testHelper.sessionRequest('get', '/api/documents?status=processed', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body.documents)).toBe(true);
      // All returned documents should be processed
      response.body.documents.forEach((doc: any) => {
        expect(doc.status).toBe('processed');
      });
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'get', '/api/documents');
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', '/api/documents');
    });
  });

  describe('DELETE /api/documents/:documentId', () => {
    let testDocumentId: string;

    beforeEach(async () => {
      const document = await dbTestUtils.createTestDocument({ sessionId: testSessionId });
      testDocumentId = document.documentId;
    });

    it('should delete document', async () => {
      const response = await testHelper.sessionRequest('delete', `/api/documents/${testDocumentId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.message).toContain('deleted');

      // Verify document is deleted
      const getResponse = await testHelper.sessionRequest('get', `/api/documents/${testDocumentId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(404);
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'delete', `/api/documents/${testDocumentId}`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'delete', `/api/documents/${testDocumentId}`);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await testHelper.sessionRequest('delete', `/api/documents/${fakeId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(404);

      testHelper.validateErrorResponse(response, 404, 'Document not found');
    });
  });

  describe('POST /api/documents/:documentId/process', () => {
    let testDocumentId: string;

    beforeEach(async () => {
      const document = await dbTestUtils.createTestDocument({ 
        sessionId: testSessionId,
        processingStatus: 'pending'
      });
      testDocumentId = document.documentId;
    });

    it('should trigger document processing', async () => {
      const response = await testHelper.sessionRequest('post', `/api/documents/${testDocumentId}/process`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.message).toContain('processing');
      expect(response.body.status).toBe('processing');
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'post', `/api/documents/${testDocumentId}/process`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'post', `/api/documents/${testDocumentId}/process`);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await testHelper.sessionRequest('post', `/api/documents/${fakeId}/process`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(404);

      testHelper.validateErrorResponse(response, 404, 'Document not found');
    });
  });

  describe('GET /api/documents/stats', () => {
    it('should return document statistics', async () => {
      const response = await request(app)
        .get('/api/documents/stats')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('byType');
      expect(response.body.data).toHaveProperty('byStatus');
      expect(response.body.data).toHaveProperty('totalSize');
      expect(response.body.data).toHaveProperty('averageSize');
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', '/api/documents/stats');
    });
  });

  describe('GET /api/documents/health', () => {
    it('should return document service health', async () => {
      const response = await request(app)
        .get('/api/documents/health')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});