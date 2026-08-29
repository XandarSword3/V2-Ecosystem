/**
 * F2: Frontend Authorization / Scope Architecture
 *
 * This module provides a useAuthorization() hook and permission helpers that
 * mirror the backend's canonical authorization model exactly. It is
 * PRESENTATION-ONLY — the backend remains the authoritative security boundary.
 *
 * The backend model (source of truth):
 *   Scope (JWT): super_admin > platform_admin > tenant_owner > tenant_admin
 *                > property_manager > property_staff > customer
 *   Roles (backward-compat, derived from scope):
 *     super_admin, admin, manager, staff, customer, guest
 *   Permissions (granular strings):
 *     resource:action[:scope] — e.g. order:create, catalog:write, payment:refund
 *   Module-scoped permissions:
 *     module:{slug}:view|order|manage|admin
 *
 * Reference: backend/src/security/permissions.ts (RolePermissions matrix)
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from './auth-context';

// Lazy import for PropertyContext — avoids circular dependency when the
// PropertyProvider wraps children of a component that calls useAuthorization().
let _useProperty: (() => { activePropertyId: string | null }) | undefined;
function usePropertySafe(): { activePropertyId: string | null } {
  try {
    if (!_useProperty) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _useProperty = require('@/context/PropertyContext').useProperty as () => { activePropertyId: string | null };
    }
    return _useProperty();
  } catch {
    return { activePropertyId: null };
  }
}

// ============================================
// Permission constants (mirrors backend Permissions)
// ============================================

export const Perm = {
  // Users
  USER_READ_SELF: 'user:read:self',
  USER_UPDATE_SELF: 'user:update:self',
  USER_READ_ANY: 'user:read:any',
  USER_UPDATE_ANY: 'user:update:any',
  USER_DELETE_ANY: 'user:delete:any',
  USER_MANAGE_ROLES: 'user:manage:roles',

  // Catalog
  CATALOG_READ: 'catalog:read',
  CATALOG_WRITE: 'catalog:write',
  CATALOG_CATEGORY_MANAGE: 'catalog:category:manage',
  CATALOG_SEATING_MANAGE: 'catalog:seating:manage',
  CATALOG_STATS: 'catalog:stats:read',

  // Orders
  ORDER_CREATE: 'order:create',
  ORDER_READ_OWN: 'order:read:own',
  ORDER_READ_ALL: 'order:read:all',
  ORDER_UPDATE: 'order:update',

  // Reservations
  RESERVATION_CREATE: 'reservation:create',
  RESERVATION_READ_OWN: 'reservation:read:own',
  RESERVATION_READ_ALL: 'reservation:read:all',
  RESERVATION_UPDATE: 'reservation:update',
  RESERVATION_CANCEL: 'reservation:cancel',
  RESERVATION_STATS: 'reservation:stats:read',

  // Units
  UNIT_READ: 'unit:read',
  UNIT_WRITE: 'unit:write',
  UNIT_PRICING_MANAGE: 'unit:pricing:manage',

  // Access
  ACCESS_CREATE: 'access:create',
  ACCESS_READ_OWN: 'access:read:own',
  ACCESS_READ_ALL: 'access:read:all',
  ACCESS_VALIDATE: 'access:validate',
  ACCESS_SESSION_READ: 'access:session:read',
  ACCESS_SESSION_MANAGE: 'access:session:manage',
  ACCESS_STATS: 'access:stats:read',

  // Entitlements
  ENTITLEMENT_READ_OWN: 'entitlement:read:own',
  ENTITLEMENT_READ_ALL: 'entitlement:read:all',
  ENTITLEMENT_MANAGE: 'entitlement:manage',

  // Payments
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_READ_OWN: 'payment:read:own',
  PAYMENT_READ_ALL: 'payment:read:all',
  PAYMENT_REFUND: 'payment:refund',
  PAYMENT_RECORD_CASH: 'payment:record:cash',

  // Loyalty
  LOYALTY_READ_SELF: 'loyalty:read:self',
  LOYALTY_READ_ANY: 'loyalty:read:any',
  LOYALTY_EARN: 'loyalty:earn',
  LOYALTY_REDEEM: 'loyalty:redeem',
  LOYALTY_ADJUST: 'loyalty:adjust',
  LOYALTY_SETTINGS: 'loyalty:settings:manage',

  // Gift cards
  GIFTCARD_PURCHASE: 'giftcard:purchase',
  GIFTCARD_REDEEM: 'giftcard:redeem',
  GIFTCARD_MANAGE: 'giftcard:manage',

  // Coupons
  COUPON_USE: 'coupon:use',
  COUPON_MANAGE: 'coupon:manage',

  // Support
  SUPPORT_TICKET_CREATE: 'support:ticket:create',
  SUPPORT_TICKET_READ_OWN: 'support:ticket:read:own',
  SUPPORT_TICKET_READ_ALL: 'support:ticket:read:all',
  SUPPORT_TICKET_RESPOND: 'support:ticket:respond',

  // Reviews
  REVIEW_CREATE: 'review:create',
  REVIEW_READ: 'review:read',
  REVIEW_MODERATE: 'review:moderate',

  // Housekeeping
  HOUSEKEEPING_TASK_READ: 'housekeeping:task:read',
  HOUSEKEEPING_TASK_UPDATE: 'housekeeping:task:update',
  HOUSEKEEPING_TASK_MANAGE: 'housekeeping:task:manage',

  // Inventory
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_MANAGE: 'inventory:manage',

  // Admin
  ADMIN_DASHBOARD: 'admin:dashboard:read',
  ADMIN_SETTINGS: 'admin:settings:manage',
  ADMIN_MODULES: 'admin:modules:manage',
  ADMIN_CMS: 'admin:cms:manage',
  ADMIN_REPORTS: 'admin:reports:read',
  ADMIN_AUDIT_LOG: 'admin:audit:read',

  // Devices/notifications
  DEVICE_REGISTER: 'device:register',
  NOTIFICATION_SEND: 'notification:send',
} as const;

export type Permission = (typeof Perm)[keyof typeof Perm];

// ============================================
// Role → Permission matrix (mirrors backend RolePermissions)
// ============================================

const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  guest: [Perm.REVIEW_READ],

  customer: [
    Perm.USER_READ_SELF,
    Perm.USER_UPDATE_SELF,
    Perm.ORDER_CREATE,
    Perm.PAYMENT_CREATE,
    Perm.PAYMENT_READ_OWN,
    Perm.LOYALTY_READ_SELF,
    Perm.GIFTCARD_PURCHASE,
    Perm.GIFTCARD_REDEEM,
    Perm.COUPON_USE,
    Perm.SUPPORT_TICKET_CREATE,
    Perm.SUPPORT_TICKET_READ_OWN,
    Perm.REVIEW_CREATE,
    Perm.REVIEW_READ,
    Perm.DEVICE_REGISTER,
  ],

  staff: [
    Perm.USER_READ_SELF,
    Perm.USER_UPDATE_SELF,
    Perm.PAYMENT_RECORD_CASH,
    Perm.LOYALTY_EARN,
    Perm.INVENTORY_READ,
    Perm.INVENTORY_UPDATE,
    Perm.DEVICE_REGISTER,
  ],

  manager: [
    Perm.USER_READ_SELF,
    Perm.USER_UPDATE_SELF,
    Perm.USER_READ_ANY,
    Perm.PAYMENT_READ_ALL,
    Perm.PAYMENT_RECORD_CASH,
    Perm.LOYALTY_READ_ANY,
    Perm.LOYALTY_ADJUST,
    Perm.LOYALTY_EARN,
    Perm.SUPPORT_TICKET_READ_ALL,
    Perm.SUPPORT_TICKET_RESPOND,
    Perm.REVIEW_MODERATE,
    Perm.HOUSEKEEPING_TASK_MANAGE,
    Perm.INVENTORY_READ,
    Perm.INVENTORY_MANAGE,
    Perm.ADMIN_DASHBOARD,
    Perm.ADMIN_REPORTS,
    Perm.DEVICE_REGISTER,
  ],

  admin: [
    // Wildcard — admin has all permissions.
    // The backend uses '*' for this; the frontend resolves it in hasPermission().
  ],

  super_admin: [
    // Wildcard — super_admin has all permissions.
  ],

  // Scope-derived pseudo-roles (scopeToRoles in backend)
  tenant_owner: [],  // Maps to admin in backend
  tenant_admin: [],  // Maps to admin in backend
  property_manager: [],  // Maps to manager + staff in backend
  property_staff: [],  // Maps to staff in backend
};

// ============================================
// Scope → derived roles (mirrors backend scopeToRoles)
// ============================================

const SCOPE_TO_ROLES: Record<string, readonly string[]> = {
  super_admin: ['super_admin'],
  platform_admin: ['platform_admin'],
  tenant_owner: ['tenant_owner', 'admin'],
  tenant_admin: ['admin'],
  property_manager: ['manager', 'staff'],
  property_staff: ['staff'],
  customer: ['customer'],
};

// ============================================
// Authorization context
// ============================================

export interface AuthorizationContext {
  /** The user's effective roles (scope-derived + legacy JWT roles). */
  roles: readonly string[];

  /** The user's scope from JWT. */
  scope: string | null;

  /** All permissions the user holds (union of role permissions). */
  permissions: ReadonlySet<string>;

  // --- Role checks ---
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;

  // --- Permission checks ---
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;

  // --- Convenience: resource:action ---
  canDo: (resource: string, action: string) => boolean;

  // --- Module-scoped permissions ---
  canViewModule: (slug: string) => boolean;
  canOrderModule: (slug: string) => boolean;
  canManageModule: (slug: string) => boolean;
  canAdminModule: (slug: string) => boolean;

  // --- Scope-level flags ---
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
  isTenantOwner: boolean;
  isTenantAdmin: boolean;
  isPropertyManager: boolean;
  isPropertyStaff: boolean;
  isCustomer: boolean;

  // --- Role-level flags (backward-compat) ---
  isStaff: boolean;
  isManager: boolean;
  isAdmin: boolean;

  // --- Property context ---
  activePropertyId: string | null;
}

