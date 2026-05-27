/**
 * Platform routes
 *
 * Public:
 *   POST /api/platform/checkout          — create Stripe checkout session (landing page CTA)
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
  suspendTenant,
  reactivateTenant,
  cancelTenant,
  changeTier,
  getRevenueOverview,
  getPlatformStats,
  createCheckoutSession,
  getBillingPortal,
} from './platform-admin.controller.js';

const router = Router();

// ============================================
// Platform admin guard
// ============================================

async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!(req.user as any)?.isPlatformAdmin) {
    res.status(403).json({ success: false, error: 'Platform administrator access required' });
    return;
  }
  next();
}

// ============================================
// Public routes
// ============================================

router.post('/checkout', createCheckoutSession);

// ============================================
// Operator routes (authenticated)
// ============================================

router.use(authenticateToken);
router.use(resolveTenant);

router.get('/billing/portal', getBillingPortal);

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
router.get('/revenue', getRevenueOverview);

export default router;
