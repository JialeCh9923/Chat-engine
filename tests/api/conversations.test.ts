import request from 'supertest';
import { ChatEngineApp } from '../../src/app';
import TestHelper, { dbTestUtils, apiTestUtils } from '../utils/testUtils';
import { mockConversation, mockSession } from '../mocks/mockData';

describe('Conversation API Endpoints', () => {
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

  describe('POST /api/conversations', () => {
    it('should create a new conversation', async () => {
      const conversationData = {
        title: 'Tax Filing Help',
        metadata: {
          taxYear: 2023,
          filingStatus: 'single'
        }
      };

      const response = await testHelper.sessionRequest('post', '/api/conversations', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send(conversationData)
        .expect(201);

      testHelper.validateApiResponse(response, 201, ['conversationId', 'sessionId', 'title', 'status']);
      expect(response.body.title).toBe(conversationData.title);
      expect(response.body.sessionId).toBe(testSessionId);
      expect(response.body.status).toBe('active');
    });

    it('should require session ID', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('X-API-Key', 'test-api-key')
        .send({ title: 'Test' })
        .expect(400);

      testHelper.validateErrorResponse(response, 400);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'post', '/api/conversations');
    });

    it('should validate required fields', async () => {
      const response = await testHelper.sessionRequest('post', '/api/conversations', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send({})
        .expect(400);

      testHelper.validateErrorResponse(response, 400);
    });
  });

  describe('GET /api/conversations/:conversationId', () => {
    let testConversationId: string;

    beforeEach(async () => {
      const conversation = await dbTestUtils.createTestConversation({ sessionId: testSessionId });
      testConversationId = conversation.conversationId;
    });

    it('should get conversation by ID', async () => {
      const response = await testHelper.sessionRequest('get', `/api/conversations/${testConversationId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      testHelper.validateApiResponse(response, 200, ['conversationId', 'sessionId', 'title', 'messages']);
      expect(response.body.conversationId).toBe(testConversationId);
      expect(response.body.sessionId).toBe(testSessionId);
    });

    it('should include messages in response', async () => {
      const response = await testHelper.sessionRequest('get', `/api/conversations/${testConversationId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body.messages)).toBe(true);
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'get', `/api/conversations/${testConversationId}`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', `/api/conversations/${testConversationId}`);
    });

    it('should return 404 for non-existent conversation', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await testHelper.sessionRequest('get', `/api/conversations/${fakeId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(404);

      testHelper.validateErrorResponse(response, 404, 'Conversation not found');
    });
  });

  describe('POST /api/conversations/:conversationId/messages', () => {
    let testConversationId: string;

    beforeEach(async () => {
      const conversation = await dbTestUtils.createTestConversation({ sessionId: testSessionId });
      testConversationId = conversation.conversationId;
    });

    it('should add a message to conversation', async () => {
      const messageData = {
        content: 'I need help with my tax deductions',
        role: 'user'
      };

      const response = await testHelper.sessionRequest('post', `/api/conversations/${testConversationId}/messages`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send(messageData)
        .expect(201);

      testHelper.validateApiResponse(response, 201, ['messageId', 'content', 'role', 'timestamp']);
      expect(response.body.content).toBe(messageData.content);
      expect(response.body.role).toBe(messageData.role);
    });

    it('should generate AI response for user messages', async () => {
      const messageData = {
        content: 'What tax forms do I need?',
        role: 'user'
      };

      const response = await testHelper.sessionRequest('post', `/api/conversations/${testConversationId}/messages`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send(messageData)
        .expect(201);

      // Should include AI response
      expect(response.body).toHaveProperty('aiResponse');
      expect(response.body.aiResponse).toHaveProperty('content');
      expect(response.body.aiResponse.role).toBe('assistant');
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'post', `/api/conversations/${testConversationId}/messages`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'post', `/api/conversations/${testConversationId}/messages`);
    });

    it('should validate message content', async () => {
      const response = await testHelper.sessionRequest('post', `/api/conversations/${testConversationId}/messages`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send({ role: 'user' })
        .expect(400);

      testHelper.validateErrorResponse(response, 400);
    });
  });

  describe('POST /api/conversations/:conversationId/messages/stream', () => {
    let testConversationId: string;

    beforeEach(async () => {
      const conversation = await dbTestUtils.createTestConversation({ sessionId: testSessionId });
      testConversationId = conversation.conversationId;
    });

    it('should start streaming response', async () => {
      const messageData = {
        content: 'Explain tax brackets to me',
        role: 'user'
      };

      const response = await testHelper.sessionRequest('post', `/api/conversations/${testConversationId}/messages/stream`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send(messageData)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'post', `/api/conversations/${testConversationId}/messages/stream`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'post', `/api/conversations/${testConversationId}/messages/stream`);
    });
  });

  describe('GET /api/conversations', () => {
    beforeEach(async () => {
      // Create multiple conversations for testing
      await dbTestUtils.createTestConversation({ sessionId: testSessionId, title: 'Conversation 1' });
      await dbTestUtils.createTestConversation({ sessionId: testSessionId, title: 'Conversation 2' });
    });

    it('should get conversations for session', async () => {
      const response = await testHelper.sessionRequest('get', '/api/conversations', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body.conversations)).toBe(true);
      expect(response.body.conversations.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should support pagination', async () => {
      const response = await testHelper.sessionRequest('get', '/api/conversations?page=1&limit=1', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.conversations.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 1);
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'get', '/api/conversations');
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', '/api/conversations');
    });
  });

  describe('PUT /api/conversations/:conversationId', () => {
    let testConversationId: string;

    beforeEach(async () => {
      const conversation = await dbTestUtils.createTestConversation({ sessionId: testSessionId });
      testConversationId = conversation.conversationId;
    });

    it('should update conversation title', async () => {
      const updateData = {
        title: 'Updated Tax Conversation',
        metadata: {
          taxYear: 2024,
          filingStatus: 'married'
        }
      };

      const response = await testHelper.sessionRequest('put', `/api/conversations/${testConversationId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send(updateData)
        .expect(200);

      testHelper.validateApiResponse(response, 200, ['conversationId', 'title']);
      expect(response.body.title).toBe(updateData.title);
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'put', `/api/conversations/${testConversationId}`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'put', `/api/conversations/${testConversationId}`);
    });
  });

  describe('DELETE /api/conversations/:conversationId', () => {
    let testConversationId: string;

    beforeEach(async () => {
      const conversation = await dbTestUtils.createTestConversation({ sessionId: testSessionId });
      testConversationId = conversation.conversationId;
    });

    it('should archive conversation', async () => {
      const response = await testHelper.sessionRequest('delete', `/api/conversations/${testConversationId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.message).toContain('archived');
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'delete', `/api/conversations/${testConversationId}`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'delete', `/api/conversations/${testConversationId}`);
    });
  });

  describe('GET /api/conversations/stats', () => {
    it('should return conversation statistics', async () => {
      const response = await request(app)
        .get('/api/conversations/stats')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('totalConversations');
      expect(response.body).toHaveProperty('activeConversations');
      expect(response.body).toHaveProperty('totalMessages');
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', '/api/conversations/stats');
    });
  });

  describe('GET /api/conversations/health', () => {
    it('should return conversation service health', async () => {
      const response = await request(app)
        .get('/api/conversations/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('service', 'conversation');
    });
  });
});