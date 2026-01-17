/**
 * Audit Service - DI-based audit/activity logging
 * Handles logging and retrieval of audit entries
 */

import type { AuditLog, AuditLogWithUser, AuditAction, AuditResource, AuditFilters, AuditRepository, LoggerService } from '../container/types.js';

// ============================================
// TYPES
// ============================================

export interface AuditServiceDependencies {
  auditRepository: AuditRepository;
  logger?: LoggerService;
}

export interface LogActivityInput {
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface GetLogsParams {
  filters?: AuditFilters;
  limit?: number;
  offset?: number;
}

// Valid actions and resources for validation
const VALID_ACTIONS: AuditAction[] = [
  'create', 'update', 'delete', 'login', 'logout', 
  'password_change', 'role_change', 'status_change', 'settings_update'
];

const VALID_RESOURCES: AuditResource[] = [
  'user', 'booking', 'order', 'chalet', 'menu_item', 
  'review', 'settings', 'pool_ticket', 'snack_item', 'support_inquiry'
];

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================
// CUSTOM ERROR
// ============================================

export class AuditServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuditServiceError';
  }
}

// ============================================
// VALIDATION
// ============================================

function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string') {
    throw new AuditServiceError('User ID is required', 'INVALID_USER_ID');
  }
  
  if (!UUID_REGEX.test(userId)) {
    throw new AuditServiceError('Invalid user ID format', 'INVALID_USER_ID_FORMAT');
  }
}

