/**
 * Discount Reversal & Linking unit tests
 *
 * discount-reversal.ts closes two gaps left by the pricing pipeline:
 *   1. linkDiscountsToOrder — backfil order_id onto the orphaned
 *      coupon_usage / gift_card_transactions row created pre-entity.
 *   2. reverseDiscounts — give back consumed usage/balance when entity
 *      creation fails or the order is later cancelled/refunded.
 *
 * Both are non-fatal BY DESIGN (a reversal failure must not block caller
 * error handling) — the tests below prove both the happy paths (exact RPC
 * params) and the swallow-don't-throw behavior.
 */

import { createScriptedSupabase } from '../helpers/scripted-supabase';

const db = createScriptedSupabase();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => db,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  linkDiscountsToOrder,
  reverseDiscounts,
} from '../../../src/engines/discount-reversal.js';
import { logger } from '../../../src/utils/logger.js';

function coupon(overrides: Record<string, unknown> = {}) {
  return {
    type: 'coupon',
    referenceId: 'coupon-1',
    label: 'SUMMER10',
    amount: 10,
    taxSavings: 1.1,
    ...overrides,
  } as any;
}

function giftCard(overrides: Record<string, unknown> = {}) {
  return {
    type: 'gift_card',
    referenceId: 'gc-1',
    label: 'GC-1234',
    amount: 25,
    taxSavings: 0,
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
});

describe('linkDiscountsToOrder', () => {
  it('backfills order_id on the most recent unlinked coupon_usage row for the user', async () => {
    db.queue('coupon_usage:select', { data: { id: 'usage-row-42' }, error: null });

    await linkDiscountsToOrder(db as any, [coupon()], 'order-1', 'user-7');

    const selectCall = db.calls.find((c) => c.table === 'coupon_usage' && c.op === 'select');
    expect(selectCall).toBeTruthy();

    // Matching filters: same coupon, unlinked (order_id null), scoped to user
    const filters = db.calls.filter((c) => c.table === 'coupon_usage');
    expect(filters.some((c) => c.op === 'eq' && JSON.stringify(c.args) === '["coupon_id","coupon-1"]')).toBe(true);
    expect(filters.some((c) => c.op === 'is' && JSON.stringify(c.args) === '["order_id",null]')).toBe(true);
    expect(filters.some((c) => c.op === 'eq' && JSON.stringify(c.args) === '["user_id","user-7"]')).toBe(true);

    const updateCall = db.calls.find((c) => c.table === 'coupon_usage' && c.op === 'update')!;
    expect(updateCall.payload).toEqual({ order_id: 'order-1' });
    // The eq that scopes the UPDATE is the LAST eq on this table (the lookup's
    // eq('coupon_id', …) comes first)
    const eqCalls = db.calls.filter((c) => c.table === 'coupon_usage' && c.op === 'eq');
    expect(eqCalls[eqCalls.length - 1].args).toEqual(['id', 'usage-row-42']);
  });

  it('matches anonymous (user_id null) usage rows when no user is known', async () => {
    db.queue('coupon_usage:select', { data: { id: 'usage-anon' }, error: null });

    await linkDiscountsToOrder(db as any, [coupon()], 'order-1');

    const filters = db.calls.filter((c) => c.table === 'coupon_usage');
    expect(filters.some((c) => c.op === 'is' && JSON.stringify(c.args) === '["user_id",null]')).toBe(true);
    const updateCall = db.calls.find((c) => c.table === 'coupon_usage' && c.op === 'update')!;
    expect(updateCall.payload).toEqual({ order_id: 'order-1' });
  });

  it('backfills gift_card_transactions when the discount is a gift card', async () => {
    db.queue('gift_card_transactions:select', { data: { id: 'tx-9' }, error: null });

    await linkDiscountsToOrder(db as any, [giftCard()], 'order-2');

    const updateCall = db.calls.find((c) => c.table === 'gift_card_transactions' && c.op === 'update')!;
    expect(updateCall.payload).toEqual({ order_id: 'order-2' });
    const eqCalls = db.calls.filter((c) => c.table === 'gift_card_transactions' && c.op === 'eq');
    expect(eqCalls[eqCalls.length - 1].args).toEqual(['id', 'tx-9']);
  });

  it('does nothing for discounts without a referenceId', async () => {
    await linkDiscountsToOrder(db as any, [coupon({ referenceId: undefined })], 'order-1');
    expect(db.calls).toEqual([]);
  });

  it('does nothing for loyalty/promotion types (no linking contract exists)', async () => {
    await linkDiscountsToOrder(db as any, [
      { type: 'loyalty', referenceId: 'cust-1', label: 'Loyalty', amount: 5, taxSavings: 0 },
      { type: 'promotion', referenceId: 'promo-1', label: 'Promo', amount: 5, taxSavings: 0 },
    ] as any, 'order-1');
    expect(db.calls).toEqual([]);
  });

  it('a lookup failure is swallowed (non-fatal by design) and processing continues', async () => {
    // queue an error result for the coupon lookup
    db.queue('coupon_usage:select', { data: null, error: { message: 'rls' } });
    db.queue('gift_card_transactions:select', { data: { id: 'tx-9' }, error: null });

    await expect(
      linkDiscountsToOrder(db as any, [coupon(), giftCard()], 'order-1'),
    ).resolves.toBeUndefined();

    // Second discount was STILL processed despite the first failing
    expect(db.calls.some((c) => c.table === 'gift_card_transactions' && c.op === 'update')).toBe(true);
  });

  it('no unlinked row found → no update issued, no throw', async () => {
    db.queue('coupon_usage:select', { data: null, error: null });

    await expect(linkDiscountsToOrder(db as any, [coupon()], 'order-1')).resolves.toBeUndefined();
    expect(db.calls.some((c) => c.table === 'coupon_usage' && c.op === 'update')).toBe(false);
  });
});

