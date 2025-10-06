import { Request, Response } from 'express';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import { CustomApiError, asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * SSE connection interface
 */
interface SSEConnection {
  id: string;
  clientId: string;
  sessionId?: string;
  response: Response;
  lastPing: Date;
  subscriptions: Set<string>;
}

/**
 * SSE event interface
 */
interface SSEEvent {
  type: string;
  data: any;
  id?: string;
  retry?: number;
}

/**
 * SSE Controller for real-time communication
 */
export class SSEController {
  private static connections = new Map<string, SSEConnection>();
  private static eventEmitter = new EventEmitter();
  private static pingInterval: NodeJS.Timeout | null = null;
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize SSE service
   */
  static initialize(): void {
    // Start ping interval to keep connections alive
    this.pingInterval = setInterval(() => {
      this.pingConnections();
    }, 30000); // Ping every 30 seconds

    // Clean up dead connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupDeadConnections();
    }, 60000); // Cleanup every minute

    logger.info('SSE service initialized');
  }

  /**
   * Shutdown SSE service
   */
  static shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.response.end();
    }
    this.connections.clear();

    logger.info('SSE service shutdown');
  }

  /**
   * Connect to SSE stream
   */
  static connect = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.query;
    const connectionId = `${req.client!.clientId}_${Date.now()}`;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Create connection
    const connection: SSEConnection = {
      id: connectionId,
      clientId: req.client!.clientId,
      sessionId: sessionId as string,
      response: res,
      lastPing: new Date(),
      subscriptions: new Set(),
    };

    SSEController.connections.set(connectionId, connection);

    // Send initial connection event
    SSEController.sendEvent(connectionId, {
      type: 'connected',
      data: {
        connectionId,
        timestamp: new Date().toISOString(),
        message: 'SSE connection established',
      },
    });

    // Handle client disconnect
    req.on('close', () => {
      SSEController.disconnect(connectionId);
    });

    req.on('aborted', () => {
      SSEController.disconnect(connectionId);
    });

    logger.info('SSE connection established', {
      connectionId,
      clientId: req.client!.clientId,
      sessionId,
    });
  });

  /**
   * Disconnect SSE connection
   */
  static disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.response.end();
      this.connections.delete(connectionId);

      logger.info('SSE connection closed', {
        connectionId,
        clientId: connection.clientId,
      });
    }
  }

  /**
   * Subscribe to event types
   */
  static subscribe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { connectionId } = req.params;
    const { eventTypes } = req.body;

    const connection = SSEController.connections.get(connectionId);
    if (!connection) {
      throw new CustomApiError('Connection not found', 404);
    }

    // Verify ownership
    if (connection.clientId !== req.client!.clientId) {
      throw new CustomApiError('Access denied to connection', 403);
    }

    // Add subscriptions
    if (Array.isArray(eventTypes)) {
      eventTypes.forEach((eventType: string) => {
        connection.subscriptions.add(eventType);
      });
    }

    logger.info('SSE subscriptions updated', {
      connectionId,
      eventTypes,
      clientId: req.client!.clientId,
    });

    res.json({
      success: true,
      data: {
        connectionId,
        subscriptions: Array.from(connection.subscriptions),
      },
      message: 'Subscriptions updated successfully',
    });
  });

  /**
   * Send event to specific connection
   */
  static sendEvent(connectionId: string, event: SSEEvent): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      const eventData = this.formatSSEEvent(event);
      connection.response.write(eventData);
      return true;
    } catch (error) {
      logger.error('Failed to send SSE event', {
        error,
        connectionId,
        eventType: event.type,
      });
      
      // Remove dead connection
      this.disconnect(connectionId);
      return false;
    }
  }

  /**
   * Broadcast event to all connections
   */
  static broadcastEvent(event: SSEEvent, filter?: {
    clientId?: string;
    sessionId?: string;
    eventType?: string;
  }): number {
    let sentCount = 0;

    for (const connection of this.connections.values()) {
      // Apply filters
      if (filter?.clientId && connection.clientId !== filter.clientId) {
        continue;
      }
      
      if (filter?.sessionId && connection.sessionId !== filter.sessionId) {
        continue;
      }
      
      if (filter?.eventType && !connection.subscriptions.has(filter.eventType)) {
        continue;
      }

      if (this.sendEvent(connection.id, event)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Send session event
   */
  static sendSessionEvent(sessionId: string, event: SSEEvent): number {
    return this.broadcastEvent(event, { sessionId, eventType: event.type });
  }

  /**
   * Send client event
   */
  static sendClientEvent(clientId: string, event: SSEEvent): number {
    return this.broadcastEvent(event, { clientId, eventType: event.type });
  }

  /**
   * Format SSE event
   */
  private static formatSSEEvent(event: SSEEvent): string {
    let formatted = '';

    if (event.id) {
      formatted += `id: ${event.id}\n`;
    }

    if (event.retry) {
      formatted += `retry: ${event.retry}\n`;
    }

    formatted += `event: ${event.type}\n`;
    formatted += `data: ${JSON.stringify(event.data)}\n\n`;

    return formatted;
  }

  /**
   * Ping all connections
   */
  private static pingConnections(): void {
    const now = new Date();
    
    for (const connection of this.connections.values()) {
      try {
        this.sendEvent(connection.id, {
          type: 'ping',
          data: { timestamp: now.toISOString() },
        });
        
        connection.lastPing = now;
      } catch (error) {
        logger.warn('Failed to ping SSE connection', {
          connectionId: connection.id,
          error,
        });
      }
    }
  }

  /**
   * Clean up dead connections
   */
  private static cleanupDeadConnections(): void {
    const cutoffTime = new Date(Date.now() - 120000); // 2 minutes ago
    const deadConnections: string[] = [];

    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.lastPing < cutoffTime) {
        deadConnections.push(connectionId);
      }
    }

    deadConnections.forEach(connectionId => {
      this.disconnect(connectionId);
    });

    if (deadConnections.length > 0) {
      logger.info('Cleaned up dead SSE connections', {
        count: deadConnections.length,
      });
    }
  }

  /**
   * Get connection statistics
   */
  static getConnectionStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = {
      totalConnections: SSEController.connections.size,
      connectionsByClient: new Map<string, number>(),
      connectionsBySession: new Map<string, number>(),
      subscriptionStats: new Map<string, number>(),
    };

    for (const connection of SSEController.connections.values()) {
      // Count by client
      const clientCount = stats.connectionsByClient.get(connection.clientId) || 0;
      stats.connectionsByClient.set(connection.clientId, clientCount + 1);

      // Count by session
      if (connection.sessionId) {
        const sessionCount = stats.connectionsBySession.get(connection.sessionId) || 0;
        stats.connectionsBySession.set(connection.sessionId, sessionCount + 1);
      }

      // Count subscriptions
      for (const subscription of connection.subscriptions) {
        const subCount = stats.subscriptionStats.get(subscription) || 0;
        stats.subscriptionStats.set(subscription, subCount + 1);
      }
    }

    res.json({
      success: true,
      data: {
        totalConnections: stats.totalConnections,
        connectionsByClient: Object.fromEntries(stats.connectionsByClient),
        connectionsBySession: Object.fromEntries(stats.connectionsBySession),
        subscriptionStats: Object.fromEntries(stats.subscriptionStats),
      },
    });
  });

  /**
   * Broadcast event to all connections
   */
  static broadcast = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { event, data } = req.body;

    if (!event || typeof event !== 'string' || event.trim() === '') {
      throw new CustomApiError('Event type is required and must be a non-empty string', 400);
    }

    if (!data) {
      throw new CustomApiError('Event data is required', 400);
    }

    const sseEvent: SSEEvent = {
      type: event,
      data,
      id: `broadcast_${Date.now()}`,
    };

    const sentCount = SSEController.broadcastEvent(sseEvent);

    logger.info('SSE broadcast sent', {
      event,
      sentCount,
      clientId: req.client!.clientId,
    });

    res.json({
      success: true,
      event,
      sentCount,
      message: `broadcast sent to ${sentCount} connections`,
    });
  });

  /**
   * Send event to specific session
   */
  static sendToSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.params;
    const { event, data } = req.body;

    if (!event || typeof event !== 'string' || event.trim() === '') {
      throw new CustomApiError('Event type is required and must be a non-empty string', 400);
    }

    if (!data) {
      throw new CustomApiError('Event data is required', 400);
    }

    const sseEvent: SSEEvent = {
      type: event,
      data,
      id: `session_${sessionId}_${Date.now()}`,
    };

    const sentCount = SSEController.sendSessionEvent(sessionId, sseEvent);

    logger.info('SSE session event sent', {
      event,
      sessionId,
      sentCount,
      clientId: req.client!.clientId,
    });

    res.json({
      success: true,
      event,
      sessionId,
      sentCount,
      message: `Event sent to ${sentCount} connections for session ${sessionId}`,
    });
  });

  /**
   * Get active connections
   */
  static getConnections = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const connectionsBySession: Array<{sessionId: string, count: number}> = [];
    const sessionCounts = new Map<string, number>();

    for (const connection of SSEController.connections.values()) {
      if (connection.sessionId) {
        const count = sessionCounts.get(connection.sessionId) || 0;
        sessionCounts.set(connection.sessionId, count + 1);
      }
    }

    for (const [sessionId, count] of sessionCounts.entries()) {
      connectionsBySession.push({ sessionId, count });
    }

    res.json({
      success: true,
      activeConnections: SSEController.connections.size,
      totalConnections: SSEController.connections.size,
      connectionsBySession,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Close connections for a specific session
   */
  static closeSessionConnections = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.params;
    let closedCount = 0;

    const connectionsToClose: string[] = [];
    for (const [connectionId, connection] of SSEController.connections.entries()) {
      if (connection.sessionId === sessionId) {
        connectionsToClose.push(connectionId);
      }
    }

    connectionsToClose.forEach(connectionId => {
      SSEController.disconnect(connectionId);
      closedCount++;
    });

    logger.info('Closed SSE connections for session', {
      sessionId,
      closedCount,
      clientId: req.client!.clientId,
    });

    res.json({
      success: true,
      sessionId,
      closedCount,
      message: `closed ${closedCount} connections for session ${sessionId}`,
    });
  });

  /**
   * Health check
   */
  static healthCheck = asyncHandler(async (req: Request, res: Response) => {
    const stats = {
      totalConnections: SSEController.connections.size,
      activeConnections: SSEController.connections.size,
      uptime: process.uptime(),
      isHealthy: SSEController.connections.size >= 0, // Always healthy if service is running
      metrics: {
        totalMessagesSent: 0, // This would be tracked in a real implementation
        totalConnections: SSEController.connections.size,
      },
    };

    res.json({
      success: true,
      service: 'SSEService',
      status: stats.isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      ...stats,
    });
  });
}

// Initialize SSE service
SSEController.initialize();

// Graceful shutdown
process.on('SIGTERM', () => {
  SSEController.shutdown();
});

process.on('SIGINT', () => {
  SSEController.shutdown();
});