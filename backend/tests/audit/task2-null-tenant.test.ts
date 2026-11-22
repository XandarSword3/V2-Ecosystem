import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { BASE_URL, record } from './api';
import { IDS, makePool } from './fixtures';
import type { Pool } from 'pg';
import { tenantRequiresOwnWebhookSecret } from '../../src/modules/payments/payment.controller.js';

/**
 * Task 2 — the null-tenant (platform-secret) webhook branch.
 *
 * `invoice.*` events carry no referenceId and no payment_intent, so
 * `resolveWebhookTenantId()` cannot resolve a tenant from the unverified body;
 * `webhookTenantId` is null and the platform-default secret verifies the
 * event. The affected tenant is resolved *after* verification from
 * `pool_memberships.stripe_subscription_id`.
 *
 * Proofs:
 *   1. tenant A has no tenant_payment_settings row -> platform secret is used;
 *      the event renews A's membership and nothing else.
 *   2. tenant B owns a webhook secret; a platform-signed event for B is
 *      rejected before any write.
 *   3. B's own secret cannot be used to sign an event that the server verifies
 *      with the platform secret (signature fails, nothing mutates).
 */

const PLATFORM_SECRET = 'whsec_platform_audit_task2';
const SECRET_B = 'whsec_task2_tenant_b';
const MEMBERSHIP_A = 'e0000000-0000-4000-8000-0000000000a1';
const MEMBERSHIP_B = 'e0000000-0000-4000-8000-0000000000b2';
const SUB_A = 'sub_task2_a';
const SUB_B = 'sub_task2_b';

function sign(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

async function postWebhook(payload: string, secret: string) {
  const res = await fetch(`${BASE_URL}/payments/webhook/stripe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': sign(payload, secret),
    },
    body: payload,
  });
  const raw = await res.text();
  let body: unknown = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    /* keep raw */
  }
  return { status: res.status, body, raw };
}

function invoiceEvent(eventId: string, subscription: string) {
  return JSON.stringify({
    id: eventId,
    object: 'event',
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        id: `in_${eventId}`,
        object: 'invoice',
        subscription,
        customer: 'cus_task2',
        amount_paid: 2500,
        currency: 'usd',
      },
    },
  });
}

describe('Task 2 — platform-secret webhook branch', () => {
  let pool: Pool;

  async function reset() {
    await pool.query('DELETE FROM membership_renewal_attempts WHERE membership_id = ANY($1::uuid[])', [
      [MEMBERSHIP_A, MEMBERSHIP_B],
    ]);
    await pool.query('DELETE FROM pool_memberships WHERE id = ANY($1::uuid[])', [
      [MEMBERSHIP_A, MEMBERSHIP_B],
    ]);
    await pool.query('DELETE FROM tenant_payment_settings WHERE tenant_id = ANY($1::uuid[])', [
      [IDS.tenantA, IDS.tenantB],
    ]);
  }

  beforeAll(async () => {
    pool = makePool();
    await reset();
    await pool.query(
      `INSERT INTO pool_memberships
         (id, tenant_id, user_id, status, billing_cycle, end_date, stripe_subscription_id)
       VALUES ($1, $2, $3, 'ACTIVE', 'MONTHLY', now() - interval '2 days', $4),
              ($5, $6, NULL, 'ACTIVE', 'MONTHLY', now() - interval '2 days', $7)`,
      [MEMBERSHIP_A, IDS.tenantA, IDS.customerA, SUB_A, MEMBERSHIP_B, IDS.tenantB, SUB_B],
    );
    // Only B owns a webhook secret. A deliberately has no row at all.
    await pool.query(
      `INSERT INTO tenant_payment_settings
         (tenant_id, stripe_secret_key, stripe_webhook_secret, currency)
       VALUES ($1, 'sk_test_task2_b', $2, 'USD')`,
      [IDS.tenantB, SECRET_B],
    );
  });

  afterAll(async () => {
    await reset();
    await pool.end();
  });

  it('platform-signed invoice for a tenant without settings renews only that tenant', async () => {
    const beforeA = await pool.query('SELECT status, end_date FROM pool_memberships WHERE id = $1', [MEMBERSHIP_A]);
    const beforeB = await pool.query('SELECT status, end_date FROM pool_memberships WHERE id = $1', [MEMBERSHIP_B]);

    const res = await postWebhook(invoiceEvent('evt_task2_a', SUB_A), PLATFORM_SECRET);

    const afterA = await pool.query('SELECT status, end_date FROM pool_memberships WHERE id = $1', [MEMBERSHIP_A]);
    const afterB = await pool.query('SELECT status, end_date FROM pool_memberships WHERE id = $1', [MEMBERSHIP_B]);

    record('task2-null-tenant.json', {
      case: 'platform-secret-tenant-without-settings',
      status: res.status,
      body: res.body,
      beforeA: beforeA.rows[0],
      afterA: afterA.rows[0],
      beforeB: beforeB.rows[0],
      afterB: afterB.rows[0],
    });

    expect(res.status).toBe(200);
    expect(new Date(afterA.rows[0].end_date).getTime()).toBeGreaterThan(
      new Date(beforeA.rows[0].end_date).getTime(),
    );
    expect(afterB.rows[0]).toEqual(beforeB.rows[0]);
  });

  it('platform-signed invoice for a tenant that owns its own secret is rejected', async () => {
    const before = await pool.query('SELECT status, end_date FROM pool_memberships WHERE id = $1', [MEMBERSHIP_B]);

    const res = await postWebhook(invoiceEvent('evt_task2_b_platform', SUB_B), PLATFORM_SECRET);

    const after = await pool.query('SELECT status, end_date FROM pool_memberships WHERE id = $1', [MEMBERSHIP_B]);

    record('task2-null-tenant.json', {
      case: 'platform-secret-tenant-owns-secret',
      status: res.status,
      body: res.body,
      before: before.rows[0],
      after: after.rows[0],
    });

    expect(res.status).toBe(400);
    expect((res.body as { error?: string })?.error).toBe('Webhook tenant secret required');
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("tenant B's own secret cannot verify against the platform secret path", async () => {
    const before = await pool.query('SELECT status, end_date FROM pool_memberships WHERE id = $1', [MEMBERSHIP_B]);

    const res = await postWebhook(invoiceEvent('evt_task2_b_own', SUB_B), SECRET_B);

    const after = await pool.query('SELECT status, end_date FROM pool_memberships WHERE id = $1', [MEMBERSHIP_B]);

    record('task2-null-tenant.json', {
      case: 'tenant-secret-on-platform-path',
      status: res.status,
      raw: res.raw,
      before: before.rows[0],
      after: after.rows[0],
    });

    expect(res.status).toBe(400);
    expect(res.raw).toMatch(/Webhook Error/);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('classifies which tenants require their own secret', async () => {
    const aNeeds = await tenantRequiresOwnWebhookSecret(IDS.tenantA);
    const bNeeds = await tenantRequiresOwnWebhookSecret(IDS.tenantB);

    record('task2-null-tenant.json', {
      case: 'tenant-requires-own-secret',
      tenantA: aNeeds,
      tenantB: bNeeds,
    });

    expect(aNeeds).toBe(false);
    expect(bNeeds).toBe(true);
  });
});
