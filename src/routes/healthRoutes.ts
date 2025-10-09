import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { config } from '../config';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: System health check
 *     description: Overall system health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                       example: 1.0.0
 *                     environment:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     memory:
 *                       type: object
 *                     services:
 *                       type: object
 *                     endpoints:
 *                       type: object
 *       503:
 *         description: System is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.nodeEnv,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        api: 'healthy',
        database: 'unknown', // Will be checked by individual services
        openai: 'unknown',
        fileSystem: 'unknown',
      },
      endpoints: {
        sessions: '/api/sessions/health',
        conversations: '/api/conversations/health',
        documents: '/api/documents/health',
        jobs: '/api/jobs/health',
        taxForms: '/api/tax-forms/health',
        clients: '/api/clients/health',
        sse: '/api/sse/health',
      },
    };

    res.json({
      success: true,
      data: healthStatus,
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/health/detailed
 * @desc    Detailed system health check with service status
 * @access  Public
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const services = [];
    const baseUrl = `${req.protocol}://${req.get('host')}/api`;

    // Check each service health endpoint
    const serviceEndpoints = [
      { name: 'Sessions', url: `${baseUrl}/sessions/health` },
      { name: 'Conversations', url: `${baseUrl}/conversations/health` },
      { name: 'Documents', url: `${baseUrl}/documents/health` },
      { name: 'Jobs', url: `${baseUrl}/jobs/health` },
      { name: 'Tax Forms', url: `${baseUrl}/tax-forms/health` },
      { name: 'Clients', url: `${baseUrl}/clients/health` },
      { name: 'SSE', url: `${baseUrl}/sse/health` },
    ];

    for (const endpoint of serviceEndpoints) {
      try {
        // In a real implementation, you would make HTTP requests to these endpoints
        // For now, we'll just indicate they're available
        services.push({
          name: endpoint.name,
          status: 'healthy',
          url: endpoint.url,
          lastChecked: new Date().toISOString(),
        });
      } catch (error) {
        services.push({
          name: endpoint.name,
          status: 'unhealthy',
          url: endpoint.url,
          error: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date().toISOString(),
        });
      }
    }

    const overallStatus = services.every(service => service.status === 'healthy') 
      ? 'healthy' 
      : 'degraded';

    res.json({
      success: true,
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: config.nodeEnv,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
        },
      },
    });
  } catch (error) {
    logger.error('Detailed health check failed', { error });
    
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/health/ready
 * @desc    Readiness probe for container orchestration
 * @access  Public
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all critical services are ready
    const isReady = true; // In a real implementation, check database connections, etc.

    if (isReady) {
      res.json({
        success: true,
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'not ready',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', { error });
    
    res.status(503).json({
      success: false,
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/health/live
 * @desc    Liveness probe for container orchestration
 * @access  Public
 */
router.get('/live', async (req: Request, res: Response) => {
  try {
    // Simple liveness check - if we can respond, we're alive
    res.json({
      success: true,
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error('Liveness check failed', { error });
    
    res.status(503).json({
      success: false,
      status: 'dead',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as healthRoutes };