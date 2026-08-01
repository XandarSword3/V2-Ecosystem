/**
 * Sentry Instrumentation Entry Point
 * 
 * This file MUST be imported before any other code (especially before Express is loaded)
 * to ensure Sentry's auto-instrumentation can hook into Express at module load time.
 * 
 * Node.js 20+ supports --import flag for preloading modules:
 * node --import ./src/instrumentation.ts src/index.ts
 * 
 * Or use NODE_OPTIONS environment variable:
 * NODE_OPTIONS="--import ./src/instrumentation.ts" npm run dev
 */

import * as Sentry from '@sentry/node';

// Check if Sentry is enabled via environment variable
const SENTRY_DSN = process.env.SENTRY_DSN;
const ENV = process.env.NODE_ENV || 'development';
const VERSION = process.env.npm_package_version || '1.0.0';

if (SENTRY_DSN) {
  // Initialize Sentry BEFORE Express is imported
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV,
    release: VERSION,
    
    // Performance Monitoring
    tracesSampleRate: ENV === 'production' ? 0.1 : 0.25,

    // Integrations - Express integration will auto-instrument Express
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
    
    beforeSend(event) {
      // Filter out noisy events in development
      if (ENV === 'development') {
        return null;
      }
      return event;
    },
    
    ignoreErrors: [
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'ECONNRESET',
      'ETIMEDOUT'
    ]
  });
}

// Export initSentry function for compatibility with existing code
// This will be a no-op if Sentry was already initialized above
export function initSentry(app: any) {
  if (SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }
}
