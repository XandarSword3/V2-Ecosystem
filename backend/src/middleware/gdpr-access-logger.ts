/**
 * GDPR Data Access Logging Middleware
 * 
 * Logs when staff members access routes that expose customer PII.
 * Required for GDPR accountability principle (Article 5(2)).
 */

import { Request, Response, NextFunction } from 'express';
import { logActivity } from '../utils/activityLogger.js';

// Routes that expose customer PII and must be logged
const PII_ROUTES: Array<{ method: string; pattern: RegExp; resource: string }> = [
  { method: 'GET', pattern: /\/api\/users\/\w+/, resource: 'user_profile' },
  { method: 'GET', pattern: /\/api\/customers/, resource: 'customer_list' },
  { method: 'GET', pattern: /\/api\/gdpr\/export/, resource: 'gdpr_data_export' },
  { method: 'GET', pattern: /\/api\/gdpr\/deletion/, resource: 'gdpr_deletion_requests' },
  { method: 'GET', pattern: /\/api\/admin\/users/, resource: 'admin_user_management' },
  { method: 'GET', pattern: /\/api\/bookings\/\w+/, resource: 'booking_detail' },
  { method: 'GET', pattern: /\/api\/payments\/\w+/, resource: 'payment_detail' },
  { method: 'GET', pattern: /\/api\/admin\/reports/, resource: 'financial_reports' },
  { method: 'GET', pattern: /\/api\/economics\/top-customers/, resource: 'customer_analytics' },
  { method: 'GET', pattern: /\/api\/admin\/audit/, resource: 'audit_logs' },
];

/**
 * Middleware that logs staff access to PII-containing routes.
 * Should be applied after authentication middleware.
 */
export function gdprAccessLogger(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  
  // Only log for authenticated staff/admin users, not customer self-service.
  // scope is the single source of truth for the authorization tier.
  const staffScopes = ['property_staff', 'property_manager', 'tenant_admin', 'tenant_owner', 'super_admin', 'platform_admin'];
  if (!user || !staffScopes.includes(user.scope ?? '')) {
    return next();
  }

  const matchedRoute = PII_ROUTES.find(
    r => r.method === req.method && r.pattern.test(req.originalUrl)
  );

  if (matchedRoute) {
    // Fire-and-forget — don't block the response
    logActivity({
      user_id: user.id || 'unknown',
      action: 'PII_DATA_ACCESS',
      resource: matchedRoute.resource,
      resource_id: req.params?.id || req.params?.userId || undefined,
      details: {
        method: req.method,
        path: req.originalUrl,
        query_params: Object.keys(req.query),
        ip_address: req.ip || req.socket?.remoteAddress,
        user_agent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      },
      ip_address: req.ip || req.socket?.remoteAddress || undefined,
      user_agent: req.headers['user-agent'],
    }).catch(() => {
      // Silently fail — access logging should never block requests
    });
  }

  next();
}
