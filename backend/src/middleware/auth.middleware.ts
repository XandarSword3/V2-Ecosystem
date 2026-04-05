import { Request, Response, NextFunction } from 'express';
import { verifyToken } from "../modules/auth/auth.utils.js";
import { getSupabase } from "../database/supabase.js";
import { logger } from "../utils/logger.js";
// Express Request type extension is defined in src/types/index.ts

export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn('Auth failure: No token provided', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(token);
    req.user = { ...payload, id: payload.userId };
    next();
  } catch (error) {
    logger.warn('Auth failure: Invalid or expired token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function authorize(...args: (string | string[])[]) {
  const allowedRoles = args.flat();
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      logger.warn('Authorization failure: Not authenticated', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        requiredRoles: allowedRoles,
      });
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const hasRole = req.user.roles.some(role =>
      allowedRoles.includes(role) || role === 'super_admin'
    );

    if (!hasRole) {
      logger.warn('Authorization failure: Insufficient permissions', {
        path: req.path,
        method: req.method,
        userId: req.user.userId,
        userRoles: req.user.roles,
        requiredRoles: allowedRoles,
      });
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Database-based permission check.
 * DEPRECATED: Use requirePermission from permission.middleware.ts instead.
 * This queries the app_role_permissions table at runtime.
 * The in-memory version in permission.middleware.ts is the canonical source of truth.
 * This function is retained only for cases where DB-level permission overrides are needed.
 */
export function requireDbPermission(permissionSlug: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[DEPRECATED] requireDbPermission('${permissionSlug}') is deprecated. Use requirePermission() from permission.middleware.ts instead.`);
    }

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Super admin bypass
    if (req.user.roles.includes('super_admin')) {
      return next();
    }

    try {
      const supabase = getSupabase();

      // Check if any of the user's roles has the permission in app_role_permissions
      // We use .in() for roles to check all user roles at once
      const { data, error } = await supabase
        .from('app_role_permissions')
        .select('permission_slug')
        .eq('permission_slug', permissionSlug)
        .in('role_name', req.user.roles)
        .limit(1);

      if (error) {
        console.error('Permission check failed:', error);
        // Fail closed
        return res.status(500).json({ success: false, error: 'Internal permission check failed' });
      }

      if (data && data.length > 0) {
        return next();
      }

      return res.status(403).json({ success: false, error: `Missing required permission: ${permissionSlug}` });

    } catch (err) {
      console.error('Unexpected error in permission check:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyToken(token);
      req.user = { ...payload, id: payload.userId };
    }
  } catch {
    // Token invalid, continue without user
  }
  next();
}
