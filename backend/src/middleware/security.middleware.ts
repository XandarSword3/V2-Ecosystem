/**
 * Security Middleware
 * 
 * Enhanced security headers and protections for enterprise deployment.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Additional security headers beyond helmet defaults
 */
export function enhancedSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent browsers from MIME-sniffing a response away from the declared content-type
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy for privacy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy (restrict browser features)
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(self), payment=(self)'
  );
  
  // Remove X-Powered-By header (express)
  res.removeHeader('X-Powered-By');
  
  // Cache control for sensitive endpoints
  if (req.path.includes('/api/auth') || req.path.includes('/api/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  
  next();
}

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction): void {
  // Remove null bytes from query parameters (potential injection attack)
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];
      if (typeof value === 'string' && value.includes('\0')) {
        req.query[key] = value.replace(/\0/g, '');
        logger.warn('Removed null bytes from query parameter', { key, ip: req.ip });
      }
    }
  }
  
  next();
}

/**
 * Detect and block suspicious requests
 */
export function suspiciousRequestDetector(req: Request, res: Response, next: NextFunction): void {
  const suspicious = [];
  
  // Check for SQL injection patterns
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\b.*\b(FROM|INTO|WHERE|TABLE)\b)/i;
  const checkValue = (value: string): boolean => {
    return sqlPatterns.test(value);
  };
  
  // Check query params
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string' && checkValue(value)) {
      suspicious.push(`query.${key}`);
    }
  }
  
  // Check path parameters
  for (const [key, value] of Object.entries(req.params)) {
    if (typeof value === 'string' && checkValue(value)) {
      suspicious.push(`params.${key}`);
    }
  }
  
  if (suspicious.length > 0) {
    logger.warn('Suspicious request detected', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      suspicious,
      userAgent: req.headers['user-agent'],
    });
    
    // Block suspicious requests to prevent SQL injection attacks
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  
  next();
}

/**
 * Request ID middleware for correlation
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers['x-request-id'] as string || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  
  next();
}

// Note: Express.Request.requestId is declared in src/types/index.ts
