import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { record } from './api';
import { IDS, makePool } from './fixtures';
import type { Pool } from 'pg';
import { resolveTenantPaymentSettings } from '../../src/modules/payments/tenant-payment-settings.js';

/**
 * P0-3 — one global Stripe account for every tenant.
 *
 * Root cause at the schema level: `site_settings` is keyed on `key` alone,
 * while `tenant_id`/`property_id` are NOT NULL. A per-tenant `payments` row was
 * therefore impossible — the second tenant's insert violated
 * `site_settings_pkey` with 23505 — and runtime `getStripeInstance()` read
 * whichever single row existed with no tenant filter.
 *
 * Fix: per-tenant credentials live in `tenant_payment_settings` (PK
 * `tenant_id`), and the resolver reads only the requested tenant's row.
 * Widening the `site_settings` PK was rejected because ~50 unrelated settings
 * readers use `.eq('key', X).single()` and several writers use
 * `onConflict: 'key'`.
 *
 * Proofs:
 *   1. Both tenants can own a row at the same time, with different secrets.
 *   2. The resolver returns tenant A's secret for A and B's for B — neither
 *      tenant can read the other's value.
 */
describe('P0-3 per-tenant Stripe configuration', () => {
  const SECRET_A = 'sk_test_tenant_a_p0_3';
  const SECRET_B = 'sk_test_tenant_b_p0_3';
  const WEBHOOK_A = 'whsec_tenant_a_p0_3';
  const WEBHOOK_B = 'whsec_tenant_b_p0_3';

  let pool: Pool;

  async function clearTenantRows() {
    await pool.query(
      `DELETE FROM tenant_payment_settings WHERE tenant_id = ANY($1::uuid[])`,
      [[IDS.tenantA, IDS.tenantB]],
    );
  }

  beforeAll(async () => {
    pool = makePool();
    await clearTenantRows();
  });

  afterAll(async () => {
    await clearTenantRows();
    await pool.end();
  });

  it('stores a distinct Stripe configuration for each tenant', async () => {
    await pool.query(
      `INSERT INTO tenant_payment_settings
         (tenant_id, stripe_secret_key, stripe_webhook_secret, currency)
       VALUES ($1, $2, $3, 'USD')`,
      [IDS.tenantA, SECRET_A, WEBHOOK_A],
    );
    await pool.query(
      `INSERT INTO tenant_payment_settings
         (tenant_id, stripe_secret_key, stripe_webhook_secret, currency)
       VALUES ($1, $2, $3, 'USD')`,
      [IDS.tenantB, SECRET_B, WEBHOOK_B],
    );

    const rows = await pool.query(
      `SELECT tenant_id, stripe_secret_key
         FROM tenant_payment_settings
        WHERE tenant_id = ANY($1::uuid[])
        ORDER BY tenant_id`,
      [[IDS.tenantA, IDS.tenantB]],
    );

    record('p0-3-evidence.json', {
      case: 'two-tenant-config-rows',
      rowCount: rows.rowCount,
      tenantIds: rows.rows.map((r) => r.tenant_id),
      primaryKey: (
        await pool.query(
          `SELECT conname, pg_get_constraintdef(oid) AS def
             FROM pg_constraint
            WHERE conrelid = 'tenant_payment_settings'::regclass AND contype = 'p'`,
        )
      ).rows,
    });

    expect(rows.rowCount).toBe(2);
    expect(rows.rows.map((r) => r.stripe_secret_key).sort()).toEqual(
      [SECRET_A, SECRET_B].sort(),
    );
  });

  it('resolves each tenant to its own secret and never to the other tenant secret', async () => {
    const a = await resolveTenantPaymentSettings(IDS.tenantA);
    const b = await resolveTenantPaymentSettings(IDS.tenantB);

    record('p0-3-evidence.json', {
      case: 'runtime-resolution-isolation',
      tenantA: { secretKey: a.secretKey, webhookSecret: a.webhookSecret, currency: a.currency },
      tenantB: { secretKey: b.secretKey, webhookSecret: b.webhookSecret, currency: b.currency },
    });

    expect(a.secretKey).toBe(SECRET_A);
    expect(a.webhookSecret).toBe(WEBHOOK_A);
    expect(b.secretKey).toBe(SECRET_B);
    expect(b.webhookSecret).toBe(WEBHOOK_B);
    expect(a.secretKey).not.toBe(SECRET_B);
    expect(b.secretKey).not.toBe(SECRET_A);
  });
});
