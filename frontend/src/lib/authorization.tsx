/**
 * F2.1: Frontend Authorization Contract
 *
 * This module provides a useAuthorization() hook that models the backend's
 * canonical authorization hierarchy for PRESENTATION decisions only.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     AUTHORIZATION LAYERS                        │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │  IDENTITY          user.id, user.email                         │
 * │       ↓                                                        │
 * │  SCOPE             JWT scope: super_admin, tenant_owner, …     │
 * │                    ← primary source of truth (JWT-verified)     │
 * │       ↓                                                        │
 * │  DERIVED ROLE      scope → roles mapping                       │
 * │                    ← backward-compat, NOT used for decisions    │
 * │       ↓                                                        │
 * │  PERMISSION        resource:action[:scope] strings              │
 * │                    ← granular, role→perm matrix                 │
 * │       ↓                                                        │
 * │  PROPERTY ACCESS   user_property_access / user_group_access     │
 * │                    ← validated by backend middleware only       │
 * │       ↓                                                        │
 * │  MODULE ACCESS     module:{slug}:view|order|manage|admin        │
 * │                    ← derived from module permissions            │
 * │       ↓                                                        │
 * │  RESOURCE OWNERSHIP resource.user_id = user.id                 │
 * │                    ← validated by backend ownerOrAdmin only     │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * CRITICAL INVARIANT: This hook NEVER authorizes. It provides hints
 * for rendering: which buttons to show, which nav items to display,
 * which sections to highlight. The backend is the sole security authority.
 * A hidden button is not a security mechanism.
 *
 * Reference: backend/src/security/permissions.ts
 * Reference: backend/src/middleware/propertyAccess.middleware.ts
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
// LAYER 1: Identity
// ============================================

/**
 * The authenticated user's identity. Read-only from the JWT.
 * Never used for authorization decisions — only for display and ownership checks.
 */
export interface Identity {
  userId: string;
  email: string;
}

// ============================================
// LAYER 2: Scope (JWT-derived, primary source of truth)
// ============================================

/**
 * The user's scope as issued by the JWT. This is the PRIMARY authorization
 * signal — it determines what the user can do at the highest level.
 *
 * Backend: req.user.scope (set by auth.middleware from verified JWT payload)
 * Frontend: user.scope (from /auth/me response)
 *
 * Scope hierarchy (descending authority):
 *   super_admin > platform_admin > tenant_owner > tenant_admin
 *   > property_manager > property_staff > customer
 */
export type UserScope =
  | 'super_admin'
  | 'platform_admin'
  | 'tenant_owner'
  | 'tenant_admin'
  | 'property_manager'
  | 'property_staff'
  | 'customer'
  | '';

// ============================================
// LAYER 3: Derived Roles (backward-compat)
// ============================================

/**
 * Roles derived from scope via the backend's scopeToRoles mapping.
 * These exist for backward compatibility with route guards that check roles.
 *
 * IMPORTANT: Do not use role checks for new authorization decisions.
 * Use permission checks instead. Roles are a coarse-grained approximation
 * that does not capture module-level or resource-level access.
 */
export type DerivedRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'customer'
  | 'guest'
  | 'tenant_owner'
  | 'tenant_admin'
  | 'property_manager'
  | 'property_staff';

// ============================================
// LAYER 4: Permissions (granular, role→perm matrix)
// ============================================

/**
 * Permission constants mirroring backend/src/security/permissions.ts.
 *
 * Pattern: resource:action[:scope]
 * Examples: order:create, catalog:write, payment:refund, loyalty:adjust
 *
 * These are the ONLY strings that should appear in permission checks.
 * Do not invent new permission strings — they must exist in the backend.
 */
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
// ROLE → PERMISSION MATRIX (must match backend exactly)
// ============================================

/**
 * Role → Permission mapping. MUST be kept in sync with the backend's
 * RolePermissions in backend/src/security/permissions.ts.
 *
 * The frontend contract test (tools/authorization-contract-test.js)
 * validates this automatically. Do not add comments saying "mirrors backend"
 * — the test proves it.
 */
const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
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
    Perm.ORDER_CREATE,
    Perm.ORDER_UPDATE,
    Perm.ORDER_READ_ALL,
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
    // Wildcard: admin has all permissions (backend uses '*').
    // The hasPermission() resolver treats this role as having every Perm value.
    // Do NOT enumerate permissions here — the wildcard IS the contract.
  ],

  super_admin: [
    // Wildcard: super_admin has all permissions (backend uses '*').
  ],

  // Scope-derived pseudo-roles: these map to actual roles via SCOPE_TO_ROLES.
  // They carry no direct permissions — they are entry points into the role layer.
  tenant_owner: [],
  tenant_admin: [],
  property_manager: [],
  property_staff: [],
};

// ============================================
// LAYER 5: Scope → Derived Roles (mirrors backend scopeToRoles)
// ============================================

