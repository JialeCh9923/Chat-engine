#!/usr/bin/env node

/**
 * Chat Engine Tax Filing API Server
 * Main entry point for the application
 */

import { chatEngineApp } from './app';
import logger from './utils/logger';
import { config } from './config';

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Starting Chat Engine Tax Filing API Server...', {
      nodeVersion: process.version,
      platform: process.platform,
      environment: config.nodeEnv,
      pid: process.pid,
    });

    // Start the application
    await chatEngineApp.start();

    logger.info('Server startup completed successfully');

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Exit with error code
    process.exit(1);
  }
}

/**
 * Handle startup errors
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception during startup', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled rejection during startup', {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

export { startServer };