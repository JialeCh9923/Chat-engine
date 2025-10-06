import request from 'supertest';
import { Express } from 'express';
import jwt from 'jsonwebtoken';
import { mockUser, mockSession } from '../mocks/mockData';

export class TestHelper {
  private app: Express;

  constructor(app: Express) {
    this.app = app;
  }

  // Generate test JWT token
  generateTestToken(user = mockUser): string {
    return jwt.sign(
      { 
        userId: user._id.toString(), 
        email: user.email 
      },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h' }
    );
  }

  // Create authenticated request
  authenticatedRequest(method: 'get' | 'post' | 'put' | 'delete', url: string, user = mockUser) {
    const token = this.generateTestToken(user);
    return request(this.app)[method](url)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Session-ID', mockSession.sessionId);
  }

  // Create request with session
  sessionRequest(method: 'get' | 'post' | 'put' | 'delete', url: string, sessionId = mockSession.sessionId) {
    return request(this.app)[method](url)
      .set('X-API-Key', 'test-api-key')
      .set('X-Session-ID', sessionId);
  }

  // Wait for async operations
  async waitFor(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Create test file buffer
  createTestFileBuffer(content = 'Test file content'): Buffer {
    return Buffer.from(content);
  }

  // Validate response structure
  validateApiResponse(response: any, expectedStatus: number, expectedFields: string[] = []) {
    expect(response.status).toBe(expectedStatus);
    
    if (expectedStatus >= 200 && expectedStatus < 300) {
      expect(response.body).toBeDefined();
      expectedFields.forEach(field => {
        expect(response.body).toHaveProperty(field);
      });
    }
  }

  // Validate error response
  validateErrorResponse(response: any, expectedStatus: number, expectedMessage?: string) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
    
    if (expectedMessage) {
      expect(response.body.message).toContain(expectedMessage);
    }
  }

  // Clean up test data
  async cleanupTestData(): Promise<void> {
    // This will be called by the afterEach hook in setup.ts
    // Additional cleanup logic can be added here if needed
  }
}

// Database test utilities
export const dbTestUtils = {
  // Create test documents in database
  async createTestUser(userData = {}) {
    const User = require('../../src/models/User').default;
    const { createMockUser } = require('../mocks/mockData');
    return await User.create(createMockUser(userData));
  },

  async createTestSession(sessionData = {}) {
    const Session = require('../../src/models/Session').default;
    const { createMockSession } = require('../mocks/mockData');
    return await Session.create(createMockSession(sessionData));
  },

  async createTestConversation(conversationData: any = {}) {
    const Conversation = require('../../src/models/Conversation').default;
    const { createMockConversation } = require('../mocks/mockData');
    return await Conversation.create(createMockConversation(conversationData.sessionId || 'test-session-123', conversationData));
  },

  async createTestDocument(documentData: any = {}) {
    const Document = require('../../src/models/Document').default;
    const { createMockDocument } = require('../mocks/mockData');
    return await Document.create(createMockDocument(documentData.sessionId || 'test-session-123', documentData));
  },

  async createTestJob(jobData: any = {}) {
    const Job = require('../../src/models/Job').default;
    const { createMockJob } = require('../mocks/mockData');
    return await Job.create(createMockJob(jobData.sessionId || 'test-session-123', jobData));
  }
};

// API test utilities
export const apiTestUtils = {
  // Common test scenarios
  async testUnauthorizedAccess(helper: TestHelper, method: 'get' | 'post' | 'put' | 'delete', url: string) {
    const response = await request(helper['app'])[method](url);
    helper.validateErrorResponse(response, 401);
  },

  async testInvalidSessionId(helper: TestHelper, method: 'get' | 'post' | 'put' | 'delete', url: string) {
    const response = await helper.sessionRequest(method, url, 'invalid-session-id');
    helper.validateErrorResponse(response, 400);
  },

  async testMissingRequiredFields(helper: TestHelper, method: 'post' | 'put', url: string, requiredFields: string[]) {
    for (const field of requiredFields) {
      const incompleteData: Record<string, any> = {};
      requiredFields.forEach(f => {
        if (f !== field) {
          incompleteData[f] = `test-${f}`;
        }
      });

      const response = await helper.authenticatedRequest(method, url)
        .send(incompleteData);
      
      helper.validateErrorResponse(response, 400);
    }
  }
};

export default TestHelper;