import { MongoClient, Db, Collection } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { config } from '../config';
import logger from '../utils/logger';
import { CustomApiError } from '../middleware/errorHandler';

/**
 * Client interface
 */
export interface Client {
  clientId: string;
  name: string;
  email: string;
  apiKey: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastAccessAt?: Date;
  usage: {
    apiCalls: number;
    sessionsCreated: number;
    documentsUploaded: number;
    jobsCreated: number;
    lastResetAt: Date;
  };
}

/**
 * Client service for managing API clients
 */
class ClientService {
  private db: Db | null = null;
  private collection: Collection<Client> | null = null;

  /**
   * Initialize the client service
   */
  async initialize(): Promise<void> {
    try {
      const client = new MongoClient(config.mongodb.uri);
      await client.connect();
      // Extract database name from URI or use default
      const dbName = config.mongodb.uri.split('/').pop()?.split('?')[0] || 'chat-engine-tax';
      this.db = client.db(dbName);
      this.collection = this.db.collection<Client>('clients');

      // Create indexes
      await this.collection.createIndex({ clientId: 1 }, { unique: true });
      await this.collection.createIndex({ apiKey: 1 }, { unique: true });
      await this.collection.createIndex({ email: 1 }, { unique: true });
      await this.collection.createIndex({ isActive: 1 });
      await this.collection.createIndex({ createdAt: 1 });

      logger.info('Client service initialized');
    } catch (error) {
      logger.error('Failed to initialize client service', { error });
      throw error;
    }
  }

