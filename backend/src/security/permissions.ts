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
  
  // Restaurant permissions
  RESTAURANT_MENU_READ: 'restaurant:menu:read',
  RESTAURANT_MENU_WRITE: 'restaurant:menu:write',
  RESTAURANT_ORDER_CREATE: 'restaurant:order:create',
  RESTAURANT_ORDER_READ_OWN: 'restaurant:order:read:own',
  RESTAURANT_ORDER_READ_ALL: 'restaurant:order:read:all',
  RESTAURANT_ORDER_UPDATE: 'restaurant:order:update',
  RESTAURANT_CATEGORY_MANAGE: 'restaurant:category:manage',
  RESTAURANT_TABLE_MANAGE: 'restaurant:table:manage',
  RESTAURANT_STATS: 'restaurant:stats:read',
  
  // Chalet permissions
  CHALET_READ: 'chalet:read',
  CHALET_WRITE: 'chalet:write',
  CHALET_BOOKING_CREATE: 'chalet:booking:create',
  CHALET_BOOKING_READ_OWN: 'chalet:booking:read:own',
  CHALET_BOOKING_READ_ALL: 'chalet:booking:read:all',
  CHALET_BOOKING_UPDATE: 'chalet:booking:update',
  CHALET_BOOKING_CANCEL: 'chalet:booking:cancel',
  CHALET_PRICING_MANAGE: 'chalet:pricing:manage',
  CHALET_STATS: 'chalet:stats:read',
  
  // Pool permissions
  POOL_SESSION_READ: 'pool:session:read',
  POOL_SESSION_MANAGE: 'pool:session:manage',
  POOL_TICKET_CREATE: 'pool:ticket:create',
  POOL_TICKET_READ_OWN: 'pool:ticket:read:own',
  POOL_TICKET_READ_ALL: 'pool:ticket:read:all',
  POOL_TICKET_VALIDATE: 'pool:ticket:validate',
  POOL_STATS: 'pool:stats:read',
  
  // Snack bar permissions
  SNACK_MENU_READ: 'snack:menu:read',
  SNACK_MENU_WRITE: 'snack:menu:write',
  SNACK_ORDER_CREATE: 'snack:order:create',
  SNACK_ORDER_READ_ALL: 'snack:order:read:all',
  SNACK_ORDER_UPDATE: 'snack:order:update',
  
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
    Permissions.RESTAURANT_ORDER_CREATE,
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
  
  // Restaurant endpoints
  '/api/v1/restaurant/menu': [
    { method: 'GET', permission: null, description: 'Public menu read' },
  ],
  '/api/v1/restaurant/orders': [
    { method: 'POST', permission: Permissions.RESTAURANT_ORDER_CREATE, description: 'Create order' },
    { method: 'GET', permission: Permissions.RESTAURANT_ORDER_READ_ALL, description: 'List all orders (staff)' },
  ],
  '/api/v1/restaurant/orders/:id/status': [
    { method: 'PATCH', permission: Permissions.RESTAURANT_ORDER_UPDATE, description: 'Update order status' },
  ],
  
  // Chalet endpoints
  '/api/v1/chalets': [
    { method: 'GET', permission: null, description: 'Public chalet list' },
  ],
  '/api/v1/chalets/bookings': [
    { method: 'POST', permission: Permissions.CHALET_BOOKING_CREATE, description: 'Create booking' },
  ],
  
  // Pool endpoints
  '/api/v1/pool/sessions': [
    { method: 'GET', permission: null, description: 'Public session list' },
  ],
  '/api/v1/pool/tickets': [
    { method: 'POST', permission: Permissions.POOL_TICKET_CREATE, description: 'Purchase ticket' },
  ],
  '/api/v1/pool/tickets/:id/validate': [
    { method: 'POST', permission: Permissions.POOL_TICKET_VALIDATE, description: 'Validate ticket (staff)' },
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