function validateAction(action: string): asserts action is AuditAction {
  if (!VALID_ACTIONS.includes(action as AuditAction)) {
    throw new AuditServiceError(
      `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
      'INVALID_ACTION'
    );
  }
}

function validateResource(resource: string): asserts resource is AuditResource {
  if (!VALID_RESOURCES.includes(resource as AuditResource)) {
    throw new AuditServiceError(
      `Invalid resource. Must be one of: ${VALID_RESOURCES.join(', ')}`,
      'INVALID_RESOURCE'
    );
  }
}

function validateResourceId(resourceId: string | undefined): void {
  if (resourceId !== undefined) {
    if (typeof resourceId !== 'string' || resourceId.trim() === '') {
      throw new AuditServiceError('Resource ID must be a non-empty string', 'INVALID_RESOURCE_ID');
    }
  }
}

function validateValue(value: unknown, fieldName: string): void {
  if (value !== undefined && value !== null) {
    if (typeof value !== 'object') {
      throw new AuditServiceError(`${fieldName} must be an object`, `INVALID_${fieldName.toUpperCase()}`);
    }
    
    // Check for circular references
    try {
      JSON.stringify(value);
    } catch {
      throw new AuditServiceError(`${fieldName} cannot contain circular references`, 'CIRCULAR_REFERENCE');
    }
  }
}

function validatePagination(limit?: number, offset?: number): void {
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new AuditServiceError('Limit must be between 1 and 1000', 'INVALID_LIMIT');
    }
  }
  
  if (offset !== undefined) {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new AuditServiceError('Offset must be a non-negative integer', 'INVALID_OFFSET');
    }
  }
}

function validateDateRange(startDate?: string, endDate?: string): void {
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new AuditServiceError('Invalid start date format', 'INVALID_START_DATE');
    }
  }
  
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      throw new AuditServiceError('Invalid end date format', 'INVALID_END_DATE');
    }
  }
  
  if (startDate && endDate) {
    if (new Date(startDate) > new Date(endDate)) {
      throw new AuditServiceError('Start date must be before end date', 'INVALID_DATE_RANGE');
    }
  }
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createAuditService(deps: AuditServiceDependencies) {
  const { auditRepository, logger } = deps;

  return {
    /**
     * Log an activity
     */
    async logActivity(input: LogActivityInput): Promise<AuditLog> {
      validateUserId(input.userId);
      validateAction(input.action);
      validateResource(input.resource);
      validateResourceId(input.resourceId);
      validateValue(input.oldValue, 'oldValue');
      validateValue(input.newValue, 'newValue');
      
      try {
        const log = await auditRepository.createLog({
          user_id: input.userId,
          action: input.action,
          resource: input.resource,
          resource_id: input.resourceId,
          old_value: input.oldValue,
          new_value: input.newValue,
          ip_address: input.ipAddress,
          user_agent: input.userAgent
        });
        
        logger?.debug(`Audit log created: ${input.action} on ${input.resource}`);
        
        return log;
      } catch (error) {
        logger?.error('Failed to create audit log', error);
        throw new AuditServiceError('Failed to log activity', 'LOG_FAILED', 500);
      }
    },

    /**
     * Get audit logs with optional filters and pagination
     */
    async getLogs(params?: GetLogsParams): Promise<{ logs: AuditLogWithUser[]; total: number }> {
      const { filters, limit = 50, offset = 0 } = params || {};
      
      validatePagination(limit, offset);
      
      if (filters) {
        if (filters.userId) {
          validateUserId(filters.userId);
        }
        if (filters.action) {
          validateAction(filters.action);
        }
        if (filters.resource) {
          validateResource(filters.resource);
        }
        validateDateRange(filters.startDate, filters.endDate);
      }
      
      return auditRepository.getLogs(filters, { limit, offset });
    },

    /**
     * Get a single audit log by ID
     */
    async getLogById(id: string): Promise<AuditLogWithUser | null> {
      if (!id || typeof id !== 'string') {
        throw new AuditServiceError('Log ID is required', 'INVALID_LOG_ID');
      }
      
      return auditRepository.getLogById(id);
    },

    /**
     * Get audit logs for a specific resource
     */
    async getLogsByResource(resource: string, resourceId?: string): Promise<AuditLogWithUser[]> {
      validateResource(resource);
      validateResourceId(resourceId);
      
      return auditRepository.getLogsByResource(resource as AuditResource, resourceId);
    },

    /**
     * Get user activity history
     */
    async getUserActivity(userId: string, limit?: number): Promise<AuditLogWithUser[]> {
      validateUserId(userId);
      
      if (limit !== undefined) {
        validatePagination(limit);
      }
      
      const { logs } = await auditRepository.getLogs(
        { userId },
        { limit: limit || 50, offset: 0 }
      );
      
      return logs;
    },

    /**
     * Get recent logins
     */
    async getRecentLogins(limit?: number): Promise<AuditLogWithUser[]> {
      if (limit !== undefined) {
        validatePagination(limit);
      }
      
      const { logs } = await auditRepository.getLogs(
        { action: 'login' },
        { limit: limit || 20, offset: 0 }
      );
      
      return logs;
    },

    /**
     * Get recent changes for a resource type
     */
    async getRecentChanges(resource: AuditResource, limit?: number): Promise<AuditLogWithUser[]> {
      validateResource(resource);
      
      if (limit !== undefined) {
        validatePagination(limit);
      }
      
      const { logs } = await auditRepository.getLogs(
        { resource },
        { limit: limit || 20, offset: 0 }
      );
      
      return logs;
    },

    /**
     * Clean up old audit logs
     */
    async cleanupOldLogs(olderThanDays: number): Promise<number> {
      if (!Number.isInteger(olderThanDays) || olderThanDays < 1) {
        throw new AuditServiceError('Days must be a positive integer', 'INVALID_DAYS');
      }
      
      if (olderThanDays < 30) {
        throw new AuditServiceError('Cannot delete logs newer than 30 days', 'RETENTION_POLICY');
      }
      
      const deletedCount = await auditRepository.deleteOldLogs(olderThanDays);
      
      logger?.info(`Cleaned up ${deletedCount} old audit logs`);
      
      return deletedCount;
    },

    /**
     * Log a user login
     */
    async logLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<AuditLog> {
      return this.logActivity({
        userId,
        action: 'login',
        resource: 'user',
        resourceId: userId,
        ipAddress,
        userAgent
      });
    },

    /**
     * Log a user logout
     */
    async logLogout(userId: string): Promise<AuditLog> {
      return this.logActivity({
        userId,
        action: 'logout',
        resource: 'user',
        resourceId: userId
      });
    },

    /**
     * Log a resource creation
     */
    async logCreate(
      userId: string,
      resource: AuditResource,
      resourceId: string,
      newValue: Record<string, unknown>
    ): Promise<AuditLog> {
      return this.logActivity({
        userId,
        action: 'create',
        resource,
        resourceId,
        newValue
      });
    },

    /**
     * Log a resource update
     */
    async logUpdate(
      userId: string,
      resource: AuditResource,
      resourceId: string,
      oldValue: Record<string, unknown>,
      newValue: Record<string, unknown>
    ): Promise<AuditLog> {
      return this.logActivity({
        userId,
        action: 'update',
        resource,
        resourceId,
        oldValue,
        newValue
      });
    },

    /**
     * Log a resource deletion
     */
    async logDelete(
      userId: string,
      resource: AuditResource,
      resourceId: string,
      oldValue: Record<string, unknown>
    ): Promise<AuditLog> {
      return this.logActivity({
        userId,
        action: 'delete',
        resource,
        resourceId,
        oldValue
      });
    },

    /**
     * Log a settings update
     */
    async logSettingsUpdate(
      userId: string,
      oldValue: Record<string, unknown>,
      newValue: Record<string, unknown>
    ): Promise<AuditLog> {
      return this.logActivity({
        userId,
        action: 'settings_update',
        resource: 'settings',
        oldValue,
        newValue
      });
    },

    /**
     * Get valid actions
     */
    getValidActions(): AuditAction[] {
      return [...VALID_ACTIONS];
    },

    /**
     * Get valid resources
     */
    getValidResources(): AuditResource[] {
      return [...VALID_RESOURCES];
    },

    /**
     * Get audit summary statistics
     */
    async getAuditSummary(startDate?: string, endDate?: string): Promise<{
      totalLogs: number;
      byAction: Record<AuditAction, number>;
      byResource: Record<AuditResource, number>;
    }> {
      validateDateRange(startDate, endDate);
      
      const { logs } = await auditRepository.getLogs(
        { startDate, endDate },
        { limit: 10000, offset: 0 }
      );
      
      const byAction: Record<string, number> = {};
      const byResource: Record<string, number> = {};
      
      for (const log of logs) {
        byAction[log.action] = (byAction[log.action] || 0) + 1;
        byResource[log.resource] = (byResource[log.resource] || 0) + 1;
      }
      
      return {
        totalLogs: logs.length,
        byAction: byAction as Record<AuditAction, number>,
        byResource: byResource as Record<AuditResource, number>
      };
    }
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
