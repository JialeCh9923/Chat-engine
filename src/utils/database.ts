import mongoose from 'mongoose';
import { config } from '../config';
import logger from './logger';

/**
 * Database connection state
 */
let isConnected = false;

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<void> {
  if (isConnected || mongoose.connection.readyState === 1) {
    logger.warn('Database already connected');
    return;
  }

  // In test environment, skip if mongoose is already connected (by test setup)
  if (process.env.NODE_ENV === 'test' && mongoose.connection.readyState !== 0) {
    logger.info('Test environment detected, using existing database connection');
    isConnected = true;
    return;
  }

  try {
    // Set mongoose options
    mongoose.set('strictQuery', false);
    
    // Connect to MongoDB
    await mongoose.connect(config.mongodb.uri, {
      maxPoolSize: config.mongodb.options.maxPoolSize,
      serverSelectionTimeoutMS: config.mongodb.options.serverSelectionTimeoutMS,
      socketTimeoutMS: config.mongodb.options.socketTimeoutMS,
      retryWrites: true,
      w: 'majority',
    });

    isConnected = true;

    // Connection event handlers
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await closeDatabase();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await closeDatabase();
      process.exit(0);
    });

    logger.info('Database initialization completed');

  } catch (error) {
    logger.error('Failed to initialize database:', error);
    isConnected = false;
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get database connection status
 */
export function getDatabaseStatus(): {
  connected: boolean;
  readyState: number;
  host?: string;
  name?: string;
} {
  return {
    connected: isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
}

export default {
  initializeDatabase,
  closeDatabase,
  isDatabaseConnected,
  getDatabaseStatus,
};