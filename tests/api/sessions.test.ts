import request from 'supertest';
import { ChatEngineApp } from '../../src/app';
import TestHelper, { dbTestUtils, apiTestUtils } from '../utils/testUtils';
import { mockSession, mockUser } from '../mocks/mockData';

describe('Session API Endpoints', () => {
  let app: any;
  let testHelper: TestHelper;

  beforeAll(async () => {
    const chatApp = new ChatEngineApp();
    await chatApp.initialize();
    app = chatApp.getApp();
    testHelper = new TestHelper(app);
  });

  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      const sessionData = {
        clientId: 'test-client-123',
        metadata: {
          userAgent: 'Jest Test Agent',
          ipAddress: '127.0.0.1'
        }
      };

      const response = await request(app)
        .post('/api/sessions')
        .set('X-API-Key', 'test-api-key')
        .send(sessionData)
        .expect(201);

      testHelper.validateApiResponse(response, 201, ['sessionId', 'clientId', 'isActive']);
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.clientId).toBe(sessionData.clientId);
      expect(response.body.isActive).toBe(true);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'post', '/api/sessions');
    });

    it('should create session with empty body (all fields optional)', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .set('X-API-Key', 'test-api-key')
        .send({})
        .expect(201);

      testHelper.validateApiResponse(response, 201, ['sessionId', 'clientId', 'isActive']);
      expect(response.body.clientId).toBe('test-client-123');
      expect(response.body.isActive).toBe(true);
    });

    it('should handle duplicate clientId gracefully', async () => {
      const sessionData = {
        metadata: { userAgent: 'Test' }
      };

      // Create first session
      const firstResponse = await request(app)
        .post('/api/sessions')
        .set('X-API-Key', 'test-api-key')
        .send(sessionData)
        .expect(201);

      // Try to create second session with same client (same API key)
      const response = await request(app)
        .post('/api/sessions')
        .set('X-API-Key', 'test-api-key')
        .send(sessionData)
        .expect(200);

      // Should return existing session
      expect(response.body.clientId).toBe('test-client-123'); // The actual client ID from API key
      expect(response.body.sessionId).toBe(firstResponse.body.sessionId); // Same session ID
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    let testSessionId: string;

    beforeEach(async () => {
      const session = await dbTestUtils.createTestSession();
      testSessionId = session.sessionId;
    });

    it('should get session by ID', async () => {
      const response = await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      testHelper.validateApiResponse(response, 200, ['sessionId', 'clientId', 'isActive']);
      expect(response.body.sessionId).toBe(testSessionId);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', `/api/sessions/${testSessionId}`);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/non-existent-session')
        .set('X-API-Key', 'test-api-key')
        .expect(404);

      testHelper.validateErrorResponse(response, 404, 'Session not found');
    });

    it('should validate session ID format', async () => {
      const response = await request(app)
        .get('/api/sessions/invalid-format')
        .set('X-API-Key', 'test-api-key')
        .expect(400);

      testHelper.validateErrorResponse(response, 400);
    });
  });

  describe('PUT /api/sessions/:sessionId', () => {
    let testSessionId: string;

    beforeEach(async () => {
      const session = await dbTestUtils.createTestSession();
      testSessionId = session.sessionId;
    });

    it('should update session metadata', async () => {
      const updateData = {
        metadata: {
          userAgent: 'Updated Test Agent',
          ipAddress: '192.168.1.1',
          customField: 'test-value'
        }
      };

      const response = await request(app)
        .put(`/api/sessions/${testSessionId}`)
        .set('X-API-Key', 'test-api-key')
        .send(updateData)
        .expect(200);

      testHelper.validateApiResponse(response, 200, ['sessionId', 'metadata']);
      expect(response.body.metadata.userAgent).toBe(updateData.metadata.userAgent);
      expect(response.body.metadata.customField).toBe(updateData.metadata.customField);
    });

    it('should update last activity timestamp', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}`)
        .set('X-API-Key', 'test-api-key')
        .send({ metadata: {} })
        .expect(200);

      expect(response.body.lastActivity).toBeDefined();
      expect(new Date(response.body.lastActivity).getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'put', `/api/sessions/${testSessionId}`);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .put('/api/sessions/non-existent-session')
        .set('X-API-Key', 'test-api-key')
        .send({ metadata: {} })
        .expect(404);

      testHelper.validateErrorResponse(response, 404, 'Session not found');
    });
  });

  describe('DELETE /api/sessions/:sessionId', () => {
    let testSessionId: string;

    beforeEach(async () => {
      const session = await dbTestUtils.createTestSession();
      testSessionId = session.sessionId;
    });

    it('should deactivate session', async () => {
      const response = await request(app)
        .delete(`/api/sessions/${testSessionId}`)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.message).toContain('deactivated');
      
      // Verify session is deactivated
      const getResponse = await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(getResponse.body.isActive).toBe(false);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'delete', `/api/sessions/${testSessionId}`);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .delete('/api/sessions/non-existent-session')
        .set('X-API-Key', 'test-api-key')
        .expect(404);

      testHelper.validateErrorResponse(response, 404, 'Session not found');
    });
  });

  describe('GET /api/sessions/client/:clientId', () => {
    let testClientId: string;

    beforeEach(async () => {
      testClientId = 'test-client-' + Date.now();
      await dbTestUtils.createTestSession({ clientId: testClientId });
    });

    it('should get sessions by client ID', async () => {
      const response = await request(app)
        .get(`/api/sessions/client/${testClientId}`)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].clientId).toBe(testClientId);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', `/api/sessions/client/${testClientId}`);
    });

    it('should return empty array for non-existent client', async () => {
      const response = await request(app)
        .get('/api/sessions/client/non-existent-client')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('GET /api/sessions/health', () => {
    it('should return session service health', async () => {
      const response = await request(app)
        .get('/api/sessions/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('service', 'session');
    });
  });
});