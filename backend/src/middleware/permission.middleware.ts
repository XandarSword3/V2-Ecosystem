/**
 * Permission Middleware
 * 
 * Enforces backend-only authorization checks.
 * NEVER trust frontend role checks - always verify on backend.
 * 
 * @module middleware/permission
 */

import { Request, Response, NextFunction } from 'express';
import { Permission, hasPermission, getPermissionsForRoles } from '../security/permissions.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to require a specific permission
 * Usage: router.get('/endpoint', requirePermission('admin:dashboard:read'), handler)
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      logger.warn(`Permission denied: No user for ${permission}`, {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const userRoles = req.user.roles || [];
    
    if (!hasPermission(userRoles, permission)) {
      logger.warn(`Permission denied: ${permission}`, {
        userId: req.user.userId,
        roles: userRoles,
        path: req.path,
        method: req.method,
      });
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'AUTH_FORBIDDEN',
        requiredPermission: permission,
      });
    }

    next();
  };
}

/**
 * Middleware to require ANY of the specified permissions
 * Usage: router.get('/endpoint', requireAnyPermission(['perm1', 'perm2']), handler)
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const userRoles = req.user.roles || [];
    const hasAny = permissions.some(perm => hasPermission(userRoles, perm));
    
    if (!hasAny) {
      logger.warn(`Permission denied: none of ${permissions.join(', ')}`, {
        userId: req.user.userId,
        roles: userRoles,
        path: req.path,
      });
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'AUTH_FORBIDDEN',
      });
    }

    next();
  };
}

/**
 * Middleware to require ALL of the specified permissions
 * Usage: router.get('/endpoint', requireAllPermissions(['perm1', 'perm2']), handler)
 */
export function requireAllPermissions(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const userRoles = req.user.roles || [];
    const hasAll = permissions.every(perm => hasPermission(userRoles, perm));
    
    if (!hasAll) {
      const missing = permissions.filter(perm => !hasPermission(userRoles, perm));
      logger.warn(`Permission denied: missing ${missing.join(', ')}`, {
        userId: req.user.userId,
        roles: userRoles,
        path: req.path,
      });
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'AUTH_FORBIDDEN',
      });
    }

    next();
  };
}

/**
 * Middleware to attach user's permissions to request
 * Useful for controllers that need to check permissions dynamically
 */
export function attachPermissions(req: Request, res: Response, next: NextFunction) {
  if (req.user && req.user.roles) {
    req.user.permissions = getPermissionsForRoles(req.user.roles);
  }
  next();
}

/**
 * Helper to check permission in controller (for conditional logic)
 * Usage: if (canAccess(req, 'admin:settings:manage')) { ... }
 */
export function canAccess(req: Request, permission: Permission): boolean {
  if (!req.user || !req.user.roles) return false;
  return hasPermission(req.user.roles, permission);
}

/**
 * Middleware for owner-only access with admin override
 * Usage: router.get('/resource/:id', ownerOrAdmin('userId'), handler)
 * 
 * @param ownerIdParam - The request param containing the owner's user ID
 * @param adminPermission - Permission that allows admin override (default: user:read:any)
 */
export function ownerOrAdmin(ownerIdParam: string, adminPermission: Permission = 'user:read:any' as Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const ownerId = req.params[ownerIdParam] || req.body[ownerIdParam];
    const isOwner = req.user.userId === ownerId;
    const isAdmin = hasPermission(req.user.roles || [], adminPermission);
    
    if (!isOwner && !isAdmin) {
      logger.warn(`Owner/Admin access denied`, {
        userId: req.user.userId,
        resourceOwnerId: ownerId,
        path: req.path,
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'AUTH_FORBIDDEN',
      });
    }

    next();
  };
}

export default {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  attachPermissions,
  canAccess,
  ownerOrAdmin,
};
