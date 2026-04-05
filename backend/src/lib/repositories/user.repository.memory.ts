/**
 * In-Memory User Repository
 * Test double for UserRepository using in-memory data structures.
 */

import type {
  UserRepository,
  User,
  UserWithRoles,
  UserFilters,
  Role,
} from '../container/types.js';

export interface InMemoryUserRepo extends UserRepository {
  addUser(user: UserWithRoles): void;
  addRole(role: Role): void;
  reset(): void;
}

export function createInMemoryUserRepository(): InMemoryUserRepo {
  const users = new Map<string, UserWithRoles>();
  const roles = new Map<string, Role>();

  return {
    addUser(user: UserWithRoles) {
      users.set(user.id, user);
    },
    addRole(role: Role) {
      roles.set(role.id, role);
    },
    reset() {
      users.clear();
      roles.clear();
    },

    async getUserById(id) {
      return users.get(id) ?? null;
    },

    async getUserByEmail(email) {
      for (const u of users.values()) {
        if (u.email === email) return u;
      }
      return null;
    },

    async getUsers(filters?: UserFilters, pagination?: { page: number; limit: number }) {
      let result = [...users.values()];
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(u =>
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }
      if (filters?.isActive !== undefined) {
        result = result.filter(u => u.is_active === filters.isActive);
      }
      if (filters?.roleId) {
        result = result.filter(u => u.roles.some(r => r.id === filters.roleId));
      }
      const total = result.length;
      if (pagination) {
        const start = (pagination.page - 1) * pagination.limit;
        result = result.slice(start, start + pagination.limit);
      }
      return { users: result, total };
    },

    async updateUser(id, data) {
      const existing = users.get(id);
      if (!existing) throw new Error(`User ${id} not found`);
      const updated: UserWithRoles = {
        ...existing,
        ...data,
        roles: existing.roles,
        updated_at: new Date().toISOString(),
      };
      users.set(id, updated);
      return updated;
    },

    async updateUserRoles(id, roleIds) {
      const existing = users.get(id);
      if (!existing) throw new Error(`User ${id} not found`);
      const newRoles = roleIds.map(rid => roles.get(rid)).filter((r): r is Role => !!r);
      const updated: UserWithRoles = { ...existing, roles: newRoles, updated_at: new Date().toISOString() };
      users.set(id, updated);
      return newRoles;
    },

    async getRoleById(id) {
      return roles.get(id) ?? null;
    },

    async getRolesByIds(ids) {
      return ids.map(id => roles.get(id)).filter((r): r is Role => !!r);
    },

    async getUserRoles(userId) {
      const user = users.get(userId);
      return user?.roles ?? [];
    },
  };
}
