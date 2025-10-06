import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Client from '../src/models/Client';

let mongoServer: MongoMemoryServer;

// Setup test environment
beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.UPLOAD_DIR = './test-uploads';
  
  // Create test client with the API key used in tests
  await Client.create({
    clientId: 'test-client-123',
    name: 'Test Client',
    email: 'test@example.com',
    apiKey: 'test-api-key',
    isActive: true,
    permissions: [
      'session:create',
      'session:read',
      'session:update',
      'session:delete',
      'conversation:create',
      'conversation:read',
      'document:upload',
      'document:read',
      'document:process',
      'job:create',
      'job:read',
      'job:cancel',
      'admin:read',
      'admin:write'
    ],
    rateLimits: {
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      requestsPerDay: 100000,
      concurrentSessions: 100,
      maxFileSize: 104857600, // 100MB for tests
      maxFilesPerSession: 50
    }
  });
});

// Clean up after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  
  // Recreate test client after cleanup
  await Client.create({
    clientId: 'test-client-123',
    name: 'Test Client',
    email: 'test@example.com',
    apiKey: 'test-api-key',
    isActive: true,
    permissions: [
      'session:create',
      'session:read',
      'session:update',
      'session:delete',
      'conversation:create',
      'conversation:read',
      'document:upload',
      'document:read',
      'document:process',
      'job:create',
      'job:read',
      'job:cancel',
      'admin:read',
      'admin:write'
    ],
    rateLimits: {
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      requestsPerDay: 100000,
      concurrentSessions: 100,
      maxFileSize: 104857600, // 100MB for tests
      maxFilesPerSession: 50
    }
  });
});

// Cleanup after all tests
afterAll(async () => {
  // Shutdown SSE service to clean up intervals
  const { SSEController } = await import('../src/controllers/sseController');
  SSEController.shutdown();
  
  // Shutdown JobService to clean up processing intervals
  const { jobService } = await import('../src/services/jobService');
  jobService.stopProcessing();
  
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}