import { describe, it, expect } from 'vitest';
import {
  Roles,
  Permissions,
  RolePermissions,
  roleHasPermission,
  hasPermission,
  getPermissionsForRoles,
  isSuperAdmin,
  isAdmin,
  isStaff,
  scopeToRoles,
  scopeIsPlatformAdmin,
  EndpointPermissions,
} from '../../../src/security/permissions.js';

describe('Permissions & RBAC Engine (Unit Tests)', () => {
  describe('roleHasPermission', () => {
    it('should grant full wildcard access to super_admin', () => {
      expect(roleHasPermission(Roles.SUPER_ADMIN, Permissions.USER_DELETE_ANY)).toBe(true);
      expect(roleHasPermission(Roles.SUPER_ADMIN, Permissions.ADMIN_SETTINGS)).toBe(true);
      expect(roleHasPermission(Roles.SUPER_ADMIN, Permissions.PAYMENT_REFUND)).toBe(true);
    });

    it('should grant full wildcard access to admin', () => {
      expect(roleHasPermission(Roles.ADMIN, Permissions.ADMIN_MODULES)).toBe(true);
      expect(roleHasPermission(Roles.ADMIN, Permissions.PAYMENT_REFUND)).toBe(true);
      expect(roleHasPermission(Roles.ADMIN, Permissions.LOYALTY_ADJUST)).toBe(true);
    });

    it('should enforce strict role boundary for customer', () => {
      expect(roleHasPermission(Roles.CUSTOMER, Permissions.ORDER_CREATE)).toBe(true);
      expect(roleHasPermission(Roles.CUSTOMER, Permissions.PAYMENT_CREATE)).toBe(true);
      expect(roleHasPermission(Roles.CUSTOMER, Permissions.USER_READ_SELF)).toBe(true);

      // Negative boundaries (customer must NOT have administrative powers)
      expect(roleHasPermission(Roles.CUSTOMER, Permissions.ORDER_READ_ALL)).toBe(false);
      expect(roleHasPermission(Roles.CUSTOMER, Permissions.PAYMENT_REFUND)).toBe(false);
      expect(roleHasPermission(Roles.CUSTOMER, Permissions.ADMIN_DASHBOARD)).toBe(false);
      expect(roleHasPermission(Roles.CUSTOMER, Permissions.USER_MANAGE_ROLES)).toBe(false);
    });

    it('should enforce staff boundaries', () => {
      expect(roleHasPermission(Roles.STAFF, Permissions.ORDER_READ_ALL)).toBe(true);
      expect(roleHasPermission(Roles.STAFF, Permissions.ORDER_UPDATE)).toBe(true);
      expect(roleHasPermission(Roles.STAFF, Permissions.PAYMENT_RECORD_CASH)).toBe(true);

      // Staff cannot manage admin settings or issue refunds
      expect(roleHasPermission(Roles.STAFF, Permissions.ADMIN_SETTINGS)).toBe(false);
      expect(roleHasPermission(Roles.STAFF, Permissions.PAYMENT_REFUND)).toBe(false);
    });

    it('should enforce guest permissions to read-only minimal scope', () => {
      expect(roleHasPermission(Roles.GUEST, Permissions.REVIEW_READ)).toBe(true);
      expect(roleHasPermission(Roles.GUEST, Permissions.ORDER_CREATE)).toBe(false);
      expect(roleHasPermission(Roles.GUEST, Permissions.PAYMENT_CREATE)).toBe(false);
    });

    it('should return false for unrecognized role', () => {
      expect(roleHasPermission('unknown_role' as any, Permissions.ORDER_CREATE)).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should return true if any role in array possesses permission', () => {
      const userRoles = [Roles.CUSTOMER, Roles.STAFF];
      expect(hasPermission(userRoles, Permissions.ORDER_READ_ALL)).toBe(true);
    });

    it('should return false if roles array is empty or undefined', () => {
      expect(hasPermission([], Permissions.ORDER_CREATE)).toBe(false);
      expect(hasPermission(undefined as any, Permissions.ORDER_CREATE)).toBe(false);
    });

    it('should return false if none of the roles possess permission', () => {
      const userRoles = [Roles.CUSTOMER, Roles.GUEST];
      expect(hasPermission(userRoles, Permissions.ADMIN_SETTINGS)).toBe(false);
    });
  });

  describe('getPermissionsForRoles', () => {
    it('should return all permissions if any role contains wildcard', () => {
      const perms = getPermissionsForRoles([Roles.ADMIN]);
      const allPermissions = Object.values(Permissions);
      expect(perms.length).toBe(allPermissions.length);
      expect(perms).toEqual(expect.arrayContaining(allPermissions));
    });

    it('should aggregate union of permissions without duplicates for non-wildcard roles', () => {
      const perms = getPermissionsForRoles([Roles.CUSTOMER, Roles.STAFF]);
      expect(perms).toContain(Permissions.ORDER_CREATE);
      expect(perms).toContain(Permissions.ORDER_READ_ALL);
      expect(perms).toContain(Permissions.PAYMENT_CREATE);
      expect(perms).not.toContain(Permissions.ADMIN_SETTINGS);
      // Ensure no duplicates
      const uniquePerms = new Set(perms);
      expect(perms.length).toBe(uniquePerms.size);
    });

    it('should ignore invalid or unknown roles in array', () => {
      const perms = getPermissionsForRoles(['fake_role', Roles.GUEST]);
      expect(perms).toEqual([Permissions.REVIEW_READ]);
    });
  });

  describe('role hierarchy assertions (isSuperAdmin, isAdmin, isStaff)', () => {
    it('should accurately verify isSuperAdmin', () => {
      expect(isSuperAdmin([Roles.SUPER_ADMIN])).toBe(true);
      expect(isSuperAdmin([Roles.ADMIN, Roles.STAFF])).toBe(false);
    });

    it('should accurately verify isAdmin across manager, admin, and super_admin', () => {
      expect(isAdmin([Roles.SUPER_ADMIN])).toBe(true);
      expect(isAdmin([Roles.ADMIN])).toBe(true);
      expect(isAdmin([Roles.MANAGER])).toBe(true);
      expect(isAdmin([Roles.STAFF])).toBe(false);
      expect(isAdmin([Roles.CUSTOMER])).toBe(false);
    });

    it('should accurately verify isStaff across staff, manager, admin, super_admin', () => {
      expect(isStaff([Roles.STAFF])).toBe(true);
      expect(isStaff([Roles.MANAGER])).toBe(true);
      expect(isStaff([Roles.ADMIN])).toBe(true);
      expect(isStaff([Roles.SUPER_ADMIN])).toBe(true);
      expect(isStaff([Roles.CUSTOMER])).toBe(false);
      expect(isStaff([Roles.GUEST])).toBe(false);
    });
  });

  describe('scopeToRoles & scopeIsPlatformAdmin', () => {
    it('should correctly map user scopes to roles', () => {
      expect(scopeToRoles('super_admin')).toEqual(['super_admin']);
      expect(scopeToRoles('platform_admin')).toEqual(['platform_admin']);
      expect(scopeToRoles('tenant_owner')).toEqual(['tenant_owner', 'admin']);
      expect(scopeToRoles('tenant_admin')).toEqual(['admin']);
      expect(scopeToRoles('property_manager')).toEqual(['manager', 'staff']);
      expect(scopeToRoles('property_staff')).toEqual(['staff']);
      expect(scopeToRoles('customer')).toEqual(['customer']);
      expect(scopeToRoles('invalid_scope' as any)).toEqual(['customer']);
    });

    it('should identify platform admins by scope', () => {
      expect(scopeIsPlatformAdmin('super_admin')).toBe(true);
      expect(scopeIsPlatformAdmin('platform_admin')).toBe(true);
      expect(scopeIsPlatformAdmin('tenant_owner')).toBe(false);
      expect(scopeIsPlatformAdmin('tenant_admin')).toBe(false);
      expect(scopeIsPlatformAdmin('property_manager')).toBe(false);
      expect(scopeIsPlatformAdmin('customer')).toBe(false);
    });
  });

  describe('EndpointPermissions definition contract', () => {
    it('should define public auth endpoints with null permission requirements', () => {
      const registerEp = EndpointPermissions['/api/v1/auth/register'];
      expect(registerEp[0].permission).toBeNull();
      const loginEp = EndpointPermissions['/api/v1/auth/login'];
      expect(loginEp[0].permission).toBeNull();
    });

    it('should protect administrative and management endpoints with explicit permissions', () => {
      const adminUsersEp = EndpointPermissions['/api/v1/admin/users'];
      expect(adminUsersEp.some(e => e.permission === Permissions.USER_READ_ANY)).toBe(true);
      expect(adminUsersEp.some(e => e.permission === Permissions.USER_MANAGE_ROLES)).toBe(true);

      const refundEp = EndpointPermissions['/api/v1/payments/transactions/:id/refund'];
      expect(refundEp[0].permission).toBe(Permissions.PAYMENT_REFUND);
    });
  });
});
