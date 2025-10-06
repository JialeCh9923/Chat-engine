import { LRUCache } from 'lru-cache';
import Session, { ISessionDocument } from '../models/Session';
import { ISession, ISessionMetadata } from '../types';
import logger from '../utils/logger';
import { AuthUtils } from '../utils/auth';
import { config } from '../config';

/**
 * Session service with MongoDB storage and LRU caching
 */
export class SessionService {
  private cache: LRUCache<string, ISessionDocument>;
  private static instance: SessionService;

  constructor() {
    // Initialize LRU cache for sessions
    this.cache = new LRUCache<string, ISessionDocument>({
      max: config.cache.sessions.max,
      ttl: config.cache.sessions.ttl,
      updateAgeOnGet: config.cache.sessions.updateAgeOnGet,
      updateAgeOnHas: true,
      allowStale: false,
    });

    // Note: LRU cache event listeners are not available in this version
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Initialize the session service
   */
  async initialize(): Promise<void> {
    try {
      // Warm up cache with active sessions
      await this.warmUpCache(50);
      
      // Clean up expired sessions
      await this.cleanupExpiredSessions();
      
      logger.info('Session service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize session service', { error });
      throw error;
    }
  }

  /**
   * Create a new session or return existing one
   */
  async createSession(
    clientId: string,
    userId?: string,
    metadata?: Partial<ISessionMetadata>
  ): Promise<{ session: ISessionDocument; isNew: boolean }> {
    try {
      // Check for existing active session with same clientId
      const existingSession = await Session.findOne({ 
        clientId, 
        status: 'active' 
      }).sort({ lastActivity: -1 });

      if (existingSession && !existingSession.isExpired()) {
        // Update last activity and return existing session
        existingSession.lastActivity = new Date();
        await existingSession.save();
        
        // Cache the session
        this.cache.set(existingSession.sessionId, existingSession);

        logger.info('Returning existing session', {
          sessionId: existingSession.sessionId,
          clientId,
          userId,
        });

        return { session: existingSession, isNew: false };
      }

      const sessionId = AuthUtils.generateUniqueId();
      
      const sessionData: Partial<ISession> = {
        sessionId,
        clientId,
        userId,
        status: 'active',
        metadata: {
          filingYear: metadata?.filingYear || new Date().getFullYear(),
          filingType: metadata?.filingType || 'individual',
          taxpayerInfo: metadata?.taxpayerInfo || {},
          preferences: metadata?.preferences || {},
          progress: metadata?.progress || {
            currentStep: 'initial',
            completedSteps: [],
            totalSteps: 0,
            percentComplete: 0,
          },
          customData: metadata?.customData || new Map(),
        },
        conversationHistory: [],
        documents: [],
        jobs: [],
        expiresAt: new Date(Date.now() + config.session.timeoutMs),
        lastActivity: new Date(),
      };

      const session = new Session(sessionData);
      await session.save();

      // Cache the session
      this.cache.set(sessionId, session);

      logger.info('Session created', {
        sessionId,
        clientId,
        userId,
        expiresAt: session.expiresAt,
      });

      return { session, isNew: true };
    } catch (error) {
      logger.error('Failed to create session', { error, clientId, userId });
      throw error;
    }
  }

  /**
   * Get session by ID (with caching)
   */
  async getSession(sessionId: string): Promise<ISessionDocument | null> {
    try {
      // Check cache first
      let session: ISessionDocument | undefined | null = this.cache.get(sessionId);
      
      if (session) {
        // Update last activity
        session.lastActivity = new Date();
        await session.save();
        
        logger.debug('Session retrieved from cache', { sessionId });
        return session;
      }

      // Fetch from database
      const dbSession = await Session.findOne({ sessionId });
      session = dbSession;
      
      if (session) {
        // Check if session is expired
        if (session.isExpired()) {
          logger.warn('Expired session accessed', { sessionId });
          await this.deleteSession(sessionId);
          return null;
        }

        // Update last activity
        session.lastActivity = new Date();
        await session.save();

        // Cache the session
        this.cache.set(sessionId, session);
        
        logger.debug('Session retrieved from database and cached', { sessionId });
      }

      return session || null;
    } catch (error) {
      logger.error('Failed to get session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Update session
   */
  async updateSession(
    sessionId: string,
    updates: Partial<ISession>
  ): Promise<ISessionDocument | null> {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return null;
      }

      // Apply updates
      Object.assign(session, updates);
      session.lastActivity = new Date();
      
      await session.save();

      // Update cache
      this.cache.set(sessionId, session);

      logger.info('Session updated', { sessionId, updates: Object.keys(updates) });

      return session;
    } catch (error) {
      logger.error('Failed to update session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Delete session (deactivate)
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // Remove from cache
      this.cache.delete(sessionId);

      // Deactivate session instead of deleting
      const result = await Session.updateOne(
        { sessionId },
        { status: 'inactive' }
      );

      logger.info('Session deactivated', { sessionId, modified: result.modifiedCount > 0 });

      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to deactivate session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Get sessions by client ID
   */
  async getSessionsByClient(
    clientId: string,
    options: {
      status?: string;
      limit?: number;
      skip?: number;
      sort?: any;
    } = {}
  ): Promise<ISessionDocument[]> {
    try {
      const query: any = { clientId };
      
      if (options.status) {
        query.status = options.status;
      }

      const sessions = await Session.find(query)
        .sort(options.sort || { lastActivity: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);

      logger.debug('Sessions retrieved by client', {
        clientId,
        count: sessions.length,
        options,
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get sessions by client', { error, clientId });
      throw error;
    }
  }

  /**
   * Get sessions by user ID
   */
  async getSessionsByUser(
    userId: string,
    options: {
      status?: string;
      limit?: number;
      skip?: number;
      sort?: any;
    } = {}
  ): Promise<ISessionDocument[]> {
    try {
      const query: any = { userId };
      
      if (options.status) {
        query.status = options.status;
      }

      const sessions = await Session.find(query)
        .sort(options.sort || { lastActivity: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);

      logger.debug('Sessions retrieved by user', {
        userId,
        count: sessions.length,
        options,
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get sessions by user', { error, userId });
      throw error;
    }
  }

  /**
   * Add conversation to session
   */
  async addConversation(sessionId: string, conversationId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return false;
      }

      await session.addConversation(conversationId);
      
      // Update cache
      this.cache.set(sessionId, session);

      logger.debug('Conversation added to session', { sessionId, conversationId });

      return true;
    } catch (error) {
      logger.error('Failed to add conversation to session', {
        error,
        sessionId,
        conversationId,
      });
      throw error;
    }
  }

  /**
   * Remove conversation from session
   */
  async removeConversation(sessionId: string, conversationId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return false;
      }

      // Remove conversation from session's conversation history
      session.conversationHistory = session.conversationHistory.filter(
        (conv: any) => conv.conversationId !== conversationId
      );
      
      session.updatedAt = new Date();
      await session.save();
      
      // Update cache
      this.cache.set(sessionId, session);

      logger.debug('Conversation removed from session', { sessionId, conversationId });

      return true;
    } catch (error) {
      logger.error('Failed to remove conversation from session', {
        error,
        sessionId,
        conversationId,
      });
      throw error;
    }
  }

  /**
   * Add document to session
   */
  async addDocument(sessionId: string, documentId: string, filename: string = 'unknown'): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return false;
      }

      await session.addDocument(documentId, filename);
      
      // Update cache
      this.cache.set(sessionId, session);

      logger.debug('Document added to session', { sessionId, documentId, filename });

      return true;
    } catch (error) {
      logger.error('Failed to add document to session', {
        error,
        sessionId,
        documentId,
      });
      throw error;
    }
  }

  /**
   * Add job to session
   */
  async addJob(sessionId: string, jobId: string, type: string = 'unknown'): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return false;
      }

      await session.addJob(jobId, type);
      
      // Update cache
      this.cache.set(sessionId, session);

      logger.debug('Job added to session', { sessionId, jobId, type });

      return true;
    } catch (error) {
      logger.error('Failed to add job to session', { error, sessionId, jobId });
      throw error;
    }
  }

  /**
   * Update session progress
   */
  async updateProgress(
    sessionId: string,
    step: string,
    percentComplete?: number
  ): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return false;
      }

