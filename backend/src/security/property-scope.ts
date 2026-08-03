import { Request } from 'express';
import { AppError } from '../utils/AppError.js';

/**
 * Single source of truth for "what property is this request scoped to".
 *
 * Mirrors tenant-scope.ts's getCallerTenantId. Added because propertyId
 * resolution had been copy-pasted per-controller (analytics.controller.ts,
 * admin/modules.controller.ts, ...) with subtly different fallback ordering
 * between them — the exact same anti-pattern that caused the cross-tenant
 * privilege escalation tenant-scope.ts was written to fix (2026-07-02).
 * New call sites should import from here instead of writing another local
 * getPropertyId().
 *
 * Prefers req.propertyId, set by validatePropertyAccess middleware after it
 * validates the x-property-id header against tenant ownership and the
 * caller's user_property_access / user_group_access rows. Falls back to the
 * raw header only when the middleware chose not to set it (no header sent,
 * or a super-admin bypass) — the header itself is never trusted directly
 * for an authorization decision, only as a last-resort value carrier once
 * the middleware has already had a chance to validate it.
 */
export function getCallerPropertyId(req: Request): string | undefined {
  return (req as any).propertyId || (req.headers['x-property-id'] as string) || undefined;
}

/**
 * Same as getCallerPropertyId, but throws a 400 AppError if no property
 * could be resolved. Use this at any call site that's about to INSERT a row
 * with a NOT NULL property_id column (e.g. customization_groups) — failing
 * fast here with an actionable 400 is strictly better than letting a null
 * reach Postgres and come back as an opaque 500 (23502 not-null violation).
 */
export function requireCallerPropertyId(req: Request): string {
  const propertyId = getCallerPropertyId(req);
  if (!propertyId) {
    throw new AppError(
      'This action requires a property to be selected (missing or invalid x-property-id header)',
      400
    );
  }
  return propertyId;
}
