/**
 * e2e/helpers/db.ts
 *
 * Direct Supabase client for test assertions.
 * Uses service key — bypasses RLS so tests can read any row directly.
 * NEVER use this to test RLS itself — use the request fixture for that.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _db: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (!_db) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error(
        '[db] SUPABASE_URL or SUPABASE_SERVICE_KEY is not set.\n' +
        'Ensure e2e/.env.test is loaded before calling getDb().'
      );
    }

    _db = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Typed helpers used by multiple specs
// ---------------------------------------------------------------------------

export async function getTenantBySubdomain(subdomain: string) {
  const { data, error } = await getDb()
    .from('tenants')
    .select('id, subdomain, billing_status, subscription_tier, plan_id, is_platform_root')
    .eq('subdomain', subdomain)
    .maybeSingle();

  if (error) throw new Error(`[db] getTenantBySubdomain('${subdomain}'): ${error.message}`);
  return data;
}

export async function getTenantBillingStatus(subdomain: string): Promise<string | null> {
  const tenant = await getTenantBySubdomain(subdomain);
  return tenant?.billing_status ?? null;
}

export async function setTenantBillingStatus(subdomain: string, status: string) {
  const { error } = await getDb()
    .from('tenants')
    .update({ billing_status: status })
    .eq('subdomain', subdomain);

  if (error) {
    throw new Error(`[db] setTenantBillingStatus('${subdomain}', '${status}'): ${error.message}`);
  }
}

export async function getSiteSettings(tenantId: string, propertyId: string | null = null) {
  const query = getDb()
    .from('site_settings')
    .select('*')
    .eq('tenant_id', tenantId);

  const { data, error } = propertyId
    ? await query.eq('property_id', propertyId).maybeSingle()
    : await query.is('property_id', null).maybeSingle();

  if (error) throw new Error(`[db] getSiteSettings: ${error.message}`);
  return data;
}
