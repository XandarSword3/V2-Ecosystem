/**
 * Permission and Role Definitions for V2 Ecosystem
 * 
 * This is the single source of truth for authorization.
 * ALL authorization checks MUST happen on the backend.
 * Frontend role checks are for UI/UX only and MUST NOT be trusted.
 * 
 * @module security/permissions
 */

// ============================================
// ROLE DEFINITIONS
// ============================================

export const Roles = {
  // Customer role - default for all registered users
  CUSTOMER: 'customer',
  // Guest role - unauthenticated users with limited access
  GUEST: 'guest',
  
  // Staff roles - engine-neutral generic staff role
  STAFF: 'staff',

  // Manager role - cross-module oversight
  MANAGER: 'manager',
  
  // Admin - full admin access
  ADMIN: 'admin',
  
  // Super admin - full system access including dangerous operations
  SUPER_ADMIN: 'super_admin',
} as const;

export type Role = typeof Roles[keyof typeof Roles];

// ============================================
// PERMISSION DEFINITIONS
// ============================================

export const Permissions = {
  // User permissions
  USER_READ_SELF: 'user:read:self',
  USER_UPDATE_SELF: 'user:update:self',
  USER_READ_ANY: 'user:read:any',
  USER_UPDATE_ANY: 'user:update:any',
  USER_DELETE_ANY: 'user:delete:any',
  USER_MANAGE_ROLES: 'user:manage:roles',

  // Catalog permissions (engine A — instant_transaction: F&B, retail, any item-based sale)
  CATALOG_READ: 'catalog:read',
  CATALOG_WRITE: 'catalog:write',
  CATALOG_CATEGORY_MANAGE: 'catalog:category:manage',
  CATALOG_SEATING_MANAGE: 'catalog:seating:manage', // generic seating/table layout config
  CATALOG_STATS: 'catalog:stats:read',

  // Order permissions (engine A — instant_transaction)
  ORDER_CREATE: 'order:create',
  ORDER_READ_OWN: 'order:read:own',
  ORDER_READ_ALL: 'order:read:all',
  ORDER_UPDATE: 'order:update',

  // Reservation permissions (engine B — time_exclusive_reservation)
  RESERVATION_CREATE: 'reservation:create',
  RESERVATION_READ_OWN: 'reservation:read:own',
  RESERVATION_READ_ALL: 'reservation:read:all',
  RESERVATION_UPDATE: 'reservation:update',
  RESERVATION_CANCEL: 'reservation:cancel',
  RESERVATION_STATS: 'reservation:stats:read',

  // Unit permissions (engine B — bookable units backing time_exclusive_reservation)
  UNIT_READ: 'unit:read',
  UNIT_WRITE: 'unit:write',
  UNIT_PRICING_MANAGE: 'unit:pricing:manage',

  // Access permissions (engine C — shared_capacity_access: pool, venue access, timed entry)
  ACCESS_CREATE: 'access:create',
  ACCESS_READ_OWN: 'access:read:own',
  ACCESS_READ_ALL: 'access:read:all',
  ACCESS_VALIDATE: 'access:validate',
  ACCESS_SESSION_READ: 'access:session:read',
  ACCESS_SESSION_MANAGE: 'access:session:manage',
  ACCESS_STATS: 'access:stats:read',

  // Entitlement permissions (engine D — ongoing_entitlement: memberships, subscriptions)
  ENTITLEMENT_READ_OWN: 'entitlement:read:own',
  ENTITLEMENT_READ_ALL: 'entitlement:read:all',
  ENTITLEMENT_MANAGE: 'entitlement:manage',

  // Payment permissions
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_READ_OWN: 'payment:read:own',
  PAYMENT_READ_ALL: 'payment:read:all',
  PAYMENT_REFUND: 'payment:refund',
  PAYMENT_RECORD_CASH: 'payment:record:cash',

  // Loyalty permissions
  LOYALTY_READ_SELF: 'loyalty:read:self',
  LOYALTY_READ_ANY: 'loyalty:read:any',
  LOYALTY_EARN: 'loyalty:earn',
  LOYALTY_REDEEM: 'loyalty:redeem',
  LOYALTY_ADJUST: 'loyalty:adjust',
  LOYALTY_SETTINGS: 'loyalty:settings:manage',

  // Gift card permissions
  GIFTCARD_PURCHASE: 'giftcard:purchase',
  GIFTCARD_REDEEM: 'giftcard:redeem',
  GIFTCARD_MANAGE: 'giftcard:manage',

  // Coupon permissions
  COUPON_USE: 'coupon:use',
  COUPON_MANAGE: 'coupon:manage',

  // Support permissions
  SUPPORT_TICKET_CREATE: 'support:ticket:create',
  SUPPORT_TICKET_READ_OWN: 'support:ticket:read:own',
  SUPPORT_TICKET_READ_ALL: 'support:ticket:read:all',
  SUPPORT_TICKET_RESPOND: 'support:ticket:respond',

  // Review permissions
  REVIEW_CREATE: 'review:create',
  REVIEW_READ: 'review:read',
  REVIEW_MODERATE: 'review:moderate',

  // Housekeeping permissions
  HOUSEKEEPING_TASK_READ: 'housekeeping:task:read',
  HOUSEKEEPING_TASK_UPDATE: 'housekeeping:task:update',
  HOUSEKEEPING_TASK_MANAGE: 'housekeeping:task:manage',

  // Inventory permissions
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_MANAGE: 'inventory:manage',

  // Admin permissions
  ADMIN_DASHBOARD: 'admin:dashboard:read',
  ADMIN_SETTINGS: 'admin:settings:manage',
  ADMIN_MODULES: 'admin:modules:manage',
  ADMIN_CMS: 'admin:cms:manage',
  ADMIN_REPORTS: 'admin:reports:read',
  ADMIN_AUDIT_LOG: 'admin:audit:read',

  // Device/notification permissions
  DEVICE_REGISTER: 'device:register',
  NOTIFICATION_SEND: 'notification:send',
} as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

