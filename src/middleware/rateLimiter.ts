import { Request, Response, NextFunction } from 'express';
import { LRUCache } from 'lru-cache';
import { CustomApiError } from './errorHandler';
import { config } from '../config';
import logger from '../utils/logger';
import { AuthUtils } from '../utils/auth';

interface RateLimitInfo {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  headers?: boolean;
}

/**
 * In-memory rate limiter using LRU cache
 */
class RateLimiter {
  private cache: LRUCache<string, RateLimitInfo>;
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.options = {
      keyGenerator: (req: Request) => AuthUtils.getClientIP(req),
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Too many requests, please try again later',
      headers: true,
      ...options,
    };

    // Cache with TTL based on window
    this.cache = new LRUCache<string, RateLimitInfo>({
      max: 10000, // Maximum number of entries
      ttl: this.options.windowMs,
    });
  }

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = this.options.keyGenerator(req);
    const now = Date.now();
    
    let rateLimitInfo = this.cache.get(key);
    
    if (!rateLimitInfo || now > rateLimitInfo.resetTime) {
      // Reset window
      rateLimitInfo = {
        count: 0,
        resetTime: now + this.options.windowMs,
        firstRequest: now,
      };
    }

    rateLimitInfo.count++;
    this.cache.set(key, rateLimitInfo);

    // Set rate limit headers
    if (this.options.headers) {
      res.set({
        'X-RateLimit-Limit': this.options.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, this.options.maxRequests - rateLimitInfo.count).toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitInfo.resetTime / 1000).toString(),
        'X-RateLimit-Window': Math.ceil(this.options.windowMs / 1000).toString(),
      });
    }

    // Check if limit exceeded
    if (rateLimitInfo.count > this.options.maxRequests) {
      const retryAfter = Math.ceil((rateLimitInfo.resetTime - now) / 1000);
      
      res.set('Retry-After', retryAfter.toString());
      
      logger.warn('Rate limit exceeded', {
        key,
        count: rateLimitInfo.count,
        limit: this.options.maxRequests,
        retryAfter,
        ip: AuthUtils.getClientIP(req),
        userAgent: req.get('User-Agent'),
      });

      throw new CustomApiError(
        this.options.message,
        429,
        'RATE_LIMIT_EXCEEDED',
        {
          limit: this.options.maxRequests,
          window: this.options.windowMs,
          retryAfter,
        }
      );
    }

    // Add rate limit info to request for logging
    (req as any).rateLimit = {
      limit: this.options.maxRequests,
      current: rateLimitInfo.count,
      remaining: this.options.maxRequests - rateLimitInfo.count,
      resetTime: rateLimitInfo.resetTime,
    };

    next();
  };

  /**
   * Get current rate limit status for a key
   */
  getStatus(key: string): RateLimitInfo | null {
    return this.cache.get(key) || null;
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
      max: this.cache.max,
    };
  }
}

/**
 * Create rate limiter middleware
 */
export const createRateLimiter = (options: RateLimitOptions) => {
  const limiter = new RateLimiter(options);
  return limiter.middleware;
};

/**
 * Global rate limiter for all requests
 */
export const globalRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  maxRequests: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later',
});

/**
 * API rate limiter for authenticated requests
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  maxRequests: config.rateLimit.maxRequests,
  keyGenerator: (req: Request) => {
    // Use client ID if available, otherwise fall back to IP
    return (req as any).client?.clientId || AuthUtils.getClientIP(req);
  },
  message: 'API rate limit exceeded, please try again later',
});

/**
 * Upload rate limiter for file uploads
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50, // 50 uploads per hour
  keyGenerator: (req: Request) => {
    const clientId = (req as any).client?.clientId;
    const ip = AuthUtils.getClientIP(req);
    return `upload:${clientId || ip}`;
  },
  message: 'Upload rate limit exceeded, please try again later',
});

/**
 * Conversation rate limiter for chat messages
 */
export const conversationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: process.env.NODE_ENV === 'test' ? 1000 : 30, // Higher limit for tests
  keyGenerator: (req: Request) => {
    const sessionId = req.params.sessionId || req.body.sessionId;
    return `conversation:${sessionId}`;
  },
  message: 'Too many messages, please slow down',
});

/**
 * Session rate limiter
 */
