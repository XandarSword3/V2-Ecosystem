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
  const propertyId = req.headers['x-property-id'] as string;

  // If no property header, allow (some endpoints don't require it)
  if (!propertyId) {
    return next();
  }

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(propertyId)) {
    res.status(400).json({ success: false, error: 'Invalid property ID format' });
    return;
  }

  // Super admins can access any property
  if (req.user?.roles?.includes('super_admin')) {
    (req as any).propertyId = propertyId;
    return next();
  }

  if (!req.user?.userId) {
    res.status(401).json({ success: false, error: 'Authentication required for property access' });
    return;
  }

  // Check user's property access in the database
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase
      .from('user_properties')
      .select('property_id')
      .eq('user_id', req.user.userId)
      .eq('property_id', propertyId)
      .single();

    if (error || !data) {
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

  // Backward compatibility: single-property deployments may not have
  // user_property_access rows yet. In that case, allow access.
  const { count: accessRowCount, error: countError } = await supabase
    .from('user_property_access')
    .select('id', { count: 'exact', head: true });

  if (!countError && (accessRowCount ?? 0) === 0) {
    return true;
  }

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
