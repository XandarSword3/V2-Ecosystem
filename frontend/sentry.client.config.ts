import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session Replay for debugging user issues
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Filter out common noise
  ignoreErrors: [
    // Network errors
    'Network Error',
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    // User aborts
    'AbortError',
    'The operation was aborted',
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Common third-party
    'ResizeObserver loop limit exceeded',
  ],
  
  // Don't send PII
  beforeSend(event) {
    // Remove any potential sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});