export const sessionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: process.env.NODE_ENV === 'test' ? 1000 : 20, // Higher limit for tests
  keyGenerator: (req: Request) => {
    const clientId = (req as any).client?.clientId;
    const ip = AuthUtils.getClientIP(req);
    return `session:${clientId || ip}`;
  },
  message: 'Session operation rate limit exceeded',
});

/**
 * Job creation rate limiter
 */
export const jobRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: process.env.NODE_ENV === 'test' ? 1000 : 10, // Higher limit for tests
  keyGenerator: (req: Request) => {
    const clientId = (req as any).client?.clientId;
    const ip = AuthUtils.getClientIP(req);
    return `job:${clientId || ip}`;
  },
  message: 'Job creation rate limit exceeded',
});

/**
 * Client-specific rate limiter middleware
 */
export const clientRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const client = (req as any).client;
  
  if (!client) {
    return next();
  }

  // Check if client has custom rate limits
  if (client.rateLimits && client.rateLimits.enabled) {
    const customLimiter = createRateLimiter({
      windowMs: client.rateLimits.windowMs || config.rateLimit.windowMs,
      maxRequests: client.rateLimits.maxRequests || config.rateLimit.maxRequests,
      keyGenerator: () => `client:${client.clientId}`,
      message: 'Client rate limit exceeded',
    });

    return customLimiter(req, res, next);
  }

  next();
};

/**
 * Adaptive rate limiter that adjusts based on system load
 */
export class AdaptiveRateLimiter {
  private baseLimiter: RateLimiter;
  private loadFactor: number = 1.0;
  private lastLoadCheck: number = 0;
  private loadCheckInterval: number = 30000; // 30 seconds

  constructor(baseOptions: RateLimitOptions) {
    this.baseLimiter = new RateLimiter(baseOptions);
  }

  private updateLoadFactor(): void {
    const now = Date.now();
    
    if (now - this.lastLoadCheck < this.loadCheckInterval) {
      return;
    }

    this.lastLoadCheck = now;

    // Simple load calculation based on cache size
    const stats = this.baseLimiter.getStats();
    const loadPercentage = stats.size / stats.max;

    if (loadPercentage > 0.8) {
      this.loadFactor = 0.5; // Reduce limits by 50%
    } else if (loadPercentage > 0.6) {
      this.loadFactor = 0.75; // Reduce limits by 25%
    } else {
      this.loadFactor = 1.0; // Normal limits
    }

    logger.debug('Adaptive rate limiter load factor updated', {
      loadPercentage,
      loadFactor: this.loadFactor,
      cacheStats: stats,
    });
  }

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    this.updateLoadFactor();

    // Temporarily modify the max requests based on load
    const originalMaxRequests = (this.baseLimiter as any).options.maxRequests;
    (this.baseLimiter as any).options.maxRequests = Math.floor(originalMaxRequests * this.loadFactor);

    try {
      this.baseLimiter.middleware(req, res, next);
    } finally {
      // Restore original max requests
      (this.baseLimiter as any).options.maxRequests = originalMaxRequests;
    }
  };
}

/**
 * Burst rate limiter for handling traffic spikes
 */
export const burstRateLimiter = createRateLimiter({
  windowMs: 1000, // 1 second
  maxRequests: 10, // 10 requests per second burst
  keyGenerator: (req: Request) => {
    const clientId = (req as any).client?.clientId;
    const ip = AuthUtils.getClientIP(req);
    return `burst:${clientId || ip}`;
  },
  message: 'Request burst limit exceeded, please slow down',
});

/**
 * Rate limiter for sensitive operations
 */
export const sensitiveOperationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  keyGenerator: (req: Request) => {
    const clientId = (req as any).client?.clientId;
    const ip = AuthUtils.getClientIP(req);
    return `sensitive:${clientId || ip}`;
  },
  message: 'Too many attempts for sensitive operation, please try again later',
});

export default {
  createRateLimiter,
  globalRateLimiter,
  apiRateLimiter,
  uploadRateLimiter,
  conversationRateLimiter,
  sessionRateLimiter,
  jobRateLimiter,
  clientRateLimiter,
  AdaptiveRateLimiter,
  burstRateLimiter,
  sensitiveOperationRateLimiter,
};