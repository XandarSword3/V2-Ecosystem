/// <reference types="vitest/globals" />

/**
 * Promotions Controller Tests
 * 
 * Tests for coupons, gift cards, and loyalty points functionality.
 * Uses chainable Supabase mock pattern.
 */

import { Request, Response } from 'express';

vi.mock('../../../../src/database/connection.js', () => ({ getSupabase: vi.fn() }));
vi.mock('../../../../src/utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { promotionsController, PromotionsController } from '../../../../src/modules/promotions/promotions.controller.js';
import { getSupabase } from '../../../../src/database/connection.js';

const UUID1 = '00000000-0000-0000-0000-000000000001';
const UUID2 = '00000000-0000-0000-0000-000000000002';
const UUID3 = '00000000-0000-0000-0000-000000000003';

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData: any) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null })
    }),
    then: (resolve: any) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data: any) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: any) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: any) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

function createMockReqRes(overrides: Partial<{ params: any; query: any; body: any; user: any }> = {}) {
  return {
    req: {
      params: {},
      query: {},
      body: {},
      user: { userId: UUID1, role: 'admin' },
      ...overrides
    } as unknown as Request,
    res: {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn()
    } as unknown as Response
  };
}

describe('PromotionsController', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  
  function createMockSupabase() {
    const responseQueue: Array<{ data: any; error: any } | null> = [];
    const rpcMock = vi.fn();
    
    const builder: any = {};
    const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'order', 'limit', 'single', 'maybeSingle', 'range', 'is', 'or', 'ilike', 'like', 'not', 'contains', 'textSearch'];
    
    for (const method of methods) {
      builder[method] = vi.fn().mockReturnValue(builder);
    }
    
    builder.then = function(resolve: any) {
      const resp = responseQueue.shift() || { data: null, error: null };
      return resolve(resp);
    };
    
    rpcMock.mockImplementation(() => {
      const resp = responseQueue.shift() || { data: null, error: null };
      return Promise.resolve(resp);
    });
    
    return {
      from: vi.fn().mockReturnValue(builder),
      rpc: rpcMock,
      builder,
      queueResponse(data: any, error: any = null) {
        responseQueue.push({ data, error });
      }
    };
  }
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);
  });

  // ============================================
  // COUPON TESTS
  // ============================================
  
  describe('applyCoupon', () => {
    const validBody = {
      couponCode: 'SAVE20',
      cartTotal: 100,
      userId: UUID1,
      existingCoupons: []
    };
    
    it('should apply coupon successfully', async () => {
      mockSupabase.queueResponse({ valid: true, discount: 20.00 }); // rpc validate
      mockSupabase.queueResponse({ code: 'SAVE20', discount_type: 'percentage', discount_value: 20 }); // coupon details
      
      const { req, res } = createMockReqRes({ body: validBody });
      await promotionsController.applyCoupon(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          valid: true,
          discount: 20.00
        })
      }));
    });
    
    it('should return 400 for invalid request body', async () => {
      const { req, res } = createMockReqRes({ body: {} });
      await promotionsController.applyCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
    
    it('should return 400 for missing couponCode', async () => {
      const { req, res } = createMockReqRes({ body: { cartTotal: 100, userId: UUID1 } });
      await promotionsController.applyCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for invalid cartTotal', async () => {
      const { req, res } = createMockReqRes({ body: { couponCode: 'TEST', cartTotal: -10, userId: UUID1 } });
      await promotionsController.applyCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 when coupon validation fails', async () => {
      mockSupabase.queueResponse({ valid: false, reason: 'Coupon has expired' });
      
      const { req, res } = createMockReqRes({ body: validBody });
      await promotionsController.applyCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Coupon has expired'
      }));
    });
    
    it('should return 400 when coupon not found', async () => {
      mockSupabase.queueResponse({ valid: false, reason: 'Coupon not found' });
      
      const { req, res } = createMockReqRes({ body: validBody });
      await promotionsController.applyCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 when minimum purchase not met', async () => {
      mockSupabase.queueResponse({ valid: false, reason: 'Minimum purchase not met' });
      
      const { req, res } = createMockReqRes({ body: { ...validBody, cartTotal: 10 } });
      await promotionsController.applyCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should handle RPC errors', async () => {
      mockSupabase.queueResponse(null, { message: 'Database error' });
      
      const { req, res } = createMockReqRes({ body: validBody });
      await promotionsController.applyCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
    
    it('should apply coupon with existing coupons (stacking)', async () => {
      mockSupabase.queueResponse({ valid: true, discount: 10.00 });
      mockSupabase.queueResponse({ code: 'EXTRA10', discount_type: 'percentage', discount_value: 10, stackable: true });
      
      const { req, res } = createMockReqRes({
        body: { ...validBody, couponCode: 'EXTRA10', existingCoupons: ['SAVE20'] }
      });
      await promotionsController.applyCoupon(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
  
  describe('createCoupon', () => {
    const validCouponBody = {
      code: 'NEWCODE',
      discountType: 'percentage' as const,
      discountValue: 15,
      minimumPurchase: 50,
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    };
    
    it('should create coupon successfully', async () => {
      mockSupabase.queueResponse(null, { code: 'PGRST116' }); // no existing coupon
      mockSupabase.queueResponse({
        id: 'coupon-1',
        code: 'NEWCODE',
        discount_type: 'percentage',
        discount_value: 15
      });
      
      const { req, res } = createMockReqRes({ body: validCouponBody });
      await promotionsController.createCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    
    it('should return 400 for invalid body', async () => {
      const { req, res } = createMockReqRes({ body: {} });
      await promotionsController.createCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for duplicate code', async () => {
      mockSupabase.queueResponse({ id: 'existing-coupon' });
      
      const { req, res } = createMockReqRes({ body: validCouponBody });
      await promotionsController.createCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Coupon code already exists'
      }));
    });
    
    it('should return 400 for invalid discount type', async () => {
      const { req, res } = createMockReqRes({
        body: { ...validCouponBody, discountType: 'invalid' }
      });
      await promotionsController.createCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for negative discount value', async () => {
      const { req, res } = createMockReqRes({
        body: { ...validCouponBody, discountValue: -10 }
      });
      await promotionsController.createCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for code too short', async () => {
      const { req, res } = createMockReqRes({
        body: { ...validCouponBody, code: 'AB' }
      });
      await promotionsController.createCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should handle insert errors', async () => {
      mockSupabase.queueResponse(null, { code: 'PGRST116' }); // no duplicate
      mockSupabase.queueResponse(null, { message: 'Insert error' });
      
      const { req, res } = createMockReqRes({ body: validCouponBody });
      await promotionsController.createCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
    
    it('should create fixed discount coupon', async () => {
      mockSupabase.queueResponse(null, { code: 'PGRST116' });
      mockSupabase.queueResponse({ id: 'coupon-2', code: 'FLAT10', discount_type: 'fixed', discount_value: 10 });
      
      const { req, res } = createMockReqRes({
        body: { ...validCouponBody, code: 'FLAT10', discountType: 'fixed', discountValue: 10 }
      });
      await promotionsController.createCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
    });
    
    it('should create stackable coupon', async () => {
      mockSupabase.queueResponse(null, { code: 'PGRST116' });
      mockSupabase.queueResponse({ id: 'coupon-3', stackable: true });
      
      const { req, res } = createMockReqRes({
        body: { ...validCouponBody, stackable: true, maxStackSize: 3 }
      });
      await promotionsController.createCoupon(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
  
  describe('recordCouponUsage', () => {
    it('should record coupon usage', async () => {
      mockSupabase.queueResponse(null); // insert
      mockSupabase.queueResponse(null); // rpc increment
      
      const controller = new PromotionsController();
      await controller.recordCouponUsage('coupon-1', UUID1, 'order-1', undefined, 15.00);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('coupon_usage');
    });
    
    it('should record usage with booking reference', async () => {
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse(null);
      
      const controller = new PromotionsController();
      await controller.recordCouponUsage('coupon-1', UUID1, undefined, 'booking-1', 20.00);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('coupon_usage');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment', expect.any(Object));
    });
  });
  
  describe('getAbuseReport', () => {
    it('should return abuse report', async () => {
      mockSupabase.queueResponse([{ user_id: UUID1 }]); // high usage
      mockSupabase.queueResponse([
        { id: UUID2, full_name: 'Fraud User', email: 'fraud@test.com', fraud_flag: true, fraud_reason: 'Suspicious' }
      ]); // flagged users
      mockSupabase.queueResponse([]); // rapid usage
      
      const { req, res } = createMockReqRes();
      await promotionsController.getAbuseReport(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          flaggedUsers: expect.any(Array)
        })
      }));
    });
    
    it('should identify suspicious users with many usages', async () => {
      mockSupabase.queueResponse([]);
      mockSupabase.queueResponse([]);
      const rapidUsage = Array.from({ length: 15 }, (_, i) => ({
        user_id: UUID1,
        created_at: '2024-01-01',
        coupon_id: `coupon-${i}`
      }));
      mockSupabase.queueResponse(rapidUsage);
      
      const { req, res } = createMockReqRes();
      await promotionsController.getAbuseReport(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.suspiciousUsers).toHaveLength(1);
      expect(response.data.suspiciousUsers[0].usageCount).toBe(15);
    });
    
    it('should not flag users with normal usage', async () => {
      mockSupabase.queueResponse([]);
      mockSupabase.queueResponse([]);
      const normalUsage = Array.from({ length: 5 }, (_, i) => ({
        user_id: UUID1,
        created_at: '2024-01-01',
        coupon_id: `coupon-${i}`
      }));
      mockSupabase.queueResponse(normalUsage);
      
      const { req, res } = createMockReqRes();
      await promotionsController.getAbuseReport(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.suspiciousUsers).toHaveLength(0);
    });
    
    it('should handle errors gracefully', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('Database error'); });
      
      const { req, res } = createMockReqRes();
      await promotionsController.getAbuseReport(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ============================================
  // GIFT CARD TESTS
  // ============================================
  
  describe('issueGiftCard', () => {
    const validGiftCardBody = {
      initialBalance: 100,
      purchasedBy: UUID1,
      recipientEmail: 'recipient@test.com',
      recipientName: 'John Doe',
      expiryMonths: 12
    };
    
    it('should issue gift card successfully', async () => {
      mockSupabase.queueResponse({
        id: 'gc-1',
        code: 'GC-TEST123',
        initial_balance: 100,
        current_balance: 100
      });
      mockSupabase.queueResponse(null); // ledger insert
      
      const { req, res } = createMockReqRes({ body: validGiftCardBody });
      await promotionsController.issueGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    
    it('should return 400 for invalid body', async () => {
      const { req, res } = createMockReqRes({ body: {} });
      await promotionsController.issueGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for missing initialBalance', async () => {
      const { req, res } = createMockReqRes({ body: { purchasedBy: UUID1 } });
      await promotionsController.issueGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for negative balance', async () => {
      const { req, res } = createMockReqRes({
        body: { initialBalance: -50, purchasedBy: UUID1 }
      });
      await promotionsController.issueGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for invalid email', async () => {
      const { req, res } = createMockReqRes({
        body: { ...validGiftCardBody, recipientEmail: 'invalid-email' }
      });
      await promotionsController.issueGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should handle insert errors', async () => {
      mockSupabase.queueResponse(null, { message: 'Insert failed' });
      
      const { req, res } = createMockReqRes({ body: validGiftCardBody });
      await promotionsController.issueGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
    
    it('should issue gift card with personal message', async () => {
      mockSupabase.queueResponse({
        id: 'gc-2',
        code: 'GC-MSG123',
        personal_message: 'Happy Birthday!'
      });
      mockSupabase.queueResponse(null);
      
      const { req, res } = createMockReqRes({
        body: { ...validGiftCardBody, personalMessage: 'Happy Birthday!' }
      });
      await promotionsController.issueGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
    });
    
    it('should issue gift card with custom expiry', async () => {
      mockSupabase.queueResponse({ id: 'gc-3', code: 'GC-EXP123' });
      mockSupabase.queueResponse(null);
      
      const { req, res } = createMockReqRes({
        body: { ...validGiftCardBody, expiryMonths: 24 }
      });
      await promotionsController.issueGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
  
  describe('checkGiftCardBalance', () => {
    it('should return balance for valid card', async () => {
      mockSupabase.queueResponse({
        code: 'GC-TEST',
        current_balance: 75.00,
        initial_balance: 100.00,
        expiry_date: '2099-12-31',
        is_active: true
      });
      
      const { req, res } = createMockReqRes({ params: { code: 'GC-TEST' } });
      await promotionsController.checkGiftCardBalance(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.balance).toBe(75.00);
      expect(response.data.isExpired).toBe(false);
      expect(response.data.isActive).toBe(true);
    });
    
    it('should detect expired card', async () => {
      mockSupabase.queueResponse({
        code: 'GC-OLD',
        current_balance: 50.00,
        initial_balance: 100.00,
        expiry_date: '2020-01-01',
        is_active: true
      });
      
      const { req, res } = createMockReqRes({ params: { code: 'GC-OLD' } });
      await promotionsController.checkGiftCardBalance(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.isExpired).toBe(true);
      expect(response.data.isActive).toBe(false);
    });
    
    it('should return 404 for non-existent card', async () => {
      mockSupabase.queueResponse(null, { code: 'PGRST116' });
      
      const { req, res } = createMockReqRes({ params: { code: 'INVALID' } });
      await promotionsController.checkGiftCardBalance(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Gift card not found'
      }));
    });
    
    it('should handle deactivated card', async () => {
      mockSupabase.queueResponse({
        code: 'GC-INACTIVE',
        current_balance: 50.00,
        initial_balance: 100.00,
        expiry_date: '2099-12-31',
        is_active: false
      });
      
      const { req, res } = createMockReqRes({ params: { code: 'GC-INACTIVE' } });
      await promotionsController.checkGiftCardBalance(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.isActive).toBe(false);
    });
    
    it('should handle database errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      
      const { req, res } = createMockReqRes({ params: { code: 'GC-TEST' } });
      await promotionsController.checkGiftCardBalance(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
  
  describe('redeemGiftCard', () => {
    const validRedeemBody = {
      cardCode: 'GC-TEST',
      amount: 50
    };
    
    it('should redeem gift card successfully', async () => {
      mockSupabase.queueResponse({
        id: 'gc-1',
        code: 'GC-TEST',
        current_balance: '100.00',
        is_active: true,
        expiry_date: '2099-12-31'
      });
      mockSupabase.queueResponse({ id: 'gc-1', current_balance: '50.00' });
      mockSupabase.queueResponse(null); // ledger
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemGiftCard(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          amountRedeemed: 50,
          remainingBalance: 50
        })
      }));
    });
    
    it('should return 400 for invalid body', async () => {
      const { req, res } = createMockReqRes({ body: {} });
      await promotionsController.redeemGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for negative amount', async () => {
      const { req, res } = createMockReqRes({
        body: { cardCode: 'GC-TEST', amount: -10 }
      });
      await promotionsController.redeemGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 404 for non-existent card', async () => {
      mockSupabase.queueResponse(null, { code: 'PGRST116' });
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
    });
    
    it('should return 400 for deactivated card', async () => {
      mockSupabase.queueResponse({
        id: 'gc-1',
        current_balance: '100.00',
        is_active: false,
        expiry_date: '2099-12-31'
      });
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Gift card is deactivated'
      }));
    });
    
    it('should return 400 for expired card', async () => {
      mockSupabase.queueResponse({
        id: 'gc-1',
        current_balance: '100.00',
        is_active: true,
        expiry_date: '2020-01-01'
      });
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Gift card has expired'
      }));
    });
    
    it('should return 400 for insufficient balance', async () => {
      mockSupabase.queueResponse({
        id: 'gc-1',
        current_balance: '25.00',
        is_active: true,
        expiry_date: '2099-12-31'
      });
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Insufficient balance',
        availableBalance: '25.00'
      }));
    });
    
    it('should handle update errors', async () => {
      mockSupabase.queueResponse({
        id: 'gc-1',
        current_balance: '100.00',
        is_active: true,
        expiry_date: '2099-12-31'
      });
      mockSupabase.queueResponse(null, { message: 'Update failed' });
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemGiftCard(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
    
    it('should redeem with order reference', async () => {
      mockSupabase.queueResponse({
        id: 'gc-1',
        code: 'GC-TEST',
        current_balance: '100.00',
        is_active: true,
        expiry_date: '2099-12-31'
      });
      mockSupabase.queueResponse({ id: 'gc-1', current_balance: '50.00' });
      mockSupabase.queueResponse(null);
      
      const { req, res } = createMockReqRes({
        body: { ...validRedeemBody, orderId: UUID2 }
      });
      await promotionsController.redeemGiftCard(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
  
  describe('getGiftCardLiabilityReport', () => {
    it('should return liability report', async () => {
      mockSupabase.queueResponse([
        { id: 'gc-1', current_balance: '100.00', expiry_date: '2099-12-31' },
        { id: 'gc-2', current_balance: '50.00', expiry_date: '2020-01-01' }
      ]);
      mockSupabase.queueResponse([
        { transaction_type: 'issuance', amount: '150.00', created_at: '2024-06-01T00:00:00Z' },
        { transaction_type: 'redemption', amount: '-25.00', created_at: '2024-06-15T00:00:00Z' }
      ]);
      
      const { req, res } = createMockReqRes();
      await promotionsController.getGiftCardLiabilityReport(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.totalCards).toBe(2);
      expect(response.data.totalLiability).toBe(150);
    });
    
    it('should calculate active vs expired liability', async () => {
      mockSupabase.queueResponse([
        { id: 'gc-1', current_balance: '100.00', expiry_date: '2099-12-31' },
        { id: 'gc-2', current_balance: '50.00', expiry_date: '2099-12-31' },
        { id: 'gc-3', current_balance: '25.00', expiry_date: '2020-01-01' }
      ]);
      mockSupabase.queueResponse([]);
      
      const { req, res } = createMockReqRes();
      await promotionsController.getGiftCardLiabilityReport(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.activeLiability).toBe(150);
      expect(response.data.expiredLiability).toBe(25);
    });
    
    it('should return monthly stats', async () => {
      mockSupabase.queueResponse([]);
      mockSupabase.queueResponse([
        { transaction_type: 'issuance', amount: '100.00', created_at: '2024-06-01T00:00:00Z' },
        { transaction_type: 'issuance', amount: '50.00', created_at: '2024-06-15T00:00:00Z' },
        { transaction_type: 'redemption', amount: '-30.00', created_at: '2024-06-20T00:00:00Z' }
      ]);
      
      const { req, res } = createMockReqRes();
      await promotionsController.getGiftCardLiabilityReport(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.monthlyStats['2024-06']).toBeDefined();
      expect(response.data.monthlyStats['2024-06'].issued).toBe(150);
      expect(response.data.monthlyStats['2024-06'].redeemed).toBe(30);
    });
    
    it('should handle empty gift cards', async () => {
      mockSupabase.queueResponse([]);
      mockSupabase.queueResponse([]);
      
      const { req, res } = createMockReqRes();
      await promotionsController.getGiftCardLiabilityReport(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.totalCards).toBe(0);
      expect(response.data.totalLiability).toBe(0);
    });
    
    it('should handle query errors', async () => {
      mockSupabase.queueResponse(null, { message: 'Query failed' });
      
      const { req, res } = createMockReqRes();
      await promotionsController.getGiftCardLiabilityReport(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ============================================
  // LOYALTY TESTS
  // ============================================
  
  describe('awardPoints', () => {
    const validAwardBody = {
      userId: UUID1,
      points: 100,
      source: 'purchase' as const
    };
    
    it('should award points successfully', async () => {
      mockSupabase.queueResponse({ id: 'batch-1', points_earned: 100 }); // batch insert
      mockSupabase.queueResponse([{ points_remaining: 200 }]); // batches for balance calculation
      mockSupabase.queueResponse(null); // transaction insert
      
      const { req, res } = createMockReqRes({ body: validAwardBody });
      await promotionsController.awardPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          pointsAwarded: 100,
          newBalance: 300
        })
      }));
    });
    
    it('should return 400 for invalid body', async () => {
      const { req, res } = createMockReqRes({ body: {} });
      await promotionsController.awardPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for invalid source', async () => {
      const { req, res } = createMockReqRes({
        body: { userId: UUID1, points: 100, source: 'invalid' }
      });
      await promotionsController.awardPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for negative points', async () => {
      const { req, res } = createMockReqRes({
        body: { userId: UUID1, points: -50, source: 'purchase' }
      });
      await promotionsController.awardPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 400 for invalid userId', async () => {
      const { req, res } = createMockReqRes({
        body: { userId: 'not-a-uuid', points: 100, source: 'purchase' }
      });
      await promotionsController.awardPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should handle batch insert errors', async () => {
      mockSupabase.queueResponse(null, { message: 'Insert failed' });
      
      const { req, res } = createMockReqRes({ body: validAwardBody });
      await promotionsController.awardPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
    
    it('should award points from referral', async () => {
      mockSupabase.queueResponse({ id: 'batch-2' }); // batch insert
      mockSupabase.queueResponse([{ points_remaining: 50 }]); // batches for balance
      mockSupabase.queueResponse(null); // transaction insert
      
      const { req, res } = createMockReqRes({
        body: { ...validAwardBody, source: 'referral', referenceId: UUID2 }
      });
      await promotionsController.awardPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
    });
    
    it('should award points with custom expiry', async () => {
      mockSupabase.queueResponse({ id: 'batch-3' }); // batch insert
      mockSupabase.queueResponse([{ points_remaining: 0 }]); // batches for balance
      mockSupabase.queueResponse(null); // transaction insert
      
      const { req, res } = createMockReqRes({
        body: { ...validAwardBody, expiryDays: 730 }
      });
      await promotionsController.awardPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
  
  describe('redeemPoints', () => {
    const validRedeemBody = {
      userId: UUID1,
      points: 50,
      redemptionType: 'discount' as const
    };
    
    it('should redeem points successfully (FIFO)', async () => {
      mockSupabase.queueResponse({ id: UUID1 }); // user exists
      mockSupabase.queueResponse(null); // no fraud flag
      mockSupabase.queueResponse([
        { id: 'b1', points_remaining: 100, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-01-01' },
        { id: 'b2', points_remaining: 100, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-02-01' }
      ]); // batches for balance
      mockSupabase.queueResponse([
        { id: 'b1', points_remaining: 100, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-01-01' },
        { id: 'b2', points_remaining: 100, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-02-01' }
      ]); // batches for FIFO
      mockSupabase.queueResponse(null); // batch update
      mockSupabase.queueResponse(null); // transaction insert
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemPoints(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          pointsRedeemed: 50,
          newBalance: 150
        })
      }));
    });
    
    it('should return 400 for invalid body', async () => {
      const { req, res } = createMockReqRes({ body: {} });
      await promotionsController.redeemPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should return 404 for non-existent user', async () => {
      mockSupabase.queueResponse(null);
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'User not found'
      }));
    });
    
    it('should return 403 for fraud-flagged user', async () => {
      mockSupabase.queueResponse({ id: UUID1 }); // user exists
      mockSupabase.queueResponse({ id: 'fraud-1' }); // fraud flag exists
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Account flagged for review'
      }));
    });
    
    it('should return 400 for insufficient points', async () => {
      mockSupabase.queueResponse({ id: UUID1 }); // user exists
      mockSupabase.queueResponse(null); // no fraud flag
      mockSupabase.queueResponse([{ points_remaining: 20 }]); // batches with 20 points
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Insufficient points',
        availablePoints: 20
      }));
    });
    
    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      
      const { req, res } = createMockReqRes({ body: validRedeemBody });
      await promotionsController.redeemPoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
    
    it('should redeem for freebie', async () => {
      mockSupabase.queueResponse({ id: UUID1 }); // user exists
      mockSupabase.queueResponse(null); // no fraud flag
      mockSupabase.queueResponse([{ points_remaining: 500 }]); // batches with 500 points
      mockSupabase.queueResponse([{ id: 'b1', points_remaining: 500, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-01-01' }]); // batches for FIFO
      mockSupabase.queueResponse(null); // batch update
      mockSupabase.queueResponse(null); // transaction insert
      
      const { req, res } = createMockReqRes({
        body: { ...validRedeemBody, points: 200, redemptionType: 'freebie' }
      });
      await promotionsController.redeemPoints(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    
    it('should redeem points across multiple batches', async () => {
      mockSupabase.queueResponse({ id: UUID1 }); // user exists
      mockSupabase.queueResponse(null); // no fraud flag
      mockSupabase.queueResponse([
        { id: 'b1', points_remaining: 30, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-01-01' },
        { id: 'b2', points_remaining: 70, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-02-01' },
        { id: 'b3', points_remaining: 50, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-03-01' }
      ]); // batches for balance check
      mockSupabase.queueResponse([
        { id: 'b1', points_remaining: 30, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-01-01' },
        { id: 'b2', points_remaining: 70, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-02-01' },
        { id: 'b3', points_remaining: 50, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-03-01' }
      ]); // batches for FIFO
      mockSupabase.queueResponse(null); // batch 1 update
      mockSupabase.queueResponse(null); // batch 2 update
      mockSupabase.queueResponse(null); // transaction insert
      
      const { req, res } = createMockReqRes({
        body: { userId: UUID1, points: 100, redemptionType: 'discount' }
      });
      await promotionsController.redeemPoints(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          pointsRedeemed: 100,
          newBalance: 50
        })
      }));
    });
  });
  
  describe('getUserLoyaltyStatus', () => {
    it('should return loyalty status', async () => {
      mockSupabase.queueResponse({
        id: UUID1,
        full_name: 'Test User'
      }); // user
      mockSupabase.queueResponse({ tier: { name: 'Gold' } }); // loyalty_members with tier
      mockSupabase.queueResponse([
        { id: 'b1', points_remaining: 300, expires_at: '2099-12-31T00:00:00Z' },
        { id: 'b2', points_remaining: 200, expires_at: '2099-06-30T00:00:00Z' }
      ]); // batches
      mockSupabase.queueResponse([
        { id: 'tx1', transaction_type: 'earn', points: 100, created_at: '2024-01-15' }
      ]); // transactions
      
      const { req, res } = createMockReqRes({ params: { userId: UUID1 } });
      await promotionsController.getUserLoyaltyStatus(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({
            totalPoints: 500,
            tier: 'Gold'
          })
        })
      }));
    });
    
    it('should return 404 for non-existent user', async () => {
      mockSupabase.queueResponse(null, { code: 'PGRST116' }); // user not found
      
      const { req, res } = createMockReqRes({ params: { userId: UUID1 } });
      await promotionsController.getUserLoyaltyStatus(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
    });
    
    it('should calculate points expiring soon', async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 15);
      
      mockSupabase.queueResponse({
        id: UUID1,
        full_name: 'Test'
      }); // user
      mockSupabase.queueResponse({ tier: { name: 'Silver' } }); // loyalty_members
      mockSupabase.queueResponse([
        { id: 'b1', points_remaining: 100, expires_at: soon.toISOString() },
        { id: 'b2', points_remaining: 100, expires_at: '2099-12-31T00:00:00Z' }
      ]); // batches
      mockSupabase.queueResponse([]); // transactions
      
      const { req, res } = createMockReqRes({ params: { userId: UUID1 } });
      await promotionsController.getUserLoyaltyStatus(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.pointsExpiringSoon).toBe(100);
    });
    
    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      
      const { req, res } = createMockReqRes({ params: { userId: UUID1 } });
      await promotionsController.getUserLoyaltyStatus(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
    
    it('should return recent transactions', async () => {
      mockSupabase.queueResponse({
        id: UUID1,
        full_name: 'Test'
      }); // user
      mockSupabase.queueResponse({ tier: { name: 'Bronze' } }); // loyalty_members
      mockSupabase.queueResponse([]); // batches
      mockSupabase.queueResponse([
        { id: 'tx1', transaction_type: 'earn', points: 100 },
        { id: 'tx2', transaction_type: 'redeem', points: -50 }
      ]); // transactions
      
      const { req, res } = createMockReqRes({ params: { userId: UUID1 } });
      await promotionsController.getUserLoyaltyStatus(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.recentTransactions).toHaveLength(2);
    });
  });
  
  describe('flagUserFraud', () => {
    it('should flag user for fraud', async () => {
      mockSupabase.queueResponse(null); // user update
      mockSupabase.queueResponse(null); // fraud flags insert
      
      const { req, res } = createMockReqRes({
        params: { userId: UUID2 },
        body: { reason: 'Suspicious redemption pattern' }
      });
      await promotionsController.flagUserFraud(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'User flagged for fraud'
      }));
    });
    
    it('should use admin userId from request', async () => {
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse(null);
      
      const { req, res } = createMockReqRes({
        params: { userId: UUID2 },
        body: { reason: 'Testing' },
        user: { userId: UUID3, role: 'admin' }
      });
      await promotionsController.flagUserFraud(req, res);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('loyalty_fraud_flags');
    });
    
    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      
      const { req, res } = createMockReqRes({
        params: { userId: UUID2 },
        body: { reason: 'Test' }
      });
      await promotionsController.flagUserFraud(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
  
  describe('expirePoints', () => {
    it('should expire old points', async () => {
      mockSupabase.queueResponse([
        { id: 'b1', user_id: UUID1, points_remaining: 50 },
        { id: 'b2', user_id: UUID2, points_remaining: 30 }
      ]);
      // For batch 1
      mockSupabase.queueResponse(null); // batch update
      mockSupabase.queueResponse({ loyalty_points: '100' }); // user select
      mockSupabase.queueResponse(null); // user update
      mockSupabase.queueResponse(null); // transaction insert
      // For batch 2
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse({ loyalty_points: '80' });
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse(null);
      
      const { req, res } = createMockReqRes();
      await promotionsController.expirePoints(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.batchesProcessed).toBe(2);
      expect(response.data.totalPointsExpired).toBe(80);
      expect(response.data.usersAffected).toBe(2);
    });
    
    it('should handle no expired batches', async () => {
      mockSupabase.queueResponse([]);
      
      const { req, res } = createMockReqRes();
      await promotionsController.expirePoints(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.batchesProcessed).toBe(0);
      expect(response.data.totalPointsExpired).toBe(0);
    });
    
    it('should count unique affected users', async () => {
      mockSupabase.queueResponse([
        { id: 'b1', user_id: UUID1, points_remaining: 25 },
        { id: 'b2', user_id: UUID1, points_remaining: 35 },
        { id: 'b3', user_id: UUID2, points_remaining: 40 }
      ]);
      // For batch 1
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse({ loyalty_points: '100' });
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse(null);
      // For batch 2
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse({ loyalty_points: '75' });
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse(null);
      // For batch 3
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse({ loyalty_points: '60' });
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse(null);
      
      const { req, res } = createMockReqRes();
      await promotionsController.expirePoints(req, res);
      
      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.usersAffected).toBe(2);
      expect(response.data.totalPointsExpired).toBe(100);
    });
    
    it('should not go below zero for user points', async () => {
      mockSupabase.queueResponse([
        { id: 'b1', user_id: UUID1, points_remaining: 150 }
      ]);
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse({ loyalty_points: '50' }); // user has less than batch
      mockSupabase.queueResponse(null);
      mockSupabase.queueResponse(null);
      
      const { req, res } = createMockReqRes();
      await promotionsController.expirePoints(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    
    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      
      const { req, res } = createMockReqRes();
      await promotionsController.expirePoints(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
