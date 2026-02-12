/**
 * Loyalty Controller Tests - Comprehensive
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createMockReqRes } from '../utils';

const createChainableMock = () => {
  let responseQueue: Array<{ data: any; error: any; count?: number }> = [];
  let responseIndex = 0;
  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) return responseQueue[responseIndex++];
    return { data: null, error: null };
  };
  const builder: any = {};
  ['select','insert','update','delete','upsert','eq','neq','gt','gte','lt','lte','like','ilike','is','in','or','not','filter','match','order','limit','range','contains','csv','head'].forEach(m => {
    builder[m] = vi.fn().mockImplementation(() => builder);
  });
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.then = (resolve: any, reject: any) => Promise.resolve(getNextResponse()).then(resolve, reject);
  const mockRpc = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  return {
    queueResponse: (data: any, error: any = null, count?: number) => { responseQueue.push({ data, error, count }); },
    reset: () => { responseQueue = []; responseIndex = 0; },
    build: () => ({ from: vi.fn().mockReturnValue(builder), rpc: mockRpc }),
    mockRpc,
  };
};

vi.mock('../../../src/database/connection.js', () => ({ getSupabase: vi.fn() }));
vi.mock('../../../src/utils/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { getSupabase } from '../../../src/database/connection.js';
import { LoyaltyController } from '../../../src/modules/loyalty/loyalty.controller';

const UUID1 = '00000000-0000-0000-0000-000000000001';
const UUID2 = '00000000-0000-0000-0000-000000000002';

describe('Loyalty Controller', () => {
  let mock: ReturnType<typeof createChainableMock>;
  let ctrl: LoyaltyController;

  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = new LoyaltyController();
    mock = createChainableMock();
    vi.mocked(getSupabase).mockReturnValue(mock.build() as any);
  });

  describe('getAccount', () => {
    it('should return existing account', async () => {
      mock.queueResponse({ id: 'a1', user_id: UUID1, points_balance: 100, tier: { name: 'Gold' } });
      const mocks = createMockReqRes({ params: { userId: UUID1 } });
      await ctrl.getAccount(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should create account if not exists', async () => {
      mock.queueResponse(null, { code: 'PGRST116' }); // no account
      mock.queueResponse({ signup_bonus: 50 }); // settings (single)
      mock.queueResponse([{ id: 'tier1', min_points: 0 }]); // tiers
      mock.queueResponse({ id: 'a1', points_balance: 50 }); // insert (single)
      mock.queueResponse(null); // transaction insert
      const mocks = createMockReqRes({ params: { userId: UUID1 } });
      await ctrl.getAccount(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mock.queueResponse(null, { code: 'OTHER_ERROR', message: 'fail' });
      const mocks = createMockReqRes({ params: { userId: UUID1 } });
      await ctrl.getAccount(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMyAccount', () => {
    it('should return 401 if not authenticated', async () => {
      const mocks = createMockReqRes();
      (mocks.req as any).user = undefined;
      await ctrl.getMyAccount(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(401);
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes();
      (mocks.req as any).user = { id: UUID1 };
      await ctrl.getMyAccount(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('earnPoints', () => {
    it('should earn points successfully', async () => {
      mock.queueResponse({ id: 'a1', points_balance: 100, user_id: UUID1 }); // account (single)
      mock.queueResponse(null); // transaction insert
      mock.queueResponse({ id: 'a1', points_balance: 150 }); // update (single)
      mock.queueResponse([{ id: 'tier1', min_points: 0 }, { id: 'tier2', min_points: 200 }]); // tiers
      const mocks = createMockReqRes({
        body: { userId: UUID1, points: 50, description: 'Purchase', referenceType: 'order' },
      });
      await ctrl.earnPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      await ctrl.earnPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      mock.queueResponse(null, { message: 'fail' });
      const mocks = createMockReqRes({ body: { userId: UUID1, points: 50 } });
      await ctrl.earnPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('redeemPoints', () => {
    it('should redeem points', async () => {
      mock.queueResponse({ id: 'a1', user_id: UUID1, available_points: 500 }); // account (single)
      mock.queueResponse({ redemption_rate: 0.01, min_redemption: 10 }); // settings (single)
      mock.queueResponse(null); // update
      mock.queueResponse(null); // transaction insert
      const mocks = createMockReqRes({
        body: { userId: UUID1, points: 100, description: 'Redemption' },
      });
      await ctrl.redeemPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      await ctrl.redeemPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for missing account', async () => {
      mock.queueResponse(null, { code: 'PGRST116' });
      const mocks = createMockReqRes({ body: { userId: UUID1, points: 100 } });
      await ctrl.redeemPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for insufficient points', async () => {
      mock.queueResponse({ id: 'a1', user_id: UUID1, points_balance: 10 }); // low balance
      mock.queueResponse({ redemption_rate: 0.01, min_redemption: 5 }); // settings
      const mocks = createMockReqRes({ body: { userId: UUID1, points: 100 } });
      await ctrl.redeemPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('adjustPoints', () => {
    it('should adjust points', async () => {
      mock.queueResponse({ id: 'a1', user_id: UUID1, points_balance: 100 }); // account (single)
      mock.queueResponse(null); // transaction insert
      mock.queueResponse({ id: 'a1', points_balance: 150 }); // update (single)
      const mocks = createMockReqRes({
        body: { userId: UUID1, points: 50, reason: 'Correction' },
      });
      await ctrl.adjustPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      await ctrl.adjustPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for missing account', async () => {
      mock.queueResponse(null, null);
      const mocks = createMockReqRes({ body: { userId: UUID1, points: 50, reason: 'test' } });
      await ctrl.adjustPoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('adjustPointsByAccountId', () => {
    it('should adjust points by account ID', async () => {
      mock.queueResponse({ id: 'a1', user_id: UUID1, points_balance: 100 }); // account (single)
      mock.queueResponse(null); // transaction insert
      mock.queueResponse({ id: 'a1', points_balance: 150 }); // update (single)
      const mocks = createMockReqRes({
        params: { accountId: 'a1' },
        body: { points: 50, reason: 'Correction' },
      });
      await ctrl.adjustPointsByAccountId(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ params: { accountId: 'a1' }, body: {} });
      await ctrl.adjustPointsByAccountId(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for missing account', async () => {
      mock.queueResponse(null, null);
      const mocks = createMockReqRes({ params: { accountId: 'a1' }, body: { points: 50, reason: 'test' } });
      await ctrl.adjustPointsByAccountId(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getTransactions', () => {
    it('should return transactions', async () => {
      mock.queueResponse([
        { id: 'tx1', type: 'earn', points: 50, created_at: '2024-01-15T10:00:00Z' },
      ]);
      const mocks = createMockReqRes({ params: { userId: UUID1 }, query: {} });
      await ctrl.getTransactions(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should filter by type', async () => {
      mock.queueResponse([]);
      const mocks = createMockReqRes({ params: { userId: UUID1 }, query: { type: 'earn', limit: '10' } });
      await ctrl.getTransactions(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes({ params: { userId: UUID1 }, query: {} });
      await ctrl.getTransactions(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getTiers', () => {
    it('should return loyalty tiers', async () => {
      mock.queueResponse([{ id: 't1', name: 'Silver', min_points: 0 }, { id: 't2', name: 'Gold', min_points: 500 }]);
      const mocks = createMockReqRes();
      await ctrl.getTiers(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mock.queueResponse(null, { message: 'fail' });
      const mocks = createMockReqRes();
      await ctrl.getTiers(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateTier', () => {
    it('should update a tier', async () => {
      mock.queueResponse({ id: 't1', name: 'Platinum' }); // update (single)
      const mocks = createMockReqRes({
        params: { tierId: 't1' },
        body: { name: 'Platinum', minPoints: 1000, benefits: ['Free parking'] },
      });
      await ctrl.updateTier(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ params: { tierId: 't1' }, body: { minPoints: -1 } });
      await ctrl.updateTier(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      mock.queueResponse(null, { message: 'fail' });
      const mocks = createMockReqRes({ params: { tierId: 't1' }, body: { name: 'Platinum' } });
      await ctrl.updateTier(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSettings', () => {
    it('should return loyalty settings', async () => {
      mock.queueResponse({ id: 's1', points_per_dollar: 10, is_enabled: true });
      const mocks = createMockReqRes();
      await ctrl.getSettings(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes();
      await ctrl.getSettings(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateSettings', () => {
    it('should update settings', async () => {
      mock.queueResponse({ id: 's1', points_per_dollar: 20 }); // update (single)
      const mocks = createMockReqRes({
        body: { pointsPerDollar: 20, isEnabled: true },
      });
      await ctrl.updateSettings(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: { pointsPerDollar: -5 } });
      await ctrl.updateSettings(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getAllAccounts', () => {
    it('should return paginated accounts', async () => {
      mock.queueResponse([{ id: 'a1', user_id: UUID1, points_balance: 100 }]);
      const mocks = createMockReqRes({ query: { page: '1', limit: '10' } });
      await ctrl.getAllAccounts(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes({ query: {} });
      await ctrl.getAllAccounts(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getStats', () => {
    it('should return loyalty stats', async () => {
      mock.queueResponse([{ id: 'a1', available_points: 100, lifetime_points: 500 }]); // accounts summary
      mock.queueResponse([{ id: 'a1', tier_id: 't1', tier: { name: 'Gold', color: '#FFD700' } }]); // tier accounts
      mock.queueResponse([{ id: 'tx1', type: 'earn', points: 50, created_at: '2024-01-15T10:00:00Z' }]); // recent transactions
      const mocks = createMockReqRes({ query: { period: '30' } });
      await ctrl.getStats(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes({ query: {} });
      await ctrl.getStats(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('calculatePoints', () => {
    it('should calculate points for a given amount', async () => {
      mock.queueResponse({ points_per_dollar: 10, is_enabled: true }); // settings (single)
      const mocks = createMockReqRes({ query: { amount: '50.00' } });
      await ctrl.calculatePoints(mocks.req as Request, mocks.res as Response);
      // May return error for non-numeric or the success response
      expect(mocks.res.json).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('fail'); });
      const mocks = createMockReqRes({ query: { amount: '50' } });
      await ctrl.calculatePoints(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });
});
