/**
 * Security Audit Logging Service
 * 
 * Comprehensive logging for security-related events.
 */

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  
  // Account security
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE = 'PASSWORD_RESET_COMPLETE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  
  // 2FA events
  TWO_FA_ENABLED = 'TWO_FA_ENABLED',
  TWO_FA_DISABLED = 'TWO_FA_DISABLED',
  TWO_FA_VERIFIED = 'TWO_FA_VERIFIED',
  TWO_FA_FAILED = 'TWO_FA_FAILED',
  
  // Permission events
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  
  // Data access events
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  BULK_DATA_EXPORT = 'BULK_DATA_EXPORT',
  GDPR_DATA_REQUEST = 'GDPR_DATA_REQUEST',
  GDPR_DATA_DELETION = 'GDPR_DATA_DELETION',
  
  // Admin actions
  ADMIN_SETTINGS_CHANGE = 'ADMIN_SETTINGS_CHANGE',
  ADMIN_USER_CREATE = 'ADMIN_USER_CREATE',
  ADMIN_USER_DELETE = 'ADMIN_USER_DELETE',
  ADMIN_USER_MODIFY = 'ADMIN_USER_MODIFY',
  
  // Security incidents
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  IP_BLOCKED = 'IP_BLOCKED',
  
  // API events
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  API_KEY_USED = 'API_KEY_USED',
}

export enum SecurityEventSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

interface SecurityEventData {
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  targetUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  description: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
}

interface SecurityAuditLogEntry {
  id: string;
  eventType: string;
  severity: string;
  userId: string | null;
  targetUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  description: string;
  metadata: any;
  success: boolean;
  createdAt: Date;
}

/**
 * Log a security event
 */
export async function logSecurityEvent(data: SecurityEventData): Promise<void> {
  try {
    await prisma.securityAuditLog.create({
      data: {
        action: 'SECURITY_EVENT',
        resource: 'SECURITY',
        eventType: data.eventType,
        severity: data.severity,
        userId: data.userId || null,
        targetUserId: data.targetUserId || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        description: data.description,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        success: data.success ?? true,
      }
    });

    // Also log to application logger for real-time monitoring
    const logMethod = 
      data.severity === SecurityEventSeverity.CRITICAL ? 'error' :
      data.severity === SecurityEventSeverity.WARNING ? 'warn' : 'info';
    
    logger[logMethod](`[SECURITY] ${data.eventType}: ${data.description}`, {
      userId: data.userId,
      targetUserId: data.targetUserId,
      ipAddress: data.ipAddress,
      success: data.success,
      metadata: data.metadata
    });

  } catch (error) {
    // Don't throw - security logging should never break the application
    logger.error('Failed to log security event', { 
      eventType: data.eventType, 
      error 
    });
  }
}

/**
 * Log login success
 */
export async function logLoginSuccess(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  method: 'password' | '2fa' | 'oauth' = 'password'
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.LOGIN_SUCCESS,
    severity: SecurityEventSeverity.INFO,
    userId,
    ipAddress,
    userAgent,
    description: `User logged in successfully via ${method}`,
    metadata: { method },
    success: true
  });
}

/**
 * Log login failure
 */
export async function logLoginFailure(
  email: string,
  ipAddress?: string,
  userAgent?: string,
  reason: string = 'Invalid credentials'
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.LOGIN_FAILURE,
    severity: SecurityEventSeverity.WARNING,
    ipAddress,
    userAgent,
    description: `Login attempt failed for ${email}: ${reason}`,
    metadata: { email, reason },
    success: false
  });
}

/**
 * Log account lockout
 */
export async function logAccountLocked(
  email: string,
  ipAddress?: string,
  attemptCount: number = 0
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.ACCOUNT_LOCKED,
    severity: SecurityEventSeverity.CRITICAL,
    ipAddress,
    description: `Account locked after ${attemptCount} failed attempts: ${email}`,
    metadata: { email, attemptCount },
    success: true
  });
}

/**
 * Log password change
 */
export async function logPasswordChange(
  userId: string,
  ipAddress?: string,
  forced: boolean = false
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.PASSWORD_CHANGE,
    severity: SecurityEventSeverity.INFO,
    userId,
    ipAddress,
    description: forced ? 'Password changed (forced reset)' : 'Password changed',
    metadata: { forced },
    success: true
  });
}

/**
 * Log 2FA events
 */