/**
 * Maps JWT scope to derived roles. This is the bridge between the scope
 * layer and the role layer. The backend's scopeToRoles() function is the
 * source of truth; this mapping must be kept in sync.
 */
/**
 * Scope → derived roles mapping.
 *
 * CRITICAL: This must be kept in sync with the backend's scopeToRoles()
 * in backend/src/security/permissions.ts AND with the backend's actual
 * middleware behavior.
 *
 * platform_admin: The backend's authorize() middleware passes platform_admin
 * through when the required role matches the scope. The backend's
 * requirePermission() only bypasses for super_admin. However,
 * scopeIsPlatformAdmin() treats platform_admin as privileged for property
 * access. For permission purposes, platform_admin resolves to super_admin
 * (which has wildcard permissions). This matches the backend's intent that
 * platform_admin is a platform-level operator with full access.
 */
const SCOPE_TO_ROLES: Record<string, readonly string[]> = {
  super_admin: ['super_admin'],
  // platform_admin → super_admin: backend treats as privileged operator
  // with full permission access (scopeIsPlatformAdmin, authorize bypass)
  platform_admin: ['super_admin'],
  tenant_owner: ['tenant_owner', 'admin'],
  tenant_admin: ['admin'],
  property_manager: ['manager', 'staff'],
  property_staff: ['staff'],
  customer: ['customer'],
};

// ============================================
// LAYER 6: Property/Module Access (presentation hints)
// ============================================

/**
 * Presentation-only access context. These are hints for rendering —
 * they do NOT authorize anything. The backend's validatePropertyAccess
 * and requireModulePropertyAccess middleware are the real gates.
 *
 * displayPropertyId: The property the UI is currently showing. Derived from
 *   the URL path (/{property}/...) or the PropertyContext's active selection.
 *   This is NOT an authorization override — it's a presentation hint that
 *   tells the frontend which property's data to display.
 */
export interface AccessContext {
  /** The property the UI is currently displaying (from URL or PropertyContext). */
  displayPropertyId: string | null;
  /** The property the user has selected in the property switcher. */
  activePropertyId: string | null;
}

// ============================================
// Authorization Context
// ============================================

export interface AuthorizationContext {
  // --- Layer 1: Identity ---
  identity: Identity | null;

  // --- Layer 2: Scope ---
  scope: UserScope;

  // --- Layer 3: Derived Roles ---
  roles: readonly DerivedRole[];

  // --- Layer 4: Permissions ---
  permissions: ReadonlySet<string>;
  /** Whether permissions came from the backend (resolved) or the static
   *  role matrix (fallback). When 'unavailable', the static matrix is
   *  still used but capability-sensitive components should fail closed. */
  permissionsStatus: 'loading' | 'resolved' | 'unavailable';

  // --- Layer 5: Scope-level flags ---
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
  isTenantOwner: boolean;
  isTenantAdmin: boolean;
  isPropertyManager: boolean;
  isPropertyStaff: boolean;
  isCustomer: boolean;

  // --- Role-level flags (backward-compat — prefer permission checks) ---
  isStaff: boolean;
  isManager: boolean;
  isAdmin: boolean;

  // --- Permission checks (primary authorization surface) ---
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;

  // --- Convenience: resource:action ---
  canDo: (resource: string, action: string) => boolean;

  // --- Module-scoped permission checks ---
  canViewModule: (slug: string) => boolean;
  canOrderModule: (slug: string) => boolean;
  canManageModule: (slug: string) => boolean;
  canAdminModule: (slug: string) => boolean;

  // --- Role checks (backward-compat — prefer permission checks) ---
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;

  // --- Access context (presentation-only) ---
  access: AccessContext;
}

// ============================================
// Permission Resolution
// ============================================

/**
 * Resolve the full permission set for a set of effective roles.
 * Wildcard roles (admin, super_admin) get ALL known permissions.
 */
/**
 * Resolve the permission set from the backend's resolved permissions array.
 * When the backend sends real permissions (including dynamic module-scoped
 * permissions like module:{slug}:view), use those directly.
 * This is the PRIMARY permission source when available.
 */
function resolveFromBackendPermissions(backendPerms: string[]): ReadonlySet<string> {
  return new Set(backendPerms);
}

/**
 * Resolve permissions from the static ROLE_PERMISSIONS matrix.
 * Used as a FALLBACK when backend permissions are not available
 * (e.g., before the /auth/me/permissions call completes).
 */
function resolveFromStaticMatrix(roles: readonly string[]): ReadonlySet<string> {
  const perms = new Set<string>();

  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role];
    if (!rolePerms) continue;

    // Wildcard roles get all known permissions
    if (role === 'admin' || role === 'super_admin') {
      for (const permSet of Object.values(ROLE_PERMISSIONS)) {
        for (const p of permSet) perms.add(p);
      }
      perms.add('*');
      continue;
    }

    for (const p of rolePerms) {
      perms.add(p);
    }
  }

  return perms;
}

