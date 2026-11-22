import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { IDS } from './fixtures';

/**
 * Task 5 — redemption concurrency.
 *
 * These tests call the database functions directly with 20 parallel
 * connections. That is deliberate: the controller has a process-local mutex,
 * but correctness must not depend on it. A second backend instance, or the
 * pricing resolver (which never takes the mutex), can redeem the same card or
 * points concurrently.
 *
 * The migration `20261119110000_redemption_functions_tenant_scope.sql` is part
 * of the fix: the functions' row locks were always right, but their ledger
 * inserts omitted the NOT NULL tenant_id/property_id, so every redemption
 * aborted (23502) and rolled back.
 */

const PARALLEL = 20;

const GIFT_CODE = 'TASK5-GIFT-CONC';
const GIFT_ID = 'f5000000-0000-4000-8000-0000000000a1';
const COUPON_CODE = 'TASK5COUPON';
const COUPON_ID = 'f5000000-0000-4000-8000-0000000000b2';
const LOYALTY_ID = 'f5000000-0000-4000-8000-0000000000c3';

type Outcome<T> = { ok: true; rows: T[] } | { ok: false; error: string };

async function settle<T>(promises: Promise<T>[]): Promise<Outcome<T>[]> {
  return Promise.all(
    promises.map(async (promise) => {
      try {
        return { ok: true as const, rows: [await promise] };
      } catch (error) {
        return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
}

describe('Task 5 — parallel redemptions cannot overspend', () => {
  let pool: Pool;

  async function cleanup() {
    await pool.query('DELETE FROM gift_card_transactions WHERE gift_card_id = $1', [GIFT_ID]);
    await pool.query('DELETE FROM gift_cards WHERE id = $1 OR code = $2', [GIFT_ID, GIFT_CODE]);
    await pool.query('DELETE FROM coupon_usage WHERE coupon_id = $1', [COUPON_ID]);
    await pool.query('DELETE FROM coupons WHERE id = $1 OR code = $2', [COUPON_ID, COUPON_CODE]);
    await pool.query('DELETE FROM loyalty_transactions WHERE member_id = $1', [LOYALTY_ID]);
    await pool.query('DELETE FROM loyalty_members WHERE id = $1', [LOYALTY_ID]);
  }

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL missing (expected local .env.test)');
    if (!/127\.0\.0\.1|localhost/.test(connectionString)) {
      throw new Error(`Refusing non-local DATABASE_URL: ${connectionString}`);
    }
    // max >= PARALLEL so all requests are genuinely in flight together.
    pool = new Pool({ connectionString, max: PARALLEL + 5, connectionTimeoutMillis: 5000, ssl: false });
    await cleanup();

    await pool.query(
      `INSERT INTO gift_cards
         (id, code, initial_value, current_balance, status, tenant_id, property_id)
       VALUES ($1, $2, 100, 100, 'active', $3, $4)`,
      [GIFT_ID, GIFT_CODE, IDS.tenantA, IDS.propertyA],
    );

    await pool.query(
      `INSERT INTO coupons
         (id, code, name, discount_type, discount_value, usage_limit, usage_count,
          per_user_limit, is_active, applies_to, tenant_id, property_id)
       VALUES ($1, $2, 'Task 5 coupon', 'fixed_amount', 10, 5, 0, NULL, true, 'all', $3, $4)`,
      [COUPON_ID, COUPON_CODE, IDS.tenantA, IDS.propertyA],
    );

    await pool.query(
      `INSERT INTO loyalty_members
         (id, user_id, property_id, tenant_id, total_points, available_points, lifetime_points)
       VALUES ($1, $2, $3, $4, 100, 100, 100)`,
      [LOYALTY_ID, IDS.customerA, IDS.propertyA, IDS.tenantA],
    );
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  it('20 parallel gift-card redemptions of $20 against $100 redeem exactly $100', async () => {
    const outcomes = await settle(
      Array.from({ length: PARALLEL }, () =>
        pool
          .query<{ success: boolean; amount_redeemed: string; new_balance: string; gift_card_id: string }>(
            'SELECT * FROM redeem_giftcard_atomic($1, $2, $3)',
            [GIFT_CODE, 20, null],
          )
          .then((r) => r.rows[0]),
      ),
    );

    const errors = outcomes.filter((o) => !o.ok).map((o) => (o as { error: string }).error);
    const rows = outcomes.flatMap((o) => (o.ok ? o.rows : []));
    const successes = rows.filter((r) => r.success);
    const totalRedeemed = successes.reduce((sum, r) => sum + Number(r.amount_redeemed), 0);

    const card = await pool.query('SELECT current_balance, status FROM gift_cards WHERE id = $1', [GIFT_ID]);
    const tx = await pool.query('SELECT COUNT(*)::int AS n FROM gift_card_transactions WHERE gift_card_id = $1', [GIFT_ID]);

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      case: 'gift-card-parallel',
      successes: successes.length,
      totalRedeemed,
      balance: card.rows[0].current_balance,
      status: card.rows[0].status,
      ledgerRows: tx.rows[0].n,
      errors: errors.slice(0, 3),
    }));

    expect(errors).toEqual([]);
    expect(successes.length).toBe(5);
    expect(totalRedeemed).toBe(100);
    expect(Number(card.rows[0].current_balance)).toBe(0);
    expect(card.rows[0].status).toBe('redeemed');
    expect(tx.rows[0].n).toBe(5);
    for (const row of successes) expect(Number(row.new_balance)).toBeGreaterThanOrEqual(0);
  });

  it('20 parallel coupon applications against usage_limit=5 yield exactly 5 successes', async () => {
    const outcomes = await settle(
      Array.from({ length: PARALLEL }, () =>
        pool
          .query<{ success: boolean; discount_amount: string; coupon_id: string }>(
            'SELECT * FROM apply_coupon_atomic($1, $2, $3, $4, $5)',
            [COUPON_CODE, IDS.customerA, 100, null, 'all'],
          )
          .then((r) => r.rows[0]),
      ),
    );

    const errors = outcomes.filter((o) => !o.ok).map((o) => (o as { error: string }).error);
    const rows = outcomes.flatMap((o) => (o.ok ? o.rows : []));
    const successes = rows.filter((r) => r.success);

    const coupon = await pool.query('SELECT usage_count FROM coupons WHERE id = $1', [COUPON_ID]);
    const usage = await pool.query('SELECT COUNT(*)::int AS n FROM coupon_usage WHERE coupon_id = $1', [COUPON_ID]);

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      case: 'coupon-parallel',
      successes: successes.length,
      usageCount: coupon.rows[0].usage_count,
      usageRows: usage.rows[0].n,
      errors: errors.slice(0, 3),
    }));

    expect(errors).toEqual([]);
    expect(successes.length).toBe(5);
    expect(coupon.rows[0].usage_count).toBe(5);
    expect(usage.rows[0].n).toBe(5);
  });

  it('20 parallel loyalty redemptions of 10 points against 100 redeem exactly 100', async () => {
    const outcomes = await settle(
      Array.from({ length: PARALLEL }, () =>
        pool
          .query<{ success: boolean; points_redeemed: number; new_balance: number; member_id: string }>(
            'SELECT * FROM redeem_loyalty_points_atomic($1, $2, $3, $4)',
            [IDS.customerA, 10, null, 1],
          )
          .then((r) => r.rows[0]),
      ),
    );

    const errors = outcomes.filter((o) => !o.ok).map((o) => (o as { error: string }).error);
    const rows = outcomes.flatMap((o) => (o.ok ? o.rows : []));
    const successes = rows.filter((r) => r.success);
    const totalPoints = successes.reduce((sum, r) => sum + Number(r.points_redeemed), 0);

    const member = await pool.query('SELECT available_points FROM loyalty_members WHERE id = $1', [LOYALTY_ID]);
    const tx = await pool.query(
      `SELECT COUNT(*)::int AS n, MIN(tenant_id::text) AS tenant_id, MIN(property_id::text) AS property_id
         FROM loyalty_transactions WHERE member_id = $1`,
      [LOYALTY_ID],
    );

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      case: 'loyalty-parallel',
      successes: successes.length,
      totalPoints,
      balance: member.rows[0].available_points,
      ledgerRows: tx.rows[0].n,
      ledgerTenant: tx.rows[0].tenant_id,
      ledgerProperty: tx.rows[0].property_id,
      errors: errors.slice(0, 3),
    }));

    expect(errors).toEqual([]);
    expect(successes.length).toBe(10);
    expect(totalPoints).toBe(100);
    expect(member.rows[0].available_points).toBe(0);
    expect(tx.rows[0].n).toBe(10);
    expect(tx.rows[0].tenant_id).toBe(IDS.tenantA);
    expect(tx.rows[0].property_id).toBe(IDS.propertyA);
    for (const row of successes) expect(Number(row.new_balance)).toBeGreaterThanOrEqual(0);
  });
});
