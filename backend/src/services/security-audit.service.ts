/**
 * Security Audit Logging Service
 * 
 * Comprehensive logging for security-related events.
 */

import { getSupabase } from '../database/connection.js';
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
    const supabase = getSupabase();
    const { error } = await supabase
      .from('security_audit_log')
      .insert({
        action: 'SECURITY_EVENT',
        resource: 'SECURITY',
        event_type: data.eventType,
        severity: data.severity,
        user_id: data.userId || null,
        target_user_id: data.targetUserId || null,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        description: data.description,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
        success: data.success ?? true,
      });
    if (error) throw error;

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
  const supabase = getSupabase();

  // Build query for logs
  let logsQuery = supabase
    .from('security_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 100) - 1);

  // Build query for count
  let countQuery = supabase
    .from('security_audit_log')
    .select('*', { count: 'exact', head: true });

  // Apply filters to both queries
  if (params.eventTypes?.length) {
    logsQuery = logsQuery.in('event_type', params.eventTypes);
    countQuery = countQuery.in('event_type', params.eventTypes);
  }
  if (params.severity) {
    logsQuery = logsQuery.eq('severity', params.severity);
    countQuery = countQuery.eq('severity', params.severity);
  }
  if (params.userId) {
    logsQuery = logsQuery.or(`user_id.eq.${params.userId},target_user_id.eq.${params.userId}`);
    countQuery = countQuery.or(`user_id.eq.${params.userId},target_user_id.eq.${params.userId}`);
  }
  if (params.ipAddress) {
    logsQuery = logsQuery.eq('ip_address', params.ipAddress);
    countQuery = countQuery.eq('ip_address', params.ipAddress);
  }
  if (params.startDate) {
    logsQuery = logsQuery.gte('created_at', params.startDate.toISOString());
    countQuery = countQuery.gte('created_at', params.startDate.toISOString());
  }
  if (params.endDate) {
    logsQuery = logsQuery.lte('created_at', params.endDate.toISOString());
    countQuery = countQuery.lte('created_at', params.endDate.toISOString());
  }

  const [{ data: logs, error: logsError }, { count, error: countError }] = await Promise.all([
    logsQuery,
    countQuery,
  ]);

  if (logsError) throw logsError;
  if (countError) throw countError;

  return { logs: (logs || []) as SecurityAuditLogEntry[], total: count || 0 };
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
  const sinceIso = since.toISOString();
  const supabase = getSupabase();

  const baseQuery = () => supabase
    .from('security_audit_log')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sinceIso);

  const [
    { count: totalEvents, error: e1 },
    { count: criticalEvents, error: e2 },
    { count: failedLogins, error: e3 },
    { count: accountLockouts, error: e4 },
    { count: suspiciousActivities, error: e5 }
  ] = await Promise.all([
    baseQuery(),
    baseQuery().eq('severity', SecurityEventSeverity.CRITICAL),
    baseQuery().eq('event_type', SecurityEventType.LOGIN_FAILURE),
    baseQuery().eq('event_type', SecurityEventType.ACCOUNT_LOCKED),
    baseQuery().eq('event_type', SecurityEventType.SUSPICIOUS_ACTIVITY),
  ]);

  const err = e1 || e2 || e3 || e4 || e5;
  if (err) throw err;

  return {
    totalEvents: totalEvents || 0,
    criticalEvents: criticalEvents || 0,
    failedLogins: failedLogins || 0,
    accountLockouts: accountLockouts || 0,
    suspiciousActivities: suspiciousActivities || 0,
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
