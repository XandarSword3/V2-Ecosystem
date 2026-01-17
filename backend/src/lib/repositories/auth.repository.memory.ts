/**
 * Auth Repository - In-Memory Implementation
 * 
 * Test double for AuthRepository that stores data in memory.
 * Provides test helpers for inspecting and manipulating state.
 */

import type { AuthRepository, AuthUser, AuthRole, AuthSession } from '../container/types.js';
import { v4 as uuidv4 } from 'uuid';

export interface InMemoryAuthRepository extends AuthRepository {
  // Test helpers
  addUser(user: AuthUser): void;
  addRole(role: AuthRole): void;
  addSession(session: AuthSession): void;
  clear(): void;
  getAllUsers(): AuthUser[];
  getAllSessions(): AuthSession[];
  getAllRoles(): AuthRole[];
  getUserRoleAssignments(): Map<string, string[]>;
}

export function createInMemoryAuthRepository(): InMemoryAuthRepository {
  // In-memory storage
  const users = new Map<string, AuthUser>();
  const usersByEmail = new Map<string, AuthUser>();
  const roles = new Map<string, AuthRole>();
  const rolesByName = new Map<string, AuthRole>();
  const userRoles = new Map<string, string[]>(); // userId -> roleNames[]
  const sessions = new Map<string, AuthSession>();
  const sessionsByToken = new Map<string, AuthSession>();
  const sessionsByRefreshToken = new Map<string, AuthSession>();

  return {
    // ============================================
    // USER OPERATIONS
    // ============================================

    async getUserById(id: string): Promise<AuthUser | null> {
      return users.get(id) || null;
    },

    async getUserByEmail(email: string): Promise<AuthUser | null> {
      return usersByEmail.get(email.toLowerCase()) || null;
    },

    async createUser(userData: Omit<AuthUser, 'id' | 'created_at' | 'updated_at'>): Promise<AuthUser> {
      const user: AuthUser = {
        ...userData,
        id: uuidv4(),
        email: userData.email.toLowerCase(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      users.set(user.id, user);
      usersByEmail.set(user.email, user);
      return user;
    },

    async updateUser(id: string, updates: Partial<AuthUser>): Promise<AuthUser> {
      const user = users.get(id);
      if (!user) throw new Error('User not found');

      const updatedUser: AuthUser = {
        ...user,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Update email index if email changed
      if (updates.email && updates.email !== user.email) {
        usersByEmail.delete(user.email);
        usersByEmail.set(updates.email.toLowerCase(), updatedUser);
      } else {
        // Always update the email map to ensure password_hash changes are reflected
        usersByEmail.set(user.email, updatedUser);
      }

      users.set(id, updatedUser);
      return updatedUser;
    },

    // ============================================
    // ROLE OPERATIONS
    // ============================================

    async getRoleByName(name: string): Promise<AuthRole | null> {
      return rolesByName.get(name) || null;
    },

    async getUserRoles(userId: string): Promise<string[]> {
      return userRoles.get(userId) || [];
    },

    async assignRole(userId: string, roleId: string): Promise<void> {
      const role = roles.get(roleId);
      if (!role) throw new Error('Role not found');

      const currentRoles = userRoles.get(userId) || [];
      if (!currentRoles.includes(role.name)) {
        userRoles.set(userId, [...currentRoles, role.name]);
      }
    },

    // ============================================
    // SESSION OPERATIONS
    // ============================================

    async createSession(sessionData: Omit<AuthSession, 'id' | 'created_at'>): Promise<AuthSession> {
      const session: AuthSession = {
        ...sessionData,
        id: uuidv4(),
        created_at: new Date().toISOString(),
      };

      sessions.set(session.id, session);
      sessionsByToken.set(session.token, session);
      sessionsByRefreshToken.set(session.refresh_token, session);
      return session;
    },

    async getSessionByToken(token: string): Promise<AuthSession | null> {
      const session = sessionsByToken.get(token);
      if (!session || !session.is_active) return null;
      return session;
    },

    async getSessionByRefreshToken(refreshToken: string): Promise<AuthSession | null> {
      const session = sessionsByRefreshToken.get(refreshToken);
      if (!session || !session.is_active) return null;
      return session;
    },

    async updateSession(id: string, updates: Partial<AuthSession>): Promise<AuthSession> {
      const session = sessions.get(id);
      if (!session) throw new Error('Session not found');

      const updatedSession: AuthSession = {
        ...session,
        ...updates,
      };

      // Update indexes if tokens changed
      if (updates.token && updates.token !== session.token) {
        sessionsByToken.delete(session.token);
        sessionsByToken.set(updates.token, updatedSession);
      } else {
        // Always update the token map with the updated session
        sessionsByToken.set(session.token, updatedSession);
      }
      
      if (updates.refresh_token && updates.refresh_token !== session.refresh_token) {
        sessionsByRefreshToken.delete(session.refresh_token);
        sessionsByRefreshToken.set(updates.refresh_token, updatedSession);
      } else {
        // Always update the refresh token map with the updated session
        sessionsByRefreshToken.set(session.refresh_token, updatedSession);
      }

      sessions.set(id, updatedSession);
      return updatedSession;
    },

    async invalidateSession(token: string): Promise<void> {
      const session = sessionsByToken.get(token);
      if (session) {
        session.is_active = false;
        sessions.set(session.id, session);
      }
    },

    async invalidateUserSessions(userId: string): Promise<void> {
      for (const session of sessions.values()) {
        if (session.user_id === userId) {
          session.is_active = false;
        }
      }
    },

    async deleteSession(id: string): Promise<void> {
      const session = sessions.get(id);
      if (session) {
        sessions.delete(id);
        sessionsByToken.delete(session.token);
        sessionsByRefreshToken.delete(session.refresh_token);
      }
    },

    // ============================================
    // TEST HELPERS
    // ============================================

    addUser(user: AuthUser): void {
      users.set(user.id, user);
      usersByEmail.set(user.email.toLowerCase(), user);
    },

    addRole(role: AuthRole): void {
      roles.set(role.id, role);
      rolesByName.set(role.name, role);
    },

    addSession(session: AuthSession): void {
      sessions.set(session.id, session);
      sessionsByToken.set(session.token, session);
      sessionsByRefreshToken.set(session.refresh_token, session);
    },

    clear(): void {
      users.clear();
      usersByEmail.clear();
      roles.clear();
      rolesByName.clear();
      userRoles.clear();
      sessions.clear();
      sessionsByToken.clear();
      sessionsByRefreshToken.clear();
    },

    getAllUsers(): AuthUser[] {
      return Array.from(users.values());
    },

    getAllSessions(): AuthSession[] {
      return Array.from(sessions.values());
    },

    getAllRoles(): AuthRole[] {
      return Array.from(roles.values());
    },

    getUserRoleAssignments(): Map<string, string[]> {
      return new Map(userRoles);
    },
  };
}

export type { AuthUser, AuthRole, AuthSession };
