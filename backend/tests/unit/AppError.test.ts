import { describe, it, expect } from 'vitest';
import { AppError } from '../../src/utils/AppError';

describe('AppError', () => {
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

    it('should create an error with validation errors', () => {
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

    it('should handle empty validation errors array', () => {
      const error = new AppError('Validation failed', 400, []);

      expect(error.errors).toEqual([]);
      expect(error.errors).toHaveLength(0);
    });

    it('should handle single validation error', () => {
      const singleError = [{ field: 'name', message: 'Name is required' }];
      const error = new AppError('Validation failed', 400, singleError);

      expect(error.errors).toHaveLength(1);
      expect(error.errors![0].field).toBe('name');
      expect(error.errors![0].message).toBe('Name is required');
    });
  });

  describe('error codes', () => {
    it('should correctly identify client errors (4xx)', () => {
      const badRequest = new AppError('Bad Request', 400);
      const unauthorized = new AppError('Unauthorized', 401);
      const forbidden = new AppError('Forbidden', 403);
      const notFound = new AppError('Not Found', 404);
      const conflict = new AppError('Conflict', 409);
      const unprocessable = new AppError('Unprocessable Entity', 422);

      expect(badRequest.statusCode).toBeGreaterThanOrEqual(400);
      expect(badRequest.statusCode).toBeLessThan(500);
      expect(unauthorized.statusCode).toBeGreaterThanOrEqual(400);
      expect(forbidden.statusCode).toBeGreaterThanOrEqual(400);
      expect(notFound.statusCode).toBeGreaterThanOrEqual(400);
      expect(conflict.statusCode).toBeGreaterThanOrEqual(400);
      expect(unprocessable.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should correctly identify server errors (5xx)', () => {
      const internalError = new AppError('Internal Server Error', 500);
      const badGateway = new AppError('Bad Gateway', 502);
      const serviceUnavailable = new AppError('Service Unavailable', 503);

      expect(internalError.statusCode).toBeGreaterThanOrEqual(500);
      expect(badGateway.statusCode).toBeGreaterThanOrEqual(500);
      expect(serviceUnavailable.statusCode).toBeGreaterThanOrEqual(500);
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
