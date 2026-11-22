/**
 * Backfill `tenant_payment_settings` for tenants provisioned before P0-3.
 *
 * Dry-run by default. Nothing is written unless --apply is passed.
 *
 * Source order per tenant (first hit wins):
 *   1. `tenant_integrations` (integration_type='stripe', active) — the
 *      encrypted registry onboarding already wrote before this migration.
 *   2. the legacy global `site_settings.payments` row — single-tenant installs
 *      that still keep their key in the old place.
 *
 * Safety:
 *   - refuses a non-local DATABASE_URL unless ALLOW_REMOTE_BACKFILL=1 is set;
 *   - never overwrites an existing tenant_payment_settings row;
 *   - prints only tenant ids / sources, never credential values.
 *
 * Usage:
 *   npx tsx scripts/backfill-tenant-payment-settings.ts            # dry run
 *   npx tsx scripts/backfill-tenant-payment-settings.ts --apply    # write
 */

import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const ALLOW_REMOTE = process.env.ALLOW_REMOTE_BACKFILL === '1';

type LegacyPayments = {
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  currency?: string;
};

function assertSafeTarget(connectionString: string): void {
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (!/^(127\.0\.0\.1|localhost|::1)$/.test(host) && !ALLOW_REMOTE) {
    throw new Error(
      `Refusing to backfill non-local database host "${host}". ` +
        'Set ALLOW_REMOTE_BACKFILL=1 only after an explicit, reviewed decision.',
    );
  }
}

async function main(): Promise<void> {
  // Loaded after dotenv.config so ENCRYPTION_KEY/JWT_SECRET are present when
  // the secrets manager derives its key.
  const { secretsManager } = await import('../src/config/secrets.config.js');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  assertSafeTarget(connectionString);

  const pool = new Pool({ connectionString, ssl: false, connectionTimeoutMillis: 5000 });
  try {
    const legacyResult = await pool.query<{ value: LegacyPayments | null }>(
      `SELECT value FROM site_settings WHERE key = 'payments' LIMIT 1`,
    );
    const legacy = legacyResult.rows[0]?.value ?? {};

    const missing = await pool.query<{ id: string; subdomain: string | null }>(
      `SELECT t.id, t.subdomain
         FROM tenants t
        WHERE NOT EXISTS (
          SELECT 1 FROM tenant_payment_settings s WHERE s.tenant_id = t.id
        )
        ORDER BY t.id`,
    );

    let fromIntegrations = 0;
    let fromLegacy = 0;
    let skippedNoCredential = 0;
    const applied: string[] = [];

    for (const tenant of missing.rows) {
      let secret: string | null = null;
      let publishableKey: string | null = null;
      let webhookSecret: string | null = null;
      let currency = (legacy.currency || 'USD').toUpperCase();
      let source: 'tenant_integrations' | 'site_settings.payments' | 'none' = 'none';

      const integration = await pool.query<{
        credentials_encrypted: string | null;
        config: Record<string, unknown> | null;
      }>(
        `SELECT credentials_encrypted, config
           FROM tenant_integrations
          WHERE tenant_id = $1
            AND integration_type = 'stripe'
            AND is_active = true
          LIMIT 1`,
        [tenant.id],
      );

      const integrationRow = integration.rows[0];
      if (integrationRow?.credentials_encrypted) {
        try {
          secret = secretsManager.decrypt(integrationRow.credentials_encrypted);
          publishableKey =
            typeof integrationRow.config?.publicKey === 'string'
              ? integrationRow.config.publicKey
              : null;
          source = 'tenant_integrations';
          fromIntegrations++;
        } catch {
          // Leave the tenant for manual remediation rather than copying a
          // credential that cannot be decrypted with the current key.
          skippedNoCredential++;
          console.log(`[skip] tenant=${tenant.id} unreadable tenant_integrations credential`);
          continue;
        }
      } else if (typeof legacy.stripeSecretKey === 'string' && legacy.stripeSecretKey) {
        secret = legacy.stripeSecretKey;
        publishableKey = legacy.stripePublishableKey || null;
        webhookSecret = legacy.stripeWebhookSecret || null;
        source = 'site_settings.payments';
        fromLegacy++;
      } else {
        skippedNoCredential++;
        console.log(`[skip] tenant=${tenant.id} no stripe credential found`);
        continue;
      }

      console.log(
        `[${APPLY ? 'apply' : 'dry-run'}] tenant=${tenant.id} subdomain=${tenant.subdomain ?? '-'} source=${source} ` +
          `hasWebhookSecret=${Boolean(webhookSecret)} currency=${currency}`,
      );

      if (APPLY) {
        await pool.query(
          `INSERT INTO tenant_payment_settings
             (tenant_id, stripe_secret_key, stripe_publishable_key, stripe_webhook_secret, currency, updated_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (tenant_id) DO NOTHING`,
          [tenant.id, secret, publishableKey, webhookSecret, currency],
        );
        applied.push(tenant.id);
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: APPLY ? 'apply' : 'dry-run',
          tenantsMissingSettings: missing.rowCount,
          fromIntegrations,
          fromLegacy,
          skippedNoCredential,
          written: applied.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
