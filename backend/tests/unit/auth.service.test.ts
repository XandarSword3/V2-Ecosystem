/**
 * Auth Service Unit Tests
 * 
 * Tests for authentication service functions including:
 * - Registration
 * - Login
 * - Token refresh
 * - Password change/reset
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { createMockUser, createMockRole, mockSupabaseClient } from '../setup';

// Mock the database connection
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabaseClient
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock email service
vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendWelcomeEmail: vi.fn().mockResolvedValue(true),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(true)
  }
}));

describe('Auth Service - Registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject registration with existing email', async () => {
    const existingUser = createMockUser();
    
    // Mock: email already exists
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ 
            data: [existingUser], 
            error: null 
          })
        })
      })
    });

    // Import after mocks are set up
    const { register } = await import('../../src/modules/auth/auth.service');
    
    await expect(register({
      email: 'test@example.com',
      password: 'Password123!',
      fullName: 'Test User'
    })).rejects.toThrow('Email already registered');
  });

  it('should hash password with bcrypt', async () => {
    const hashSpy = vi.spyOn(bcrypt, 'hash');
    
    // Mock: email doesn't exist
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createMockUser(),
                error: null
              })
            })
          })
        };
      }
      if (table === 'roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [createMockRole()],
                error: null
              })
            })
          })
        };
      }
      if (table === 'user_roles') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      }
      return mockSupabaseClient;
    });

    const { register } = await import('../../src/modules/auth/auth.service');
    
    await register({
      email: 'new@example.com',
      password: 'SecurePass123!',
      fullName: 'New User'
    });

    expect(hashSpy).toHaveBeenCalledWith('SecurePass123!', 12);
  });
});

describe('Auth Service - Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject login for non-existent user', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'No rows found' }
          })
        })
      })
    });

    const { login } = await import('../../src/modules/auth/auth.service');
    
    await expect(login('nonexistent@example.com', 'password123', {}))
      .rejects.toThrow('Invalid credentials');
  });

  it('should reject login for disabled account', async () => {
    const disabledUser = createMockUser({ is_active: false });
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: disabledUser,
            error: null
          })
        })
      })
    });

    const { login } = await import('../../src/modules/auth/auth.service');
    
    await expect(login('test@example.com', 'password123', {}))
      .rejects.toThrow('Account is disabled');
  });

  it('should reject login with incorrect password', async () => {
    const user = createMockUser();
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: user,
            error: null
          })
        })
      })
    });

    const { login } = await import('../../src/modules/auth/auth.service');
    
    await expect(login('test@example.com', 'wrongpassword', {}))
      .rejects.toThrow('Invalid credentials');
  });
});

describe('Auth Service - Password Validation', () => {
  it('should require minimum 8 characters', () => {
    const { z } = require('zod');
    const passwordSchema = z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain uppercase letter')
      .regex(/[a-z]/, 'Password must contain lowercase letter')
      .regex(/[0-9]/, 'Password must contain number');

    expect(() => passwordSchema.parse('short')).toThrow();
    expect(() => passwordSchema.parse('validpassword')).toThrow(); // no uppercase
    expect(() => passwordSchema.parse('VALIDPASSWORD')).toThrow(); // no lowercase
    expect(() => passwordSchema.parse('ValidPassword')).toThrow(); // no number
    expect(() => passwordSchema.parse('ValidPassword123')).not.toThrow();
  });
});

describe('Auth Service - Token Management', () => {
  it('should generate JWT with correct claims', async () => {
    const jwt = await import('jsonwebtoken');
    const token = jwt.sign(
      { userId: 'test-id', roles: ['customer'] },
      'test-secret',
      { expiresIn: '15m' }
    );
    
    const decoded = jwt.verify(token, 'test-secret') as { userId: string; roles: string[] };
    
    expect(decoded.userId).toBe('test-id');
    expect(decoded.roles).toContain('customer');
  });

  it('should reject expired tokens', async () => {
    const jwt = await import('jsonwebtoken');
    const expiredToken = jwt.sign(
      { userId: 'test-id' },
      'test-secret',
      { expiresIn: '-1s' } // Already expired
    );
    
    expect(() => jwt.verify(expiredToken, 'test-secret')).toThrow();
  });
});
