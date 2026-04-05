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
const mockRpc = vi.fn();
const sendGiftCardMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));

// Mock the database connection module
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendGiftCard: sendGiftCardMock,
  },
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
        expires_at: '2027-04-05T00:00:00.000Z',
      };

      // Queue responses in order
      mockBuilder.queueResponse(mockTemplate, null);  // Get template
      mockBuilder.queueResponse(null, null);          // Check code uniqueness
      mockBuilder.queueResponse(createdGiftCard, null); // Insert gift card
      mockBuilder.queueResponse(null, null);          // Insert transaction
      mockBuilder.queueResponse({ full_name: 'Test Sender' }, null); // Purchaser lookup for email

      await controller.purchaseGiftCard(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseJson).toEqual({
        success: true,
        data: {
          id: 'gc-123',
          code: expect.any(String),
          amount: 50,
          recipientEmail: 'friend@example.com',
          recipientName: 'John',
          expiresAt: expect.any(String),
        },
        message: 'Gift card created successfully',
      });

      expect(mockFrom).toHaveBeenCalledWith('gift_card_templates');
      expect(mockFrom).toHaveBeenCalledWith('gift_cards');
      expect(mockFrom).toHaveBeenCalledWith('gift_card_transactions');
      expect(sendGiftCardMock).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'friend@example.com',
          recipientName: 'John',
          amount: 50,
        })
      );
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

      mockBuilder.queueResponse({
        id: 'gc-redeem',
        current_balance: 50,
        status: 'active',
        expires_at: '2099-12-31T23:59:59Z',
      }, null);

      // Mock the atomic RPC returning a successful redemption
      mockRpc.mockResolvedValue({
        data: [{ success: true, amount_redeemed: 20, new_balance: 30, gift_card_id: 'gc-redeem', error_message: null }],
        error: null,
      });

      await controller.redeemGiftCard(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
      expect(responseJson.data.amountRedeemed).toBe(20);
      expect(responseJson.data.remainingBalance).toBe(30);
    });

    it('should reject invalid gift card', async () => {
      mockRequest.body = {
        code: 'INVALID-CODE',
        amount: 20,
      };

      mockBuilder.queueResponse(null, { message: 'not found' });

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
        current_balance: 50,
        status: 'inactive',
        expires_at: '2099-12-31T23:59:59Z',
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
        current_balance: 50,
        status: 'active',
        expires_at: '2099-12-31T23:59:59Z',
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
      const purchasedCards = [
        { id: 'gc-1', code: 'GIFT-AAA', current_balance: 50, status: 'active', created_at: '2023-01-01T10:00:00Z' },
      ];
      const receivedCards = [
        { id: 'gc-2', code: 'GIFT-BBB', current_balance: 30, status: 'active', created_at: '2023-01-02T10:00:00Z' },
      ];

      // Queue separate responses for purchased and received calls
      mockBuilder.queueResponse(purchasedCards, null); // Purchased
      mockBuilder.queueResponse(receivedCards, null);  // Received

      await controller.getMyGiftCards(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson).toEqual({
        success: true,
        data: [
          expect.objectContaining({
            id: 'gc-2',
            code: 'GIFT-BBB',
            current_balance: 30,
            status: 'active',
            type: 'received',
          }),
          expect.objectContaining({
            id: 'gc-1',
            code: 'GIFT-AAA',
            current_balance: 50,
            status: 'active',
            type: 'purchased',
          }),
        ],
      });
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
