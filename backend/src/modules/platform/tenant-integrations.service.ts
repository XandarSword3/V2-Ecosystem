/**
 * TenantIntegrationsService
 *
 * Per-tenant storage for third-party integration config + credentials
 * (Stripe, SMTP, SendGrid, SiteMinder, door locks, WhatsApp).
 *
 * Fixes Critical #1/#2 from the multi-tenant audit: these previously had
 * nowhere to live but process.env, so one tenant's onboarding flow
 * (finalizeOnboarding) overwrote every other tenant's credentials on the
 * same Node process. See 20260628000000_create_tenant_integrations.sql.
 *
 * Secrets are encrypted at rest via secretsManager.encrypt()/.decrypt()
 * (AES-256-GCM, ENCRYPTION_KEY) — callers should never log a decrypted
 * value or return credentials_encrypted to a client.
 *
 * NOTE: this only covers storage. Wiring the runtime read paths (payment
 * processing, email sending, SiteMinder API calls) to pull from here
 * instead of process.env is a separate, higher-blast-radius follow-up —
 * see CONTEXT.md.
 */

import { getSupabase } from '../../database/connection.js';
import { secretsManager } from '../../config/secrets.config.js';
import { logger } from '../../utils/logger.js';

export type IntegrationType =
  | 'stripe'
  | 'smtp'
  | 'sendgrid'
  | 'siteminder'
  | 'door_lock'
  | 'whatsapp'
  | 'twilio'
  | 'salto'
  | 'openkey';

export interface TenantIntegration {
  id: string;
  tenantId: string;
  integrationType: IntegrationType;
  config: Record<string, unknown>;
  /** Decrypted secret, or null if none stored. Never log this. */
  credential: string | null;
  isActive: boolean;
}

/**
 * Upsert a tenant's integration config + (optional) secret credential.
 * Pass `secret` to set/rotate the credential; omit it to update config
 * only and leave the existing credential untouched. Pass an empty string
 * to explicitly clear the stored credential.
 */
export async function upsertTenantIntegration(
  tenantId: string,
  integrationType: IntegrationType,
  config: Record<string, unknown>,
  secret?: string,
): Promise<void> {
  const supabase = getSupabase();

  // Merge config with the existing row rather than replacing it wholesale.
  // Callers that want to clear a key should pass { key: null }.
  const { data: existing } = await supabase
    .from('tenant_integrations')
    .select('config')
    .eq('tenant_id', tenantId)
    .eq('integration_type', integrationType)
    .maybeSingle();

  const mergedConfig = { ...(existing?.config ?? {}), ...config };

  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    integration_type: integrationType,
    config: mergedConfig,
  };

  if (secret !== undefined) {
    row.credentials_encrypted = secret ? secretsManager.encrypt(secret) : null;
  }

  const { error } = await supabase
    .from('tenant_integrations')
    .upsert(row, { onConflict: 'tenant_id,integration_type' });

  if (error) {
    logger.error('[TENANT_INTEGRATIONS] Upsert failed', {
      tenantId,
      integrationType,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Fetch a tenant's integration config + decrypted credential.
 * Returns null if no row exists or the integration is inactive.
 */
export async function getTenantIntegration(
  tenantId: string,
  integrationType: IntegrationType,
): Promise<TenantIntegration | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('tenant_integrations')
    .select('id, tenant_id, integration_type, config, credentials_encrypted, is_active')
    .eq('tenant_id', tenantId)
    .eq('integration_type', integrationType)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    logger.error('[TENANT_INTEGRATIONS] Lookup failed', {
      tenantId,
      integrationType,
      error: error.message,
    });
    return null;
  }

  if (!data) return null;

  let credential: string | null = null;
  if (data.credentials_encrypted) {
    try {
      credential = secretsManager.decrypt(data.credentials_encrypted as string);
    } catch {
      logger.error(
        '[TENANT_INTEGRATIONS] Decrypt failed — ENCRYPTION_KEY may have rotated without re-encrypting this row',
        { tenantId, integrationType },
      );
    }
  }

  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    integrationType: data.integration_type as IntegrationType,
    config: (data.config as Record<string, unknown>) ?? {},
    credential,
    isActive: data.is_active as boolean,
  };
}

/** Soft-disable an integration without deleting its row/history. */
export async function deactivateTenantIntegration(
  tenantId: string,
  integrationType: IntegrationType,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('tenant_integrations')
    .update({ is_active: false })
    .eq('tenant_id', tenantId)
    .eq('integration_type', integrationType);

  if (error) {
    logger.error('[TENANT_INTEGRATIONS] Deactivate failed', {
      tenantId,
      integrationType,
      error: error.message,
    });
    throw error;
  }
}
