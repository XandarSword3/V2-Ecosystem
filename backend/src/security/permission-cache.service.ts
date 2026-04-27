import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { Permissions, RolePermissions, type Permission, type Role } from './permissions.js';

type PermissionSlug = string;
type RoleName = string;

class PermissionCacheService {
  private permissionByRole = new Map<RoleName, Set<PermissionSlug>>();
  private loaded = false;
  private lastRefreshAt: string | null = null;

  async initialize(): Promise<void> {
    await this.refreshCache();
  }

  hasPermission(roleName: string, permissionSlug: string): boolean {
    if (!this.loaded) {
      this.loadFallbackFromStaticPermissions();
    }

    // Super admin: wildcard grants everything.
    if (roleName === 'super_admin') {
      const superAdmin = this.permissionByRole.get('super_admin');
      return Boolean(superAdmin?.has('*') || superAdmin?.has(permissionSlug));
    }

    const direct = this.permissionByRole.get(roleName);
    if (direct?.has(permissionSlug)) {
      return true;
    }

    return false;
  }

  getPermissionsForRole(roleName: string): string[] {
    if (!this.loaded) {
      this.loadFallbackFromStaticPermissions();
    }
    return Array.from(this.permissionByRole.get(roleName) ?? []);
  }

  getPermissionsForRoles(roleNames: string[]): string[] {
    const granted = new Set<string>();
    roleNames.forEach((roleName) => {
      this.getPermissionsForRole(roleName).forEach((permission) => granted.add(permission));
    });
    return Array.from(granted);
  }

  async refreshCache(): Promise<void> {
    const supabase = getSupabase();
    try {
      const [{ data: permissions, error: permissionsError }, { data: rolePermissions, error: rolePermissionsError }] = await Promise.all([
        supabase.from('app_permissions').select('slug'),
        supabase.from('app_role_permissions').select('role_name, permission_slug'),
      ]);

      if (permissionsError) throw permissionsError;
      if (rolePermissionsError) throw rolePermissionsError;

      const knownPermissions = new Set((permissions ?? []).map((row) => row.slug));
      const nextMap = new Map<RoleName, Set<PermissionSlug>>();

      (rolePermissions ?? []).forEach((row) => {
        if (!knownPermissions.has(row.permission_slug)) return;
        const current = nextMap.get(row.role_name) ?? new Set<PermissionSlug>();
        current.add(row.permission_slug);
        nextMap.set(row.role_name, current);
      });

      this.permissionByRole = nextMap;
      this.loaded = true;
      this.lastRefreshAt = new Date().toISOString();
      logger.info(`[Permission Cache] Refreshed from database at ${this.lastRefreshAt}`);
    } catch (error) {
      logger.warn('[Permission Cache] Failed to refresh from database, using static permissions fallback.', error);
      this.loadFallbackFromStaticPermissions();
    }
  }

  getStatus(): { loaded: boolean; lastRefreshAt: string | null; roleCount: number } {
    return {
      loaded: this.loaded,
      lastRefreshAt: this.lastRefreshAt,
      roleCount: this.permissionByRole.size,
    };
  }

  private loadFallbackFromStaticPermissions(): void {
    const nextMap = new Map<RoleName, Set<PermissionSlug>>();
    const allPermissions = new Set(Object.values(Permissions) as Permission[]);

    Object.entries(RolePermissions).forEach(([roleName, permissionList]) => {
      if (permissionList.includes('*')) {
        nextMap.set(roleName, new Set(['*', ...allPermissions]));
        return;
      }
      nextMap.set(roleName, new Set(permissionList as Permission[]));
    });

    this.permissionByRole = nextMap;
    this.loaded = true;
    if (!this.lastRefreshAt) {
      this.lastRefreshAt = new Date().toISOString();
    }
  }
}

export const permissionCache = new PermissionCacheService();

export function getFallbackRolePermissionRows(): Array<{ role_name: string; permission_slug: string }> {
  const rows: Array<{ role_name: string; permission_slug: string }> = [];
  const allPermissions = Object.values(Permissions) as Permission[];

  Object.entries(RolePermissions).forEach(([roleName, permissions]) => {
    if (permissions.includes('*')) {
      allPermissions.forEach((permission) => {
        rows.push({ role_name: roleName as Role, permission_slug: permission });
      });
      return;
    }

    (permissions as Permission[]).forEach((permission) => {
      rows.push({ role_name: roleName as Role, permission_slug: permission });
    });
  });

  return rows;
}
