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
