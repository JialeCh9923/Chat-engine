import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat Engine Tax Filing API',
      version: '1.0.0',
      description: 'RESTful API for tax filing chat engine with AI assistance',
      contact: {
        name: 'GenTech',
        email: 'support@chat-engine-tax.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.chat-engine-tax.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Validation failed' },
                details: { type: 'array', items: { type: 'string' } }
              }
            },
            timestamp: { type: 'string', format: 'date-time' },
            requestId: { type: 'string' }
          }
        },
        Session: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Session ID' },
            clientId: { type: 'string', description: 'Client ID' },
            filingType: { type: 'string', enum: ['individual', 'business', 'nonprofit'] },
            status: { type: 'string', enum: ['active', 'completed', 'expired', 'archived'] },
            progress: { type: 'number', minimum: 0, maximum: 100 },
            metadata: { type: 'object' },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Conversation: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Conversation ID' },
            sessionId: { type: 'string', description: 'Session ID' },
            status: { type: 'string', enum: ['active', 'archived', 'deleted'] },
            messages: { type: 'array', items: { type: 'object' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Document: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Document ID' },
            sessionId: { type: 'string', description: 'Session ID' },
            filename: { type: 'string' },
            originalName: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'number' },
            category: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
            metadata: { type: 'object' },
            uploadedAt: { type: 'string', format: 'date-time' }
          }
        },
        Job: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Job ID' },
            type: { type: 'string', enum: ['document_processing', 'ai_analysis', 'form_generation'] },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
            priority: { type: 'number', minimum: 1, maximum: 10 },
            data: { type: 'object' },
            result: { type: 'object' },
            error: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        TaxForm: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Tax Form ID' },
            sessionId: { type: 'string', description: 'Session ID' },
            formType: { type: 'string' },
            taxYear: { type: 'number' },
            status: { type: 'string', enum: ['draft', 'completed', 'filed', 'rejected'] },
            data: { type: 'object' },
            calculations: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [
      {
        apiKey: []
      }
    ],
    tags: [
      {
        name: 'Sessions',
        description: 'Session management endpoints'
      },
      {
        name: 'Conversations',
        description: 'Conversation and messaging endpoints'
      },
      {
        name: 'Documents',
        description: 'Document upload and management endpoints'
      },
      {
        name: 'Jobs',
        description: 'Background job processing endpoints'
      },
      {
        name: 'Tax Forms',
        description: 'Tax form generation and management endpoints'
      },
      {
        name: 'Clients',
        description: 'Client management endpoints'
      },
      {
        name: 'SSE',
        description: 'Server-Sent Events endpoints'
      },
      {
        name: 'Health',
        description: 'Health check endpoints'
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);