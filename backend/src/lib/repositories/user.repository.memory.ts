/**
 * In-Memory User Repository
 *
 * Test double for user operations.
 */

import type { 
  UserRepository,
  User,
  UserWithRoles,
  Role,
  UserFilters,
} from '../container/types.js';

function generateId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createInMemoryUserRepository(): UserRepository & {
  // Test helpers
  addUser: (user: UserWithRoles) => void;
  addRole: (role: Role) => void;
  setUserRoles: (userId: string, roleIds: string[]) => void;
  clear: () => void;
  getAllUsers: () => UserWithRoles[];
  getAllRoles: () => Role[];
} {
  const users = new Map<string, User>();
  const roles = new Map<string, Role>();
  const userRoles = new Map<string, Set<string>>(); // userId -> Set of roleIds

  return {
    // ----------------------------------------
    // USER OPERATIONS
    // ----------------------------------------

    async getUserById(id: string): Promise<UserWithRoles | null> {
      const user = users.get(id);
      if (!user) return null;
      
      const userRoleIds = userRoles.get(id) || new Set();
      const userRolesList = Array.from(userRoleIds)
        .map(rid => roles.get(rid))
        .filter((r): r is Role => r !== undefined);
      
      return { ...user, roles: userRolesList };
    },

    async getUserByEmail(email: string): Promise<UserWithRoles | null> {
      const user = Array.from(users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) return null;
      
      const userRoleIds = userRoles.get(user.id) || new Set();
      const userRolesList = Array.from(userRoleIds)
        .map(rid => roles.get(rid))
        .filter((r): r is Role => r !== undefined);
      
      return { ...user, roles: userRolesList };
    },

    async getUsers(
      filters: UserFilters = {},
      pagination = { page: 1, limit: 20 }
    ): Promise<{ users: UserWithRoles[]; total: number }> {
      let results = Array.from(users.values());
      
      // Apply filters
      if (filters.search) {
        const search = filters.search.toLowerCase();
        results = results.filter(u =>
          u.email.toLowerCase().includes(search) ||
          u.full_name.toLowerCase().includes(search)
        );
      }
      
      if (filters.isActive !== undefined) {
        results = results.filter(u => u.is_active === filters.isActive);
      }
      
      if (filters.roleId) {
        results = results.filter(u => {
          const roleIds = userRoles.get(u.id);
          return roleIds?.has(filters.roleId!);
        });
      }
      
      // Sort by created_at descending
      results.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      const total = results.length;
      
      // Apply pagination
      const offset = (pagination.page - 1) * pagination.limit;
      results = results.slice(offset, offset + pagination.limit);
      
      // Add roles to each user
      const usersWithRoles: UserWithRoles[] = results.map(u => {
        const roleIds = userRoles.get(u.id) || new Set();
        const rolesList = Array.from(roleIds)
          .map(rid => roles.get(rid))
          .filter((r): r is Role => r !== undefined);
        return { ...u, roles: rolesList };
      });
      
      return { users: usersWithRoles, total };
    },

    async updateUser(id: string, data: Partial<User>): Promise<User> {
      const user = users.get(id);
      if (!user) {
        throw new Error(`User not found: ${id}`);
      }
      
      const updated: User = {
        ...user,
        ...data,
        id, // Ensure ID doesn't change
        updated_at: new Date().toISOString(),
      };
      users.set(id, updated);
      return { ...updated };
    },

    async updateUserRoles(id: string, roleIds: string[]): Promise<Role[]> {
      const user = users.get(id);
      if (!user) {
        throw new Error(`User not found: ${id}`);
      }
      
      // Verify all roles exist
      const foundRoles: Role[] = [];
      for (const roleId of roleIds) {
        const role = roles.get(roleId);
        if (!role) {
          throw new Error(`Role not found: ${roleId}`);
        }
        foundRoles.push(role);
      }
      
      // Update user roles
      userRoles.set(id, new Set(roleIds));
      
      return foundRoles;
    },

    async getRoleById(id: string): Promise<Role | null> {
      return roles.get(id) || null;
    },

    async getRolesByIds(ids: string[]): Promise<Role[]> {
      return ids
        .map(id => roles.get(id))
        .filter((r): r is Role => r !== undefined);
    },

    async getUserRoles(userId: string): Promise<Role[]> {
      const roleIds = userRoles.get(userId) || new Set();
      return Array.from(roleIds)
        .map(rid => roles.get(rid))
        .filter((r): r is Role => r !== undefined);
    },

    // ----------------------------------------
    // TEST HELPERS
    // ----------------------------------------

    addUser(user: UserWithRoles): void {
      const { roles: userRolesList, ...userData } = user;
      users.set(user.id, { ...userData });
      if (userRolesList && userRolesList.length > 0) {
        userRoles.set(user.id, new Set(userRolesList.map(r => r.id)));
      }
    },

    addRole(role: Role): void {
      roles.set(role.id, { ...role });
    },

    setUserRoles(userId: string, roleIds: string[]): void {
      userRoles.set(userId, new Set(roleIds));
    },

    clear(): void {
      users.clear();
      roles.clear();
      userRoles.clear();
    },

    getAllUsers(): UserWithRoles[] {
      return Array.from(users.values()).map(u => {
        const roleIds = userRoles.get(u.id) || new Set();
        const rolesList = Array.from(roleIds)
          .map(rid => roles.get(rid))
          .filter((r): r is Role => r !== undefined);
        return { ...u, roles: rolesList };
      });
    },

    getAllRoles(): Role[] {
      return Array.from(roles.values());
    },
  };
}
