import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, changePasswordSchema } from '../../../src/modules/auth/auth.validation';

describe('Auth Validation', () => {
  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1!',
        fullName: 'John Doe'
      });

      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1!',
        fullName: 'John Doe',
        phone: '+1234567890',
        preferredLanguage: 'en'
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        password: 'Password1!',
        fullName: 'John Doe'
      });

      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Pass1!',
        fullName: 'John Doe'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 8 characters');
      }
    });

    it('should reject password without uppercase', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password1!',
        fullName: 'John Doe'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('uppercase');
      }
    });

    it('should reject password without lowercase', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'PASSWORD1!',
        fullName: 'John Doe'
      });

      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password!',
        fullName: 'John Doe'
      });

      expect(result.success).toBe(false);
    });

    it('should reject password without special character', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        fullName: 'John Doe'
      });

      expect(result.success).toBe(false);
    });

    it('should reject short full name', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1!',
        fullName: 'J'
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid language preference', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1!',
        fullName: 'John Doe',
        preferredLanguage: 'de'
      });

      expect(result.success).toBe(false);
    });

    it('should accept supported languages', () => {
      const languages = ['en', 'ar', 'fr'] as const;
      for (const lang of languages) {
        const result = registerSchema.safeParse({
          email: 'test@example.com',
          password: 'Password1!',
          fullName: 'John Doe',
          preferredLanguage: lang
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'anypassword'
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid',
        password: 'password'
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: ''
      });

      expect(result.success).toBe(false);
    });

    it('should not enforce strong password on login', () => {
      // Login only checks if password exists, not strength
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'simple'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('changePasswordSchema', () => {
    it('should accept valid password change data', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword',
        newPassword: 'NewPassword1!'
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty current password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: '',
        newPassword: 'NewPassword1!'
      });

      expect(result.success).toBe(false);
    });

    it('should enforce strong new password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword',
        newPassword: 'weak'
      });

      expect(result.success).toBe(false);
    });
  });
});
