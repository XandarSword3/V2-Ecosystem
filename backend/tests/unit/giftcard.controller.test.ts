import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';

// Create a properly chainable Supabase mock
const createChainableMock = (defaultResponse: { data: any; error: any } = { data: null, error: null }) => {
  let responseQueue: Array<{ data: any; error: any; count?: number }> = [];
  let responseIndex = 0;

  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) {
      return responseQueue[responseIndex++];
    }
    return defaultResponse;
  };

  const builder: any = {};
  
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'or', 'not',
    'filter', 'match', 'order', 'limit', 'range',
  ];
  
  chainMethods.forEach(method => {
    builder[method] = vi.fn().mockImplementation(() => builder);
  });

  builder.single = vi.fn().mockImplementation(() => {
    return Promise.resolve(getNextResponse());
  });
  builder.maybeSingle = vi.fn().mockImplementation(() => {
    return Promise.resolve(getNextResponse());
  });
  builder.then = (resolve: any, reject: any) => {
    return Promise.resolve(getNextResponse()).then(resolve, reject);
  };

  return {
    builder,
    queueResponse: (data: any, error: any = null, count?: number) => {
      responseQueue.push({ data, error, count });
    },
    reset: () => {
      responseQueue = [];
      responseIndex = 0;
    },
  };
};

let mockBuilder: ReturnType<typeof createChainableMock>;
const mockFrom = vi.fn();

// Mock the database connection module
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { GiftCardController } from '../../src/modules/giftcards/giftcard.controller';

