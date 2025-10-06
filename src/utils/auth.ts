import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config';

export interface JWTPayload {
  clientId: string;
  userId?: string;
  sessionId?: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export class AuthUtils {
  /**
   * Generate a JWT token
   */
  static generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions);
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyJWT(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Generate a secure API key
   */
  static generateApiKey(length: number = config.security.apiKeyLength): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure session token
   */
  static generateSessionToken(length: number = config.security.sessionTokenLength): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  /**
   * Compare a password with its hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Create HMAC signature for webhook verification
   */
  static createHMACSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifyHMACSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.createHMACSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    
    // Support both "Bearer token" and "token" formats
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    } else if (parts.length === 1) {
      return parts[0];
    }
    
    return null;
  }

  /**
   * Extract API key from various sources
   */
  static extractApiKey(req: any): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = this.extractTokenFromHeader(authHeader);
      if (token) return token;
    }

    // Check X-API-Key header
    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader) return apiKeyHeader;

    // Check query parameter
    const apiKeyQuery = req.query.api_key || req.query.apiKey;
    if (apiKeyQuery) return apiKeyQuery;

    return null;
  }

  /**
   * Check if a permission is granted
   */
  static hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    // Admin permissions grant access to everything
    if (userPermissions.includes('admin:write') || userPermissions.includes('admin:read')) {
      return true;
    }

    // Check for exact permission match
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Check for wildcard permissions
    const [resource, action] = requiredPermission.split(':');
    const wildcardPermission = `${resource}:*`;
    if (userPermissions.includes(wildcardPermission)) {
      return true;
    }

    return false;
  }

  /**
   * Validate IP address against whitelist
   */
  static isIPWhitelisted(clientIP: string, whitelist: string[]): boolean {
    if (!whitelist || whitelist.length === 0) return true;
    
    // Support CIDR notation and exact IP matches
    return whitelist.some(allowedIP => {
      if (allowedIP.includes('/')) {
        // CIDR notation - simplified check
        const [network, prefixLength] = allowedIP.split('/');
        // For simplicity, we'll do exact match for now
        // In production, you'd want proper CIDR matching
        return clientIP.startsWith(network.split('.').slice(0, parseInt(prefixLength) / 8).join('.'));
      } else {
        return clientIP === allowedIP;
      }
    });
  }

  /**
   * Get client IP address from request
   */
  static getClientIP(req: any): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           'unknown';
  }

  /**
   * Generate a unique identifier
   */
  static generateUniqueId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(8).toString('hex');
    return `${prefix}${prefix ? '_' : ''}${timestamp}_${randomPart}`;
  }

  /**
   * Sanitize user input to prevent injection attacks
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[;]/g, '') // Remove semicolons
      .trim()
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate SSN format
   */
  static isValidSSN(ssn: string): boolean {
    const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;
    return ssnRegex.test(ssn);
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) return data;
    
    const masked = { ...data };
    const sensitiveFields = ['ssn', 'password', 'apiKey', 'token', 'secret'];
    
    for (const key in masked) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        if (typeof masked[key] === 'string' && masked[key].length > 4) {
          masked[key] = masked[key].substring(0, 4) + '*'.repeat(masked[key].length - 4);
        } else {
          masked[key] = '***';
        }
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    }
    
    return masked;
  }

  /**
   * Rate limiting helper
   */
  static createRateLimitKey(clientId: string, endpoint: string, timeWindow: string): string {
    return `rate_limit:${clientId}:${endpoint}:${timeWindow}`;
  }

  /**
   * Session timeout helper
   */
  static isSessionExpired(lastActivity: Date, timeoutMs: number): boolean {
    const now = new Date();
    const timeSinceLastActivity = now.getTime() - lastActivity.getTime();
    return timeSinceLastActivity > timeoutMs;
  }

  /**
   * Generate session expiration date
   */
  static generateSessionExpiration(timeoutMs: number = config.session.timeoutMs): Date {
    return new Date(Date.now() + timeoutMs);
  }
}

export default AuthUtils;