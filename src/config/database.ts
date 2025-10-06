import mongoose from 'mongoose';
import { config } from './index';
import logger from '../utils/logger';

class Database {
  private static instance: Database;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    try {
      await mongoose.connect(config.mongodb.uri, config.mongodb.options);
      this.isConnected = true;
      logger.info('Successfully connected to MongoDB');

      // Set up event listeners
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public async createIndexes(): Promise<void> {
    try {
      // Create indexes for better performance
      const db = mongoose.connection.db;
      
      if (!db) {
        throw new Error('Database connection not established');
      }
      
      // Sessions collection indexes
      await db.collection('sessions').createIndex({ sessionId: 1 }, { unique: true });
      await db.collection('sessions').createIndex({ clientId: 1, userId: 1 });
      await db.collection('sessions').createIndex({ status: 1 });
      await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

      // Conversations collection indexes
      await db.collection('conversations').createIndex({ conversationId: 1 }, { unique: true });
      await db.collection('conversations').createIndex({ sessionId: 1, timestamp: -1 });

      // Documents collection indexes
      await db.collection('documents').createIndex({ documentId: 1 }, { unique: true });
      await db.collection('documents').createIndex({ sessionId: 1 });
      await db.collection('documents').createIndex({ processingStatus: 1 });

      // Jobs collection indexes
      await db.collection('jobs').createIndex({ jobId: 1 }, { unique: true });
      await db.collection('jobs').createIndex({ sessionId: 1 });
      await db.collection('jobs').createIndex({ status: 1, priority: -1 });
      await db.collection('jobs').createIndex({ createdAt: -1 });

      // Clients collection indexes
      await db.collection('clients').createIndex({ clientId: 1 }, { unique: true });
      await db.collection('clients').createIndex({ apiKey: 1 }, { unique: true });
      await db.collection('clients').createIndex({ isActive: 1 });

      // Tax forms collection indexes
      await db.collection('taxforms').createIndex({ formId: 1 }, { unique: true });
      await db.collection('taxforms').createIndex({ sessionId: 1 });
      await db.collection('taxforms').createIndex({ status: 1 });

      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Error creating database indexes:', error);
      throw error;
    }
  }
}

export default Database;