// ============================================
// ROLE-PERMISSION MATRIX
// ============================================

export const RolePermissions: Record<Role, (Permission | '*')[]> = {
  // Guest - minimal permissions for browsing
  [Roles.GUEST]: [
    Permissions.REVIEW_READ,
  ],

  // Customer - basic user permissions
  [Roles.CUSTOMER]: [
    Permissions.USER_READ_SELF,
    Permissions.USER_UPDATE_SELF,
    Permissions.ORDER_CREATE,
    Permissions.PAYMENT_CREATE,
    Permissions.PAYMENT_READ_OWN,
    Permissions.LOYALTY_READ_SELF,
    Permissions.GIFTCARD_PURCHASE,
    Permissions.GIFTCARD_REDEEM,
    Permissions.COUPON_USE,
    Permissions.SUPPORT_TICKET_CREATE,
    Permissions.SUPPORT_TICKET_READ_OWN,
    Permissions.REVIEW_CREATE,
    Permissions.REVIEW_READ,
    Permissions.DEVICE_REGISTER,
  ],

  // Staff - generic role, engine-agnostic (engine refit)
  [Roles.STAFF]: [
    Permissions.USER_READ_SELF,
    Permissions.USER_UPDATE_SELF,
    Permissions.PAYMENT_RECORD_CASH,
    Permissions.LOYALTY_EARN,
    Permissions.INVENTORY_READ,
    Permissions.INVENTORY_UPDATE,
    Permissions.DEVICE_REGISTER,
  ],

  // Manager - cross-module oversight
  [Roles.MANAGER]: [
    Permissions.USER_READ_SELF,
    Permissions.USER_UPDATE_SELF,
    Permissions.USER_READ_ANY,
    Permissions.PAYMENT_READ_ALL,
    Permissions.PAYMENT_RECORD_CASH,
    Permissions.LOYALTY_READ_ANY,
    Permissions.LOYALTY_ADJUST,
    Permissions.LOYALTY_EARN,
    Permissions.SUPPORT_TICKET_READ_ALL,
    Permissions.SUPPORT_TICKET_RESPOND,
    Permissions.REVIEW_MODERATE,
    Permissions.HOUSEKEEPING_TASK_MANAGE,
    Permissions.INVENTORY_READ,
    Permissions.INVENTORY_MANAGE,
    Permissions.ADMIN_DASHBOARD,
    Permissions.ADMIN_REPORTS,
    Permissions.DEVICE_REGISTER,
  ],

  // Admin - full system access except super-admin-only operations
  [Roles.ADMIN]: [
    '*', // All permissions
    // All payment permissions
    Permissions.PAYMENT_CREATE,
    Permissions.PAYMENT_READ_OWN,
    Permissions.PAYMENT_READ_ALL,
    Permissions.PAYMENT_REFUND,
    Permissions.PAYMENT_RECORD_CASH,
    // All loyalty permissions
    Permissions.LOYALTY_READ_SELF,
    Permissions.LOYALTY_READ_ANY,
    Permissions.LOYALTY_EARN,
    Permissions.LOYALTY_REDEEM,
    Permissions.LOYALTY_ADJUST,
    Permissions.LOYALTY_SETTINGS,
    // Gift card & coupon management
    Permissions.GIFTCARD_PURCHASE,
    Permissions.GIFTCARD_REDEEM,
    Permissions.GIFTCARD_MANAGE,
    Permissions.COUPON_USE,
    Permissions.COUPON_MANAGE,
    // Support
    Permissions.SUPPORT_TICKET_CREATE,
    Permissions.SUPPORT_TICKET_READ_OWN,
    Permissions.SUPPORT_TICKET_READ_ALL,
    Permissions.SUPPORT_TICKET_RESPOND,
    // Reviews
    Permissions.REVIEW_CREATE,
    Permissions.REVIEW_READ,
    Permissions.REVIEW_MODERATE,
    // Housekeeping
    Permissions.HOUSEKEEPING_TASK_READ,
    Permissions.HOUSEKEEPING_TASK_UPDATE,
    Permissions.HOUSEKEEPING_TASK_MANAGE,
    // Inventory
    Permissions.INVENTORY_READ,
    Permissions.INVENTORY_UPDATE,
    Permissions.INVENTORY_MANAGE,
    // Admin
    Permissions.ADMIN_DASHBOARD,
    Permissions.ADMIN_SETTINGS,
    Permissions.ADMIN_MODULES,
    Permissions.ADMIN_CMS,
    Permissions.ADMIN_REPORTS,
    Permissions.ADMIN_AUDIT_LOG,
    // Devices & notifications
    Permissions.DEVICE_REGISTER,
    Permissions.NOTIFICATION_SEND,
  ],

  // Super Admin - full access (uses wildcard)
  [Roles.SUPER_ADMIN]: ['*'],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const perms = RolePermissions[role];
  if (!perms) return false;
  // Super admin has all permissions
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

/**
 * Check if any of the given roles has a specific permission
 */
export function hasPermission(roles: string[], permission: Permission): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some(role => roleHasPermission(role as Role, permission));
}

