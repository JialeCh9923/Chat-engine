import { Request, Response } from 'express';
import { sessionService } from '../services/sessionService';
import logger from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { CustomApiError } from '../middleware/errorHandler';

/**
 * Session controller handling all session-related operations
 */
export class SessionController {
  /**
   * Create a new session
   * POST /api/v1/sessions
   */
  static createSession = asyncHandler(async (req: Request, res: Response) => {
    const { userId, metadata } = req.body;
    const clientId = (req as any).client.clientId;

    logger.info('Creating new session', { clientId, userId });

    const { session, isNew } = await sessionService.createSession(clientId, userId, metadata);

    res.status(isNew ? 201 : 200).json({
      sessionId: session.sessionId,
      clientId: session.clientId,
      status: session.status,
      metadata: session.metadata,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      isActive: session.isActive(),
    });
  });

  /**
   * Get session by ID
   * GET /api/v1/sessions/:sessionId
   */
  static getSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    logger.debug('Retrieving session', { sessionId });

    const session = await sessionService.getSession(sessionId);

    if (!session) {
      throw new CustomApiError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    res.json({
      sessionId: session.sessionId,
      clientId: session.clientId,
      userId: session.userId,
      status: session.status,
      metadata: session.metadata,
      conversationHistory: session.conversationHistory,
      documents: session.documents,
      jobs: session.jobs,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
      lastActivity: session.lastActivity,
      isActive: session.isActive(),
      isExpired: session.isExpired(),
    });
  });

  /**
   * Update session
   * PUT /api/v1/sessions/:sessionId
   */
  static updateSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const updates = req.body;

    logger.info('Updating session', { sessionId, updates: Object.keys(updates) });

    // Remove fields that shouldn't be updated directly
    delete updates.sessionId;
    delete updates.clientId;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.lastActivity;

    const session = await sessionService.updateSession(sessionId, updates);

    if (!session) {
      throw new CustomApiError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    res.json({
      sessionId: session.sessionId,
      status: session.status,
      metadata: session.metadata,
      updatedAt: session.updatedAt,
      lastActivity: session.lastActivity,
    });
  });

  /**
   * Delete session
   * DELETE /api/v1/sessions/:sessionId
   */
  static deleteSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    logger.info('Deactivating session', { sessionId });

    const deactivated = await sessionService.deleteSession(sessionId);

    if (!deactivated) {
      throw new CustomApiError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Session deactivated successfully',
    });
  });

  /**
   * Get sessions by client ID (for client route)
   * GET /api/v1/sessions/client/:clientId
   */
  static getSessionsByClient = asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;
    const {
      status,
      userId,
      page = 1,
      limit = 20,
      sort = 'lastActivity',
      order = 'desc',
    } = req.query;

    logger.debug('Retrieving sessions for client', { clientId, status, userId });

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj: any = {};
    sortObj[sort as string] = order === 'desc' ? -1 : 1;

    let sessions;
    if (userId) {
      sessions = await sessionService.getSessionsByUser(userId as string, {
        status: status as string,
        limit: Number(limit),
        skip,
        sort: sortObj,
      });
    } else {
      sessions = await sessionService.getSessionsByClient(clientId, {
        status: status as string,
        limit: Number(limit),
        skip,
        sort: sortObj,
      });
    }

    const sessionData = sessions.map(session => ({
      sessionId: session.sessionId,
      clientId: session.clientId,
      userId: session.userId,
      status: session.status,
      metadata: session.metadata,
      conversationCount: session.conversationHistory.length,
      documentCount: session.documents.length,
      jobCount: session.jobs.length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      isActive: session.isActive(),
      isExpired: session.isExpired(),
    }));

    // Return just the array for client route
    res.json(sessionData);
  });

  /**
   * Get sessions by client
   * GET /api/v1/sessions
   */
  static getSessions = asyncHandler(async (req: Request, res: Response) => {
    const clientId = (req as any).client.clientId;
    const {
      status,
      userId,
      page = 1,
      limit = 20,
      sort = 'lastActivity',
      order = 'desc',
    } = req.query;

    logger.debug('Retrieving sessions for client', { clientId, status, userId });

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj: any = {};
    sortObj[sort as string] = order === 'desc' ? -1 : 1;

    let sessions;
    if (userId) {
      sessions = await sessionService.getSessionsByUser(userId as string, {
        status: status as string,
        limit: Number(limit),
        skip,
        sort: sortObj,
      });
    } else {
      sessions = await sessionService.getSessionsByClient(clientId, {
        status: status as string,
        limit: Number(limit),
        skip,
        sort: sortObj,
      });
    }

    const sessionData = sessions.map(session => ({
      sessionId: session.sessionId,
      userId: session.userId,
      status: session.status,
      metadata: session.metadata,
      conversationCount: session.conversationHistory.length,
      documentCount: session.documents.length,
      jobCount: session.jobs.length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      isActive: session.isActive(),
      isExpired: session.isExpired(),
    }));

    res.json({
      success: true,
      data: sessionData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: sessionData.length,
        hasMore: sessionData.length === Number(limit),
      },
    });
  });

  /**
   * Extend session expiration
   * POST /api/v1/sessions/:sessionId/extend
   */
  static extendSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { additionalTime } = req.body;

    logger.info('Extending session', { sessionId, additionalTime });

    const extended = await sessionService.extendSession(sessionId, additionalTime);

    if (!extended) {
      throw new CustomApiError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    const session = await sessionService.getSession(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        expiresAt: session?.expiresAt,
        lastActivity: session?.lastActivity,
      },
      message: 'Session extended successfully',
    });
  });

  /**
   * Update session progress
   * POST /api/v1/sessions/:sessionId/progress
   */
  static updateProgress = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const progress = req.body;

    logger.info('Updating session progress', { sessionId, progress });

    const updated = await sessionService.updateProgress(sessionId, progress);

    if (!updated) {
      throw new CustomApiError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    const session = await sessionService.getSession(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        progress: session?.metadata.progress,
        updatedAt: session?.updatedAt,
      },
      message: 'Session progress updated successfully',
    });
  });

  /**
   * Get session statistics
   * GET /api/v1/sessions/stats
   */
  static getSessionStats = asyncHandler(async (req: Request, res: Response) => {
    const clientId = (req as any).client.clientId;

    logger.debug('Retrieving session statistics', { clientId });

    const stats = await sessionService.getSessionStats();
    const cacheStats = sessionService.getCacheStats();

    res.json({
      success: true,
      data: {
        sessions: stats,
        cache: cacheStats,
      },
    });
  });

  /**
   * Cleanup expired sessions
   * POST /api/v1/sessions/cleanup
   */
  static cleanupExpiredSessions = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Cleaning up expired sessions');

    const cleanedCount = await sessionService.cleanupExpiredSessions();

    res.json({
      success: true,
      data: {
        cleanedCount,
      },
      message: `Cleaned up ${cleanedCount} expired sessions`,
    });
  });

  /**
   * Warm up session cache
   * POST /api/v1/sessions/cache/warmup
   */
  static warmUpCache = asyncHandler(async (req: Request, res: Response) => {
    const { limit = 100 } = req.body;

    logger.info('Warming up session cache', { limit });

    await sessionService.warmUpCache(limit);

    const cacheStats = sessionService.getCacheStats();

    res.json({
      success: true,
      data: {
        cache: cacheStats,
      },
      message: 'Session cache warmed up successfully',
    });
  });

  /**
   * Clear session cache
   * POST /api/v1/sessions/cache/clear
   */
  static clearCache = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Clearing session cache');

    sessionService.clearCache();

    res.json({
      success: true,
      message: 'Session cache cleared successfully',
    });
  });

  /**
   * Health check for session service
   * GET /api/v1/sessions/health
   */
  static healthCheck = asyncHandler(async (req: Request, res: Response) => {
    const cacheStats = sessionService.getCacheStats();
    const sessionStats = await sessionService.getSessionStats();

    res.json({
      success: true,
      data: {
        service: 'session',
        status: 'healthy',
        cache: cacheStats,
        sessions: {
          total: sessionStats.total,
          active: sessionStats.active,
          expired: sessionStats.expired,
        },
        timestamp: new Date().toISOString(),
      },
    });
  });
}

export default SessionController;