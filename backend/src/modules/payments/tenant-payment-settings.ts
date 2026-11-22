/**
 * Per-tenant payment gateway configuration (P0-3).
 *
 * `site_settings` is keyed on `key` alone, so it can only ever hold one global
 * `payments` row: two tenants cannot each store a Stripe key there (the second
 * insert is a 23505 against `site_settings_pkey`). Per-tenant credentials live
 * in `tenant_payment_settings`, one row per tenant (PK `tenant_id`).
 *
 * This module is deliberately small and dependency-light so the tenant
 * isolation proof can exercise it directly against the real local database.
 */

import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export interface TenantPaymentSettings {
  secretKey: string | null;
  publishableKey: string | null;
  webhookSecret: string | null;
  currency: string | null;
}

/**
 * Resolve payment-gateway credentials for one tenant.
 *
 * Resolution order, per field:
 *   1. `tenant_payment_settings` for `tenantId`
 *   2. the legacy global `site_settings.payments` row (single-tenant installs)
 *   3. the environment default (`config.stripe.*`), applied by the caller
 *
 * The lookup is scoped to the requested tenant. It never falls back from
 * tenant A to tenant B's row: if tenant A has no row, only the legacy/global
 * value is considered.
 */
export async function resolveTenantPaymentSettings(
  tenantId?: string | null,
): Promise<TenantPaymentSettings> {
  const supabase = getSupabase();
  const resolved: TenantPaymentSettings = {
    secretKey: null,
    publishableKey: null,
    webhookSecret: null,
    currency: null,
  };

  if (tenantId) {
    const { data, error } = await supabase
      .from('tenant_payment_settings')
      .select('stripe_secret_key, stripe_publishable_key, stripe_webhook_secret, currency')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      // A deployment that has not applied the P0-3 migration yet must still be
      // able to charge on the platform default, so a missing table is a debug
      // note. Anything else (permissions, bad row) is surfaced.
      if ((error as { code?: string }).code === '42P01') {
        logger.debug('[Payments] tenant_payment_settings is absent; using legacy payment settings');
      } else {
        logger.warn(
          `[Payments] Could not read tenant payment settings for ${tenantId}: ${error.message}`,
        );
      }
    } else if (data) {
      resolved.secretKey = data.stripe_secret_key || null;
      resolved.publishableKey = data.stripe_publishable_key || null;
      resolved.webhookSecret = data.stripe_webhook_secret || null;
      resolved.currency = data.currency ? String(data.currency).toUpperCase() : null;
    }
  }

  if (!resolved.secretKey || !resolved.webhookSecret || !resolved.currency) {
    const { data: legacy } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'payments')
      .maybeSingle();

    const value = (legacy?.value ?? {}) as Record<string, unknown>;
    resolved.secretKey =
      resolved.secretKey ||
      (typeof value.stripeSecretKey === 'string' ? value.stripeSecretKey : null);
    resolved.publishableKey =
      resolved.publishableKey ||
      (typeof value.stripePublishableKey === 'string' ? value.stripePublishableKey : null);
    resolved.webhookSecret =
      resolved.webhookSecret ||
      (typeof value.stripeWebhookSecret === 'string' ? value.stripeWebhookSecret : null);
    resolved.currency =
      resolved.currency ||
      (typeof value.currency === 'string' ? value.currency.toUpperCase() : null);
  }

  return resolved;
}
