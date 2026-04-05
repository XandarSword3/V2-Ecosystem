/**
 * In-Memory Auth Repository
 * Test double for AuthRepository using in-memory data structures.
 */

import type {
  AuthRepository,
  AuthUser,
  AuthSession,
  AuthRole,
} from '../container/types.js';

export interface InMemoryAuthRepository extends AuthRepository {
  addUser(user: AuthUser): void;
  addRole(role: AuthRole): void;
  getAllUsers(): AuthUser[];
  getAllSessions(): AuthSession[];
  reset(): void;
}

export function createInMemoryAuthRepository(): InMemoryAuthRepository {
  const users = new Map<string, AuthUser>();
  const sessions = new Map<string, AuthSession>();
  const roles = new Map<string, AuthRole>();
  const userRoles = new Map<string, string[]>(); // userId -> roleIds

  return {
    addUser(user: AuthUser) {
      users.set(user.id, user);
    },
    addRole(role: AuthRole) {
      roles.set(role.id, role);
    },
    getAllUsers(): AuthUser[] {
      return [...users.values()];
    },
    getAllSessions(): AuthSession[] {
      return [...sessions.values()];
    },
    reset() {
      users.clear();
      sessions.clear();
      roles.clear();
      userRoles.clear();
    },

    // User operations
    async getUserById(id) {
      return users.get(id) ?? null;
    },
    async getUserByEmail(email) {
      for (const u of users.values()) {
        if (u.email === email) return u;
      }
      return null;
    },
    async createUser(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const user: AuthUser = { ...data, id, created_at: now, updated_at: now } as AuthUser;
      users.set(id, user);
      return user;
    },
    async updateUser(id, data) {
      const existing = users.get(id);
      if (!existing) throw new Error(`User ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      users.set(id, updated);
      return updated;
    },

    // Role operations
    async getRoleByName(name) {
      for (const r of roles.values()) {
        if (r.name === name) return r;
      }
      return null;
    },
    async getUserRoles(userId) {
      const roleIds = userRoles.get(userId) ?? [];
      return roleIds.map(rid => roles.get(rid)?.name).filter((n): n is string => !!n);
    },
    async assignRole(userId, roleId) {
      const existing = userRoles.get(userId) ?? [];
      if (!existing.includes(roleId)) {
        existing.push(roleId);
        userRoles.set(userId, existing);
      }
    },

    // Session operations
    async createSession(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const session: AuthSession = { ...data, id, created_at: now } as AuthSession;
      sessions.set(id, session);
      return session;
    },
    async getSessionByToken(token) {
      for (const s of sessions.values()) {
        if (s.token === token) return s;
      }
      return null;
    },
    async getSessionByRefreshToken(refreshToken) {
      for (const s of sessions.values()) {
        if (s.refresh_token === refreshToken) return s;
      }
      return null;
    },
    async updateSession(id, data) {
      const existing = sessions.get(id);
      if (!existing) throw new Error(`Session ${id} not found`);
      const updated = { ...existing, ...data };
      sessions.set(id, updated);
      return updated;
    },
    async invalidateSession(token) {
      for (const [id, s] of sessions) {
        if (s.token === token) {
          sessions.delete(id);
          return;
        }
      }
    },
    async invalidateUserSessions(userId) {
      for (const [id, s] of sessions) {
        if (s.user_id === userId) {
          sessions.delete(id);
        }
      }
    },
    async deleteSession(id) {
      sessions.delete(id);
    },
  };
}
