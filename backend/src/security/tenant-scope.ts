import { Request } from 'express';
import { AppError } from '../utils/AppError.js';

/**
 * Single source of truth for "what tenant is this request allowed to act on".
 *
 * This is JWT-derived only — it reads req.user.tenantId, which is stamped by
 * auth.middleware from the verified token payload. It must never fall back to
 * a client-supplied header (e.g. x-tenant-id), since that value is fully
 * attacker-controlled and was the root cause of the cross-tenant admin bugs
 * this module was extracted to fix.
 *
 * The one legitimate place a raw x-tenant-id header is read is
 * tenantAccess.middleware.ts, for resolving which tenant an *unauthenticated*
 * request belongs to (e.g. public storefront routes). Everywhere else that
 * needs "the caller's tenant" for an authorization/ownership decision should
 * use this module instead of reading the header or req.tenant directly.
 */

/**
 * Returns the caller's tenant id, or null if the caller is a super_admin
 * (platform-wide operator role, intentionally unscoped).
 * Throws a 403 AppError if a non-super_admin caller has no tenant on their
 * token — that's an invalid/incomplete session, not something to silently
 * treat as "no scope" (which would be equivalent to global access).
 */
export function getCallerTenantId(req: Request): string | null {
  if (req.user?.scope === 'super_admin') return null;
  if (!req.user?.tenantId) {
    throw new AppError('No tenant associated with this account', 403);
  }
  return req.user.tenantId;
}

/**
 * Same as getCallerTenantId, but for call sites that are never valid for
 * super_admin to call unscoped (e.g. an insert that must always be stamped
 * with a concrete tenant_id). Throws 403 if there is no concrete tenant,
 * including for super_admin.
 */
export function requireTenantScope(req: Request): string {
  const tenantId = getCallerTenantId(req);
  if (!tenantId) {
    throw new AppError('This action requires a tenant-scoped account', 403);
  }
  return tenantId;
}