// ============================================
// Permission resolution
// ============================================

function resolvePermissions(roles: readonly string[]): ReadonlySet<string> {
  const perms = new Set<string>();

  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role];
    if (!rolePerms) continue;

    // Wildcard roles (admin, super_admin) get all known permissions
    if (role === 'admin' || role === 'super_admin') {
      // Add all known permissions
      for (const permSet of Object.values(ROLE_PERMISSIONS)) {
        for (const p of permSet) perms.add(p);
      }
      // Also add module-scoped wildcard
      perms.add('*');
      continue;
    }

    for (const p of rolePerms) {
      perms.add(p);
    }
  }

  return perms;
}

function resolveEffectiveRoles(userScope: string | undefined, userRoles: string[]): string[] {
  const effective = new Set<string>();

  // Scope-derived roles (primary)
  if (userScope) {
    const scopeRoles = SCOPE_TO_ROLES[userScope];
    if (scopeRoles) {
      for (const r of scopeRoles) effective.add(r);
    }
  }

  // JWT roles (backward-compat)
  for (const r of userRoles) {
    effective.add(r);
  }

  return Array.from(effective);
}

// ============================================
// Hook
// ============================================

/**
 * @param overridePropertyId When provided (e.g. from useParams()), bypasses
 * PropertyContext entirely. Useful at layout level where PropertyProvider
 * wraps children but the layout itself is outside the provider.
 */
