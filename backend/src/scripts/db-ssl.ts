import type { PoolConfig } from 'pg';

/**
 * Shared TLS policy for operator scripts (C-2 remediation).
 *
 * The V2_ECOSYSTEM_PRODUCTION_AUDIT.md finding was that migration/utility
 * scripts hard-coded `ssl: { rejectUnauthorized: false }`, accepting any
 * certificate for remote Supabase connections running with operator
 * credentials. This helper mirrors the policy in src/database/connection.ts:
 *
 *   - local connections (localhost / 127.0.0.1): no TLS config needed
 *   - everything else: verify the server certificate. `NODE_ENV=production`
 *     forces verification; ad hoc runs without it keep the operational
 *     accident-tolerance of the main connection. `DB_SSL_CA` may pin
 *     Supabase's root CA when a pooler needs an explicit trust anchor.
 */
export function scriptSsl(connectionString: string | undefined | null): PoolConfig['ssl'] {
  const url = connectionString ?? '';
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  if (!url || isLocal) return false;
  return {
    // SECURITY: rejectUnauthorized must be true when running against prod.
    // If Supabase's Transaction Pooler (port 6543) requires a different
    // setting, supply DB_SSL_CA and pin it explicitly.
    rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false,
    ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
  };
}
