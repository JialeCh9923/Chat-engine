import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import logger from './utils/logger';
import { apiRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { globalRateLimiter } from './middleware/rateLimiter';
import { initializeDatabase } from './utils/database';
import { sessionService } from './services/sessionService';
import { conversationService } from './services/conversationService';
import { documentService } from './services/documentService';
import { jobService } from './services/jobService';
import { taxFormService } from './services/taxFormService';
import { clientService } from './services/clientService';
import { openaiService } from './services/openaiService';
import { swaggerSpec } from './config/swagger';

/**
 * Chat Engine Tax Filing Application
 */
class ChatEngineApp {
  public app: Application;
  private isInitialized = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    }));

    // Compression
    this.app.use(compression());

    // Request logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          logger.info(message.trim(), { source: 'http' });
        },
      },
    }));

    // Body parsing
    this.app.use(express.json({ limit: config.upload.maxFileSize }));
    this.app.use(express.urlencoded({ extended: true, limit: config.upload.maxFileSize }));

    // Global rate limiting
    this.app.use(globalRateLimiter);

    // Request ID and timing
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.startTime = Date.now();
      
      res.setHeader('X-Request-ID', req.id);
      
      next();
    });

    // Health check endpoint (before API routes)
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
      });
    });
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Swagger JSON spec endpoint - MUST come before swagger-ui-express
    this.app.get('/api-docs/swagger.json', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // Swagger API documentation
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Chat Engine Tax Filing API Documentation',
    }));

    // API routes
    this.app.use('/api', apiRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Chat Engine Tax Filing API',
        version: '1.0.0',
        description: 'RESTful API for tax filing chat engine with AI assistance',
        documentation: '/api-docs',
        health: '/health',
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString(),
      });
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      
      // Graceful shutdown
      this.shutdown();
      process.exit(1);
    });
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Application already initialized');
      return;
    }

    try {
      logger.info('Initializing Chat Engine Tax Filing API...');

      // Initialize database connection
      logger.info('Connecting to database...');
      await initializeDatabase();
      logger.info('Database connected successfully');

      // Initialize services in dependency order
      logger.info('Initializing services...');
      
      // Core services
      await clientService.initialize();
      logger.info('Client service initialized');

      await sessionService.initialize();
      logger.info('Session service initialized');

      await conversationService.initialize();
      logger.info('Conversation service initialized');

      await documentService.initialize();
      logger.info('Document service initialized');

      await jobService.initialize();
      logger.info('Job service initialized');

      await taxFormService.initialize();
      logger.info('Tax form service initialized');

      // AI service
      await openaiService.initialize();
      logger.info('OpenAI service initialized');

      // Job processing is automatically started in JobService constructor
      logger.info('Job processing started');

      this.isInitialized = true;
      logger.info('All services initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize application', { error });
      throw error;
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<any> {
    try {
      // Initialize services first
      await this.initialize();

      // Start HTTP server
      const server = this.app.listen(config.port, () => {
        logger.info(`Chat Engine Tax Filing API started`, {
          port: config.port,
          environment: config.nodeEnv,
          version: '1.0.0',
        });
      });

      // Graceful shutdown handling
      const gracefulShutdown = (signal: string) => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        
        server.close(async () => {
          logger.info('HTTP server closed');
          await this.shutdown();
          process.exit(0);
        });

        // Force shutdown after 30 seconds
        setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 30000);
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      return server;
    } catch (error) {
      logger.error('Failed to start server', { error });
      throw error;
    }
  }

  /**
   * Shutdown the application
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      logger.info('Shutting down application...');

      // Stop job processing
      jobService.stopProcessing();
      logger.info('Job processing stopped');

      // Cleanup services (in reverse order)
      // Note: Individual services should handle their own cleanup
      logger.info('Services shutdown completed');

      this.isInitialized = false;
      logger.info('Application shutdown completed');

    } catch (error) {
      logger.error('Error during shutdown', { error });
    }
  }

  /**
   * Get application instance
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Check if application is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export the class and create application instance
export { ChatEngineApp };
export const chatEngineApp = new ChatEngineApp();
export default chatEngineApp;