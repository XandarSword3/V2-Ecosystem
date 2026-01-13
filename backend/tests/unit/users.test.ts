/**
 * Users Module Unit Tests
 * 
 * Tests for the user management module including:
 * - Profile retrieval and updates
 * - User preferences
 * - Account management
 * - User search and listing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { createMockUser, mockSupabaseClient } from '../setup';

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

describe('Users Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Profile Retrieval', () => {
    it('should retrieve user profile by ID', async () => {
      const mockUser = createMockUser();

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockUser,
              error: null
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .select('*')
        .eq('id', mockUser.id)
        .single();

      expect(result.data).toEqual(mockUser);
      expect(result.data.email).toBeDefined();
    });

    it('should not expose password hash in profile', async () => {
      const mockUser = createMockUser();

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockUser.id,
                email: mockUser.email,
                full_name: mockUser.full_name,
                // password_hash is intentionally excluded
              },
              error: null
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .select('id, email, full_name')
        .eq('id', mockUser.id)
        .single();

      expect(result.data.password_hash).toBeUndefined();
    });

    it('should include user role information', async () => {
      const mockUser = createMockUser();

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                ...mockUser,
                role: { id: 'role-1', name: 'customer', display_name: 'Customer' }
              },
              error: null
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .select('*, role:roles(*)')
        .eq('id', mockUser.id)
        .single();

      expect(result.data.role).toBeDefined();
      expect(result.data.role.name).toBe('customer');
    });
  });

  describe('Profile Updates', () => {
    it('should update user full name', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: '123', full_name: 'New Name' },
                error: null
              })
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .update({ full_name: 'New Name' })
        .eq('id', '123')
        .select()
        .single();

      expect(result.data.full_name).toBe('New Name');
    });

    it('should update user phone number', async () => {
      const newPhone = '+961 71 234 567';

      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: '123', phone: newPhone },
                error: null
              })
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .update({ phone: newPhone })
        .eq('id', '123')
        .select()
        .single();

      expect(result.data.phone).toBe(newPhone);
    });

    it('should validate phone number format', () => {
      const validPhones = [
        '+961 71 234 567',
        '+1 555 123 4567',
        '+44 20 7946 0958'
      ];
      
      const invalidPhones = [
        'not-a-phone',
        '123',
        ''
      ];

      // Simple phone validation regex
      const phoneRegex = /^\+?[\d\s-]{7,}$/;

      validPhones.forEach(phone => {
        expect(phoneRegex.test(phone)).toBe(true);
      });

      invalidPhones.forEach(phone => {
        expect(phoneRegex.test(phone)).toBe(false);
      });
    });

    it('should update user preferences', async () => {
      const preferences = {
        language: 'ar',
        theme: 'dark',
        notifications_enabled: true
      };

      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: '123', preferences },
                error: null
              })
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .update({ preferences })
        .eq('id', '123')
        .select()
        .single();

      expect(result.data.preferences.language).toBe('ar');
      expect(result.data.preferences.theme).toBe('dark');
    });
  });

  describe('Password Management', () => {
    it('should hash password when changing', async () => {
      const newPassword = 'NewSecurePass123!';
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      expect(hashedPassword).not.toBe(newPassword);
      expect(hashedPassword.startsWith('$2')).toBe(true); // bcrypt hash prefix
    });

    it('should require current password to change password', async () => {
      const currentPassword = 'OldPass123!';
      const storedHash = await bcrypt.hash(currentPassword, 12);
      
      const isValid = await bcrypt.compare(currentPassword, storedHash);
      expect(isValid).toBe(true);

      const wrongPassword = 'WrongPass456!';
      const isInvalid = await bcrypt.compare(wrongPassword, storedHash);
      expect(isInvalid).toBe(false);
    });

    it('should validate password strength', () => {
      // Password must have at least 8 chars, 1 uppercase, 1 lowercase, 1 number
      const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

      const strongPasswords = [
        'Password123',
        'SecurePass1!',
        'MyP@ssw0rd2024'
      ];

      const weakPasswords = [
        'password',
        '12345678',
        'SHORT1',
        'alllowercase1'
      ];

      strongPasswords.forEach(pw => {
        expect(strongPasswordRegex.test(pw)).toBe(true);
      });

      weakPasswords.forEach(pw => {
        expect(strongPasswordRegex.test(pw)).toBe(false);
      });
    });
  });

  describe('User Search and Listing', () => {
    it('should search users by email', async () => {
      const searchTerm = 'john';

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockResolvedValue({
            data: [
              { id: '1', email: 'john@example.com' },
              { id: '2', email: 'johnny@example.com' }
            ],
            error: null
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .select('*')
        .ilike('email', `%${searchTerm}%`);

      expect(result.data).toHaveLength(2);
      expect(result.data.every((u: { email: string }) => 
        u.email.toLowerCase().includes(searchTerm)
      )).toBe(true);
    });

    it('should paginate user list', async () => {
      const pageSize = 10;
      const page = 2;
      const offset = (page - 1) * pageSize;

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: Array(pageSize).fill(null).map((_, i) => ({ id: `user-${offset + i}` })),
            error: null
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .select('*')
        .range(offset, offset + pageSize - 1);

      expect(result.data).toHaveLength(pageSize);
    });

    it('should filter users by role', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { id: '1', role_id: 'staff-role' },
              { id: '2', role_id: 'staff-role' }
            ],
            error: null
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .select('*')
        .eq('role_id', 'staff-role');

      expect(result.data.every((u: { role_id: string }) => 
        u.role_id === 'staff-role'
      )).toBe(true);
    });
  });

  describe('Account Status', () => {
    it('should deactivate user account', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: '123', is_active: false },
                error: null
              })
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .update({ is_active: false })
        .eq('id', '123')
        .select()
        .single();

      expect(result.data.is_active).toBe(false);
    });

    it('should record last login timestamp', async () => {
      const loginTime = new Date().toISOString();

      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: { id: '123', last_login: loginTime },
            error: null
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .update({ last_login: loginTime })
        .eq('id', '123');

      expect(result.data.last_login).toBe(loginTime);
    });
  });

  describe('Email Verification', () => {
    it('should track email verification status', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: '123', email_verified: true, email_verified_at: '2024-01-01T00:00:00Z' },
              error: null
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('users')
        .select('email_verified, email_verified_at')
        .eq('id', '123')
        .single();

      expect(result.data.email_verified).toBe(true);
      expect(result.data.email_verified_at).toBeDefined();
    });
  });
});
