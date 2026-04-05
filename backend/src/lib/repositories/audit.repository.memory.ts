/**
 * In-Memory Audit Repository
 * Test double for AuditRepository using in-memory data structures.
 */

import type {
  AuditRepository,
  AuditLog,
  AuditLogWithUser,
  AuditFilters,
  AuditResource,
} from '../container/types.js';

export function createInMemoryAuditRepository(): AuditRepository & {
  addLog(log: AuditLog): void;
  addUser(user: { id: string; full_name: string; email: string }): void;
  getAllLogs(): AuditLogWithUser[];
  clear(): void;
  reset(): void;
} {
  const logs = new Map<string, AuditLog>();
  const users = new Map<string, { full_name: string; email: string }>();

  function enrich(log: AuditLog): AuditLogWithUser {
    const user = users.get(log.user_id);
    return { ...log, user: user ?? null };
  }

  return {
    addLog(log: AuditLog) {
      logs.set(log.id, log);
    },
    addUser(user: { id: string; full_name: string; email: string }) {
      users.set(user.id, { full_name: user.full_name, email: user.email });
    },
    getAllLogs(): AuditLogWithUser[] {
      return [...logs.values()].map(enrich);
    },
    clear() {
      logs.clear();
      users.clear();
    },
    reset() {
      logs.clear();
      users.clear();
    },

    async createLog(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const log: AuditLog = { ...data, id, created_at: now } as AuditLog;
      logs.set(id, log);
      return log;
    },
    async getLogs(filters, pagination) {
      let result = [...logs.values()];
      if (filters?.userId) result = result.filter(l => l.user_id === filters.userId);
      if (filters?.action) result = result.filter(l => l.action === filters.action);
      if (filters?.resource) result = result.filter(l => l.resource === filters.resource);
      if (filters?.resourceId) result = result.filter(l => l.resource_id === filters.resourceId);
      if (filters?.startDate) result = result.filter(l => l.created_at >= filters.startDate!);
      if (filters?.endDate) result = result.filter(l => l.created_at <= filters.endDate!);
      result.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const total = result.length;
      if (pagination) {
        result = result.slice(pagination.offset, pagination.offset + pagination.limit);
      }
      return { logs: result.map(enrich), total };
    },
    async getLogById(id) {
      const log = logs.get(id);
      return log ? enrich(log) : null;
    },
    async getLogsByResource(resource, resourceId) {
      let result = [...logs.values()].filter(l => l.resource === resource);
      if (resourceId) result = result.filter(l => l.resource_id === resourceId);
      return result.map(enrich);
    },
    async deleteOldLogs(olderThanDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);
      const cutoffStr = cutoff.toISOString();
      let count = 0;
      for (const [id, log] of logs) {
        if (log.created_at < cutoffStr) {
          logs.delete(id);
          count++;
        }
      }
      return count;
    },
  };
}
