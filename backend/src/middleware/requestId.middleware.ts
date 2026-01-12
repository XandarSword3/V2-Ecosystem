import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

/**
 * Middleware to add a unique request ID to each request.
 * This enables request correlation across logs, errors, and distributed systems.
 * 
 * The request ID is:
 * - Taken from X-Request-ID header if provided by upstream (e.g., load balancer)
 * - Generated as a UUIDv4 if not provided
 * - Added to response headers for client correlation
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header or generate new one
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  
  // Attach to request object
  req.requestId = requestId;
  
  // Add to response headers for client correlation
  res.setHeader('X-Request-ID', requestId);
  
  next();
}

/**
 * Get the current request ID from a request object.
 * Returns a placeholder if no request ID is set.
 */
export function getRequestId(req: Request): string {
  return req.requestId || 'no-request-id';
}
