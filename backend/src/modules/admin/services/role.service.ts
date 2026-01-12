import { getSupabase } from '../../../database/connection.js';

interface RoleRow {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_system: boolean;
  created_at: string;
}

interface RoleWithPermissions extends RoleRow {
  permissions: PermissionRow[];
}

interface PermissionRow {
  id: string;
  name: string;
  slug: string;
  description?: string;
  resource?: string;
  action?: string;
}

interface CreateRoleData {
  name: string;
  slug?: string;
  description?: string;
  permissions?: string[];
}

interface UpdateRoleData {
  name?: string;
  description?: string;
  permissions?: string[];
}

export class RoleService {
  private supabase = getSupabase();

  async getRoles(): Promise<RoleWithPermissions[]> {
    const { data, error } = await this.supabase
      .from('roles')
      .select(`
        id, name, slug, description, is_system, created_at,
        role_permissions(permission:permissions(id, name, slug, description))
      `)
      .order('name');

    if (error) throw error;

    interface RolePermData { permission: PermissionRow | null }
    interface RawRole extends RoleRow { role_permissions?: RolePermData[] }

    return ((data || []) as unknown as RawRole[]).map(role => ({
      ...role,
      permissions: (role.role_permissions?.map(rp => rp.permission).filter((p): p is PermissionRow => p !== null) || [])
    }));
  }

  async getRoleById(id: string): Promise<RoleWithPermissions | null> {
    const { data, error } = await this.supabase
      .from('roles')
      .select(`
        id, name, slug, description, is_system, created_at,
        role_permissions(permission:permissions(id, name, slug, description))
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;

    interface RolePermData { permission: PermissionRow | null }
    const roleData = data as unknown as RoleRow & { role_permissions?: RolePermData[] };

    return {
      ...roleData,
      permissions: roleData.role_permissions?.map(rp => rp.permission).filter((p): p is PermissionRow => p !== null) || []
    };
  }

  async createRole(roleData: CreateRoleData): Promise<RoleRow> {
    const slug = roleData.slug || roleData.name.toLowerCase().replace(/\s+/g, '_');

    const { data, error } = await this.supabase
      .from('roles')
      .insert({
        name: roleData.name,
        slug,
        description: roleData.description,
        is_system: false
      })
      .select()
      .single();

    if (error) throw error;

    if (roleData.permissions && roleData.permissions.length > 0) {
      await this.assignPermissions(data.id, roleData.permissions);
    }

    return data;
  }

  async updateRole(id: string, roleData: UpdateRoleData): Promise<RoleRow> {
    const updates: Partial<RoleRow> = {};
    
    if (roleData.name) updates.name = roleData.name;
    if (roleData.description !== undefined) updates.description = roleData.description;

    const { data, error } = await this.supabase
      .from('roles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (roleData.permissions) {
      await this.assignPermissions(id, roleData.permissions);
    }

    return data;
  }

  async deleteRole(id: string): Promise<void> {
    // Check if it's a system role
    const role = await this.getRoleById(id);
    if (role?.is_system) {
      throw new Error('Cannot delete system roles');
    }

    // Remove permission assignments
    await this.supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', id);

    // Remove user assignments
    await this.supabase
      .from('user_roles')
      .delete()
      .eq('role_id', id);

    // Delete role
    const { error } = await this.supabase
      .from('roles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getPermissions(): Promise<PermissionRow[]> {
    const { data, error } = await this.supabase
      .from('permissions')
      .select('id, name, slug, description, resource, action')
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async assignPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    // Remove existing permissions
    await this.supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    // Add new permissions
    if (permissionIds.length > 0) {
      const { error } = await this.supabase
        .from('role_permissions')
        .insert(permissionIds.map(permId => ({
          role_id: roleId,
          permission_id: permId
        })));

      if (error) throw error;
    }
  }
}

export const roleService = new RoleService();
