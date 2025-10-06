import { Request, Response, NextFunction } from 'express';
import { Client } from '../models';
import { AuthUtils, JWTPayload } from '../utils/auth';
import logger from '../utils/logger';

// Extend Express Request interface to include auth data
declare global {
  namespace Express {
    interface Request {
      client?: any;
      user?: any;
      session?: any;
      permissions?: string[];
      clientIP?: string;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  client: any;
  user?: any;
  session?: any;
  permissions: string[];
  clientIP: string;
}

/**
 * Middleware to authenticate API key
 */
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = AuthUtils.extractApiKey(req);
    
    if (!apiKey) {
      res.status(401).json({
        error: 'API_KEY_MISSING',
        message: 'API key is required. Provide it in Authorization header, X-API-Key header, or api_key query parameter.',
      });
      return;
    }

    // Find client by API key
    const client = await Client.findByApiKey(apiKey);
    
    if (!client) {
      logger.warn(`Invalid API key attempted: ${AuthUtils.maskSensitiveData({ apiKey })}`);
      res.status(401).json({
        error: 'INVALID_API_KEY',
        message: 'Invalid API key provided.',
      });
      return;
    }

    if (!client.isActive) {
      logger.warn(`Inactive client attempted access: ${client.clientId}`);
      res.status(403).json({
        error: 'CLIENT_INACTIVE',
        message: 'Client account is inactive.',
      });
      return;
    }

    // Check if client is locked
    if (client.isLocked()) {
      logger.warn(`Locked client attempted access: ${client.clientId}`);
      res.status(423).json({
        error: 'CLIENT_LOCKED',
        message: 'Client account is temporarily locked due to security reasons.',
      });
      return;
    }

    // Get client IP
    const clientIP = AuthUtils.getClientIP(req);
    
    // Check IP whitelist if configured
    if (client.security.ipWhitelist && client.security.ipWhitelist.length > 0) {
      if (!AuthUtils.isIPWhitelisted(clientIP, client.security.ipWhitelist)) {
        logger.warn(`IP not whitelisted for client ${client.clientId}: ${clientIP}`);
        res.status(403).json({
          error: 'IP_NOT_WHITELISTED',
          message: 'Your IP address is not authorized to access this API.',
        });
        return;
      }
    }

    // Check rate limits
    const rateLimitCheck = checkRateLimit(client, req);
    if (!rateLimitCheck.allowed) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. ${rateLimitCheck.message}`,
        retryAfter: rateLimitCheck.retryAfter,
      });
      return;
    }

    // Check billing limits
    const billingCheck = client.isWithinBillingLimits();
    if (!billingCheck.valid) {
      res.status(402).json({
        error: 'BILLING_LIMIT_EXCEEDED',
        message: `Billing limit exceeded for: ${billingCheck.exceeded.join(', ')}`,
        exceededLimits: billingCheck.exceeded,
      });
      return;
    }

    // Update client usage and last activity
    client.incrementUsage('requests');
    client.updateLastLogin(clientIP);
    await client.save();

    // Attach client data to request
    req.client = client;
    req.permissions = client.permissions;
    req.clientIP = clientIP;

    logger.debug(`API key authenticated for client: ${client.clientId}`);
    next();

  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Internal authentication error.',
    });
  }
};

/**
 * Middleware to authenticate JWT token
 */
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    
    if (!token) {
      res.status(401).json({
        error: 'TOKEN_MISSING',
        message: 'JWT token is required in Authorization header.',
      });
      return;
    }

    // Verify JWT token
    let payload: JWTPayload;
    try {
      payload = AuthUtils.verifyJWT(token);
    } catch (error) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired JWT token.',
      });
      return;
    }

    // Find client
    const client = await Client.findByClientId(payload.clientId);
    
    if (!client || !client.isActive) {
      res.status(401).json({
        error: 'INVALID_CLIENT',
        message: 'Client not found or inactive.',
      });
      return;
    }

    // Attach data to request
    req.client = client;
    req.user = { userId: payload.userId };
    req.session = { sessionId: payload.sessionId };
    req.permissions = payload.permissions;
    req.clientIP = AuthUtils.getClientIP(req);

    logger.debug(`JWT authenticated for client: ${client.clientId}, user: ${payload.userId}`);
    next();

  } catch (error) {
    logger.error('JWT authentication error:', error);
    res.status(500).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Internal authentication error.',
    });
  }
};

/**
 * Middleware to require specific permissions
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.permissions) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required.',
      });
      return;
    }

    if (!AuthUtils.hasPermission(req.permissions!, permission)) {
      logger.warn(`Permission denied for client ${req.client?.clientId}: required ${permission}, has ${req.permissions.join(', ')}`);
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Required permission: ${permission}`,
        requiredPermission: permission,
        userPermissions: req.permissions,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to require multiple permissions (all must be present)
 */
export const requireAllPermissions = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.permissions) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required.',
      });
      return;
    }

    const missingPermissions = permissions.filter(
      permission => !AuthUtils.hasPermission(req.permissions!, permission)
    );

    if (missingPermissions.length > 0) {
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Missing required permissions: ${missingPermissions.join(', ')}`,
        requiredPermissions: permissions,
        missingPermissions,
        userPermissions: req.permissions,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to require any of the specified permissions
 */
export const requireAnyPermission = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.permissions) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required.',
      });
      return;
    }

    const hasAnyPermission = permissions.some(
      permission => AuthUtils.hasPermission(req.permissions!, permission)
    );

    if (!hasAnyPermission) {
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Required any of: ${permissions.join(', ')}`,
        requiredPermissions: permissions,
        userPermissions: req.permissions,
      });
      return;
    }

    next();
  };
};

