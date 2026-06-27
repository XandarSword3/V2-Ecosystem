/// <reference types="vitest/globals" />

import { Request, Response } from 'express';

vi.mock('../../../src/database/connection.js', () => ({ getSupabase: vi.fn() }));
vi.mock('../../../src/utils/logger.js', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { promotionsController as ctrl } from '../../../src/modules/promotions/promotions.controller.js';
import { getSupabase } from '../../../src/database/connection.js';

const UUID1 = '00000000-0000-0000-0000-000000000001';
const UUID2 = '00000000-0000-0000-0000-000000000002';

function createMockReqRes(overrides: any = {}) {
  return {
    req: { params: {}, query: {}, body: {}, user: { userId: UUID1, role: 'admin' }, ...overrides },
    res: { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() } as any,
  };
}

function createChainableMock() {
  const responseQueue: Array<{ data: any; error: any }> = [];
  const mockRpc = vi.fn();
  const builder: any = {};
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'order', 'limit', 'single', 'maybeSingle', 'range', 'is', 'or', 'ilike', 'like', 'not', 'contains', 'textSearch'];
  for (const m of methods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = function (resolve: any) {
    const resp = responseQueue.shift() || { data: null, error: null };
    return resolve(resp);
  };
  mockRpc.mockImplementation(() => {
    const resp = responseQueue.shift() || { data: null, error: null };
    return Promise.resolve(resp);
  });
  const mock = {
    from: vi.fn().mockReturnValue(builder),
    rpc: mockRpc,
    builder,
    queueResponse(data: any, error: any = null) { responseQueue.push({ data, error }); },
  };
  vi.mocked(getSupabase).mockReturnValue(mock as any);
  return mock;
}

let mock: ReturnType<typeof createChainableMock>;
beforeEach(() => { vi.clearAllMocks(); mock = createChainableMock(); });

describe('Promotions Controller', () => {
  // ===== COUPONS =====
  describe('applyCoupon', () => {
    it('should apply coupon successfully', async () => {
      mock.queueResponse({ valid: true, discount: 15.00 }); // rpc
      mock.queueResponse({ code: 'SAVE15', discount_type: 'percentage', discount_value: 15 }); // coupon
      const mocks = createMockReqRes({ body: { couponCode: 'SAVE15', cartTotal: 100, userId: UUID1 } });
      await ctrl.applyCoupon(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      await ctrl.applyCoupon(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when coupon not valid', async () => {
      mock.queueResponse({ valid: false, reason: 'Coupon expired' });
      const mocks = createMockReqRes({ body: { couponCode: 'EXPIRED', cartTotal: 100, userId: UUID1 } });
      await ctrl.applyCoupon(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should handle rpc errors', async () => {
      mock.queueResponse(null, { message: 'rpc error' });
      const mocks = createMockReqRes({ body: { couponCode: 'SAVE15', cartTotal: 100, userId: UUID1 } });
      await ctrl.applyCoupon(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createCoupon', () => {
    const validBody = { code: 'NEWCODE', discountType: 'percentage' as const, discountValue: 10, startDate: '2024-01-01', endDate: '2024-12-31' };

    it('should create coupon successfully', async () => {
      mock.queueResponse(null, { code: 'PGRST116' }); // no existing
      mock.queueResponse({ id: 'c1', code: 'NEWCODE' }); // insert
      const mocks = createMockReqRes({ body: validBody });
      await ctrl.createCoupon(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for duplicate code', async () => {
      mock.queueResponse({ id: 'existing' });
      const mocks = createMockReqRes({ body: validBody });
      await ctrl.createCoupon(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      await ctrl.createCoupon(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should handle insert errors', async () => {
      mock.queueResponse(null, { code: 'PGRST116' }); // no duplicate
      mock.queueResponse(null, { message: 'insert error' }); // insert fails
      const mocks = createMockReqRes({ body: validBody });
      await ctrl.createCoupon(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAbuseReport', () => {
    it('should return abuse report', async () => {
      mock.queueResponse([{ user_id: UUID1 }]); // highUsage
      mock.queueResponse([{ id: UUID2, full_name: 'Fraud', email: 'f@f.com', fraud_flag: true, fraud_reason: 'sus' }]); // flaggedUsers
      mock.queueResponse([]); // rapidUsage
      const mocks = createMockReqRes();
      await ctrl.getAbuseReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should flag suspicious users with >10 usages', async () => {
      mock.queueResponse([]); mock.queueResponse([]); // highUsage + flaggedUsers
      const rapid = Array.from({ length: 11 }, (_, i) => ({ user_id: UUID1, created_at: '2024-01-01', coupon_id: `c${i}` }));
      mock.queueResponse(rapid);
      const mocks = createMockReqRes();
      await ctrl.getAbuseReport(mocks.req as Request, mocks.res as Response);
      const resp = mocks.res.json.mock.calls[0][0];
      expect(resp.data.suspiciousUsers).toHaveLength(1);
      expect(resp.data.suspiciousUsers[0].usageCount).toBe(11);
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes();
      await ctrl.getAbuseReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ===== GIFT CARDS =====
  describe('issueGiftCard', () => {
    it('should issue a gift card', async () => {
      mock.queueResponse({ id: 'gc1', code: 'GC-TEST', initial_balance: 100 }); // insert
      mock.queueResponse(null); // ledger insert
      const mocks = createMockReqRes({ body: { initialBalance: 100, purchasedBy: UUID1 } });
      await ctrl.issueGiftCard(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      await ctrl.issueGiftCard(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      mock.queueResponse(null, { message: 'insert error' });
      const mocks = createMockReqRes({ body: { initialBalance: 100, purchasedBy: UUID1 } });
      await ctrl.issueGiftCard(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('checkGiftCardBalance', () => {
    it('should return balance for valid card', async () => {
      mock.queueResponse({ code: 'GC-TEST', current_balance: 75, initial_balance: 100, expiry_date: '2099-12-31', is_active: true });
      const mocks = createMockReqRes({ params: { code: 'GC-TEST' } });
      await ctrl.checkGiftCardBalance(mocks.req as Request, mocks.res as Response);
      const resp = mocks.res.json.mock.calls[0][0];
      expect(resp.success).toBe(true);
      expect(resp.data.balance).toBe(75);
      expect(resp.data.isExpired).toBe(false);
    });

    it('should detect expired card', async () => {
      mock.queueResponse({ code: 'GC-OLD', current_balance: 50, initial_balance: 100, expiry_date: '2020-01-01', is_active: true });
      const mocks = createMockReqRes({ params: { code: 'GC-OLD' } });
      await ctrl.checkGiftCardBalance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json.mock.calls[0][0].data.isExpired).toBe(true);
    });

    it('should return 404 for missing card', async () => {
      mock.queueResponse(null, { code: 'PGRST116' });
      const mocks = createMockReqRes({ params: { code: 'NOPE' } });
      await ctrl.checkGiftCardBalance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes({ params: { code: 'GC-X' } });
      await ctrl.checkGiftCardBalance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('redeemGiftCard', () => {
    it('should redeem successfully', async () => {
      mock.queueResponse({ id: 'gc1', code: 'GC-TEST', current_balance: '100.00', is_active: true, expiry_date: '2099-12-31' });
      mock.queueResponse({ id: 'gc1', current_balance: '50.00' }); // update
      mock.queueResponse(null); // ledger
      const mocks = createMockReqRes({ body: { cardCode: 'GC-TEST', amount: 50 } });
      await ctrl.redeemGiftCard(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      await ctrl.redeemGiftCard(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for missing card', async () => {
      mock.queueResponse(null, { code: 'PGRST116' });
      const mocks = createMockReqRes({ body: { cardCode: 'NOPE', amount: 10 } });
      await ctrl.redeemGiftCard(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for deactivated card', async () => {
      mock.queueResponse({ id: 'gc1', current_balance: '100.00', is_active: false, expiry_date: '2099-12-31' });
      const mocks = createMockReqRes({ body: { cardCode: 'GC-X', amount: 10 } });
      await ctrl.redeemGiftCard(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for expired card', async () => {
      mock.queueResponse({ id: 'gc1', current_balance: '100.00', is_active: true, expiry_date: '2020-01-01' });
      const mocks = createMockReqRes({ body: { cardCode: 'GC-X', amount: 10 } });
      await ctrl.redeemGiftCard(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for insufficient balance', async () => {
      mock.queueResponse({ id: 'gc1', current_balance: '5.00', is_active: true, expiry_date: '2099-12-31' });
      const mocks = createMockReqRes({ body: { cardCode: 'GC-X', amount: 50 } });
      await ctrl.redeemGiftCard(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should handle update errors', async () => {
      mock.queueResponse({ id: 'gc1', current_balance: '100.00', is_active: true, expiry_date: '2099-12-31' });
      mock.queueResponse(null, { message: 'update fail' });
      const mocks = createMockReqRes({ body: { cardCode: 'GC-X', amount: 10 } });
      await ctrl.redeemGiftCard(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getGiftCardLiabilityReport', () => {
    it('should return liability report', async () => {
      mock.queueResponse([
        { id: 'gc1', current_balance: '100.00', expiry_date: '2099-12-31' },
        { id: 'gc2', current_balance: '50.00', expiry_date: '2020-01-01' },
      ]);
      mock.queueResponse([
        { transaction_type: 'issuance', amount: '100.00', created_at: '2024-06-15T00:00:00Z' },
        { transaction_type: 'redemption', amount: '-25.00', created_at: '2024-06-20T00:00:00Z' },
      ]);
      const mocks = createMockReqRes();
      await ctrl.getGiftCardLiabilityReport(mocks.req as Request, mocks.res as Response);
      const resp = mocks.res.json.mock.calls[0][0];
      expect(resp.success).toBe(true);
      expect(resp.data.totalCards).toBe(2);
    });

    it('should handle errors', async () => {
      mock.queueResponse(null, { message: 'query error' });
      const mocks = createMockReqRes();
      await ctrl.getGiftCardLiabilityReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ===== LOYALTY =====
  describe('awardPoints', () => {
    const validBody = { userId: UUID1, points: 100, source: 'purchase' as const };

    it('should award points successfully', async () => {
      mock.queueResponse({ id: 'b1', points_earned: 100 }); // batch insert
      mock.queueResponse([{ points_remaining: 200 }]); // batches for balance calculation
      mock.queueResponse(null); // transaction insert
      const mocks = createMockReqRes({ body: validBody });
      await ctrl.awardPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      await ctrl.awardPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      mock.queueResponse(null, { message: 'fail' });
      const mocks = createMockReqRes({ body: validBody });
      await ctrl.awardPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('redeemPoints', () => {
    const validBody = { userId: UUID1, points: 50, redemptionType: 'discount' as const };

    it('should redeem points successfully', async () => {
      mock.queueResponse({ id: UUID1 }); // user exists
      mock.queueResponse(null); // no fraud flag
      mock.queueResponse([{ points_remaining: 200 }]); // batches for balance
      mock.queueResponse([{ id: 'b1', points_remaining: 200, expires_at: '2099-12-31T00:00:00Z', created_at: '2024-01-01' }]); // batches for FIFO
      mock.queueResponse(null); // batch update
      mock.queueResponse(null); // transaction insert
      const mocks = createMockReqRes({ body: validBody });
      await ctrl.redeemPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      await ctrl.redeemPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for missing user', async () => {
      mock.queueResponse(null);
      const mocks = createMockReqRes({ body: validBody });
      await ctrl.redeemPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 for fraud-flagged user', async () => {
      mock.queueResponse({ id: UUID1 }); // user exists
      mock.queueResponse({ id: 'fraud-1' }); // fraud flag exists
      const mocks = createMockReqRes({ body: validBody });
      await ctrl.redeemPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 for insufficient points', async () => {
      mock.queueResponse({ id: UUID1 }); // user exists
      mock.queueResponse(null); // no fraud flag
      mock.queueResponse([{ points_remaining: 10 }]); // batches with 10 points
      const mocks = createMockReqRes({ body: validBody });
      await ctrl.redeemPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes({ body: validBody });
      await ctrl.redeemPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getUserLoyaltyStatus', () => {
    it('should return loyalty status', async () => {
      mock.queueResponse({ id: UUID1, full_name: 'Test' }); // user
      mock.queueResponse({ tier: { name: 'Gold' } }); // loyalty_members
      mock.queueResponse([{ id: 'b1', points_remaining: 100, expires_at: '2099-12-31T00:00:00Z' }]); // batches
      mock.queueResponse([{ id: 'tx1', transaction_type: 'earn', points: 100, created_at: '2024-01-01' }]); // txns
      const mocks = createMockReqRes({ params: { userId: UUID1 } });
      await ctrl.getUserLoyaltyStatus(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 for missing user', async () => {
      mock.queueResponse(null, { code: 'PGRST116' });
      const mocks = createMockReqRes({ params: { userId: UUID1 } });
      await ctrl.getUserLoyaltyStatus(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes({ params: { userId: UUID1 } });
      await ctrl.getUserLoyaltyStatus(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('flagUserFraud', () => {
    it('should flag user for fraud', async () => {
      mock.queueResponse(null); // user update
      mock.queueResponse(null); // fraud_flags insert
      const mocks = createMockReqRes({ params: { userId: UUID2 }, body: { reason: 'Suspicious activity' } });
      await ctrl.flagUserFraud(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes({ params: { userId: UUID2 }, body: { reason: 'test' } });
      await ctrl.flagUserFraud(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('expirePoints', () => {
    it('should expire old points', async () => {
      mock.queueResponse([
        { id: 'b1', user_id: UUID1, points_remaining: 50 },
        { id: 'b2', user_id: UUID2, points_remaining: 30 },
      ]); // expired batches
      mock.queueResponse(null); // batch 1 update
      mock.queueResponse({ loyalty_points: '100' }); // user 1 select
      mock.queueResponse(null); // user 1 update
      mock.queueResponse(null); // transaction 1 insert
      mock.queueResponse(null); // batch 2 update
      mock.queueResponse({ loyalty_points: '80' }); // user 2 select
      mock.queueResponse(null); // user 2 update
      mock.queueResponse(null); // transaction 2 insert
      const mocks = createMockReqRes();
      await ctrl.expirePoints(mocks.req as Request, mocks.res as Response);
      const resp = mocks.res.json.mock.calls[0][0];
      expect(resp.success).toBe(true);
      expect(resp.data.batchesProcessed).toBe(2);
      expect(resp.data.totalPointsExpired).toBe(80);
      expect(resp.data.usersAffected).toBe(2);
    });

    it('should handle no expired batches', async () => {
      mock.queueResponse([]);
      const mocks = createMockReqRes();
      await ctrl.expirePoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json.mock.calls[0][0].data.batchesProcessed).toBe(0);
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes();
      await ctrl.expirePoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });
});
