import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';

// Create a properly chainable Supabase mock
const createChainableMock = () => {
  let responseQueue: Array<{ data: any; error: any; count?: number }> = [];
  let responseIndex = 0;

  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) {
      return responseQueue[responseIndex++];
    }
    return { data: null, error: null };
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

  builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.then = (resolve: any, reject: any) => Promise.resolve(getNextResponse()).then(resolve, reject);

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

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { CouponController } from '../../src/modules/coupons/coupon.controller';

describe('Coupon Controller', () => {
  let controller: CouponController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: any;
  let responseStatus: number;

  beforeEach(() => {
    controller = new CouponController();
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

  describe('validateCoupon', () => {
    it('should validate a percentage coupon successfully', async () => {
      mockRequest.body = {
        code: 'SAVE20',
        orderType: 'chalets',
        orderAmount: 100,
      };

      const mockCoupon = {
        id: 'coupon-123',
        code: 'SAVE20',
        name: 'Save 20%',
        discount_type: 'percentage',
        discount_value: 20,
        min_order_amount: 50,
        max_discount_amount: 50,
        usage_limit: 100,
        usage_count: 10,
        per_user_limit: 1,
        valid_from: new Date(Date.now() - 86400000).toISOString(),
        valid_until: new Date(Date.now() + 86400000).toISOString(),
        is_active: true,
        applies_to: 'all',
        requires_min_items: 0,
        first_order_only: false,
      };

      mockBuilder.queueResponse(mockCoupon, null);

      await controller.validateCoupon(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
      expect(responseJson.data.valid).toBe(true);
    });

    it('should validate a fixed discount coupon', async () => {
      mockRequest.body = {
        code: 'FLAT10',
        orderType: 'chalets',
        orderAmount: 50,
      };

      const mockCoupon = {
        id: 'coupon-456',
        code: 'FLAT10',
        name: 'Flat $10 Off',
        discount_type: 'fixed',
        discount_value: 10,
        min_order_amount: 0,
        is_active: true,
        applies_to: 'all',
        requires_min_items: 0,
      };

      mockBuilder.queueResponse(mockCoupon, null);

      await controller.validateCoupon(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
      expect(responseJson.data.valid).toBe(true);
    });

    it('should reject invalid coupon code', async () => {
      mockRequest.body = {
        code: 'INVALID',
        orderType: 'chalets',
        orderAmount: 100,
      };

      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      await controller.validateCoupon(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should reject expired coupon', async () => {
      mockRequest.body = {
        code: 'EXPIRED',
        orderType: 'chalets',
        orderAmount: 100,
      };

      const mockCoupon = {
        id: 'coupon-expired',
        code: 'EXPIRED',
        discount_type: 'percentage',
        discount_value: 10,
        valid_from: new Date(Date.now() - 86400000 * 10).toISOString(),
        valid_until: new Date(Date.now() - 86400000).toISOString(),
        is_active: true,
        applies_to: 'all',
      };

      mockBuilder.queueResponse(mockCoupon, null);

      await controller.validateCoupon(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.valid).toBe(false);
      expect(responseJson.error).toBe('Coupon has expired');
    });

    it('should reject coupon below minimum order', async () => {
      mockRequest.body = {
        code: 'MINORDER',
        orderType: 'chalets',
        orderAmount: 30,
      };

      const mockCoupon = {
        id: 'coupon-min',
        code: 'MINORDER',
        discount_type: 'percentage',
        discount_value: 10,
        min_order_amount: 50,
        is_active: true,
        applies_to: 'all',
        requires_min_items: 0,
      };

      mockBuilder.queueResponse(mockCoupon, null);

      await controller.validateCoupon(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.valid).toBe(false);
    });
  });

  describe('getCoupons (Admin)', () => {
    it('should return paginated coupons', async () => {
      mockRequest.query = { page: '1', limit: '10' };
      mockRequest.user = { id: 'admin-123', role: 'admin' };

      const mockCoupons = [
        { id: 'coupon-1', code: 'SAVE10', discount_type: 'percentage', discount_value: 10 },
        { id: 'coupon-2', code: 'FLAT5', discount_type: 'fixed', discount_value: 5 },
      ];

      mockBuilder.queueResponse(mockCoupons, null, 50);

      await controller.getCoupons(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
      expect(responseJson.data).toEqual(mockCoupons);
    });
  });

  describe('createCoupon', () => {
    it('should create a new coupon', async () => {
      mockRequest.body = {
        code: 'NEWCODE',
        name: 'New Coupon',
        discountType: 'percentage',
        discountValue: 15,
        appliesTo: 'all',
      };
      mockRequest.user = { id: 'admin-123', role: 'admin' };

      const createdCoupon = {
        id: 'coupon-new',
        code: 'NEWCODE',
        name: 'New Coupon',
        discount_type: 'percentage',
        discount_value: 15,
        is_active: true,
      };

      // Check if code exists
      mockBuilder.queueResponse(null, null);
      // Insert coupon
      mockBuilder.queueResponse(createdCoupon, null);

      await controller.createCoupon(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseJson.success).toBe(true);
    });
  });
});
