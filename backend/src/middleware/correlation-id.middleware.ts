/**
 * V2 Resort - Request Correlation ID Tracking Middleware
 * Enables distributed tracing across services
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

// Header name for correlation ID
export const CORRELATION_ID_HEADER = 'X-Correlation-ID';
export const REQUEST_ID_HEADER = 'X-Request-ID';

// Async local storage for correlation context
interface CorrelationContext {
  correlationId: string;
  requestId: string;
  startTime: number;
  userId?: string;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
  path?: string;
  method?: string;
}

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Get current correlation context
 */
export const getCorrelationContext = (): CorrelationContext | undefined => {
  return correlationStorage.getStore();
};

/**
 * Get correlation ID from current context
 */
export const getCorrelationId = (): string | undefined => {
  return correlationStorage.getStore()?.correlationId;
};

/**
 * Get request ID from current context
 */
export const getRequestId = (): string | undefined => {
  return correlationStorage.getStore()?.requestId;
};

/**
 * Run a function within a correlation context
 */
export const runWithCorrelation = <T>(
  context: Partial<CorrelationContext>,
  fn: () => T
): T => {
  const fullContext: CorrelationContext = {
    correlationId: context.correlationId || uuidv4(),
    requestId: context.requestId || uuidv4(),
    startTime: context.startTime || Date.now(),
    ...context,
  };
  
  return correlationStorage.run(fullContext, fn);
};

/**
 * Express middleware for correlation ID tracking
 */
export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Get or generate correlation ID
  const correlationId = 
    req.headers[CORRELATION_ID_HEADER.toLowerCase()] as string || 
    uuidv4();
  
  // Always generate a new request ID for this specific request
  const requestId = uuidv4();
  
  // Extract user information if available
  const userId = (req as any).user?.id;
  const sessionId = req.sessionID;
  
  // Extract client information
  const clientIp = 
    req.headers['x-forwarded-for'] as string || 
    req.headers['x-real-ip'] as string || 
    req.socket.remoteAddress || 
    'unknown';
  
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Create correlation context
  const context: CorrelationContext = {
    correlationId,
    requestId,
    startTime: Date.now(),
    userId,
    sessionId,
    clientIp: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : clientIp,
    userAgent,
    path: req.path,
    method: req.method,
  };
  
  // Set response headers
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  res.setHeader(REQUEST_ID_HEADER, requestId);
  
  // Log request start
  console.log(JSON.stringify({
    level: 'info',
    message: 'Request started',
    correlationId,
    requestId,
    method: req.method,
    path: req.path,
    clientIp: context.clientIp,
    userAgent: context.userAgent,
    userId,
  }));
  
  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - context.startTime;
    console.log(JSON.stringify({
      level: res.statusCode >= 400 ? 'error' : 'info',
      message: 'Request completed',
      correlationId,
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      clientIp: context.clientIp,
      userId,
    }));
  });
  
  // Run the rest of the request in correlation context
  correlationStorage.run(context, () => {
    next();
  });
};

/**
 * Logger wrapper that automatically includes correlation ID
 */
export const correlatedLogger = {
  info: (message: string, data?: Record<string, any>) => {
    const context = getCorrelationContext();
    console.log(JSON.stringify({
      level: 'info',
      message,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  },
  
  error: (message: string, error?: Error, data?: Record<string, any>) => {
    const context = getCorrelationContext();
    console.error(JSON.stringify({
      level: 'error',
      message,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      timestamp: new Date().toISOString(),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      ...data,
    }));
  },
  
  warn: (message: string, data?: Record<string, any>) => {
    const context = getCorrelationContext();
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  },
  
  debug: (message: string, data?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      const context = getCorrelationContext();
      console.debug(JSON.stringify({
        level: 'debug',
        message,
        correlationId: context?.correlationId,
        requestId: context?.requestId,
        timestamp: new Date().toISOString(),
        ...data,
      }));
    }
  },
};

/**
 * Axios interceptor to pass correlation ID to downstream services
 */
export const axiosCorrelationInterceptor = (config: any) => {
  const correlationId = getCorrelationId();
  const requestId = getRequestId();
  
  if (correlationId) {
    config.headers = config.headers || {};
    config.headers[CORRELATION_ID_HEADER] = correlationId;
  }
  
  if (requestId) {
    config.headers = config.headers || {};
    config.headers['X-Parent-Request-ID'] = requestId;
  }
  
  return config;
};

/**
 * Fetch wrapper that includes correlation ID
 */
export const correlatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const correlationId = getCorrelationId();
  const requestId = getRequestId();
  
  const headers = new Headers(options.headers);
  
  if (correlationId) {
    headers.set(CORRELATION_ID_HEADER, correlationId);
  }
  
  if (requestId) {
    headers.set('X-Parent-Request-ID', requestId);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
};

/**
 * Add correlation context to error for Sentry/error tracking
 */
export const enrichErrorWithCorrelation = (error: Error): Error & { correlationId?: string; requestId?: string } => {
  const context = getCorrelationContext();
  const enrichedError = error as Error & { correlationId?: string; requestId?: string };
  
  if (context) {
    enrichedError.correlationId = context.correlationId;
    enrichedError.requestId = context.requestId;
  }
  
  return enrichedError;
};

export default correlationIdMiddleware;
