import { getSupabase } from '../../../database/connection.js';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  profile_image_url?: string;
  created_at: string;
  updated_at?: string;
}

interface UserWithRoles extends UserRow {
  roles: string[];
  permissions: string[];
}

interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  roles?: string[];
}

interface UpdateUserData {
  email?: string;
  full_name?: string;
  phone?: string;
  is_active?: boolean;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class UserService {
  private supabase = getSupabase();

  async getUsers(options: PaginationOptions = {}): Promise<PaginatedResult<UserWithRoles>> {
    const { page = 1, limit = 20, search, sortBy = 'created_at', sortOrder = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('users')
      .select(`
        id, email, full_name, phone, is_active, profile_image_url, created_at, updated_at,
        user_roles!left(role:roles(id, name, slug))
      `, { count: 'exact' });

    if (search) {
      // Sanitize search input to prevent SQL injection
      const sanitizedSearch = String(search)
        .replace(/[%_\\]/g, '\\$&')  // Escape SQL wildcards
        .replace(/['";]/g, '')           // Remove quotes and semicolons
        .slice(0, 100);                   // Limit length
      query = query.or(`email.ilike.%${sanitizedSearch}%,full_name.ilike.%${sanitizedSearch}%`);
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    interface RoleData { id: string; name: string; slug: string }
    interface UserRoleData { role: RoleData | null }
    interface RawUserData extends UserRow {
      user_roles?: UserRoleData[];
    }

    const usersWithRoles: UserWithRoles[] = ((data || []) as unknown as RawUserData[]).map(user => ({
      ...user,
      roles: user.user_roles?.map(ur => ur.role?.name).filter(Boolean) as string[] || [],
      permissions: []
    }));

    return {
      data: usersWithRoles,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  }

  async getUserById(id: string): Promise<UserWithRoles | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select(`
        id, email, full_name, phone, is_active, profile_image_url, created_at, updated_at,
        user_roles!left(role:roles(id, name, slug, role_permissions(permission:permissions(id, name, slug))))
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;

    interface PermissionData { id: string; name: string; slug: string }
    interface RolePermData { permission: PermissionData | null }
    interface RoleDataFull { id: string; name: string; slug: string; role_permissions?: RolePermData[] }
    interface UserRoleFull { role: RoleDataFull | null }

    const userData = data as unknown as UserRow & { user_roles?: UserRoleFull[] };
    
    const roles = userData.user_roles?.map(ur => ur.role?.name).filter(Boolean) as string[] || [];
    const permissions = new Set<string>();
    
    userData.user_roles?.forEach(ur => {
      ur.role?.role_permissions?.forEach(rp => {
        if (rp.permission?.slug) {
          permissions.add(rp.permission.slug);
        }
      });
    });

    return {
      ...userData,
      roles,
      permissions: Array.from(permissions)
    };
  }

  async createUser(userData: CreateUserData, createdBy: string): Promise<UserRow> {
    // Check if email already exists
    const { data: existing } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', userData.email)
      .maybeSingle();

    if (existing) {
      throw new Error('Email already exists');
    }

    // Create user
    const { data: newUser, error } = await this.supabase
      .from('users')
      .insert({
        email: userData.email,
        password_hash: userData.password, // Note: Should be hashed before calling this
        full_name: userData.full_name,
        phone: userData.phone,
        is_active: true,
        created_by: createdBy
      })
      .select()
      .single();

    if (error) throw error;

    // Assign roles if provided
    if (userData.roles && userData.roles.length > 0) {
      await this.assignRoles(newUser.id, userData.roles);
    }

    return newUser;
  }

  async updateUser(id: string, userData: UpdateUserData): Promise<UserRow> {
    const { data, error } = await this.supabase
      .from('users')
      .update({
        ...userData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteUser(id: string): Promise<void> {
    // First remove all role assignments
    await this.supabase
      .from('user_roles')
      .delete()
      .eq('user_id', id);

    // Then delete the user
    const { error } = await this.supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    // Remove existing roles
    await this.supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // Add new roles
    if (roleIds.length > 0) {
      const { error } = await this.supabase
        .from('user_roles')
        .insert(roleIds.map(roleId => ({
          user_id: userId,
          role_id: roleId
        })));

      if (error) throw error;
    }
  }
}

export const userService = new UserService();