      await session.updateProgress(step, percentComplete);
      
      // Update cache
      this.cache.set(sessionId, session);

      logger.debug('Session progress updated', { sessionId, step, percentComplete });

      return true;
    } catch (error) {
      logger.error('Failed to update session progress', {
        error,
        sessionId,
        step,
        percentComplete,
      });
      throw error;
    }
  }

  /**
   * Extend session expiration
   */
  async extendSession(sessionId: string, additionalTime?: number): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return false;
      }

      const extension = additionalTime || config.session.timeoutMs;
      session.expiresAt = new Date(Date.now() + extension);
      session.lastActivity = new Date();
      
      await session.save();
      
      // Update cache
      this.cache.set(sessionId, session);

      logger.info('Session extended', {
        sessionId,
        newExpiresAt: session.expiresAt,
        extension,
      });

      return true;
    } catch (error) {
      logger.error('Failed to extend session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await Session.deleteMany({ expiresAt: { $lt: new Date() } });
      
      // Clear cache entries for expired sessions
      const now = Date.now();
      for (const [key, session] of this.cache.entries()) {
        if (session.expiresAt && session.expiresAt.getTime() < now) {
          this.cache.delete(key);
        }
      }

      logger.info('Expired sessions cleaned up', { count: result.deletedCount });

      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error });
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
      max: this.cache.max,
      ttl: this.cache.ttl,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Session cache cleared');
  }

  /**
   * Warm up cache with active sessions
   */
  async warmUpCache(limit: number = 100): Promise<void> {
    try {
      const activeSessions = await Session.find({ status: 'active' })
        .sort({ lastActivity: -1 })
        .limit(limit);

      for (const session of activeSessions) {
        this.cache.set(session.sessionId, session);
      }

      logger.info('Session cache warmed up', { count: activeSessions.length });
    } catch (error) {
      logger.error('Failed to warm up session cache', { error });
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    byStatus: Record<string, number>;
    byFilingType: Record<string, number>;
  }> {
    try {
      const [
        total,
        active,
        expired,
        statusStats,
        filingTypeStats,
      ] = await Promise.all([
        Session.countDocuments(),
        Session.countDocuments({ status: 'active' }),
        Session.countDocuments({ expiresAt: { $lt: new Date() } }),
        Session.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Session.aggregate([
          { $group: { _id: '$metadata.filingType', count: { $sum: 1 } } },
        ]),
      ]);

      const byStatus: Record<string, number> = {};
      statusStats.forEach((stat: any) => {
        byStatus[stat._id] = stat.count;
      });

      const byFilingType: Record<string, number> = {};
      filingTypeStats.forEach((stat: any) => {
        byFilingType[stat._id] = stat.count;
      });

      return {
        total,
        active,
        expired,
        byStatus,
        byFilingType,
      };
    } catch (error) {
      logger.error('Failed to get session statistics', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const sessionService = SessionService.getInstance();