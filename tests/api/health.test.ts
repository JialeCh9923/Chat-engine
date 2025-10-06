import request from 'supertest';
import { ChatEngineApp } from '../../src/app';
import TestHelper from '../utils/testUtils';

describe('Health API Endpoints', () => {
  let app: any;
  let testHelper: TestHelper;

  beforeAll(async () => {
    const chatApp = new ChatEngineApp();
    await chatApp.initialize();
    app = chatApp.getApp();
    testHelper = new TestHelper(app);
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /api/health', () => {
    it('should return detailed health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('services');
      expect(response.body.data.services).toHaveProperty('api');
      expect(response.body.data.services).toHaveProperty('database');
    });

    it('should include service endpoints', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.data).toHaveProperty('endpoints');
      expect(response.body.data.endpoints).toHaveProperty('sessions');
      expect(response.body.data.endpoints).toHaveProperty('conversations');
    });
  });

  describe('GET /api/health/detailed', () => {
    it('should return comprehensive health check', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('services');
      expect(Array.isArray(response.body.data.services)).toBe(true);
    });

    it('should check all service endpoints', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      const serviceNames = response.body.data.services.map((s: any) => s.name);
      expect(serviceNames).toContain('Sessions');
      expect(serviceNames).toContain('Conversations');
      expect(serviceNames).toContain('Documents');
      expect(serviceNames).toContain('Jobs');
      expect(serviceNames).toContain('Tax Forms');
    });
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Chat Engine Tax Filing API');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('health', '/health');
    });
  });

  describe('GET /api', () => {
    it('should return API documentation', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Chat Engine Tax Filing API');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('health', '/api/health');
      expect(response.body.endpoints).toHaveProperty('sessions', '/api/sessions');
      expect(response.body.endpoints).toHaveProperty('conversations', '/api/conversations');
    });
  });
});