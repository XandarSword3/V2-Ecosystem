import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the actual logger
import { logger } from '../../src/utils/logger';

describe('Logger (Source)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logger instance', () => {
    it('should be defined', () => {
      expect(logger).toBeDefined();
    });

    it('should have info method', () => {
      expect(typeof logger.info).toBe('function');
    });

    it('should have error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('should have warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('should have debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });

    it('should have http method', () => {
      expect(typeof logger.http).toBe('function');
    });
  });

  describe('logging operations', () => {
    it('should not throw when logging info', () => {
      expect(() => logger.info('Test info message')).not.toThrow();
    });

    it('should not throw when logging error', () => {
      expect(() => logger.error('Test error message')).not.toThrow();
    });

    it('should not throw when logging warn', () => {
      expect(() => logger.warn('Test warning message')).not.toThrow();
    });

    it('should not throw when logging debug', () => {
      expect(() => logger.debug('Test debug message')).not.toThrow();
    });

    it('should not throw when logging http', () => {
      expect(() => logger.http('Test http message')).not.toThrow();
    });

    it('should not throw when logging with metadata object', () => {
      expect(() => logger.info('Test message', { key: 'value', count: 42 })).not.toThrow();
    });

    it('should not throw when logging error with stack trace', () => {
      const error = new Error('Test error');
      expect(() => logger.error('An error occurred', { error, stack: error.stack })).not.toThrow();
    });
  });
});
