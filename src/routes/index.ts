import { Router } from 'express';
import { sessionRoutes } from './sessionRoutes';
import { conversationRoutes } from './conversationRoutes';
import { documentRoutes } from './documentRoutes';
import { jobRoutes } from './jobRoutes';
import { taxFormRoutes } from './taxFormRoutes';
import { clientRoutes } from './clientRoutes';
import { sseRoutes } from './sseRoutes';
import { healthRoutes } from './healthRoutes';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { authenticateApiKey } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// Apply global rate limiting to all API routes
router.use(apiRateLimiter);

// API documentation endpoint (no authentication required)
router.get('/', (req, res) => {
  res.json({
    name: 'Chat Engine Tax Filing API',
    version: '1.0.0',
    description: 'RESTful API for tax filing chat engine with AI assistance',
    endpoints: {
      health: '/api/health',
      clients: '/api/clients',
      sessions: '/api/sessions',
      conversations: '/api/conversations',
      documents: '/api/documents',
      jobs: '/api/jobs',
      taxForms: '/api/tax-forms',
      sse: '/api/sse',
    },
    documentation: {
      authentication: 'API Key required in X-API-Key header',
      rateLimit: 'Global rate limiting applied',
      contentType: 'application/json',
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check routes (no authentication required)
router.use('/health', healthRoutes);

// Individual service health endpoints (no authentication required)
router.get('/sessions/health', async (req, res, next) => {
  try {
    const { default: SessionController } = await import('../controllers/sessionController');
    await SessionController.healthCheck(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.get('/conversations/health', async (req, res, next) => {
  try {
    const { default: ConversationController } = await import('../controllers/conversationController');
    await ConversationController.healthCheck(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.get('/documents/health', async (req, res, next) => {
  try {
    const { default: DocumentController } = await import('../controllers/documentController');
    await DocumentController.healthCheck(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/health', async (req, res, next) => {
  try {
    const { JobController } = await import('../controllers/jobController');
    await JobController.healthCheck(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/tax-forms/health', async (req, res, next) => {
  try {
    const { TaxFormController } = await import('../controllers/taxFormController');
    await TaxFormController.healthCheck(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/clients/health', async (req, res, next) => {
  try {
    const { ClientController } = await import('../controllers/clientController');
    await ClientController.healthCheck(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/sse/health', async (req, res, next) => {
  try {
    const { SSEController } = await import('../controllers/sseController');
    await SSEController.healthCheck(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Client management routes (some endpoints require authentication)
router.use('/clients', clientRoutes);

// Apply authentication to all other routes
router.use(authenticateApiKey);

// Stats endpoints (authentication required)
router.get('/sessions/stats', async (req, res, next) => {
  try {
    const { sessionService } = await import('../services/sessionService');
    const stats = await sessionService.getSessionStats();
    const cacheStats = sessionService.getCacheStats();
    
    res.json({
      totalSessions: stats.total,
      activeSessions: stats.active,
      expiredSessions: stats.expired,
      sessionsByStatus: stats.byStatus,
      sessionsByFilingType: stats.byFilingType,
      cacheStats,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/conversations/stats', async (req, res, next) => {
  try {
    const { conversationService } = await import('../services/conversationService');
    const stats = await conversationService.getConversationStats();
    
    res.json({
      totalConversations: stats.total,
      activeConversations: stats.active,
      archivedConversations: stats.archived,
      conversationsByStatus: stats.byStatus,
      averageMessages: stats.averageMessages,
      totalMessages: stats.totalMessages,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/queue/stats', async (req, res, next) => {
  try {
    const { jobService } = await import('../services/jobService');
    const stats = await jobService.getQueueStats();
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/tax-forms/stats', async (req, res, next) => {
  try {
    const { taxFormService } = await import('../services/taxFormService');
    const stats = await taxFormService.getTaxFormStats();
    
    res.json({
      totalTaxForms: stats.total,
      taxFormsByType: stats.byType,
      taxFormsByStatus: stats.byStatus,
      taxFormsByYear: stats.byYear,
      completionRate: stats.completionRate,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sse/stats', async (req, res, next) => {
  try {
    const stats = {
      totalConnections: 0,
      connectionsByClient: {},
      connectionsBySession: {},
      subscriptionStats: {},
    };
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Session management routes
router.use('/sessions', sessionRoutes);

// Conversation routes
router.use('/conversations', conversationRoutes);

// Document upload and management routes
router.use('/documents', documentRoutes);

// Job queue management routes
router.use('/jobs', jobRoutes);

// Tax form management routes
router.use('/tax-forms', taxFormRoutes);

// Server-Sent Events routes
router.use('/sse', sseRoutes);

// 404 handler for API routes
router.use('*', (req, res) => {
  logger.warn('API endpoint not found', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /api/health',
      'POST /api/clients',
      'GET /api/sessions',
      'POST /api/sessions',
      'GET /api/conversations',
      'POST /api/conversations',
      'POST /api/documents/upload',
      'GET /api/jobs',
      'POST /api/jobs',
      'GET /api/tax-forms',
      'POST /api/tax-forms',
      'GET /api/sse/connect',
    ],
  });
});

export { router as apiRoutes };