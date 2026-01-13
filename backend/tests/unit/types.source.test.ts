import { describe, it, expect } from 'vitest';

// Import the type guard functions from source
import {
  isErrorWithMessage,
  isErrorWithStatusCode,
  getErrorMessage,
} from '../../src/types/index';

describe('Types Module - Type Guards (Source)', () => {
  describe('isErrorWithMessage', () => {
    it('should return true for Error objects', () => {
      const error = new Error('Test error');
      expect(isErrorWithMessage(error)).toBe(true);
    });

    it('should return true for object with message property', () => {
      const error = { message: 'Custom error' };
      expect(isErrorWithMessage(error)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isErrorWithMessage(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isErrorWithMessage(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isErrorWithMessage('error string')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isErrorWithMessage(404)).toBe(false);
    });

    it('should return false for object without message', () => {
      expect(isErrorWithMessage({ code: 'ERROR' })).toBe(false);
    });

    it('should return false for object with non-string message', () => {
      expect(isErrorWithMessage({ message: 123 })).toBe(false);
    });

    it('should return true for object with empty string message', () => {
      expect(isErrorWithMessage({ message: '' })).toBe(true);
    });
  });

  describe('isErrorWithStatusCode', () => {
    it('should return true for object with statusCode and message', () => {
      const error = { statusCode: 404, message: 'Not found' };
      expect(isErrorWithStatusCode(error)).toBe(true);
    });

    it('should return false for object with only message', () => {
      const error = { message: 'Error' };
      expect(isErrorWithStatusCode(error)).toBe(false);
    });

    it('should return false for object with only statusCode', () => {
      const error = { statusCode: 500 };
      expect(isErrorWithStatusCode(error)).toBe(false);
    });

    it('should return false for object with non-number statusCode', () => {
      const error = { statusCode: '404', message: 'Not found' };
      expect(isErrorWithStatusCode(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isErrorWithStatusCode(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isErrorWithStatusCode(undefined)).toBe(false);
    });

    it('should return true for valid error with 400 status', () => {
      expect(isErrorWithStatusCode({ statusCode: 400, message: 'Bad request' })).toBe(true);
    });

    it('should return true for valid error with 500 status', () => {
      expect(isErrorWithStatusCode({ statusCode: 500, message: 'Internal error' })).toBe(true);
    });
  });

  describe('getErrorMessage', () => {
    it('should return message from Error object', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should return message from plain object', () => {
      const error = { message: 'Custom error message' };
      expect(getErrorMessage(error)).toBe('Custom error message');
    });

    it('should return default message for null', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
    });

    it('should return default message for undefined', () => {
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
    });

    it('should return default message for string', () => {
      expect(getErrorMessage('error string')).toBe('An unexpected error occurred');
    });

    it('should return default message for number', () => {
      expect(getErrorMessage(404)).toBe('An unexpected error occurred');
    });

    it('should return default message for object without message', () => {
      expect(getErrorMessage({ code: 'ERROR' })).toBe('An unexpected error occurred');
    });

    it('should return empty string if message is empty', () => {
      expect(getErrorMessage({ message: '' })).toBe('');
    });
  });
});
