import { describe, it, expect } from 'vitest';

// Import the actual source
import { AppError } from '../../src/utils/AppError';

describe('AppError (Source)', () => {
  describe('constructor', () => {
    it('should create an error with message and status code', () => {
      const error = new AppError('Something went wrong', 500);

      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.errors).toBeUndefined();
    });

    it('should create a 400 Bad Request error', () => {
      const error = new AppError('Invalid input', 400);

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should create a 401 Unauthorized error', () => {
      const error = new AppError('Unauthorized', 401);

      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
    });

    it('should create a 403 Forbidden error', () => {
      const error = new AppError('Forbidden', 403);

      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
    });

    it('should create a 404 Not Found error', () => {
      const error = new AppError('Resource not found', 404);

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
    });

    it('should create an error with validation errors array', () => {
      const validationErrors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' }
      ];

      const error = new AppError('Validation failed', 400, validationErrors);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.errors).toEqual(validationErrors);
      expect(error.errors).toHaveLength(2);
    });

    it('should be an instance of Error', () => {
      const error = new AppError('Test error', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should have isOperational set to true by default', () => {
      const error = new AppError('Operational error', 500);

      expect(error.isOperational).toBe(true);
    });

    it('should have a stack trace', () => {
      const error = new AppError('Error with stack', 500);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('error handling', () => {
    it('should be throwable', () => {
      expect(() => {
        throw new AppError('Thrown error', 500);
      }).toThrow('Thrown error');
    });

    it('should be catchable with try-catch', () => {
      let caughtError: AppError | null = null;

      try {
        throw new AppError('Caught error', 404);
      } catch (error) {
        caughtError = error as AppError;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe('Caught error');
      expect(caughtError!.statusCode).toBe(404);
    });

    it('should work with Promise.reject', async () => {
      const errorPromise = Promise.reject(new AppError('Async error', 500));

      await expect(errorPromise).rejects.toThrow('Async error');
    });
  });
});
