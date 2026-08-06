/**
 * Property Access Validation Middleware
 * 
 * Validates that the x-property-id header value corresponds to a property
 * the authenticated user has access to, preventing cross-property data access.
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware that validates the x-property-id header against the user's
 * property assignments. Super admins bypass the check.
 */
export async function validatePropertyAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const propertyId = req.headers['x-property-id'] as string;

  // If no property header, allow (some endpoints don't require it)
  if (!propertyId) {
    return next();
  }

  // Validate UUID format — if malformed, ignore the header rather than
  // rejecting the request with 400. The offline PWA service worker and other
  // automated callers may send stale or placeholder values; blocking them with
  // a hard error breaks the hydration loop. Treat an invalid value the same
  // as a missing header (no property scoping applied).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId)) {
    logger.warn('x-property-id header present but not a valid UUID — ignoring', {
      path: req.path,
      prefix: propertyId.substring(0, 8),
    });
    return next();
  }

  // If property was already resolved by resolveProperty (e.g. via X-Property-Slug),
  // sync it to (req as any).propertyId so downstream controllers use the exact route property.
  if (req.property?.id) {
    (req as any).propertyId = req.property.id;
    return next();
  }

  // Super admins can access any property (spans all tenants by design)
  if (req.user?.roles?.includes('super_admin')) {
    (req as any).propertyId = propertyId;
    return next();
  }

  // ── Tenant ownership guard ──────────────────────────────────────────────
  // Before any user-level check, verify this property belongs to the request's
  // resolved tenant. Prevents cross-tenant property access regardless of
  // user_property_access table state — even for tenant_owner / tenant_admin.
  // Skip only when there is no tenant context on the request (platform-admin
  // routes without a tenanted host should never reach this middleware).
  if (req.tenant?.id) {
    const supabase = getSupabase();
    const { data: ownedProperty } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('tenant_id', req.tenant.id)
      .maybeSingle();

    if (!ownedProperty) {
      // Return 404 rather than 403 — avoids leaking which property UUIDs
      // exist across other tenants.
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }
  }

  // tenant_owner and tenant_admin have implicit access to all properties within
  // their tenant — scoped user_property_access rows are optional for these scopes.
  // Default-deny for everyone else (property_staff, property_manager, customer).
  //
  // CRITICAL: this bypass is only valid when the resolved tenant (req.tenant.id,
  // which comes from the client-supplied X-Tenant-ID/X-Tenant-Slug header via
  // resolveTenant) actually matches the user's OWN tenant (req.user.tenantId,
  // which comes from the verified JWT and cannot be spoofed by the caller).
  // Without this comparison, any tenant_owner/tenant_admin could send another
  // tenant's slug/ID header alongside a property_id from that tenant and pass
  // straight through — the "tenant ownership guard" above only checks that the
  // property belongs to req.tenant.id, not that req.tenant.id belongs to this
  // user. Fixed 2026-07-02: previously missing, confirmed exploitable cross-tenant
  // privilege escalation reaching admin/reporting/revenue/users/loyalty/manager/
  // analytics routes (see CONTEXT.md).
  const userScope = req.user?.scope;
  const tenantMatchesUser = !!req.tenant?.id && !!req.user?.tenantId && req.tenant.id === req.user.tenantId;
  if (
    tenantMatchesUser &&
    (userScope === 'tenant_owner' ||
      userScope === 'tenant_admin' ||
      req.user?.roles?.includes('tenant_admin'))
  ) {
    (req as any).propertyId = propertyId;
    return next();
  }

  if (!req.user?.userId) {
    res.status(401).json({ success: false, error: 'Authentication required for property access' });
    return;
  }

    const allowed = await userHasAccessToProperty(req.user.userId, propertyId);

    if (!allowed) {
      logger.warn('Property access denied', {
        userId: req.user?.userId,
        propertyId,
        path: req.path,
      });
      res.status(403).json({ success: false, error: 'Access denied for this property' });
      return;
    }

    (req as any).propertyId = propertyId;
    next();
  } catch (err: unknown) {
    logger.error('Property access check error:', err);
    res.status(500).json({ success: false, error: 'Property access validation failed' });
  }
}

async function userHasAccessToProperty(userId: string, propertyId: string): Promise<boolean> {
  const supabase = getSupabase();

  // Direct user → property access row
  const { data: directAccess, error: directError } = await supabase
    .from('user_property_access')
    .select('id')
    .eq('user_id', userId)
    .eq('property_id', propertyId)
    .or('expires_at.is.null,expires_at.gt.now()')
    .limit(1);

  if (!directError && (directAccess?.length ?? 0) > 0) {
    return true;
  }

  const { data: groupAccess, error: groupError } = await supabase
    .from('user_group_access')
    .select('id, group_id')
    .eq('user_id', userId)
    .or('expires_at.is.null,expires_at.gt.now()');

  if (groupError || (groupAccess?.length ?? 0) === 0) {
    return false;
  }

  const groupIds = (groupAccess ?? []).map((entry) => entry.group_id).filter(Boolean);
  if (groupIds.length === 0) {
    return false;
  }

  const { data: matchingProperty, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .in('group_id', groupIds)
    .limit(1);

  if (propertyError) {
    return false;
  }

  return (matchingProperty?.length ?? 0) > 0;
}

export function requirePropertyAccess(propertyId: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!propertyId) {
      next();
      return;
    }

    if (!req.user?.userId) {
      res.status(401).json({ success: false, error: 'Authentication required for property access' });
      return;
    }

    if (req.user.roles?.includes('super_admin')) {
      next();
      return;
    }

    const allowed = await userHasAccessToProperty(req.user.userId, propertyId);
    if (!allowed) {
      logger.warn('Property access denied by requirePropertyAccess', {
        userId: req.user.userId,
        propertyId,
        path: req.path,
      });
      res.status(403).json({ success: false, error: 'Access denied for this property' });
      return;
    }

    next();
  };
}

export function requireModulePropertyAccess(moduleSlug: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.userId) {
      res.status(401).json({ success: false, error: 'Authentication required for property access' });
      return;
    }

    if (req.user.roles?.includes('super_admin')) {
      next();
      return;
    }

    const supabase = getSupabase();
    const { data: moduleRecord, error } = await supabase
      .from('modules')
      .select('property_id')
      .eq('slug', moduleSlug)
      .maybeSingle();

    if (error) {
      logger.error('Module property lookup failed', { moduleSlug, error: error.message });
      res.status(500).json({ success: false, error: 'Failed to resolve module property access' });
      return;
    }

    const propertyId = moduleRecord?.property_id as string | undefined;
    if (!propertyId) {
      // Backward compatibility for modules without property scoping yet.
      next();
      return;
    }

    const allowed = await userHasAccessToProperty(req.user.userId, propertyId);
    if (!allowed) {
      logger.warn('Property access denied by requireModulePropertyAccess', {
        userId: req.user.userId,
        moduleSlug,
        propertyId,
      });
      res.status(403).json({ success: false, error: 'Access denied for this property' });
      return;
    }

    next();
  };
}