export function useAuthorization(overridePropertyId?: string | null): AuthorizationContext {
  const { user } = useAuth();
  const propertyCtx = usePropertySafe();
  const activePropertyId = overridePropertyId ?? propertyCtx.activePropertyId;

  const userScope = user?.scope;
  const userRoles = user?.roles ?? [];

  const roles = useMemo(
    () => resolveEffectiveRoles(userScope, userRoles),
    [userScope, userRoles],
  );

  const permissions = useMemo(() => resolvePermissions(roles), [roles]);

  const isSuperAdmin = roles.includes('super_admin');
  const isAdmin = isSuperAdmin || roles.includes('admin') || roles.includes('tenant_owner') || roles.includes('tenant_admin');
  const isManager = isAdmin || roles.includes('manager') || roles.includes('property_manager');
  const isStaff = isManager || roles.includes('staff') || roles.includes('property_staff');
  const isCustomer = roles.includes('customer');

  const hasRole = useCallback(
    (role: string) => roles.includes(role),
    [roles],
  );

  const hasAnyRole = useCallback(
    (checkRoles: string[]) => checkRoles.some((r) => roles.includes(r)),
    [roles],
  );

  const hasPermission = useCallback(
    (permission: string) => {
      // Wildcard check
      if (permissions.has('*')) return true;
      // Exact match
      if (permissions.has(permission)) return true;
      // Module-scoped wildcard: module:{slug}:* matches any action on that module
      const parts = permission.split(':');
      if (parts.length === 3 && parts[2] !== '*') {
        const wildcardPerm = `${parts[0]}:${parts[1]}:*`;
        if (permissions.has(wildcardPerm)) return true;
      }
      return false;
    },
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (checkPerms: string[]) => checkPerms.some((p) => hasPermission(p)),
    [hasPermission],
  );

  const hasAllPermissions = useCallback(
    (checkPerms: string[]) => checkPerms.every((p) => hasPermission(p)),
    [hasPermission],
  );

  const canDo = useCallback(
    (resource: string, action: string) => hasPermission(`${resource}:${action}`),
    [hasPermission],
  );

  // Module-scoped permission checks
  const canViewModule = useCallback(
    (slug: string) => hasPermission(`module:${slug}:view`) || hasPermission(`module:${slug}:*`),
    [hasPermission],
  );
  const canOrderModule = useCallback(
    (slug: string) => hasPermission(`module:${slug}:order`) || hasPermission(`module:${slug}:*`),
    [hasPermission],
  );
  const canManageModule = useCallback(
    (slug: string) => hasPermission(`module:${slug}:manage`) || hasPermission(`module:${slug}:*`),
    [hasPermission],
  );
  const canAdminModule = useCallback(
    (slug: string) => hasPermission(`module:${slug}:admin`) || hasPermission(`module:${slug}:*`),
    [hasPermission],
  );

  return useMemo(
    () => ({
      roles,
      scope: userScope ?? null,
      permissions,
      hasRole,
      hasAnyRole,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canDo,
      canViewModule,
      canOrderModule,
      canManageModule,
      canAdminModule,
      isSuperAdmin,
      isPlatformAdmin: userScope === 'platform_admin',
      isTenantOwner: userScope === 'tenant_owner',
      isTenantAdmin: userScope === 'tenant_admin',
      isPropertyManager: userScope === 'property_manager',
      isPropertyStaff: userScope === 'property_staff',
      isCustomer,
      isStaff,
      isManager,
      isAdmin,
      activePropertyId,
    }),
    [
      roles, userScope, permissions,
      hasRole, hasAnyRole, hasPermission, hasAnyPermission, hasAllPermissions,
      canDo, canViewModule, canOrderModule, canManageModule, canAdminModule,
      isSuperAdmin, isCustomer, isStaff, isManager, isAdmin,
      activePropertyId,
    ],
  );
}
