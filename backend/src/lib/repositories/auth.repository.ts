/**
 * Auth Repository - Supabase Implementation
 * 
 * Handles all database operations for authentication.
 * This is the production implementation using Supabase.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthRepository, AuthUser, AuthRole, AuthSession } from '../container/types.js';

export function createAuthRepository(supabase: SupabaseClient): AuthRepository {
  return {
    // ============================================
    // USER OPERATIONS
    // ============================================

    async getUserById(id: string): Promise<AuthUser | null> {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;
      return data as AuthUser;
    },

    async getUserByEmail(email: string): Promise<AuthUser | null> {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !data) return null;
      return data as AuthUser;
    },

    async createUser(user: Omit<AuthUser, 'id' | 'created_at' | 'updated_at'>): Promise<AuthUser> {
      const { data, error } = await supabase
        .from('users')
        .insert({
          ...user,
          email: user.email.toLowerCase(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as AuthUser;
    },

    async updateUser(id: string, updates: Partial<AuthUser>): Promise<AuthUser> {
      const { data, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as AuthUser;
    },

    // ============================================
    // ROLE OPERATIONS
    // ============================================

    async getRoleByName(name: string): Promise<AuthRole | null> {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('name', name)
        .single();

      if (error || !data) return null;
      return data as AuthRole;
    },

    async getUserRoles(userId: string): Promise<string[]> {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles (id, name, display_name)
        `)
        .eq('user_id', userId);

      if (error || !data) return [];

      // Handle Supabase join which may return roles as array or object
      interface UserRoleRow {
        role_id: string;
        roles: { id: string; name: string; display_name: string } | Array<{ id: string; name: string; display_name: string }> | null;
      }
      return (data as UserRoleRow[]).map((r) => {
        const roles = r.roles;
        if (!roles) return undefined;
        if (Array.isArray(roles)) return roles[0]?.name;
        return roles.name;
      }).filter(Boolean) as string[];
    },

    async assignRole(userId: string, roleId: string): Promise<void> {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
        });

      if (error) throw error;
    },

    // ============================================
    // SESSION OPERATIONS
    // ============================================

    async createSession(session: Omit<AuthSession, 'id' | 'created_at'>): Promise<AuthSession> {
      const { data, error } = await supabase
        .from('sessions')
        .insert(session)
        .select()
        .single();

      if (error) throw error;
      return data as AuthSession;
    },

    async getSessionByToken(token: string): Promise<AuthSession | null> {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (error || !data) return null;
      return data as AuthSession;
    },

    async getSessionByRefreshToken(refreshToken: string): Promise<AuthSession | null> {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('refresh_token', refreshToken)
        .eq('is_active', true)
        .single();

      if (error || !data) return null;
      return data as AuthSession;
    },

    async updateSession(id: string, updates: Partial<AuthSession>): Promise<AuthSession> {
      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as AuthSession;
    },

    async invalidateSession(token: string): Promise<void> {
      await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('token', token);
    },

    async invalidateUserSessions(userId: string): Promise<void> {
      await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('user_id', userId);
    },

    async deleteSession(id: string): Promise<void> {
      await supabase
        .from('sessions')
        .delete()
        .eq('id', id);
    },
  };
}

export type { AuthRepository };
