import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { sessionService } from '../services/sessionService';

/**
 * Middleware to validate session from X-Session-ID header
 * Attaches session to request if valid
 */
export const validateSessionFromHeader = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  try {
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      res.status(400).json({
        error: 'SESSION_ID_REQUIRED',
        message: 'Session ID is required in X-Session-ID header.',
      });
      return;
    }

    const session = await sessionService.getSession(sessionId);
    
    if (!session) {
      res.status(400).json({
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found.',
      });
      return;
    }

    // Check if client owns this session
    if (session.clientId !== authReq.client.clientId) {
      res.status(403).json({
        error: 'SESSION_ACCESS_DENIED',
        message: 'You do not have access to this session.',
      });
      return;
    }

    // Attach session to request
    authReq.session = { sessionId: session.sessionId };
    next();
  } catch (error) {
    res.status(500).json({
      error: 'VALIDATION_ERROR',
      message: 'Internal validation error.',
    });
  }
};