describe('reverseDiscounts', () => {
  it('reverses coupon usage via reverse_coupon_usage with provided user and order', async () => {
    await reverseDiscounts(db as any, [coupon()], { userId: 'user-7', orderId: 'order-1' });

    expect(db.calls).toEqual([
      expect.objectContaining({ table: 'rpc:reverse_coupon_usage', op: 'call' }),
    ]);
    const rpcCall = db.calls[0];
    expect(rpcCall.args![0]).toEqual({
      p_coupon_id: 'coupon-1',
      p_user_id: 'user-7',
      p_order_id: 'order-1',
    });
    expect(logger.info).toHaveBeenCalled();
  });

  it('passes nulls (fallback matching) when order and user are unknown (creation-failure case)', async () => {
    await reverseDiscounts(db as any, [coupon()], {});

    const rpcCall = db.calls.find((c) => c.table === 'rpc:reverse_coupon_usage')!;
    expect(rpcCall.args![0]).toEqual({
      p_coupon_id: 'coupon-1',
      p_user_id: null,
      p_order_id: null,
    });
  });

  it('restores gift card balance via restore_gift_card_balance with the consumed amount', async () => {
    await reverseDiscounts(db as any, [giftCard()], { orderId: 'order-3' });

    const rpcCall = db.calls.find((c) => c.table === 'rpc:restore_gift_card_balance')!;
    expect(rpcCall.args![0]).toEqual({
      p_gift_card_id: 'gc-1',
      p_amount: 25,
      p_order_id: 'order-3',
    });
  });

  it('restores the gift card even when the breakdown amount is 0', async () => {
    await reverseDiscounts(db as any, [giftCard({ amount: 0 })], {});

    const rpcCall = db.calls.find((c) => c.table === 'rpc:restore_gift_card_balance')!;
    expect(rpcCall.args![0]).toEqual({ p_gift_card_id: 'gc-1', p_amount: 0, p_order_id: null });
  });

  it('reverses loyalty points using metadata.pointsUsed and the owning tenant', async () => {
    db.queue('rpc:reverse_loyalty_redemption', { data: true, error: null });

    await reverseDiscounts(db as any, [
      {
        type: 'loyalty',
        referenceId: 'cust-1',
        label: 'Loyalty',
        amount: 100,
        taxSavings: 0,
        metadata: { pointsUsed: 500 },
      },
    ] as any, { orderId: 'o-1', tenantId: 'tenant-1' });

    const rpcCall = db.calls.find((c) => c.table === 'rpc:reverse_loyalty_redemption')!;
    expect(rpcCall.args![0]).toEqual({
      p_user_id: 'cust-1',
      p_points: 500,
      p_order_id: 'o-1',
      p_tenant_id: 'tenant-1',
    });
    expect(logger.info).toHaveBeenCalledWith(
      '[DISCOUNT REVERSAL] Restored loyalty points',
      expect.objectContaining({ customerId: 'cust-1', pointsUsed: 500, orderId: 'o-1' }),
    );
  });

  it('refuses to reverse loyalty without a tenant (points NOT restored)', async () => {
    await reverseDiscounts(db as any, [
      {
        type: 'loyalty',
        referenceId: 'cust-1',
        label: 'Loyalty',
        amount: 100,
        taxSavings: 0,
        metadata: { pointsUsed: 500 },
      },
    ] as any, { orderId: 'o-1' });

    expect(db.calls.find((c) => c.table === 'rpc:reverse_loyalty_redemption')).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      '[DISCOUNT REVERSAL] Cannot reverse loyalty redemption without a tenant — points NOT restored',
      expect.objectContaining({ customerId: 'cust-1', pointsUsed: 500, orderId: 'o-1' }),
    );
  });

  it('an RPC failure does NOT throw — caller error handling must not be blocked', async () => {
    db.queue('rpc:reverse_coupon_usage', { data: null, error: { message: 'deadlock' } });

    await expect(reverseDiscounts(db as any, [coupon()], {})).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      '[DISCOUNT REVERSAL] Failed to reverse discount — usage/balance NOT restored',
      expect.objectContaining({ type: 'coupon', referenceId: 'coupon-1' }),
    );
    // The next discount in the list was still attempted
    db.queue('rpc:restore_gift_card_balance', { data: null, error: null });
    // (covered by list-processing assertion below)
  });

  it('processes the whole list even when an early reversal fails', async () => {
    db.queue('rpc:reverse_coupon_usage', { data: null, error: { message: 'deadlock' } });
    db.queue('rpc:restore_gift_card_balance', { data: null, error: null });

    await reverseDiscounts(db as any, [coupon(), giftCard()], {});

    expect(db.calls.some((c) => c.table === 'rpc:restore_gift_card_balance')).toBe(true);
  });

  it('discounts without a referenceId are skipped', async () => {
    await reverseDiscounts(db as any, [coupon({ referenceId: undefined })], {});
    expect(db.calls).toEqual([]);
  });
});
