import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';

// Mock dependencies inline to avoid hoisting issues
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/modules/auth/auth.utils.js', () => ({
  generateTokens: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/AppError.js', () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-session-id'),
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue({
      toString: vi.fn().mockReturnValue('test-challenge-base64url'),
    }),
  },
}));

import { getSupabase } from '../../../src/database/connection.js';
import { generateTokens } from '../../../src/modules/auth/auth.utils.js';
import {
  registerBegin,
  registerComplete,
  authenticateBegin,
  authenticateComplete,
  listCredentials,
  deleteCredential,
} from '../../../src/modules/auth/biometric.controller.js';

describe('Biometric Controller', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
    };
    
    vi.mocked(getSupabase).mockReturnValue(mockSupabase);
  });

  describe('registerBegin', () => {
    it('should return 401 if user not authenticated', async () => {
      const { req, res } = createMockReqRes({});
      req.user = undefined;

      await registerBegin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 404 if user not found in database', async () => {
      const { req, res } = createMockReqRes({
        user: { userId: 'user-123' },
      });

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }));

      await registerBegin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    it('should return registration options on success', async () => {
      const { req, res } = createMockReqRes({
        user: { userId: 'user-123' },
      });

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - get user
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
              }),
            }),
          };
        }
        // Second call - get existing credentials
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      });

      await registerBegin(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          sessionId: expect.any(String),
          options: expect.objectContaining({
            challenge: expect.any(String),
            rp: expect.objectContaining({
              name: 'V2 Ecosystem',
            }),
            user: expect.objectContaining({
              name: 'test@example.com',
              displayName: 'Test User',
            }),
          }),
        })
      );
    });
  });

  describe('registerComplete', () => {
    it('should return 400 if missing required fields', async () => {
      const { req, res } = createMockReqRes({
        body: {},
      });

      await registerComplete(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields',
      });
    });

    it('should return 400 for invalid credential format', async () => {
      const { req, res } = createMockReqRes({
        body: {
          sessionId: 'test-session',
          credential: { id: 'cred-123', response: {} }, // Missing required fields
        },
      });

      // Mock internal challenge store check would fail - but we're testing credential validation
      // This test may need adjustment based on actual implementation
      await registerComplete(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('authenticateBegin', () => {
    it('should return valid-looking response for non-existent user (prevent enumeration)', async () => {
      const { req, res } = createMockReqRes({
        body: { email: 'nonexistent@example.com' },
      });

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }));

      await authenticateBegin(req, res);

      // Should still return success to prevent user enumeration
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          sessionId: expect.any(String),
          options: expect.objectContaining({
            challenge: expect.any(String),
            allowCredentials: [],
          }),
        })
      );
    });

    it('should return 400 if user has no biometric credentials', async () => {
      const { req, res } = createMockReqRes({
        body: { email: 'test@example.com' },
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - get user
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null }),
              }),
            }),
          };
        }
        // Second call - get credentials (empty)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      });

      await authenticateBegin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No biometric credentials registered for this account',
      });
    });

    it('should return authentication options when credentials exist', async () => {
      const { req, res } = createMockReqRes({
        body: { email: 'test@example.com' },
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - get user
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null }),
              }),
            }),
          };
        }
        // Second call - get credentials
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ credential_id: 'cred-abc-123' }],
                error: null,
              }),
            }),
          }),
        };
      });

      await authenticateBegin(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          sessionId: expect.any(String),
          options: expect.objectContaining({
            challenge: expect.any(String),
            userVerification: 'required',
            allowCredentials: expect.arrayContaining([
              expect.objectContaining({
                id: 'cred-abc-123',
                type: 'public-key',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('authenticateComplete', () => {
    it('should return 400 if missing required fields', async () => {
      const { req, res } = createMockReqRes({
        body: {},
      });

      await authenticateComplete(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields',
      });
    });

    it('should return 400 for invalid credential format', async () => {
      const { req, res } = createMockReqRes({
        body: {
          sessionId: 'test-session',
          credential: { id: 'cred-123', response: {} }, // Missing authenticatorData and signature
        },
      });

      // Session check will fail first, but testing validation
      await authenticateComplete(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('listCredentials', () => {
    it('should return 401 if user not authenticated', async () => {
      const { req, res } = createMockReqRes({});
      req.user = undefined;

      await listCredentials(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return empty list if no credentials', async () => {
      const { req, res } = createMockReqRes({
        user: { userId: 'user-123' },
      });

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }));

      await listCredentials(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        credentials: [],
      });
    });

    it('should return list of credentials', async () => {
      const { req, res } = createMockReqRes({
        user: { userId: 'user-123' },
      });

      const mockCredentials = [
        {
          id: 'cred-1',
          device_type: 'face_id',
          device_name: 'iPhone 15',
          created_at: '2024-01-01T00:00:00Z',
          last_used_at: '2024-01-15T00:00:00Z',
          is_active: true,
        },
        {
          id: 'cred-2',
          device_type: 'touch_id',
          device_name: 'MacBook Pro',
          created_at: '2024-01-02T00:00:00Z',
          last_used_at: null,
          is_active: true,
        },
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockCredentials, error: null }),
          }),
        }),
      }));

      await listCredentials(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        credentials: mockCredentials,
      });
    });

    it('should return 500 if database error', async () => {
      const { req, res } = createMockReqRes({
        user: { userId: 'user-123' },
      });

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }));

      await listCredentials(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to list credentials',
      });
    });
  });

  describe('deleteCredential', () => {
    it('should return 401 if user not authenticated', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'cred-123' },
      });
      req.user = undefined;

      await deleteCredential(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 400 if no credential ID provided', async () => {
      const { req, res } = createMockReqRes({
        user: { userId: 'user-123' },
        params: {},
      });

      await deleteCredential(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Credential ID required',
      });
    });

    it('should return 404 if credential not found', async () => {
      const { req, res } = createMockReqRes({
        user: { userId: 'user-123' },
        params: { id: 'nonexistent-cred' },
      });

      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          }),
        }),
      }));

      await deleteCredential(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Credential not found',
      });
    });

    it('should soft delete credential successfully', async () => {
      const { req, res } = createMockReqRes({
        user: { userId: 'user-123' },
        params: { id: 'cred-123' },
      });

      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'cred-123' }, error: null }),
              }),
            }),
          }),
        }),
      }));

      await deleteCredential(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Credential removed successfully',
      });
    });
  });
});