  /**
   * Generate a secure API key
   */
  private generateApiKey(): string {
    return `ck_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Create a new client
   */
  async createClient(
    name: string,
    email: string,
    permissions: string[] = ['read', 'write']
  ): Promise<Client> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      // Check if email already exists
      const existingClient = await this.collection.findOne({ email });
      if (existingClient) {
        throw new CustomApiError('Client with this email already exists', 400);
      }

      const client: Client = {
        clientId: uuidv4(),
        name,
        email,
        apiKey: this.generateApiKey(),
        permissions,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          apiCalls: 0,
          sessionsCreated: 0,
          documentsUploaded: 0,
          jobsCreated: 0,
          lastResetAt: new Date(),
        },
      };

      await this.collection.insertOne(client);

      logger.info('Client created', {
        clientId: client.clientId,
        name,
        email,
        permissions,
      });

      return client;
    } catch (error) {
      logger.error('Failed to create client', { error, name, email });
      throw error;
    }
  }

  /**
   * Get client by ID
   */
  async getClient(clientId: string): Promise<Client | null> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      const client = await this.collection.findOne({ clientId });
      return client;
    } catch (error) {
      logger.error('Failed to get client', { error, clientId });
      throw error;
    }
  }

  /**
   * Get client by API key
   */
  async getClientByApiKey(apiKey: string): Promise<Client | null> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      const client = await this.collection.findOne({ apiKey, isActive: true });
      
      if (client) {
        // Update last access time
        await this.collection.updateOne(
          { clientId: client.clientId },
          { $set: { lastAccessAt: new Date() } }
        );
      }

      return client;
    } catch (error) {
      logger.error('Failed to get client by API key', { error });
      throw error;
    }
  }

  /**
   * Get all clients
   */
  async getAllClients(options: {
    isActive?: boolean;
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
  } = {}): Promise<Client[]> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      const {
        isActive,
        limit = 20,
        skip = 0,
        sort = { createdAt: -1 },
      } = options;

      const filter: any = {};
      if (isActive !== undefined) {
        filter.isActive = isActive;
      }

      const clients = await this.collection
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      return clients;
    } catch (error) {
      logger.error('Failed to get all clients', { error, options });
      throw error;
    }
  }

  /**
   * Update client
   */
  async updateClient(
    clientId: string,
    updates: Partial<Pick<Client, 'name' | 'email' | 'permissions' | 'isActive'>>
  ): Promise<Client | null> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      // Check if email is being updated and already exists
      if (updates.email) {
        const existingClient = await this.collection.findOne({
          email: updates.email,
          clientId: { $ne: clientId },
        });
        if (existingClient) {
          throw new CustomApiError('Client with this email already exists', 400);
        }
      }

      const result = await this.collection.findOneAndUpdate(
        { clientId },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (result) {
        logger.info('Client updated', {
          clientId,
          updates: Object.keys(updates),
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to update client', { error, clientId, updates });
      throw error;
    }
  }

  /**
   * Delete client
   */
  async deleteClient(clientId: string): Promise<boolean> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      const result = await this.collection.deleteOne({ clientId });

      if (result.deletedCount > 0) {
        logger.info('Client deleted', { clientId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to delete client', { error, clientId });
      throw error;
    }
  }

  /**
   * Regenerate API key
   */
  async regenerateApiKey(clientId: string): Promise<string | null> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      const newApiKey = this.generateApiKey();

      const result = await this.collection.findOneAndUpdate(
        { clientId },
        {
          $set: {
            apiKey: newApiKey,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (result) {
        logger.info('API key regenerated', { clientId });
        return newApiKey;
      }

      return null;
    } catch (error) {
      logger.error('Failed to regenerate API key', { error, clientId });
      throw error;
    }
  }

  /**
   * Get client usage statistics
   */
  async getClientUsage(clientId: string): Promise<Client['usage'] | null> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      const client = await this.collection.findOne(
        { clientId },
        { projection: { usage: 1 } }
      );

      return client?.usage || null;
    } catch (error) {
      logger.error('Failed to get client usage', { error, clientId });
      throw error;
    }
  }

  /**
   * Update client usage
   */
  async updateClientUsage(
    clientId: string,
    operation: 'apiCalls' | 'sessionsCreated' | 'documentsUploaded' | 'jobsCreated',
    amount: number = 1
  ): Promise<void> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      await this.collection.updateOne(
        { clientId },
        {
          $inc: { [`usage.${operation}`]: amount },
          $set: { updatedAt: new Date() },
        }
      );

      logger.debug('Client usage updated', {
        clientId,
        operation,
        amount,
      });
    } catch (error) {
      logger.error('Failed to update client usage', {
        error,
        clientId,
        operation,
        amount,
      });
      throw error;
    }
  }

  /**
   * Reset client usage
   */
  async resetClientUsage(clientId: string): Promise<void> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      await this.collection.updateOne(
        { clientId },
        {
          $set: {
            'usage.apiCalls': 0,
            'usage.sessionsCreated': 0,
            'usage.documentsUploaded': 0,
            'usage.jobsCreated': 0,
            'usage.lastResetAt': new Date(),
            updatedAt: new Date(),
          },
        }
      );

      logger.info('Client usage reset', { clientId });
    } catch (error) {
      logger.error('Failed to reset client usage', { error, clientId });
      throw error;
    }
  }

  /**
   * Get client statistics
   */
  async getClientStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalApiCalls: number;
    totalSessions: number;
    totalDocuments: number;
    totalJobs: number;
  }> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      const [totalResult, activeResult, inactiveResult, usageResult] = await Promise.all([
        this.collection.countDocuments({}),
        this.collection.countDocuments({ isActive: true }),
        this.collection.countDocuments({ isActive: false }),
        this.collection.aggregate([
          {
            $group: {
              _id: null,
              totalApiCalls: { $sum: '$usage.apiCalls' },
              totalSessions: { $sum: '$usage.sessionsCreated' },
              totalDocuments: { $sum: '$usage.documentsUploaded' },
              totalJobs: { $sum: '$usage.jobsCreated' },
            },
          },
        ]).toArray(),
      ]);

      const usage = usageResult[0] || {
        totalApiCalls: 0,
        totalSessions: 0,
        totalDocuments: 0,
        totalJobs: 0,
      };

      return {
        total: totalResult,
        active: activeResult,
        inactive: inactiveResult,
        totalApiCalls: usage.totalApiCalls,
        totalSessions: usage.totalSessions,
        totalDocuments: usage.totalDocuments,
        totalJobs: usage.totalJobs,
      };
    } catch (error) {
      logger.error('Failed to get client statistics', { error });
      throw error;
    }
  }

  /**
   * Cleanup inactive clients
   */
  async cleanupInactiveClients(daysInactive: number = 90): Promise<number> {
    if (!this.collection) {
      throw new CustomApiError('Client service not initialized', 500);
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

      const result = await this.collection.deleteMany({
        isActive: false,
        $or: [
          { lastAccessAt: { $lt: cutoffDate } },
          { lastAccessAt: { $exists: false }, createdAt: { $lt: cutoffDate } },
        ],
      });

      logger.info('Inactive clients cleaned up', {
        deletedCount: result.deletedCount,
        daysInactive,
      });

      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup inactive clients', { error, daysInactive });
      throw error;
    }
  }
}

// Create singleton instance
export const clientService = new ClientService();