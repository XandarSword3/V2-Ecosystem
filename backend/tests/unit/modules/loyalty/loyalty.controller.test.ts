import { describe, it, expect, vi, beforeEach } from 'vitest';

// Proxy-based Supabase mock: every method call returns the proxy, awaiting resolves the next queued value
let resolveQueue: any[];
let mockChain: any;

function setupMock() {
  resolveQueue = [];
  const handler: ProxyHandler<any> = {
    get(_target, prop: string) {
      if (prop === 'then') {
        const val = resolveQueue.shift() || { data: null, error: null };
        return (resolve: any) => resolve(val);
      }
      // Any property access returns a callable that returns the proxy
      return (..._args: any[]) => mockChain;
    }
  };
  mockChain = new Proxy(function () {}, handler);
}

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => {
    return new Proxy({}, {
      get(_target, _prop: string) {
        return (..._args: any[]) => mockChain;
      }
    });
  },
}));

import { LoyaltyController } from '../../../../src/modules/loyalty/loyalty.controller.js';

function createReq(overrides: any = {}): any {
  return {
    params: {},
    body: {},
    query: {},
    user: { userId: 'user-123', id: 'user-123', email: 'test@test.com', roles: ['admin'] },
    ...overrides,
  };
}

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('LoyaltyController', () => {
  let controller: LoyaltyController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyController();
    setupMock();
  });

  // ── getAccount ──────────────────────────────────────────────

  describe('getAccount', () => {
    it('should return existing loyalty account', async () => {
      const acct = { id: 'acc-1', user_id: 'user-123', available_points: 500, tier: { name: 'Silver' } };
      resolveQueue = [{ data: acct, error: null }];
      const req = createReq({ params: { userId: 'user-123' } });
      const res = createRes();

      await controller.getAccount(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: acct });
    });

    it('should auto-create account with signup bonus when none exists', async () => {
      const newAcct = { id: 'acc-new', available_points: 100, tier: { name: 'Bronze' } };
      resolveQueue = [
        { data: null, error: { code: 'PGRST116' } }, // no existing acct → triggers create
        { data: { signup_bonus: 100 }, error: null },   // settings
        { data: { id: 'tier-1' }, error: null },          // default tier
        { data: newAcct, error: null },                    // insert returning
        { data: null, error: null },                       // transaction log
      ];
      const req = createReq({ params: { userId: 'user-new' } });
      const res = createRes();

      await controller.getAccount(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: newAcct });
    });

    it('should return 500 on unexpected database error', async () => {
      resolveQueue = [{ data: null, error: { code: 'DB_ERR', message: 'connection lost' } }];
      const req = createReq({ params: { userId: 'user-123' } });
      const res = createRes();

      await controller.getAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  // ── getMyAccount ────────────────────────────────────────────

  describe('getMyAccount', () => {
    it('should return 401 when user is not authenticated', async () => {
      const req = createReq({ user: undefined });
      const res = createRes();

      await controller.getMyAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should delegate to getAccount using JWT userId', async () => {
      resolveQueue = [{ data: { id: 'acc-1', available_points: 200 }, error: null }];
      const req = createReq();
      const res = createRes();

      await controller.getMyAccount(req, res);
      expect(req.params.userId).toBe('user-123');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── earnPoints ──────────────────────────────────────────────

  describe('earnPoints', () => {
    it('should reject invalid body (non-uuid, negative)', async () => {
      const req = createReq({ body: { userId: 'not-a-uuid', points: -5 } });
      const res = createRes();

      await controller.earnPoints(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'Validation failed' }));
    });

    it('should earn points with multiplier 1', async () => {
      resolveQueue = [
        { data: [{ success: true, points_earned: 50, tier_multiplier: '1', new_balance: 250 }], error: null },
      ];
      const req = createReq({
        body: { userId: '550e8400-e29b-41d4-a716-446655440000', points: 50, referenceType: 'order' },
      });
      const res = createRes();

      await controller.earnPoints(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ pointsEarned: 50, multiplier: 1, newBalance: 250 }),
      }));
    });
  });

  // ── redeemPoints ────────────────────────────────────────────

  describe('redeemPoints', () => {
    it('should reject invalid body', async () => {
      const req = createReq({ body: { userId: 'bad', points: 0 } });
      const res = createRes();
      await controller.redeemPoints(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject insufficient points', async () => {
      resolveQueue = [
        { data: { min_redemption: 10, redemption_rate: 0.01 }, error: null }, // settings
        { data: [{ success: false, error_message: 'Insufficient points', new_balance: 50 }], error: null }, // rpc
      ];
      const req = createReq({
        body: { userId: '550e8400-e29b-41d4-a716-446655440000', points: 1000 },
      });
      const res = createRes();
      await controller.redeemPoints(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'Insufficient points' }));
    });

    it('should redeem points and return dollar value', async () => {
      resolveQueue = [
        { data: { min_redemption: 100, redemption_rate: 0.01 }, error: null },   // settings
        { data: [{ success: true, points_redeemed: 200, new_balance: 300 }], error: null }, // rpc
      ];
      const req = createReq({
        body: { userId: '550e8400-e29b-41d4-a716-446655440000', points: 200 },
      });
      const res = createRes();
      await controller.redeemPoints(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { pointsRedeemed: 200, dollarValue: 2, newBalance: 300 },
      }));
    });
  });

  // ── adjustPoints ────────────────────────────────────────────

  describe('adjustPoints', () => {
    it('should reject body without reason', async () => {
      const req = createReq({
        body: { userId: '550e8400-e29b-41d4-a716-446655440000', points: 50 },
      });
      const res = createRes();
      await controller.adjustPoints(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should adjust points correctly (negative)', async () => {
      resolveQueue = [
        { data: [{ success: true, adjustment: -50, new_balance: 150, tier_name: 'Silver' }], error: null }, // rpc
      ];
      const req = createReq({
        body: { userId: '550e8400-e29b-41d4-a716-446655440000', points: -50, reason: 'Correction' },
      });
      const res = createRes();
      await controller.adjustPoints(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ adjustment: -50, newBalance: 150, reason: 'Correction' }),
      }));
    });

    it('should clamp balance to 0 for large negative adjustment', async () => {
      resolveQueue = [
        { data: [{ success: true, adjustment: -100, new_balance: 0, tier_name: 'Bronze' }], error: null }, // rpc
      ];
      const req = createReq({
        body: { userId: '550e8400-e29b-41d4-a716-446655440000', points: -100, reason: 'Penalty' },
      });
      const res = createRes();
      await controller.adjustPoints(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ newBalance: 0 }),
      }));
    });
  });

  // ── getTiers ────────────────────────────────────────────────

  describe('getTiers', () => {
    it('should return loyalty tiers', async () => {
      const tiers = [{ id: 't1', name: 'Bronze', min_points: 0 }, { id: 't2', name: 'Silver', min_points: 500 }];
      resolveQueue = [{ data: tiers, error: null }];
      const req = createReq();
      const res = createRes();
      await controller.getTiers(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: tiers });
    });

    it('should return 500 on error', async () => {
      resolveQueue = [{ data: null, error: { message: 'fail' } }];
      const req = createReq();
      const res = createRes();
      await controller.getTiers(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ── updateSettings ──────────────────────────────────────────

  describe('updateSettings', () => {
    it('should reject invalid settings values', async () => {
      const req = createReq({ body: { pointsPerDollar: -1 } });
      const res = createRes();
      await controller.updateSettings(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should update existing settings', async () => {
      resolveQueue = [
        { data: { id: 's-1' }, error: null },                           // existing check
        { data: { id: 's-1', points_per_dollar: 2 }, error: null },     // update returning
      ];
      const req = createReq({ body: { pointsPerDollar: 2, redemptionRate: 0.01, minRedemption: 100 } });
      const res = createRes();
      await controller.updateSettings(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── calculatePoints ─────────────────────────────────────────

  describe('calculatePoints', () => {
    it('should reject invalid amount', async () => {
      const req = createReq({ body: { amount: -5 } });
      const res = createRes();
      await controller.calculatePoints(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 0 when loyalty is disabled (settings not found)', async () => {
      resolveQueue = [{ data: null, error: { code: 'PGRST116' } }]; // no enabled settings row
      const req = createReq({ body: { amount: 50 } });
      const res = createRes();
      await controller.calculatePoints(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ pointsToEarn: 0, enabled: false }),
      }));
    });

    it('should calculate points from amount with multiplier', async () => {
      resolveQueue = [
        { data: { points_per_dollar: 10, redemption_rate: 0.01, is_enabled: true }, error: null }, // settings
        { data: { tier: { points_multiplier: 2 } }, error: null }, // account with tier
      ];
      const req = createReq({ body: { userId: '550e8400-e29b-41d4-a716-446655440000', amount: 50 } });
      const res = createRes();
      await controller.calculatePoints(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ pointsToEarn: 1000, multiplier: 2, enabled: true }),
      }));
    });
  });

  // ── getTransactions ─────────────────────────────────────────

  describe('getTransactions', () => {
    it('should return empty when no account found', async () => {
      resolveQueue = [{ data: null, error: null }]; // no account
      const req = createReq({ params: { userId: 'user-x' }, query: {} });
      const res = createRes();
      await controller.getTransactions(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: [],
        pagination: expect.objectContaining({ total: 0 }),
      }));
    });

    it('should return paginated transactions', async () => {
      const txns = [{ id: 'tx-1', type: 'earn', points: 100 }];
      resolveQueue = [
        { data: { id: 'acc-1' }, error: null },                       // account lookup
        { data: txns, count: 1, error: null },                        // transactions
      ];
      const req = createReq({ params: { userId: 'user-123' }, query: { page: '1', limit: '20' } });
      const res = createRes();
      await controller.getTransactions(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: txns,
        pagination: expect.objectContaining({ total: 1 }),
      }));
    });
  });
});
