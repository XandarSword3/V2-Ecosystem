import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Enhanced request logging middleware
 * Logs detailed information about every request including:
 * - Request method, URL, and headers
 * - Request body (sanitized - passwords hidden)
 * - Response status and timing
 * - Any errors that occur
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Attach request ID for tracking
  req.requestId = requestId;
  
  // Sanitize body to hide sensitive fields
  const sanitizeBody = (body: unknown): unknown => {
    if (!body || typeof body !== 'object') return body;
    
    const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'token', 'refreshToken', 'secret'];
    const sanitized = { ...(body as Record<string, unknown>) };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  };
  
  // Log incoming request
  const sanitizedBody = sanitizeBody(req.body);
  logger.info(`[${requestId}] ➡️  ${req.method} ${req.originalUrl}`);
  
  if (typeof sanitizedBody === 'object' && sanitizedBody !== null && Object.keys(sanitizedBody).length > 0) {
    logger.debug(`[${requestId}] Body: ${JSON.stringify(sanitizedBody, null, 2)}`);
  }
  
  // Log user info if authenticated
  if (req.user) {
    logger.debug(`[${requestId}] User: ${req.user.userId} (${req.user.email})`);
  }
  
  // Capture response
  const originalSend = res.send;
  res.send = function(body: unknown): Response {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Log response summary
    const statusEmoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
    logger.info(`[${requestId}] ${statusEmoji} ${req.method} ${req.originalUrl} - ${statusCode} (${duration}ms)`);
    
    // Log error responses in detail
    if (statusCode >= 400) {
      try {
        const responseBody = typeof body === 'string' ? JSON.parse(body) : body;
        logger.warn(`[${requestId}] Error Response: ${JSON.stringify(responseBody)}`);
      } catch {
        logger.warn(`[${requestId}] Error Response: ${body}`);
      }
    }
    
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Enhanced error logging middleware
 * Logs detailed error information including stack traces
 */
export function errorLogger(err: Error, req: Request, res: Response, next: NextFunction) {
  const requestId = (req as any).requestId || 'unknown';
  
  logger.error(`[${requestId}] 💥 Error in ${req.method} ${req.originalUrl}`);
  logger.error(`[${requestId}] Message: ${err.message}`);
  logger.error(`[${requestId}] Stack: ${err.stack}`);
  
  // Log request context for debugging
  logger.error(`[${requestId}] Request Body: ${JSON.stringify(req.body || {})}`);
  logger.error(`[${requestId}] Request Params: ${JSON.stringify(req.params || {})}`);
  logger.error(`[${requestId}] Request Query: ${JSON.stringify(req.query || {})}`);
  
  // Pass to next error handler
  next(err);
}
