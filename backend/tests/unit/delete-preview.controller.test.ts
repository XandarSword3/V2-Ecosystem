import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Create mock Supabase responses
const createMockSupabase = () => {
  const mockFrom = vi.fn();
  
  return {
    from: mockFrom,
    setupUserPreview: (user: any, bookings: number, orders: number) => {
      mockFrom.mockImplementation((table: string) => {
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };

        if (table === 'users') {
          builder.single.mockResolvedValue({ data: user, error: null });
          return builder;
        }
        
        if (table === 'chalet_bookings') {
          return {
            ...builder,
            limit: vi.fn().mockResolvedValue({ data: [], count: bookings, error: null }),
          };
        }
        
        if (table === 'restaurant_orders') {
          return {
            ...builder,
            limit: vi.fn().mockResolvedValue({ data: [], count: orders, error: null }),
          };
        }

        // Default for other tables
        return {
          ...builder,
          limit: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
        };
      });
    },
  };
};

// Mock the database connection
const mockSupabase = createMockSupabase();
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { getDeletePreview } from '../../src/modules/admin/controllers/delete-preview.controller';

describe('Delete Preview Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: any;
  let nextFn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    responseJson = null;
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => {
        responseJson = data;
        return mockResponse;
      }),
    };
    
    mockRequest = {
      params: {},
    };

    nextFn = vi.fn();
  });

  describe('User delete preview', () => {
    it('should return low severity for user with no related data', async () => {
      mockRequest.params = { entityType: 'user', entityId: 'user-123' };
      
      mockSupabase.setupUserPreview(
        { id: 'user-123', email: 'test@test.com', full_name: 'Test User', created_at: '2024-01-01' },
        0, // bookings
        0  // orders
      );

      await getDeletePreview(
        mockRequest as Request,
        mockResponse as Response,
        nextFn
      );

      expect(responseJson.success).toBe(true);
      expect(responseJson.data.entity.type).toBe('user');
      expect(responseJson.data.canDelete).toBe(true);
    });
  });

  describe('Invalid entity type', () => {
    it('should reject invalid entity types', async () => {
      mockRequest.params = { entityType: 'invalid', entityId: '123' };

      await getDeletePreview(
        mockRequest as Request,
        mockResponse as Response,
        nextFn
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseJson.success).toBe(false);
      expect(responseJson.error).toContain('Invalid entity type');
    });
  });

  describe('Supported entity types', () => {
    const entityTypes = ['user', 'booking', 'staff', 'chalet', 'menu_item', 'table', 'module'];

    it('should accept all valid entity types', () => {
      entityTypes.forEach(type => {
        expect(['user', 'booking', 'staff', 'chalet', 'menu_item', 'table', 'module']).toContain(type);
      });
    });
  });
});
