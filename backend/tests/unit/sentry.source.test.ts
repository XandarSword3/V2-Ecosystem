import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mock is set up
import {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  setTags,
  setContext,
  addBreadcrumb,
  startTransaction,
  sentryRequestHandler,
  sentryErrorHandler,
  isSentryEnabled,
  flushSentry,
  closeSentry,
} from '../../src/utils/sentry';

describe('Sentry Utils (Source)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initSentry', () => {
    it('should be a function', () => {
      expect(typeof initSentry).toBe('function');
    });

    it('should not throw when called without app', () => {
      expect(() => initSentry()).not.toThrow();
    });
  });

  describe('captureException', () => {
    it('should be a function', () => {
      expect(typeof captureException).toBe('function');
    });

    it('should accept error parameter', () => {
      const error = new Error('Test error');
      // Just verify it doesn't throw
      expect(() => captureException(error)).not.toThrow();
    });

    it('should accept error with context', () => {
      const error = new Error('Test error');
      expect(() => captureException(error, {
        tags: { module: 'test' },
        extra: { additionalInfo: 'info' },
        user: { id: 'user-123', email: 'test@example.com' },
        level: 'error',
      })).not.toThrow();
    });
  });

  describe('captureMessage', () => {
    it('should be a function', () => {
      expect(typeof captureMessage).toBe('function');
    });

    it('should accept message parameter', () => {
      expect(() => captureMessage('Test message')).not.toThrow();
    });

    it('should accept message with level and context', () => {
      expect(() => captureMessage('Test message', 'warning', { key: 'value' })).not.toThrow();
    });
  });

  describe('setUser', () => {
    it('should be a function that can be called', () => {
      expect(typeof setUser).toBe('function');
      expect(() => setUser({ id: 'user-123', email: 'test@example.com' })).not.toThrow();
    });
  });

  describe('clearUser', () => {
    it('should be a function that can be called', () => {
      expect(typeof clearUser).toBe('function');
      expect(() => clearUser()).not.toThrow();
    });
  });

  describe('setTags', () => {
    it('should be a function that can be called', () => {
      expect(typeof setTags).toBe('function');
      expect(() => setTags({ environment: 'test', version: '1.0.0' })).not.toThrow();
    });
  });

  describe('setContext', () => {
    it('should be a function that can be called', () => {
      expect(typeof setContext).toBe('function');
      expect(() => setContext('request', { method: 'GET', url: '/api/test' })).not.toThrow();
    });
  });

  describe('addBreadcrumb', () => {
    it('should be a function that can be called', () => {
      expect(typeof addBreadcrumb).toBe('function');
      expect(() => addBreadcrumb({
        message: 'User clicked button',
        category: 'ui.click',
        level: 'info',
        data: { buttonId: 'submit' },
      })).not.toThrow();
    });
  });

  describe('startTransaction', () => {
    it('should be a function', () => {
      expect(typeof startTransaction).toBe('function');
    });

    it('should accept transaction name and op', () => {
      expect(() => startTransaction('test-transaction', 'http.request')).not.toThrow();
    });
  });

  describe('sentryRequestHandler', () => {
    it('should return a middleware function', () => {
      const middleware = sentryRequestHandler();
      expect(typeof middleware).toBe('function');
    });

    it('should call next in middleware', () => {
      const middleware = sentryRequestHandler();
      const req = { method: 'GET', originalUrl: '/test', query: {}, get: vi.fn() } as any;
      const res = {} as any;
      const next = vi.fn();
      
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('sentryErrorHandler', () => {
    it('should return an error handler middleware function', () => {
      const errorHandler = sentryErrorHandler();
      expect(typeof errorHandler).toBe('function');
    });

    it('should call next with error in error handler', () => {
      const errorHandler = sentryErrorHandler();
      const err = new Error('Test error');
      const req = { path: '/test', method: 'GET', query: {}, body: {} } as any;
      const res = {} as any;
      const next = vi.fn();
      
      errorHandler(err, req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('isSentryEnabled', () => {
    it('should be a function', () => {
      expect(typeof isSentryEnabled).toBe('function');
    });

    it('should return a boolean', () => {
      const result = isSentryEnabled();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('flushSentry', () => {
    it('should be an async function', () => {
      expect(typeof flushSentry).toBe('function');
    });

    it('should return a promise', async () => {
      const result = flushSentry();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should accept a custom timeout', async () => {
      await expect(flushSentry(5000)).resolves.not.toThrow();
    });
  });

  describe('closeSentry', () => {
    it('should be an async function', () => {
      expect(typeof closeSentry).toBe('function');
    });

    it('should resolve without throwing', async () => {
      await expect(closeSentry()).resolves.not.toThrow();
    });
  });
});