/**
 * Get all permissions for a set of roles (union)
 */
export function getPermissionsForRoles(roles: string[]): Permission[] {
  const permissionSet = new Set<Permission>();
  
  for (const role of roles) {
    const perms = RolePermissions[role as Role];
    if (!perms) continue;
    
    // If role has wildcard, return all permissions
    if (perms.includes('*')) {
      return Object.values(Permissions);
    }
    
    perms.forEach(p => {
      if (p !== '*') permissionSet.add(p as Permission);
    });
  }
  
  return Array.from(permissionSet);
}

/**
 * Check if user is super admin
 */
export function isSuperAdmin(roles: string[]): boolean {
  return roles.includes(Roles.SUPER_ADMIN);
}

/**
 * Check if user is admin (any admin role)
 */
export function isAdmin(roles: string[]): boolean {
  const adminRoles = [
    Roles.MANAGER,
    Roles.ADMIN,
    Roles.SUPER_ADMIN,
  ];
  return roles.some(role => (adminRoles as string[]).includes(role));
}

/**
 * Check if user is staff (any staff role)
 */
export function isStaff(roles: string[]): boolean {
  const staffRoles = [
    Roles.STAFF,
    Roles.MANAGER,
    Roles.ADMIN,
    Roles.SUPER_ADMIN,
  ];
  return roles.some(role => (staffRoles as string[]).includes(role));
}

// ============================================
// USER SCOPE MODEL
// ============================================

export type UserScope = 
  | 'super_admin'
  | 'platform_admin'
  | 'tenant_owner'
  | 'tenant_admin'
  | 'property_manager'
  | 'property_staff'
  | 'customer';

/**
 * Map user scope to derived roles[] for backward compatibility
 * with existing route guards that check roles.
 */
export function scopeToRoles(scope: UserScope): string[] {
  switch (scope) {
    case 'super_admin':
      return ['super_admin'];
    case 'platform_admin':
      return ['platform_admin'];
    case 'tenant_owner':
      return ['admin'];
    case 'tenant_admin':
      return ['admin'];
    case 'property_manager':
      return ['manager', 'staff'];
    case 'property_staff':
      return ['staff'];
    case 'customer':
      return ['customer'];
    default:
      return ['customer'];
  }
}

/**
 * Derive isPlatformAdmin flag from scope
 */
export function scopeIsPlatformAdmin(scope: UserScope): boolean {
  return scope === 'super_admin' || scope === 'platform_admin';
}

// ============================================
// ENDPOINT PERMISSION MAPPING
// ============================================
/**
 * Maps API endpoints to required permissions.
 * This is used for documentation and validation.
 */