export async function logTwoFactorEvent(
  userId: string,
  event: 'enabled' | 'disabled' | 'verified' | 'failed',
  ipAddress?: string
): Promise<void> {
  const eventTypeMap = {
    enabled: SecurityEventType.TWO_FA_ENABLED,
    disabled: SecurityEventType.TWO_FA_DISABLED,
    verified: SecurityEventType.TWO_FA_VERIFIED,
    failed: SecurityEventType.TWO_FA_FAILED,
  };

  const severityMap = {
    enabled: SecurityEventSeverity.INFO,
    disabled: SecurityEventSeverity.WARNING,
    verified: SecurityEventSeverity.INFO,
    failed: SecurityEventSeverity.WARNING,
  };

  await logSecurityEvent({
    eventType: eventTypeMap[event],
    severity: severityMap[event],
    userId,
    ipAddress,
    description: `Two-factor authentication ${event}`,
    success: event !== 'failed'
  });
}

/**
 * Log permission/role changes
 */
export async function logPermissionChange(
  adminUserId: string,
  targetUserId: string,
  action: 'grant' | 'revoke',
  permission: string,
  ipAddress?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: action === 'grant' 
      ? SecurityEventType.PERMISSION_GRANTED 
      : SecurityEventType.PERMISSION_REVOKED,
    severity: SecurityEventSeverity.WARNING,
    userId: adminUserId,
    targetUserId,
    ipAddress,
    description: `Permission ${action}ed: ${permission}`,
    metadata: { permission, action },
    success: true
  });
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
  description: string,
  ipAddress?: string,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity: SecurityEventSeverity.CRITICAL,
    userId,
    ipAddress,
    description,
    metadata,
    success: false
  });
}

/**
 * Log admin settings change
 */
export async function logAdminSettingsChange(
  adminUserId: string,
  settingKey: string,
  oldValue: string,
  newValue: string,
  ipAddress?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.ADMIN_SETTINGS_CHANGE,
    severity: SecurityEventSeverity.INFO,
    userId: adminUserId,
    ipAddress,
    description: `Admin setting changed: ${settingKey}`,
    metadata: { 
      settingKey, 
      oldValue: oldValue.length > 20 ? '[redacted]' : oldValue,
      newValue: newValue.length > 20 ? '[redacted]' : newValue
    },
    success: true
  });
}

/**
 * Query security audit logs
 */
export async function querySecurityLogs(params: {
  eventTypes?: SecurityEventType[];
  severity?: SecurityEventSeverity;
  userId?: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ logs: SecurityAuditLogEntry[]; total: number }> {
  const where: any = {};

  if (params.eventTypes?.length) {
    where.eventType = { in: params.eventTypes };
  }
  if (params.severity) {
    where.severity = params.severity;
  }
  if (params.userId) {
    where.OR = [
      { userId: params.userId },
      { targetUserId: params.userId }
    ];
  }
  if (params.ipAddress) {
    where.ipAddress = params.ipAddress;
  }
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = params.startDate;
    if (params.endDate) where.createdAt.lte = params.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.securityAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 100,
      skip: params.offset || 0,
    }),
    prisma.securityAuditLog.count({ where })
  ]);

  return { logs, total };
}

/**
 * Get security summary for dashboard
 */
export async function getSecuritySummary(days: number = 7): Promise<{
  totalEvents: number;
  criticalEvents: number;
  failedLogins: number;
  accountLockouts: number;
  suspiciousActivities: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [
    totalEvents,
    criticalEvents,
    failedLogins,
    accountLockouts,
    suspiciousActivities
  ] = await Promise.all([
    prisma.securityAuditLog.count({
      where: { createdAt: { gte: since } }
    }),
    prisma.securityAuditLog.count({
      where: { 
        createdAt: { gte: since },
        severity: SecurityEventSeverity.CRITICAL
      }
    }),
    prisma.securityAuditLog.count({
      where: { 
        createdAt: { gte: since },
        eventType: SecurityEventType.LOGIN_FAILURE
      }
    }),
    prisma.securityAuditLog.count({
      where: { 
        createdAt: { gte: since },
        eventType: SecurityEventType.ACCOUNT_LOCKED
      }
    }),
    prisma.securityAuditLog.count({
      where: { 
        createdAt: { gte: since },
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY
      }
    })
  ]);

  return {
    totalEvents,
    criticalEvents,
    failedLogins,
    accountLockouts,
    suspiciousActivities
  };
}

export default {
  logSecurityEvent,
  logLoginSuccess,
  logLoginFailure,
  logAccountLocked,
  logPasswordChange,
  logTwoFactorEvent,
  logPermissionChange,
  logSuspiciousActivity,
  logAdminSettingsChange,
  querySecurityLogs,
  getSecuritySummary,
  SecurityEventType,
  SecurityEventSeverity
};
