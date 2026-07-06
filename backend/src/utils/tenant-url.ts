import { config } from '../config/index.js';

/**
 * Builds a tenant-scoped frontend URL for auth links (email verification,
 * password reset, welcome/login emails).
 *
 * Registration is always tenant-scoped (users.tenant_id is required), so links
 * sent to a user must point at their tenant's subdomain — never at the flat
 * config.frontendUrl, which has no tenant context and defaults to production
 * in most .env setups.
 *
 * Dev:  http://{subdomain}.localhost:{port}{path}
 * Prod: https://{subdomain}.{PRODUCTION_BASE_DOMAIN}{path}   (default: v2platform.com)
 */
export function buildTenantUrl(subdomain: string, path: string): string {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const baseDomain = process.env.PRODUCTION_BASE_DOMAIN || 'v2platform.com';
    return `https://${subdomain}.${baseDomain}${path}`;
  }

  let port = '3000';
  try {
    port = new URL(config.frontendUrl).port || '3000';
  } catch {
    // config.frontendUrl malformed — fall back to default dev port
  }
  return `http://${subdomain}.localhost:${port}${path}`;
}
