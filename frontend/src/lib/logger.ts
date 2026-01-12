'use client';

/**
 * Frontend Logger
 * 
 * Provides structured logging for the frontend with:
 * - Environment-aware logging (disabled in production unless debug mode)
 * - Consistent log format with timestamps
 * - Log levels (debug, info, warn, error)
 * - Easy enable/disable via localStorage
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  prefix: string;
  message: string;
  data?: unknown;
}

// Check if we're in a browser and if debug mode is enabled
const isBrowser = typeof window !== 'undefined';
const isProduction = process.env.NODE_ENV === 'production';

function isDebugEnabled(): boolean {
  if (!isBrowser) return false;
  if (!isProduction) return true;
  // Allow debug mode in production via localStorage flag
  return localStorage.getItem('v2-debug') === 'true';
}

function formatLog(entry: LogEntry): string {
  return `[${entry.timestamp}] ${entry.prefix} ${entry.message}`;
}

function createLogger(prefix: string) {
  const log = (level: LogLevel, message: string, data?: unknown) => {
    if (!isDebugEnabled() && level !== 'error') return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString().substring(11, 23),
      level,
      prefix: `[${prefix}]`,
      message,
      data,
    };

    const formatted = formatLog(entry);

    switch (level) {
      case 'debug':
        if (data !== undefined) {
          console.debug(formatted, data);
        } else {
          console.debug(formatted);
        }
        break;
      case 'info':
        if (data !== undefined) {
          console.info(formatted, data);
        } else {
          console.info(formatted);
        }
        break;
      case 'warn':
        if (data !== undefined) {
          console.warn(formatted, data);
        } else {
          console.warn(formatted);
        }
        break;
      case 'error':
        // Errors are always logged
        if (data !== undefined) {
          console.error(formatted, data);
        } else {
          console.error(formatted);
        }
        break;
    }
  };

  return {
    debug: (message: string, data?: unknown) => log('debug', message, data),
    info: (message: string, data?: unknown) => log('info', message, data),
    warn: (message: string, data?: unknown) => log('warn', message, data),
    error: (message: string, data?: unknown) => log('error', message, data),
  };
}

// Pre-configured loggers for common modules
export const socketLogger = createLogger('Socket');
export const settingsLogger = createLogger('Settings');
export const authLogger = createLogger('Auth');
export const apiLogger = createLogger('API');

// Export factory for custom loggers
export { createLogger };