export const EndpointPermissions: Record<string, { method: string; permission: Permission | null; description: string }[]> = {
  // Auth endpoints (public)
  '/api/v1/auth/register': [{ method: 'POST', permission: null, description: 'Public registration' }],
  '/api/v1/auth/login': [{ method: 'POST', permission: null, description: 'Public login' }],
  '/api/v1/auth/refresh': [{ method: 'POST', permission: null, description: 'Token refresh' }],
  '/api/v1/auth/me': [{ method: 'GET', permission: Permissions.USER_READ_SELF, description: 'Get own profile' }],
  
  // Device endpoints
  '/api/v1/devices': [
    { method: 'GET', permission: Permissions.DEVICE_REGISTER, description: 'List own devices' },
  ],
  '/api/v1/devices/register': [
    { method: 'POST', permission: Permissions.DEVICE_REGISTER, description: 'Register device' },
  ],
  
  // Dynamic module endpoints (engine-based, all modules share these paths)
  '/api/v1/{moduleSlug}/items': [
    { method: 'GET', permission: null, description: 'Public catalog items list' },
  ],
  '/api/v1/{moduleSlug}/orders': [
    { method: 'POST', permission: Permissions.ORDER_CREATE, description: 'Create instant_transaction order' },
    { method: 'GET', permission: Permissions.ORDER_READ_ALL, description: 'List all orders (staff)' },
  ],
  '/api/v1/staff/modules/{moduleSlug}/orders/:id/status': [
    { method: 'PUT', permission: Permissions.ORDER_UPDATE, description: 'Update order status (staff)' },
    { method: 'PATCH', permission: Permissions.ORDER_UPDATE, description: 'Update order status (staff)' },
  ],

  // time_exclusive_reservation endpoints
  '/api/v1/{moduleSlug}/units': [
    { method: 'GET', permission: null, description: 'Public bookable unit list' },
  ],
  '/api/v1/{moduleSlug}/bookings': [
    { method: 'POST', permission: Permissions.RESERVATION_CREATE, description: 'Create booking' },
  ],

  // shared_capacity_access endpoints
  '/api/v1/{moduleSlug}/capacity-windows': [
    { method: 'GET', permission: null, description: 'Public capacity window list' },
  ],
  '/api/v1/{moduleSlug}/access-tickets': [
    { method: 'POST', permission: Permissions.ACCESS_CREATE, description: 'Purchase access ticket' },
  ],
  '/api/v1/{moduleSlug}/access-tickets/:id/validate': [
    { method: 'POST', permission: Permissions.ACCESS_VALIDATE, description: 'Validate ticket (staff)' },
  ],
  
  // Payment endpoints
  '/api/v1/payments/create-intent': [
    { method: 'POST', permission: Permissions.PAYMENT_CREATE, description: 'Create payment intent' },
  ],
  '/api/v1/payments/transactions': [
    { method: 'GET', permission: Permissions.PAYMENT_READ_ALL, description: 'List all transactions (admin)' },
  ],
  '/api/v1/payments/transactions/:id/refund': [
    { method: 'POST', permission: Permissions.PAYMENT_REFUND, description: 'Refund payment (admin)' },
  ],
  
  // Loyalty endpoints
  '/api/v1/loyalty/me': [
    { method: 'GET', permission: Permissions.LOYALTY_READ_SELF, description: 'Get own loyalty account' },
  ],
  '/api/v1/loyalty/accounts': [
    { method: 'GET', permission: Permissions.LOYALTY_READ_ANY, description: 'List all accounts (admin)' },
  ],
  '/api/v1/loyalty/adjust': [
    { method: 'POST', permission: Permissions.LOYALTY_ADJUST, description: 'Adjust points (admin)' },
  ],
  
  // Admin endpoints
  '/api/v1/admin/dashboard': [
    { method: 'GET', permission: Permissions.ADMIN_DASHBOARD, description: 'Admin dashboard' },
  ],
  '/api/v1/admin/users': [
    { method: 'GET', permission: Permissions.USER_READ_ANY, description: 'List users' },
    { method: 'POST', permission: Permissions.USER_MANAGE_ROLES, description: 'Create user' },
  ],
  '/api/v1/admin/settings': [
    { method: 'GET', permission: Permissions.ADMIN_SETTINGS, description: 'Read settings' },
    { method: 'PUT', permission: Permissions.ADMIN_SETTINGS, description: 'Update settings' },
  ],
};

export default {
  Roles,
  Permissions,
  RolePermissions,
  EndpointPermissions,
  roleHasPermission,
  hasPermission,
  getPermissionsForRoles,
  isSuperAdmin,
  isAdmin,
  isStaff,
};
