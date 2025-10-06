import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB Configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-engine-tax',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
    },
  },
  
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.7,
    maxRetries: 3,
    timeout: 30000, // 30 seconds
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as string,
  },
  
  // API Configuration
  api: {
    version: process.env.API_VERSION || 'v1',
    prefix: process.env.API_PREFIX || '/api',
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: process.env.NODE_ENV === 'test' 
      ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10000', 10) // High limit for tests
      : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  
  // Session Configuration
  session: {
    timeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '3600000', 10), // 1 hour
    maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '5', 10),
  },
  
  // Cache Configuration
  cache: {
    sessions: {
      ttl: parseInt(process.env.CACHE_TTL_SESSIONS || '1800000', 10), // 30 minutes
      max: parseInt(process.env.CACHE_MAX_SESSIONS || '1000', 10),
      updateAgeOnGet: true,
    },
    aiResponses: {
      ttl: parseInt(process.env.CACHE_TTL_AI_RESPONSES || '3600000', 10), // 1 hour
      max: parseInt(process.env.CACHE_MAX_AI_RESPONSES || '5000', 10),
      updateAgeOnGet: true,
    },
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
  },
  
  // Tax Filing Configuration
  taxFiling: {
    supportedYears: [2020, 2021, 2022, 2023, 2024],
    supportedFilingTypes: ['individual', 'business', 'partnership', 'corporation'],
    maxDocumentsPerSession: 50,
    documentTypes: [
      'W2', '1099-MISC', '1099-INT', '1099-DIV', '1099-R', '1099-G',
      'W2G', '1098', '1098-E', '1098-T', 'K1', 'receipt', 'invoice',
      'bank_statement', 'investment_statement', 'other'
    ],
  },
  
  // Job Queue Configuration
  jobQueue: {
    maxConcurrentJobs: 5,
    jobTimeout: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
  },
  
  // Security Configuration
  security: {
    bcryptRounds: 12,
    apiKeyLength: 32,
    sessionTokenLength: 64,
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    optionsSuccessStatus: 200,
  },
};

export default config;