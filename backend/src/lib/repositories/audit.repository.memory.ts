/**
 * In-memory Audit Repository for testing
 * Provides a test double for AuditRepository
 */

import type { AuditLog, AuditLogWithUser, AuditAction, AuditResource, AuditFilters, AuditRepository } from '../container/types.js';

function generateId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface UserInfo {
  id: string;
  full_name: string;
  email: string;
}

export function createInMemoryAuditRepository(): AuditRepository & {
  // Test helpers
  addLog(log: AuditLog): void;
  addUser(user: UserInfo): void;
  clear(): void;
  getAllLogs(): AuditLog[];
} {
  const logs: Map<string, AuditLog> = new Map();
  const users: Map<string, UserInfo> = new Map();

  function enrichWithUser(log: AuditLog): AuditLogWithUser {
    const user = users.get(log.user_id);
    return {
      ...log,
      user: user ? { full_name: user.full_name, email: user.email } : null
    };
  }

  return {
    async createLog(data: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
      const log: AuditLog = {
        id: generateId(),
        user_id: data.user_id,
        action: data.action,
        resource: data.resource,
        resource_id: data.resource_id ?? null,
        old_value: data.old_value ?? null,
        new_value: data.new_value ?? null,
        ip_address: data.ip_address ?? null,
        user_agent: data.user_agent ?? null,
        created_at: new Date().toISOString()
      };
      logs.set(log.id, log);
      return log;
    },

    async getLogs(
      filters?: AuditFilters,
      pagination?: { limit: number; offset: number }
    ): Promise<{ logs: AuditLogWithUser[]; total: number }> {
      let results = Array.from(logs.values());

      // Apply filters
      if (filters) {
        if (filters.userId) {
          results = results.filter(l => l.user_id === filters.userId);
        }
        if (filters.action) {
          results = results.filter(l => l.action === filters.action);
        }
        if (filters.resource) {
          results = results.filter(l => l.resource === filters.resource);
        }
        if (filters.resourceId) {
          results = results.filter(l => l.resource_id === filters.resourceId);
        }
        if (filters.startDate) {
          const startDate = new Date(filters.startDate);
          results = results.filter(l => new Date(l.created_at) >= startDate);
        }
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          results = results.filter(l => new Date(l.created_at) <= endDate);
        }
      }

      // Sort by created_at descending
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const total = results.length;

      // Apply pagination
      if (pagination) {
        results = results.slice(pagination.offset, pagination.offset + pagination.limit);
      }

      return {
        logs: results.map(enrichWithUser),
        total
      };
    },

    async getLogById(id: string): Promise<AuditLogWithUser | null> {
      const log = logs.get(id);
      return log ? enrichWithUser(log) : null;
    },

    async getLogsByResource(resource: AuditResource, resourceId?: string): Promise<AuditLogWithUser[]> {
      let results = Array.from(logs.values()).filter(l => l.resource === resource);
      
      if (resourceId) {
        results = results.filter(l => l.resource_id === resourceId);
      }

      // Sort by created_at descending
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return results.map(enrichWithUser);
    },

    async deleteOldLogs(olderThanDays: number): Promise<number> {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let deletedCount = 0;
      for (const [id, log] of logs.entries()) {
        if (new Date(log.created_at) < cutoffDate) {
          logs.delete(id);
          deletedCount++;
        }
      }

      return deletedCount;
    },

    // Test helpers
    addLog(log: AuditLog): void {
      logs.set(log.id, log);
    },

    addUser(user: UserInfo): void {
      users.set(user.id, user);
    },

    clear(): void {
      logs.clear();
      users.clear();
    },

    getAllLogs(): AuditLog[] {
      return Array.from(logs.values());
    }
  };
}
