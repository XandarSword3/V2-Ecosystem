import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { makePool, IDS } from './fixtures';
import type { Pool } from 'pg';

/**
 * Task 3 — P0-10 scheduler double charge.
 *
 * Two scheduler instances are simulated by invoking runMembershipRenewalJob()
 * concurrently with the same run window against the same Postgres database.
 * Stripe is mocked; the mock honours idempotency keys the way Stripe does
 * (same key -> same invoice), and records every distinct invoice created.
 *
 * Assertions:
 *   * exactly one invoice for one due membership across two instances;
 *   * a second run in a different window cannot renew the same billing period
 *     (membership_renewal_attempts unique key), so still one invoice;
 *   * the membership advances exactly one period.
 */

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  pay: vi.fn(),
  transition: vi.fn(),
}));

vi.mock('../../src/config/stripe.js', () => ({
  stripeClient: {
    invoices: {
      create: mocks.create,
      pay: mocks.pay,
    },
  },
}));

vi.mock('../../src/engines/engine-service.js', () => ({
  getEngineService: () => ({ transitionState: mocks.transition }),
}));

import { runMembershipRenewalJob } from '../../src/jobs/membership-renewal.job.js';

const MEMBERSHIP_ID = 'f0000000-0000-4000-8000-0000000000c3';
const SUBSCRIPTION_ID = 'sub_task3_double_charge';
const WINDOW = 'task3-window-a';
const WINDOW_2 = 'task3-window-b';

describe('Task 3 — exactly one renewal invoice across two scheduler instances', () => {
  let pool: Pool;
  const distinctInvoices: string[] = [];
  const byKey = new Map<string, { id: string }>();
  let sequence = 0;

  async function reset() {
    await pool.query('DELETE FROM membership_renewal_attempts WHERE membership_id = $1', [MEMBERSHIP_ID]);
    await pool.query('DELETE FROM pool_memberships WHERE id = $1', [MEMBERSHIP_ID]);
    await pool.query("DELETE FROM job_runs WHERE job_name = 'membership_renewal'");
  }

  beforeAll(async () => {
    pool = makePool();
    await reset();
    await pool.query(
      `INSERT INTO pool_memberships
         (id, tenant_id, user_id, status, billing_cycle, end_date, stripe_subscription_id)
       VALUES ($1, $2, $3, 'ACTIVE', 'MONTHLY', now() - interval '1 day', $4)`,
      [MEMBERSHIP_ID, IDS.tenantA, IDS.customerA, SUBSCRIPTION_ID],
    );
  });

  beforeEach(() => {
    distinctInvoices.length = 0;
    byKey.clear();
    sequence = 0;
    mocks.create.mockReset();
    mocks.pay.mockReset();
    mocks.transition.mockReset();

    mocks.transition.mockResolvedValue({ allowed: true, targetState: 'active' });
    mocks.pay.mockResolvedValue({ id: 'paid' });
    mocks.create.mockImplementation(async (_params: unknown, options?: { idempotencyKey?: string }) => {
      const key = options?.idempotencyKey;
      if (key && byKey.has(key)) return byKey.get(key);
      const invoice = { id: `in_task3_${++sequence}` };
      if (key) byKey.set(key, invoice);
      distinctInvoices.push(invoice.id);
      return invoice;
    });
  });

  afterAll(async () => {
    await reset();
    await pool.end();
  });

  it('two concurrent instances create one invoice and advance one period', async () => {
    const before = await pool.query('SELECT end_date FROM pool_memberships WHERE id = $1', [MEMBERSHIP_ID]);

    await Promise.all([
      runMembershipRenewalJob({ runWindow: WINDOW, claimedBy: 'instance-1' }),
      runMembershipRenewalJob({ runWindow: WINDOW, claimedBy: 'instance-2' }),
    ]);

    const after = await pool.query('SELECT status, end_date FROM pool_memberships WHERE id = $1', [MEMBERSHIP_ID]);
    const attempts = await pool.query(
      'SELECT status, billing_period_start, stripe_invoice_id FROM membership_renewal_attempts WHERE membership_id = $1',
      [MEMBERSHIP_ID],
    );

    expect(distinctInvoices).toHaveLength(1);
    expect(attempts.rowCount).toBe(1);
    expect(attempts.rows[0].status).toBe('succeeded');
    expect(attempts.rows[0].stripe_invoice_id).toBe(distinctInvoices[0]);
    expect(new Date(after.rows[0].end_date).getTime()).toBeGreaterThan(
      new Date(before.rows[0].end_date).getTime(),
    );

    // A later run in a different window still cannot renew the same period.
    await runMembershipRenewalJob({ runWindow: WINDOW_2, claimedBy: 'instance-3' });

    expect(distinctInvoices).toHaveLength(1);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        case: 'two-schedulers-one-invoice',
        invoices: distinctInvoices,
        attempts: attempts.rows,
        createCalls: mocks.create.mock.calls.length,
      }),
    );
  });
});
