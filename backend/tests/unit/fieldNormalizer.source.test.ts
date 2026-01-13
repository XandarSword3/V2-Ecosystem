import { describe, it, expect } from 'vitest';

// Import the actual source functions
import {
  snakeToCamel,
  camelToSnake,
  normalizeToSnakeCase,
  normalizeToCamelCase,
  normalizeRequestBody
} from '../../src/utils/fieldNormalizer';

describe('Field Normalizer (Source)', () => {
  describe('snakeToCamel', () => {
    it('should convert snake_case to camelCase', () => {
      expect(snakeToCamel('hello_world')).toBe('helloWorld');
    });

    it('should handle multiple underscores', () => {
      expect(snakeToCamel('this_is_a_test')).toBe('thisIsATest');
    });

    it('should return same string if no underscores', () => {
      expect(snakeToCamel('hello')).toBe('hello');
    });

    it('should handle empty string', () => {
      expect(snakeToCamel('')).toBe('');
    });
  });

  describe('camelToSnake', () => {
    it('should convert camelCase to snake_case', () => {
      expect(camelToSnake('helloWorld')).toBe('hello_world');
    });

    it('should handle multiple capitals', () => {
      expect(camelToSnake('thisIsATest')).toBe('this_is_a_test');
    });

    it('should return same string if no capitals', () => {
      expect(camelToSnake('hello')).toBe('hello');
    });

    it('should handle empty string', () => {
      expect(camelToSnake('')).toBe('');
    });
  });

  describe('normalizeToSnakeCase', () => {
    it('should convert object keys to snake_case', () => {
      const input = { firstName: 'John', lastName: 'Doe' };
      const result = normalizeToSnakeCase(input);
      expect(result).toEqual({ first_name: 'John', last_name: 'Doe' });
    });

    it('should handle nested objects', () => {
      const input = { 
        userData: { 
          firstName: 'John',
          contactInfo: { phoneNumber: '123' }
        }
      };
      const result = normalizeToSnakeCase(input);
      expect(result).toEqual({
        user_data: {
          first_name: 'John',
          contact_info: { phone_number: '123' }
        }
      });
    });

    it('should handle arrays', () => {
      const input = [{ firstName: 'John' }, { firstName: 'Jane' }];
      const result = normalizeToSnakeCase(input);
      expect(result).toEqual([{ first_name: 'John' }, { first_name: 'Jane' }]);
    });

    it('should handle null', () => {
      expect(normalizeToSnakeCase(null)).toBe(null);
    });

    it('should handle undefined', () => {
      expect(normalizeToSnakeCase(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(normalizeToSnakeCase('hello')).toBe('hello');
      expect(normalizeToSnakeCase(42)).toBe(42);
      expect(normalizeToSnakeCase(true)).toBe(true);
    });
  });

  describe('normalizeToCamelCase', () => {
    it('should convert object keys to camelCase', () => {
      const input = { first_name: 'John', last_name: 'Doe' };
      const result = normalizeToCamelCase(input);
      expect(result).toEqual({ firstName: 'John', lastName: 'Doe' });
    });

    it('should handle nested objects', () => {
      const input = {
        user_data: {
          first_name: 'John',
          contact_info: { phone_number: '123' }
        }
      };
      const result = normalizeToCamelCase(input);
      expect(result).toEqual({
        userData: {
          firstName: 'John',
          contactInfo: { phoneNumber: '123' }
        }
      });
    });

    it('should handle arrays', () => {
      const input = [{ first_name: 'John' }, { first_name: 'Jane' }];
      const result = normalizeToCamelCase(input);
      expect(result).toEqual([{ firstName: 'John' }, { firstName: 'Jane' }]);
    });

    it('should handle null', () => {
      expect(normalizeToCamelCase(null)).toBe(null);
    });

    it('should handle undefined', () => {
      expect(normalizeToCamelCase(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(normalizeToCamelCase('hello')).toBe('hello');
      expect(normalizeToCamelCase(42)).toBe(42);
      expect(normalizeToCamelCase(true)).toBe(true);
    });
  });

  describe('normalizeRequestBody', () => {
    it('should add camelCase version of snake_case keys', () => {
      const input = { user_name: 'john' };
      const result = normalizeRequestBody(input);
      expect(result.user_name).toBe('john');
      expect(result.userName).toBe('john');
    });

    it('should add snake_case version of camelCase keys', () => {
      const input = { userName: 'john' };
      const result = normalizeRequestBody(input);
      expect(result.userName).toBe('john');
      expect(result.user_name).toBe('john');
    });

    it('should not overwrite existing keys', () => {
      const input = { user_name: 'snake', userName: 'camel' };
      const result = normalizeRequestBody(input);
      expect(result.user_name).toBe('snake');
      expect(result.userName).toBe('camel');
    });

    it('should handle nested objects', () => {
      const input = { user_data: { first_name: 'John' } };
      const result = normalizeRequestBody(input);
      expect(result.userData).toBeDefined();
      expect(result.userData.firstName).toBe('John');
    });

    it('should handle arrays', () => {
      const input = [{ first_name: 'John' }];
      const result = normalizeRequestBody(input);
      expect(result[0].first_name).toBe('John');
      expect(result[0].firstName).toBe('John');
    });

    it('should handle null and undefined', () => {
      expect(normalizeRequestBody(null)).toBe(null);
      expect(normalizeRequestBody(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(normalizeRequestBody('string')).toBe('string');
      expect(normalizeRequestBody(123)).toBe(123);
    });
  });
});