describe('Gift Card Controller', () => {
  let controller: GiftCardController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: any;
  let responseStatus: number;

  beforeEach(() => {
    controller = new GiftCardController();
    responseJson = {};
    responseStatus = 200;
    
    mockResponse = {
      status: vi.fn().mockImplementation((code) => {
        responseStatus = code;
        return mockResponse;
      }),
      json: vi.fn().mockImplementation((data) => {
        responseJson = data;
        return mockResponse;
      }),
    };
    
    mockRequest = {
      user: { id: 'user-123', role: 'customer' },
      params: {},
      query: {},
      body: {},
    };
    
    mockBuilder = createChainableMock();
    mockFrom.mockReturnValue(mockBuilder.builder);
    
    vi.clearAllMocks();
    mockFrom.mockReturnValue(mockBuilder.builder);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockBuilder.reset();
  });

  describe('getTemplates', () => {
    it('should return active gift card templates', async () => {
      const mockTemplates = [
        { id: 'tmpl-25', name: '$25 Gift Card', amount: 25, is_active: true },
        { id: 'tmpl-50', name: '$50 Gift Card', amount: 50, is_active: true },
        { id: 'tmpl-100', name: '$100 Gift Card', amount: 100, is_active: true },
      ];

      mockBuilder.queueResponse(mockTemplates, null);

      await controller.getTemplates(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockFrom).toHaveBeenCalledWith('gift_card_templates');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTemplates,
      });
    });

    it('should handle database errors', async () => {
      mockBuilder.queueResponse(null, { message: 'Database error' });

      await controller.getTemplates(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(responseJson.success).toBe(false);
    });
  });

  describe('purchaseGiftCard', () => {
    // SKIP REASON: The controller makes multiple database calls (template lookup, code uniqueness check,
    // insert, transaction log, purchaser lookup) and the mock queue pattern doesn't handle this well.
    // The actual controller is tested via integration tests.
    it('should purchase a gift card from template', async () => {
      mockRequest.body = {
        templateId: '550e8400-e29b-41d4-a716-446655440050',
        recipientEmail: 'friend@example.com',
        recipientName: 'John',
        message: 'Happy Birthday!',
      };

      const mockTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440050',
        name: '$50 Gift Card',
        amount: 50,
        design: { background: '#7c3aed' },
        is_active: true,
      };

      const createdGiftCard = {
        id: 'gc-123',
        code: 'GIFT-ABCD1234',
        initial_balance: 50,
        current_balance: 50,
        status: 'active',
        recipient_email: 'friend@example.com',
        recipient_name: 'John',
      };

      // Queue responses in order
      mockBuilder.queueResponse(mockTemplate, null);  // Get template
      mockBuilder.queueResponse(null, null);          // Check code uniqueness
      mockBuilder.queueResponse(createdGiftCard, null); // Insert gift card
      mockBuilder.queueResponse(null, null);          // Insert transaction

      await controller.purchaseGiftCard(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseJson.success).toBe(true);
    });

    it('should reject missing required fields', async () => {
      mockRequest.body = {
        templateId: '550e8400-e29b-41d4-a716-446655440050',
        // missing recipientEmail and recipientName
      };

      await controller.purchaseGiftCard(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseJson.error).toBe('Validation failed');
    });

    it('should reject non-existent template', async () => {
      mockRequest.body = {
        templateId: '550e8400-e29b-41d4-a716-446655449999', // Valid UUID format, but not found
        recipientEmail: 'friend@example.com',
        recipientName: 'John',
      };

      mockBuilder.queueResponse(null, null);  // Template not found

      await controller.purchaseGiftCard(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('checkBalance', () => {
    it('should return gift card balance', async () => {
      mockRequest.params = { code: 'GIFT-ABC123' };

      const mockGiftCard = {
        id: 'gc-123',
        code: 'GIFT-ABC123',
        current_balance: 35.50,
        initial_balance: 50,
        status: 'active',
        expires_at: '2025-12-31T23:59:59Z',
      };

      mockBuilder.queueResponse(mockGiftCard, null);

      await controller.checkBalance(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
      expect(responseJson.data.code).toBe('GIFT-ABC123');
    });

    it('should return 404 for invalid code', async () => {
      mockRequest.params = { code: 'INVALID-CODE' };

      mockBuilder.queueResponse(null, null);

      await controller.checkBalance(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(responseJson.error).toBe('Gift card not found');
    });
  });

  describe('redeemGiftCard', () => {
    it('should redeem gift card successfully', async () => {
      mockRequest.body = {
        code: 'GIFT-REDEEM1',
        amount: 20,
      };

      const mockGiftCard = {
        id: 'gc-redeem',
        code: 'GIFT-REDEEM1',
        current_balance: 50,
        status: 'active',
      };

      // Get gift card, update balance, log transaction
      mockBuilder.queueResponse(mockGiftCard, null);
      mockBuilder.queueResponse({ ...mockGiftCard, current_balance: 30 }, null);
      mockBuilder.queueResponse({ id: 'txn-1' }, null);

      await controller.redeemGiftCard(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });

    it('should reject invalid gift card', async () => {
      mockRequest.body = {
        code: 'INVALID-CODE',
        amount: 20,
      };

      mockBuilder.queueResponse(null, null);

      await controller.redeemGiftCard(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should reject inactive gift card', async () => {
      mockRequest.body = {
        code: 'GIFT-INACTIVE',
        amount: 20,
      };

      mockBuilder.queueResponse({
        id: 'gc-inactive',
        code: 'GIFT-INACTIVE',
        current_balance: 50,
        status: 'expired',
      }, null);

      await controller.redeemGiftCard(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should reject insufficient balance', async () => {
      mockRequest.body = {
        code: 'GIFT-LOW',
        amount: 100,
      };

      mockBuilder.queueResponse({
        id: 'gc-low',
        code: 'GIFT-LOW',
        current_balance: 25,
        status: 'active',
        expires_at: '2025-12-31T23:59:59Z',
      }, null);

      await controller.redeemGiftCard(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getMyGiftCards', () => {
    it('should return user purchased gift cards', async () => {
      const mockGiftCards = [
        { id: 'gc-1', code: 'GIFT-AAA', current_balance: 50, status: 'active', created_at: '2023-01-01' },
      ];

      // Queue separate responses for purchased and received calls
      mockBuilder.queueResponse(mockGiftCards, null); // Purchased
      mockBuilder.queueResponse([], null);            // Received

      await controller.getMyGiftCards(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
      expect(responseJson.data).toBeDefined();
      expect(Array.isArray(responseJson.data)).toBe(true);
      expect(responseJson.data[0].type).toBe('purchased');
    });
  });

  describe('getAllGiftCards (Admin)', () => {
    it('should return paginated gift cards', async () => {
      mockRequest.query = { page: '1', limit: '10' };
      mockRequest.user = { id: 'admin-123', role: 'admin' };

      const mockGiftCards = [
        { id: 'gc-1', code: 'GIFT-1', current_balance: 50, status: 'active' },
        { id: 'gc-2', code: 'GIFT-2', current_balance: 0, status: 'redeemed' },
      ];

      mockBuilder.queueResponse(mockGiftCards, null, 100);

      await controller.getAllGiftCards(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
      expect(responseJson.data).toEqual(mockGiftCards);
    });
  });
});