/**
 * Resolve effective roles from scope + JWT roles.
 * Scope-derived roles take precedence; JWT roles fill gaps.
 */
function resolveEffectiveRoles(userScope: string | undefined, userRoles: string[]): DerivedRole[] {
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

  return Array.from(effective) as DerivedRole[];
}

// ============================================
// Hook
// ============================================

/**
 * @param displayPropertyId When provided, overrides PropertyContext's activePropertyId
 *   for presentation purposes. This is used at layout level where PropertyProvider
 *   wraps children but the layout itself is outside the provider.
 *
 *   CRITICAL: This parameter is a PRESENTATION hint only. It tells the frontend
 *   "the user is looking at this property's data." It does NOT authorize access.
 *   The backend's validatePropertyAccess middleware independently verifies that
 *   the authenticated user actually has access to this property. If they don't,
 *   the backend returns 403 regardless of what this hint says.
 *
 *   The value should come from the URL path (/{property}/...) or the
 *   PropertyContext's active selection — never from user input.
 */
export function useAuthorization(displayPropertyId?: string | null): AuthorizationContext {
  const { user, permissionsStatus } = useAuth();
  const propertyCtx = usePropertySafe();

  const userScope = user?.scope as string | undefined;
  const userRoles = user?.roles ?? [];

  const identity = useMemo<Identity | null>(
    () => user ? { userId: user.id, email: user.email } : null,
    [user],
  );

  const roles = useMemo(
    () => resolveEffectiveRoles(userScope, userRoles),
    [userScope, userRoles],
  );

  // F2: Permission resolution with explicit status tracking.
  // - 'resolved': use real backend permissions (includes module-scoped)
  // - 'loading': use static matrix as temporary fallback
  // - 'unavailable': use static matrix but components should fail closed
  //   for capability-sensitive rendering
  const backendPermissions = user?.permissions;
  const permissions = useMemo(
    () => backendPermissions && backendPermissions.length > 0
      ? resolveFromBackendPermissions(backendPermissions)
      : resolveFromStaticMatrix(roles),
    [backendPermissions, roles],
  );

  // Scope flags (Layer 2)
  const scope = (userScope ?? '') as UserScope;
  const isSuperAdmin = scope === 'super_admin';
  const isPlatformAdmin = scope === 'platform_admin';
  const isTenantOwner = scope === 'tenant_owner';
  const isTenantAdmin = scope === 'tenant_admin';
  const isPropertyManager = scope === 'property_manager';
  const isPropertyStaff = scope === 'property_staff';
  const isCustomer = scope === 'customer';

  // Role flags (Layer 3, backward-compat)
  const isAdmin = isSuperAdmin || roles.includes('admin') || isTenantOwner || isTenantAdmin;
  const isManager = isAdmin || roles.includes('manager') || isPropertyManager;
  const isStaff = isManager || roles.includes('staff') || isPropertyStaff;

  // Permission checks (Layer 4)
  const hasPermission = useCallback(
    (permission: string) => {
      if (permissions.has('*')) return true;
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

  // Module-scoped permission checks (Layer 6)
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

  // Role checks (backward-compat)
  const hasRole = useCallback(
    (role: string) => roles.includes(role as DerivedRole),
    [roles],
  );
  const hasAnyRole = useCallback(
    (checkRoles: string[]) => checkRoles.some((r) => roles.includes(r as DerivedRole)),
    [roles],
  );

  // Access context (Layer 6, presentation-only)
  const access = useMemo<AccessContext>(
    () => ({
      displayPropertyId: displayPropertyId ?? propertyCtx.activePropertyId ?? null,
      activePropertyId: propertyCtx.activePropertyId,
    }),
    [displayPropertyId, propertyCtx.activePropertyId],
  );

  return useMemo(
    () => ({
      identity,
      scope,
      roles,
      permissions,
      permissionsStatus,
      isSuperAdmin,
      isPlatformAdmin,
      isTenantOwner,
      isTenantAdmin,
      isPropertyManager,
      isPropertyStaff,
      isCustomer,
      isStaff,
      isManager,
      isAdmin,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canDo,
      canViewModule,
      canOrderModule,
      canManageModule,
      canAdminModule,
      hasRole,
      hasAnyRole,
      access,
    }),
    [
      identity, scope, roles, permissions, permissionsStatus,
      isSuperAdmin, isPlatformAdmin, isTenantOwner, isTenantAdmin,
      isPropertyManager, isPropertyStaff, isCustomer,
      isStaff, isManager, isAdmin,
      hasPermission, hasAnyPermission, hasAllPermissions, canDo,
      canViewModule, canOrderModule, canManageModule, canAdminModule,
      hasRole, hasAnyRole, access,
    ],
  );
}
