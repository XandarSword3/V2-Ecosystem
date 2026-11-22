import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { BASE_URL, record } from './api';
import { IDS, makePool } from './fixtures';
import type { Pool } from 'pg';

/**
 * Webhook tenant binding.
 *
 * The signing secret is selected from the *unverified* body
 * (`data.object.metadata.referenceId`, or the payment intent on a charge
 * event). After `constructEvent`, the handler must prove that the verified
 * event mutates the same tenant.
 *
 * Two proofs:
 *   1. tenant A signs a valid payment_intent event for tenant B's order with
 *      A's own secret -> rejected, no payment/ledger/order state change.
 *   2. a legacy/misconfigured payments row claims tenant A while pointing at
 *      tenant B's order. The charge event verifies with A's secret (secret
 *      selection reads the payment row), so this one reaches and is stopped
 *      by the post-verification tenant-binding guard.
 */

const SECRET_A = 'whsec_p0_webhook_tenant_a';
const SECRET_B = 'whsec_p0_webhook_tenant_b';
const PI_A_FOR_B = 'pi_p0_webhook_a_for_b';
const PI_GUARD = 'pi_p0_webhook_guard';

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

describe('Webhook tenant binding', () => {
  let pool: Pool;

  async function reset() {
    await pool.query('DELETE FROM tenant_payment_settings WHERE tenant_id = ANY($1::uuid[])', [
      [IDS.tenantA, IDS.tenantB],
    ]);
    await pool.query('DELETE FROM payments WHERE stripe_payment_intent_id = ANY($1::text[])', [
      [PI_A_FOR_B, PI_GUARD],
    ]);
    await pool.query('DELETE FROM payment_ledger WHERE gateway_reference_id = ANY($1::text[])', [
      [PI_A_FOR_B, PI_GUARD],
    ]);
    await pool.query(
      `UPDATE transactions SET metadata = '{"audit_fixture":true}'::jsonb WHERE id = $1`,
      [IDS.txnOrderB],
    );
  }

  beforeAll(async () => {
    pool = makePool();
    await reset();
    await pool.query(
      `INSERT INTO tenant_payment_settings
         (tenant_id, stripe_secret_key, stripe_webhook_secret, currency)
       VALUES ($1, 'sk_test_webhook_a', $2, 'USD'),
              ($3, 'sk_test_webhook_b', $4, 'USD')`,
      [IDS.tenantA, SECRET_A, IDS.tenantB, SECRET_B],
    );
  });

  afterAll(async () => {
    await reset();
    await pool.end();
  });

  it("rejects a tenant-A-signed event that references tenant B's order and changes nothing", async () => {
    const before = await pool.query(
      `SELECT metadata, status FROM transactions WHERE id = $1`,
      [IDS.txnOrderB],
    );

    const payload = JSON.stringify({
      id: 'evt_p0_webhook_a_for_b',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: PI_A_FOR_B,
          object: 'payment_intent',
          amount: 10000,
          currency: 'usd',
          latest_charge: null,
          metadata: {
            referenceId: IDS.txnOrderB,
            referenceType: 'instant_transaction',
          },
        },
      },
    });

    const res = await postWebhook(payload, SECRET_A);

    const after = await pool.query(
      `SELECT metadata, status FROM transactions WHERE id = $1`,
      [IDS.txnOrderB],
    );
    const payments = await pool.query(
      `SELECT id, status FROM payments WHERE stripe_payment_intent_id = $1`,
      [PI_A_FOR_B],
    );
    const ledger = await pool.query(
      `SELECT id FROM payment_ledger WHERE gateway_reference_id = $1`,
      [PI_A_FOR_B],
    );

    record('task1-webhook-tenant-binding.json', {
      case: 'tenant-a-signs-tenant-b-order',
      status: res.status,
      body: res.body,
      signingTenant: IDS.tenantA,
      referencedTenant: IDS.tenantB,
      before: before.rows[0],
      after: after.rows[0],
      paymentRows: payments.rows,
      ledgerRows: ledger.rows,
    });

    expect(res.status).toBe(400);
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(payments.rowCount).toBe(0);
    expect(ledger.rowCount).toBe(0);
  });

  it('post-verification guard rejects a verified event whose payment row and order disagree on tenant', async () => {
    // Deliberate mismatch: the payment row says tenant A, the order it points
    // at belongs to tenant B. Secret selection reads the payment row, so A's
    // secret verifies the event; only the post-verification guard can catch it.
    await pool.query(
      `INSERT INTO payments
         (reference_type, reference_id, amount, currency, method, status,
          stripe_payment_intent_id, tenant_id, property_id, processed_at)
       VALUES ('instant_transaction', $1, 100.00, 'USD', 'card', 'completed', $2, $3, $4, now())`,
      [IDS.txnOrderB, PI_GUARD, IDS.tenantA, IDS.propertyA],
    );

    const before = await pool.query(
      `SELECT metadata, status FROM transactions WHERE id = $1`,
      [IDS.txnOrderB],
    );

    const payload = JSON.stringify({
      id: 'evt_p0_webhook_guard',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_p0_webhook_guard',
          object: 'charge',
          payment_intent: PI_GUARD,
          amount_refunded: 10000,
          currency: 'usd',
          refunds: { data: [] },
        },
      },
    });

    const res = await postWebhook(payload, SECRET_A);

    const after = await pool.query(
      `SELECT metadata, status FROM transactions WHERE id = $1`,
      [IDS.txnOrderB],
    );
    const payment = await pool.query(
      `SELECT status, notes FROM payments WHERE stripe_payment_intent_id = $1`,
      [PI_GUARD],
    );
    const ledger = await pool.query(
      `SELECT id FROM payment_ledger WHERE gateway_reference_id = $1`,
      [PI_GUARD],
    );

    record('task1-webhook-tenant-binding.json', {
      case: 'verified-event-payment-order-tenant-mismatch',
      status: res.status,
      body: res.body,
      signingTenant: IDS.tenantA,
      orderTenant: IDS.tenantB,
      before: before.rows[0],
      after: after.rows[0],
      payment: payment.rows[0],
      ledgerRows: ledger.rows,
    });

    expect(res.status).toBe(400);
    expect((res.body as { error?: string })?.error).toBe('Webhook tenant mismatch');
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(payment.rows[0]?.status).toBe('completed');
    expect(ledger.rowCount).toBe(0);
  });
});
