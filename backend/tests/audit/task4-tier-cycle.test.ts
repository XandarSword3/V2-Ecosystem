import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { makePool, IDS } from './fixtures';
import type { Pool } from 'pg';

/**
 * Task 4 — tier change must preserve the subscription's billing cycle.
 *
 * Before the fix, `changeTier` called `getPriceId(newTier)` with the default
 * cycle ('monthly'), so an annual Pro -> Business change moved the tenant onto
 * the monthly Business Price: an immediate proration invoice plus a higher
 * recurring charge than the annual price the tenant had agreed to.
 *
 * Stripe is mocked (no network). `plans` and `audit_logs` are the real local
 * tables, so the proof covers price selection and the audit row.
 */

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  update: vi.fn(),
}));

vi.mock('stripe', () => {
  class FakeStripe {
    subscriptions = {
      retrieve: mocks.retrieve,
      update: mocks.update,
    };
  }
  return { default: FakeStripe };
});

import { SaasBillingService, resolveSubscriptionCycle } from '../../src/services/saas-billing.service.js';

// The Stripe client is mocked below; this key only satisfies the lazy-init
// guard. No network call can occur.
process.env.STRIPE_SECRET_KEY = 'sk_test_task4_offline';

const ANNUAL_TARGET = 'task4_annual_target';
const MONTHLY_TARGET = 'task4_monthly_target';
const ANNUAL_MONTHLY_PRICE = 'price_task4_annual_target_monthly';
const ANNUAL_ANNUAL_PRICE = 'price_task4_annual_target_annual';
const MONTHLY_MONTHLY_PRICE = 'price_task4_monthly_target_monthly';
const MONTHLY_ANNUAL_PRICE = 'price_task4_monthly_target_annual';

function subscription(interval: 'year' | 'month', metadataCycle: string) {
  return {
    id: 'sub_task4',
    metadata: {
      tenantId: IDS.tenantA,
      subdomain: 'audit-proof-a',
      tier: 'starter',
      billing_cycle: metadataCycle,
    },
    items: {
      data: [
        {
          id: 'si_task4',
          price: {
            id: `price_task4_current_${interval}`,
            recurring: { interval },
          },
        },
      ],
    },
    current_period_start: 1_700_000_000,
  };
}

describe('Task 4 — tier change preserves billing cycle', () => {
  let pool: Pool;
  const service = new SaasBillingService();

  async function cleanup() {
    await pool.query('DELETE FROM plans WHERE code = ANY($1::text[])', [[ANNUAL_TARGET, MONTHLY_TARGET]]);
    await pool.query("DELETE FROM audit_logs WHERE action = 'saas_subscription.tier_changed'");
  }

  beforeAll(async () => {
    pool = makePool();
    await cleanup();
    await pool.query(
      `INSERT INTO plans
         (code, name, description, price_monthly_cents, price_annual_cents,
          feature_limits, stripe_monthly_price_id, stripe_annual_price_id,
          is_active, sort_order)
       VALUES
         ($1, 'Task 4 Annual Target', 'audit', 1000, 10000, '{}'::jsonb, $2, $3, true, 90),
         ($4, 'Task 4 Monthly Target', 'audit', 2000, 20000, '{}'::jsonb, $5, $6, true, 91)`,
      [
        ANNUAL_TARGET, ANNUAL_MONTHLY_PRICE, ANNUAL_ANNUAL_PRICE,
        MONTHLY_TARGET, MONTHLY_MONTHLY_PRICE, MONTHLY_ANNUAL_PRICE,
      ],
    );
  });

  beforeEach(() => {
    mocks.retrieve.mockReset();
    mocks.update.mockReset();
    mocks.update.mockImplementation(async (_id: string, params: unknown) => ({
      ...(params as object),
      id: 'sub_task4',
      current_period_start: 1_700_000_000,
    }));
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  it('annual Pro -> Business selects the annual Business price and keeps annual metadata', async () => {
    mocks.retrieve.mockResolvedValue(subscription('year', 'annual'));

    const result = await service.changeTier('sub_task4', 'starter', ANNUAL_TARGET, {
      tenantId: IDS.tenantA,
      actorUserId: IDS.managerA,
      actor: 'platform_admin',
    });

    expect(result.billingCycle).toBe('annual');
    const [, params] = mocks.update.mock.calls[0] as [string, Record<string, unknown>];
    const items = params.items as Array<{ price: string }>;
    expect(items[0].price).toBe(ANNUAL_ANNUAL_PRICE);
    expect((params.metadata as Record<string, string>).billing_cycle).toBe('annual');
    expect((params.metadata as Record<string, string>).tier).toBe(ANNUAL_TARGET);

    const audit = await pool.query(
      `SELECT tenant_id, user_id, action, resource_id, old_value, new_value, details
         FROM audit_logs
        WHERE action = 'saas_subscription.tier_changed'
        ORDER BY created_at DESC
        LIMIT 1`,
    );
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0].tenant_id).toBe(IDS.tenantA);
    expect(audit.rows[0].user_id).toBe(IDS.managerA);
    expect(audit.rows[0].resource_id).toBe('sub_task4');
    expect(audit.rows[0].old_value).toMatchObject({ tier: 'starter', billing_cycle: 'annual' });
    expect(audit.rows[0].new_value).toMatchObject({ tier: ANNUAL_TARGET, billing_cycle: 'annual' });
    expect(audit.rows[0].details.newPriceId).toBe(ANNUAL_ANNUAL_PRICE);
  });

  it('monthly Pro -> Business stays monthly', async () => {
    mocks.retrieve.mockResolvedValue(subscription('month', 'monthly'));

    const result = await service.changeTier('sub_task4', 'starter', MONTHLY_TARGET, {
      tenantId: IDS.tenantA,
      actorUserId: IDS.managerA,
    });

    expect(result.billingCycle).toBe('monthly');
    const [, params] = mocks.update.mock.calls[0] as [string, Record<string, unknown>];
    expect((params.items as Array<{ price: string }>)[0].price).toBe(MONTHLY_MONTHLY_PRICE);
    expect((params.metadata as Record<string, string>).billing_cycle).toBe('monthly');
  });

  it('derives the cycle from the Stripe price interval even when metadata lies', async () => {
    expect(resolveSubscriptionCycle(subscription('year', 'monthly') as never)).toBe('annual');
    expect(resolveSubscriptionCycle(subscription('month', 'annual') as never)).toBe('monthly');

    mocks.retrieve.mockResolvedValue(subscription('year', 'monthly'));
    const result = await service.changeTier('sub_task4', 'starter', ANNUAL_TARGET);
    expect(result.billingCycle).toBe('annual');
  });
});
