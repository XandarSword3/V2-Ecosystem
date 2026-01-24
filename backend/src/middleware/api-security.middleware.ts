/**
 * V2 Resort - API Security Hardening Middleware
 * Comprehensive security middleware for API protection
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import xss from 'xss';
import securityAuditLogger from '../services/security-audit.service';

// Security configuration
const SECURITY_CONFIG = {
  rateLimit: {
    window: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  strictRateLimit: {
    window: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  bodyLimit: '10mb',
  parameterLimit: 100,
  trustedProxies: ['127.0.0.1', '::1'],
  allowedOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
};

/**
 * Enhanced security headers using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Adjust for prod
      connectSrc: ["'self'", 'https:', 'wss:'],
      frameSrc: ["'self'", 'https://js.stripe.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // May need to adjust for some resources
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

/**
 * HTTP Parameter Pollution protection
 */
export const parameterPollutionProtection = hpp({
  whitelist: ['sort', 'filter', 'fields', 'include'], // Allow these as arrays
});

/**
 * Request size limiter
 */
export function requestSizeLimiter(maxSize: string = '10mb') {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      securityAuditLogger.logSecurityEvent({
        eventType: securityAuditLogger.SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: securityAuditLogger.SecurityEventSeverity.WARNING,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        description: 'Request too large',
        metadata: {
          outcome: 'blocked',
          details: {
            reason: 'Request too large',
            size: contentLength,
            max: maxBytes,
          }
        },
      });

      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request body exceeds ${maxSize}`,
      });
    }

    next();
  };
}

/**
 * XSS sanitization middleware
 */
export function xssSanitizer(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as Record<string, any>);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
}

function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = xss(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((v) =>
        typeof v === 'string' ? xss(v) : v
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * SQL injection pattern detector
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b.*\b(FROM|INTO|WHERE|TABLE|DATABASE)\b)/i,
  /('|").*(--)|(\/\*.*\*\/)/i,
  /(\bOR\b.*=.*\bOR\b)/i,
  /(;.*(\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b))/i,
];

export function sqlInjectionDetector(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const checkValue = (value: any): boolean => {
    if (typeof value !== 'string') return false;
    return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
  };

  const checkObject = (obj: Record<string, any>): boolean => {
    for (const value of Object.values(obj)) {
      if (checkValue(value)) return true;
      if (typeof value === 'object' && value !== null) {
        if (checkObject(value)) return true;
      }
    }
    return false;
  };

  const suspicious =
    checkObject(req.body || {}) ||
    checkObject(req.query || {}) ||
    checkObject(req.params || {});

  if (suspicious) {
    securityAuditLogger.logSecurityEvent({
      eventType: securityAuditLogger.SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: securityAuditLogger.SecurityEventSeverity.CRITICAL,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      description: 'Potential SQL injection detected',
      metadata: {
        outcome: 'blocked',
        details: {
          reason: 'Potential SQL injection detected',
          path: req.path,
          method: req.method,
        }
      },
    });

    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request contains invalid characters',
    });
  }

  next();
}

/**
 * Path traversal protection
 */
export function pathTraversalProtection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const DANGEROUS_PATTERNS = [
    /\.\.\//,
    /\.\.\\/, 
    /%2e%2e%2f/i,
    /%2e%2e\//i,
    /\.%2e\//i,
    /%2e\.\//i,
    /\.\.\%5c/i,
    /etc\/passwd/i,
    /etc\/shadow/i,
    /proc\/self/i,
  ];

  const fullUrl = req.originalUrl || req.url;

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(fullUrl)) {
      securityAuditLogger.logSecurityEvent({
        eventType: securityAuditLogger.SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: securityAuditLogger.SecurityEventSeverity.WARNING,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        description: 'Path traversal attempt detected',
        metadata: {
          outcome: 'blocked',
          details: {
            reason: 'Path traversal attempt detected',
            path: fullUrl,
          }
        },
      });

      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid path',
      });
    }
  }

  next();
}

/**
 * Create rate limiter for specific routes
 */
export function createRateLimiter(options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) {
  return rateLimit({
    windowMs: options.windowMs || SECURITY_CONFIG.rateLimit.window,
    max: options.max || SECURITY_CONFIG.rateLimit.maxRequests,
    message: {
      error: 'Too Many Requests',
      message: options.message || 'Please try again later',
      retryAfter: Math.ceil((options.windowMs || SECURITY_CONFIG.rateLimit.window) / 1000),
    },
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    keyGenerator: options.keyGenerator || ((req) => req.ip || 'unknown'),
    handler: async (req, res) => {
      await securityAuditLogger.logSecurityEvent({
        eventType: securityAuditLogger.SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: securityAuditLogger.SecurityEventSeverity.WARNING,
        userId: (req as any).user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        description: 'Rate limit exceeded',
        metadata: {
          outcome: 'blocked',
          details: {
            path: req.path,
            method: req.method,
            limit: options.max || SECURITY_CONFIG.rateLimit.maxRequests,
          }
        },
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Please try again later',
        retryAfter: Math.ceil((options.windowMs || SECURITY_CONFIG.rateLimit.window) / 1000),
      });
    },
  });
}

/**
 * Authentication rate limiter (stricter)
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
});

/**
 * Password reset rate limiter
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many password reset requests',
});

/**
 * API key validation middleware
 */
export function apiKeyValidator(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    // Allow if user is authenticated via JWT
    if ((req as any).user) {
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required',
    });
  }

  // Validate API key format
  if (!/^v2_[a-zA-Z0-9]{32,64}$/.test(apiKey)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format',
    });
  }

  // API key validation would happen here against database
  // For now, just pass through
  next();
}

/**
 * Request ID injection
 */
export function requestIdInjector(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = req.headers['x-request-id'] as string ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}

/**
 * Sensitive data masking in responses
 */
export function sensitiveDataMasker(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const originalJson = res.json.bind(res);

  res.json = (data: any) => {
    const maskedData = maskSensitiveFields(data);
    return originalJson(maskedData);
  };

  next();
}

const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'secret',
  'api_key',
  'token',
  'refresh_token',
  'ssn',
  'credit_card',
  'cvv',
];

function maskSensitiveFields(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveFields);
  }

  const masked: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_FIELDS.some((f) => lowerKey.includes(f))) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveFields(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Parse size string to bytes
 */
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+)\s*(b|kb|mb|gb)?$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB

  const value = parseInt(match[1], 10);
  const unit = match[2] || 'b';

  return value * (units[unit] || 1);
}

/**
 * Combined security middleware stack
 */
export function applySecurityMiddleware(app: any): void {
  // Basic security headers
  app.use(securityHeaders);

  // Request ID for tracking
  app.use(requestIdInjector);

  // Request size limiting (before body parsing)
  app.use(requestSizeLimiter('10mb'));

  // Parameter pollution protection
  app.use(parameterPollutionProtection);

  // Path traversal protection
  app.use(pathTraversalProtection);

  // SQL injection detection
  app.use(sqlInjectionDetector);

  // XSS sanitization
  app.use(xssSanitizer);

  // Sensitive data masking
  app.use(sensitiveDataMasker);

  console.log('[Security] API security middleware applied');
}
