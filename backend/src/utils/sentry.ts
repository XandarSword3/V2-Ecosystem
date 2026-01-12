/**
 * Sentry Error Tracking Integration
 * 
 * This module provides Sentry integration for error tracking and performance monitoring.
 * Set SENTRY_DSN environment variable to enable.
 * 
 * Usage:
 * 1. Set SENTRY_DSN in environment variables
 * 2. Call initSentry() early in application startup
 * 3. Use sentryRequestHandler() before routes
 * 4. Use sentryErrorHandler() after routes
 */

import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction, Express } from 'express';
import { logger } from './logger.js';
import { config } from '../config/index.js';

// Check if Sentry is enabled via environment variable
const SENTRY_DSN = process.env.SENTRY_DSN;
const IS_SENTRY_ENABLED = Boolean(SENTRY_DSN);

let isInitialized = false;

/**
 * Initialize Sentry with configuration
 * Should be called early in the application lifecycle
 */
export function initSentry(app?: Express): void {
  if (isInitialized) {
    logger.warn('Sentry already initialized');
    return;
  }

  if (!IS_SENTRY_ENABLED) {
    logger.info('Sentry is not configured. Set SENTRY_DSN to enable error tracking.');
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: config.env || 'development',
      release: process.env.npm_package_version || '1.0.0',
      
      // Performance Monitoring
      tracesSampleRate: config.env === 'production' ? 0.1 : 1.0,
      
      // Session Tracking
      autoSessionTracking: true,
      
      // Integrations
      integrations: [
        // HTTP integration for tracing outgoing requests
        Sentry.httpIntegration(),
        // Node-specific integrations
        Sentry.onUncaughtExceptionIntegration(),
        Sentry.onUnhandledRejectionIntegration(),
      ],
      
      // Before sending event, you can modify or filter
      beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint) {
        // Don't send events in test environment
        if (process.env.NODE_ENV === 'test') {
          return null;
        }
        
        // Filter out certain errors if needed
        const error = hint.originalException as Error | undefined;
        if (error?.message?.includes('ECONNREFUSED')) {
          // Don't report connection refused errors
          return null;
        }
        
        return event;
      },
      
      // Ignore certain errors
      ignoreErrors: [
        'Network request failed',
        'Failed to fetch',
        'Load failed',
        'ECONNRESET',
        'ETIMEDOUT'
      ]
    });

    // Set up Express-specific error handling if app is provided
    if (app) {
      Sentry.setupExpressErrorHandler(app);
    }

    isInitialized = true;
    logger.info('Sentry initialized successfully', { 
      environment: config.env,
      dsn: SENTRY_DSN?.substring(0, 20) + '...' 
    });
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Capture an exception to Sentry
 * @param error - The error to capture
 * @param context - Additional context to attach to the event
 * @returns Event ID if captured, undefined otherwise
 */
export function captureException(
  error: Error | unknown, 
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id: string; email?: string; username?: string };
    level?: Sentry.SeverityLevel;
  }
): string | undefined {
  if (!IS_SENTRY_ENABLED) {
    logger.error('Error captured (Sentry disabled):', error);
    return undefined;
  }

  return Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    user: context?.user,
    level: context?.level
  });
}

/**
 * Capture a message to Sentry
 * @param message - The message to capture
 * @param level - Severity level
 * @param context - Additional context
 */
export function captureMessage(
  message: string, 
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string | undefined {
  if (!IS_SENTRY_ENABLED) {
    logger.info('Message captured (Sentry disabled):', { message, level });
    return undefined;
  }

  return Sentry.captureMessage(message, {
    level,
    extra: context
  });
}

/**
 * Set user context for Sentry
 * Call this when a user logs in
 */
export function setUser(user: { 
  id: string; 
  email?: string; 
  username?: string;
  ip_address?: string;
}): void {
  if (!IS_SENTRY_ENABLED) return;
  Sentry.setUser(user);
}

/**
 * Clear user context
 * Call this when a user logs out
 */
export function clearUser(): void {
  if (!IS_SENTRY_ENABLED) return;
  Sentry.setUser(null);
}

/**
 * Set custom tags for all subsequent events
 */
export function setTags(tags: Record<string, string>): void {
  if (!IS_SENTRY_ENABLED) return;
  Sentry.setTags(tags);
}

/**
 * Set extra context for all subsequent events
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (!IS_SENTRY_ENABLED) return;
  Sentry.setContext(name, context);
}

/**
 * Add breadcrumb for tracing user actions
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, unknown>;
}): void {
  if (!IS_SENTRY_ENABLED) return;
  Sentry.addBreadcrumb({
    message: breadcrumb.message,
    category: breadcrumb.category,
    level: breadcrumb.level,
    data: breadcrumb.data
  });
}

/**
 * Start a new transaction for performance monitoring
 */
export function startTransaction(
  name: string, 
  op: string
): Sentry.Span | undefined {
  if (!IS_SENTRY_ENABLED) return undefined;
  return Sentry.startInactiveSpan({ name, op });
}

/**
 * Express middleware to add request context to Sentry
 */
export function sentryRequestHandler(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!IS_SENTRY_ENABLED) {
      return next();
    }

    // Add request-specific context
    Sentry.setContext('request', {
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      headers: {
        'user-agent': req.get('user-agent'),
        'content-type': req.get('content-type')
      }
    });

    // Add user context if available
    if ((req as Request & { user?: { userId: string } }).user) {
      const user = (req as Request & { user: { userId: string } }).user;
      Sentry.setUser({ id: user.userId });
    }

    next();
  };
}

/**
 * Express error handler middleware for Sentry
 * Should be used after all other error handlers
 */
export function sentryErrorHandler(): (err: Error, req: Request, res: Response, next: NextFunction) => void {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (!IS_SENTRY_ENABLED) {
      return next(err);
    }

    // Capture the error with request context
    captureException(err, {
      tags: {
        path: req.path,
        method: req.method
      },
      extra: {
        query: req.query,
        body: req.body
      }
    });

    next(err);
  };
}

/**
 * Check if Sentry is enabled and initialized
 */
export function isSentryEnabled(): boolean {
  return IS_SENTRY_ENABLED && isInitialized;
}

/**
 * Flush pending events before shutdown
 * Call this before process exit
 */
export async function flushSentry(timeout: number = 2000): Promise<boolean> {
  if (!IS_SENTRY_ENABLED) return true;
  return Sentry.flush(timeout);
}

/**
 * Close Sentry client
 * Call this during graceful shutdown
 */
export async function closeSentry(): Promise<void> {
  if (!IS_SENTRY_ENABLED) return;
  await Sentry.close();
  logger.info('Sentry closed');
}