/**
 * Optional authentication middleware - doesn't fail if no auth provided
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = AuthUtils.extractApiKey(req);
    
    if (apiKey) {
      const client = await Client.findByApiKey(apiKey);
      if (client && client.isActive) {
        req.client = client;
        req.permissions = client.permissions;
        req.clientIP = AuthUtils.getClientIP(req);
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors, just log them
    logger.debug('Optional auth error:', error);
    next();
  }
};

/**
 * Rate limiting helper function
 */
function checkRateLimit(client: any, req: Request): { allowed: boolean; message?: string; retryAfter?: number } {
  const now = new Date();
  
  // Check requests per minute
  if (!client.checkRateLimit('minute')) {
    return {
      allowed: false,
      message: `Exceeded ${client.rateLimits.requestsPerMinute} requests per minute`,
      retryAfter: 60,
    };
  }

  // Check requests per hour
  if (!client.checkRateLimit('hour')) {
    return {
      allowed: false,
      message: `Exceeded ${client.rateLimits.requestsPerHour} requests per hour`,
      retryAfter: 3600,
    };
  }

  // Check requests per day
  if (!client.checkRateLimit('day')) {
    return {
      allowed: false,
      message: `Exceeded ${client.rateLimits.requestsPerDay} requests per day`,
      retryAfter: 86400,
    };
  }

  return { allowed: true };
}

/**
 * Middleware to validate session ownership
 */
export const validateSessionOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.params.sessionId || req.body.sessionId;
    
    if (!sessionId) {
      res.status(400).json({
        error: 'SESSION_ID_REQUIRED',
        message: 'Session ID is required.',
      });
      return;
    }

    // Import Session model here to avoid circular dependency
    const { Session } = await import('../models');
    const session = await Session.findBySessionId(sessionId);
    
    if (!session) {
      res.status(404).json({
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found.',
      });
      return;
    }

    // Check if client owns this session
    if (session.clientId !== req.client.clientId) {
      res.status(403).json({
        error: 'SESSION_ACCESS_DENIED',
        message: 'You do not have access to this session.',
      });
      return;
    }

    // Attach session to request
    req.session = session;
    next();

  } catch (error) {
    logger.error('Session ownership validation error:', error);
    res.status(500).json({
      error: 'VALIDATION_ERROR',
      message: 'Internal validation error.',
    });
  }
};

export default {
  authenticateApiKey,
  authenticateJWT,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  optionalAuth,
  validateSessionOwnership,
};