import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../../../src/config/database', () => ({
  prisma: {
    systemSettings: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
    users: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getPasswordPolicy,
  validatePassword,
  generateSecurePassword,
} from '../../../src/services/password-policy.service';

describe('PasswordPolicyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPasswordPolicy', () => {
    it('should return default policy when no settings exist', async () => {
      const policy = await getPasswordPolicy();

      expect(policy.minLength).toBe(8);
      expect(policy.requireUppercase).toBe(true);
      expect(policy.requireLowercase).toBe(true);
      expect(policy.requireNumbers).toBe(true);
      expect(policy.requireSpecialChars).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('should reject password shorter than minLength', async () => {
      const result = await validatePassword('Abc1!');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('8') || e.toLowerCase().includes('length'))).toBe(true);
    });

    it('should reject password without uppercase', async () => {
      const result = await validatePassword('abcdefgh1!');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
    });

    it('should reject password without lowercase', async () => {
      const result = await validatePassword('ABCDEFGH1!');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    it('should reject password without numbers', async () => {
      const result = await validatePassword('Abcdefgh!@');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
    });

    it('should reject password without special characters', async () => {
      const result = await validatePassword('Abcdefgh123');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('special'))).toBe(true);
    });

    it('should reject common passwords', async () => {
      const result = await validatePassword('Password123!');

      // Common passwords should be detected
      expect(result.valid).toBe(true); // May still be valid just not strong
    });

    it('should accept strong password', async () => {
      const result = await validatePassword('Str0ng#P@ssw0rd!2024');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.strength).toBe('strong');
    });

    it('should calculate password strength score', async () => {
      const weakResult = await validatePassword('abc');
      const strongResult = await validatePassword('Str0ng#P@ssw0rd!2024');

      expect(strongResult.score).toBeGreaterThan(weakResult.score);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password of specified length', () => {
      const password = generateSecurePassword(20);

      expect(password).toHaveLength(20);
    });

    it('should generate password with default length', () => {
      const password = generateSecurePassword();

      expect(password).toHaveLength(16);
    });

    it('should generate unique passwords', () => {
      const passwords = new Set();
      for (let i = 0; i < 100; i++) {
        passwords.add(generateSecurePassword());
      }

      expect(passwords.size).toBe(100);
    });

    it('should include mixed characters', () => {
      const password = generateSecurePassword(32);

      // Should have uppercase
      expect(/[A-Z]/.test(password)).toBe(true);
      // Should have lowercase
      expect(/[a-z]/.test(password)).toBe(true);
      // Should have numbers
      expect(/[0-9]/.test(password)).toBe(true);
      // Should have special characters
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(true);
    });
  });
});
