import request from 'supertest';
import { ChatEngineApp } from '../../src/app';
import TestHelper, { dbTestUtils, apiTestUtils } from '../utils/testUtils';
import { mockJob } from '../mocks/mockData';

describe('Job API Endpoints', () => {
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

  describe('POST /api/jobs', () => {
    it('should create a new job', async () => {
      const jobData = {
        type: 'tax_calculation',
        priority: 'high',
        data: {
          income: 50000,
          deductions: 12000,
          filingStatus: 'single'
        }
      };

      const response = await testHelper.sessionRequest('post', '/api/jobs', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send(jobData)
        .expect(201);

      testHelper.validateApiResponse(response, 201, ['success', 'data']);
      expect(response.body.data.type).toBe(jobData.type);
      expect(response.body.data.priority).toBe(10); // 'high' maps to 10
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.jobId).toBeDefined();
    });

    it('should validate job type', async () => {
      const jobData = {
        type: 'invalid_job_type',
        data: {}
      };

      const response = await testHelper.sessionRequest('post', '/api/jobs', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send(jobData)
        .expect(400);

      testHelper.validateErrorResponse(response, 400, 'Invalid job type');
    });

    it('should require session ID', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('X-API-Key', 'test-api-key')
        .send({ type: 'tax_calculation', data: {} })
        .expect(400);

      testHelper.validateErrorResponse(response, 400);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'post', '/api/jobs');
    });

    it('should validate required fields', async () => {
      // Test missing type field
      const response = await testHelper.sessionRequest('post', '/api/jobs', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send({}) // No type field
        .expect(400);

      testHelper.validateErrorResponse(response, 400);
    });

    it('should set default priority', async () => {
      const jobData = {
        type: 'document_processing',
        data: { documentId: 'test-doc-123' }
      };

      const response = await testHelper.sessionRequest('post', '/api/jobs', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .send(jobData)
        .expect(201);

      expect(response.body.data.priority).toBe(5); // 'medium' maps to 5
    });
  });

  describe('GET /api/jobs/:jobId', () => {
    let testJobId: string;

    beforeEach(async () => {
      const job = await dbTestUtils.createTestJob({ sessionId: testSessionId });
      testJobId = job.jobId; // Use the custom jobId field, not MongoDB _id
    });

    it('should get job by ID', async () => {
      const response = await testHelper.sessionRequest('get', `/api/jobs/${testJobId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      testHelper.validateApiResponse(response, 200, ['jobId', 'type', 'status', 'progress']);
      expect(response.body.jobId).toBe(testJobId);
    });

    it('should include job data and result', async () => {
      const response = await testHelper.sessionRequest('get', `/api/jobs/${testJobId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      if (response.body.data.status === 'completed') {
        expect(response.body.data).toHaveProperty('result');
      }
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'get', `/api/jobs/${testJobId}`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', `/api/jobs/${testJobId}`);
    });

    it('should return 404 for non-existent job', async () => {
      const fakeId = '1234567890_abcdef123456';
      const response = await testHelper.sessionRequest('get', `/api/jobs/${fakeId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(404);

      testHelper.validateErrorResponse(response, 404, 'Job not found');
    });

    it('should validate job ID format', async () => {
      const response = await testHelper.sessionRequest('get', '/api/jobs/invalid-id', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(400);

      testHelper.validateErrorResponse(response, 400);
    });
  });

  describe('GET /api/jobs', () => {
    beforeEach(async () => {
      // Create multiple jobs for testing
      await dbTestUtils.createTestJob({ 
        sessionId: testSessionId, 
        type: 'tax_calculation',
        status: 'completed'
      });
      await dbTestUtils.createTestJob({ 
        sessionId: testSessionId, 
        type: 'document_processing',
        status: 'pending'
      });
    });

    it('should get jobs for session', async () => {
      const response = await testHelper.sessionRequest('get', '/api/jobs', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body.jobs)).toBe(true);
      expect(response.body.jobs.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should support pagination', async () => {
      const response = await testHelper.sessionRequest('get', '/api/jobs?page=1&limit=1', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.jobs.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 1);
    });

    it('should filter by job type', async () => {
      const response = await testHelper.sessionRequest('get', '/api/jobs?type=tax_calculation', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body.jobs)).toBe(true);
      response.body.jobs.forEach((job: any) => {
        expect(job.type).toBe('tax_calculation');
      });
    });

    it('should filter by status', async () => {
      const response = await testHelper.sessionRequest('get', '/api/jobs?status=completed', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body.jobs)).toBe(true);
      response.body.jobs.forEach((job: any) => {
        expect(job.status).toBe('completed');
      });
    });

    it('should sort by creation date', async () => {
      const response = await testHelper.sessionRequest('get', '/api/jobs?sort=createdAt&order=desc', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body.jobs)).toBe(true);
      if (response.body.jobs.length > 1) {
        const firstDate = new Date(response.body.jobs[0].createdAt);
        const secondDate = new Date(response.body.jobs[1].createdAt);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'get', '/api/jobs');
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', '/api/jobs');
    });
  });

  describe('POST /api/jobs/:jobId/cancel', () => {
    let testJobId: string;

    beforeEach(async () => {
      const job = await dbTestUtils.createTestJob({ 
        sessionId: testSessionId,
        status: 'pending'
      });
      testJobId = job.jobId; // Use the custom jobId field, not MongoDB _id
    });

    it('should cancel pending job', async () => {
      const response = await testHelper.sessionRequest('post', `/api/jobs/${testJobId}/cancel`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.message).toContain('cancelled');
      expect(response.body.data.status).toBe('cancelled');
    });

    it('should not cancel completed job', async () => {
      // Update job to completed status
      const Job = require('../../src/models/Job').default;
      await Job.findOneAndUpdate({ jobId: testJobId }, { status: 'completed' });

      const response = await testHelper.sessionRequest('post', `/api/jobs/${testJobId}/cancel`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(400);

      testHelper.validateErrorResponse(response, 400, 'Job cannot be cancelled');
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'post', `/api/jobs/${testJobId}/cancel`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'post', `/api/jobs/${testJobId}/cancel`);
    });

    it('should return 404 for non-existent job', async () => {
      const fakeId = '1234567890_abcdef123456';
      const response = await testHelper.sessionRequest('post', `/api/jobs/${fakeId}/cancel`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(404);

      testHelper.validateErrorResponse(response, 404, 'Job not found');
    });
  });

  describe('DELETE /api/jobs/:jobId', () => {
    let testJobId: string;

    beforeEach(async () => {
      const job = await dbTestUtils.createTestJob({ sessionId: testSessionId });
      testJobId = job.jobId; // Use the custom jobId field, not MongoDB _id
    });

    it('should delete job', async () => {
      const response = await testHelper.sessionRequest('delete', `/api/jobs/${testJobId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.message).toContain('deleted');

      // Verify job is deleted
      const getResponse = await testHelper.sessionRequest('get', `/api/jobs/${testJobId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(404);
    });

    it('should require session ID', async () => {
      await apiTestUtils.testInvalidSessionId(testHelper, 'delete', `/api/jobs/${testJobId}`);
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'delete', `/api/jobs/${testJobId}`);
    });

    it('should return 404 for non-existent job', async () => {
      const fakeId = '1234567890_abcdef123456';
      const response = await testHelper.sessionRequest('delete', `/api/jobs/${fakeId}`, testSessionId)
        .set('X-API-Key', 'test-api-key')
        .expect(404);

      testHelper.validateErrorResponse(response, 404, 'Job not found');
    });
  });

  describe('GET /api/jobs/stats', () => {
    beforeEach(async () => {
      await dbTestUtils.createTestJob({ sessionId: testSessionId, status: 'completed' });
      await dbTestUtils.createTestJob({ sessionId: testSessionId, status: 'pending' });
      await dbTestUtils.createTestJob({ sessionId: testSessionId, status: 'failed' });
    });

    it('should return job statistics', async () => {
      const response = await testHelper.sessionRequest('get', '/api/jobs/stats', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .timeout(10000)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalJobs');
      expect(response.body.data).toHaveProperty('statusBreakdown');
      expect(response.body.data).toHaveProperty('typeBreakdown');
      expect(response.body.data).toHaveProperty('averageProcessingTime');
    }, 15000);

    it('should include status breakdown', async () => {
      const response = await testHelper.sessionRequest('get', '/api/jobs/stats', testSessionId)
        .set('X-API-Key', 'test-api-key')
        .timeout(10000)
        .expect(200);

      expect(response.body.data.statusBreakdown).toHaveProperty('completed');
      expect(response.body.data.statusBreakdown).toHaveProperty('pending');
      expect(response.body.data.statusBreakdown).toHaveProperty('failed');
    }, 15000);

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'get', '/api/jobs/stats');
    });
  });

  describe('POST /api/jobs/cleanup', () => {
    beforeEach(async () => {
      // Create old completed jobs
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      await dbTestUtils.createTestJob({ 
        sessionId: testSessionId, 
        status: 'completed',
        completedAt: oldDate
      });
    });

    it('should cleanup old jobs', async () => {
      const response = await request(app)
        .post('/api/jobs/cleanup')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('deletedCount');
      expect(response.body.message).toContain('cleaned up');
    });

    it('should require API key', async () => {
      await apiTestUtils.testUnauthorizedAccess(testHelper, 'post', '/api/jobs/cleanup');
    });
  });

  describe('GET /api/jobs/health', () => {
    it('should return job service health', async () => {
      const response = await request(app)
        .get('/api/jobs/health')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('queueSize');
    });
  });
});