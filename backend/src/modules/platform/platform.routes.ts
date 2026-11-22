/**
 * Platform routes
 *
 * Public:
 *   POST /api/platform/checkout          — create Stripe checkout session (landing page CTA)
 *   GET  /api/tenants/by-slug/:slug      — validate tenant exists by slug (no auth)
 *
 * Operator (authenticated, any billing status):
 *   GET  /api/platform/billing/portal    — Stripe billing portal redirect
 *
 * Platform Admin only (is_platform_admin = true):
 *   GET    /api/platform/stats
 *   GET    /api/platform/tenants
 *   GET    /api/platform/tenants/:id
 *   POST   /api/platform/tenants/:id/suspend
 *   POST   /api/platform/tenants/:id/reactivate
 *   POST   /api/platform/tenants/:id/unsuspend   (alias for reactivate)
 *   POST   /api/platform/tenants/:id/cancel
 *   PATCH  /api/platform/tenants/:id/tier
 *   GET    /api/platform/revenue
 *
 * Webhook (no auth — signature-verified by handler):
 *   POST /api/webhooks/stripe/saas       — registered in app.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate as authenticateToken } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenantAccess.middleware.js';
import {
  listTenants,
  getTenant,
  getTenantBySlug,
  suspendTenant,
  reactivateTenant,
  cancelTenant,
  changeTier,
  getRevenueOverview,
  getPlatformStats,
  createCheckoutSession,
  getBillingPortal,
  getPublicPlans,
  getTenantFeatureFlags,
  setTenantFeatureFlag,
} from './platform-admin.controller.js';

const router = Router();

// ============================================
// Platform admin guard
// ============================================

export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!(req.user as any)?.isPlatformAdmin) {
    res.status(403).json({ success: false, error: 'Platform administrator access required' });
    return;
  }
  next();
}

/**
 * Tenant billing-portal guard.
 *
 * The billing portal is the tenant's own Stripe subscription screen, not a
 * platform-operator tool: `BillingAlertBanner` calls it from both the tenant
 * admin and tenant staff layouts, and the handler reads the tenant from
 * `req.tenant`. Putting it behind `requirePlatformAdmin` would 403 the paying
 * tenant.
 *
 * What was actually wrong (P0-2) is that *any* authenticated principal —
 * including a plain customer — reached the handler, and the tenant came from
 * the header. The header half is closed by `authenticate`'s tenant binding
 * (see `tenantBindingViolation` in auth.middleware.ts). This guard closes the
 * role half: a customer token must not mint a billing-portal session.
 */
export function requireTenantBillingAccess(req: Request, res: Response, next: NextFunction): void {
  if ((req.user as any)?.isPlatformAdmin) {
    next();
    return;
  }
  const scope = req.user?.scope;
  const roles = req.user?.roles || [];
  const isCustomer = scope === 'customer'
    || (roles.length > 0 && roles.every((role) => role === 'customer'));
  if (isCustomer) {
    res.status(403).json({ success: false, error: 'Billing portal is restricted to tenant staff' });
    return;
  }
  next();
}

import { userRateLimit } from '../../middleware/userRateLimit.middleware.js';

const platformCheckoutRateLimit = userRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  keyPrefix: 'rate:platform:checkout:',
  message: 'Too many checkout attempts. Please try again later.',
});

// ============================================
// Public routes
// ============================================

router.get('/plans', getPublicPlans);
router.post('/checkout', platformCheckoutRateLimit, createCheckoutSession);

// Public tenant validation (no auth) - for frontend 404 handling
router.get('/tenants/by-slug/:slug', getTenantBySlug);

// ============================================
// Operator routes (authenticated)
// ============================================

router.use(authenticateToken);
router.use(resolveTenant);

router.get('/billing/portal', requireTenantBillingAccess, getBillingPortal);

// ============================================
// Platform admin routes
// ============================================

router.use(requirePlatformAdmin);

router.get('/stats', getPlatformStats);
router.get('/tenants', listTenants);
router.get('/tenants/:id', getTenant);
router.post('/tenants/:id/suspend', suspendTenant);
router.post('/tenants/:id/reactivate', reactivateTenant);
router.post('/tenants/:id/unsuspend', reactivateTenant); // alias used by frontend
router.post('/tenants/:id/cancel', cancelTenant);
router.patch('/tenants/:id/tier', changeTier);
router.get('/tenants/:id/feature-flags', getTenantFeatureFlags);
router.post('/tenants/:id/feature-flags', setTenantFeatureFlag);
router.get('/revenue', getRevenueOverview);

export default router;
