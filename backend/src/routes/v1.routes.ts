// File: backend/src/routes/v1.routes.ts
/**
 * API Version 1 Router
 * 
 * Provides API versioning support for mobile apps and external integrations.
 * All routes are available at /api/v1/* while maintaining backward compatibility
 * with the existing /api/* endpoints.
 * 
 * Includes NEW Generic Routes for White Label support.
 * 
 * @module routes/v1
 * @version 1.1.0
 */

import { Router, Request, Response } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import paymentRoutes from '../modules/payments/payment.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import reviewsRoutes from '../modules/reviews/reviews.routes.js';
import supportRoutes from '../modules/support/support.routes.js';
import loyaltyRoutes from '../modules/loyalty/loyalty.routes.js';
import giftcardRoutes from '../modules/giftcards/giftcard.routes.js';
import couponRoutes from '../modules/coupons/coupon.routes.js';
import housekeepingRoutes from '../modules/housekeeping/housekeeping.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import managerRoutes from '../modules/manager/manager.routes.js';
import moduleStaffRoutes from '../modules/staff/module-staff.routes.js';
import devicesRoutes from '../modules/devices/devices.routes.js';
import promotionsRoutes from '../modules/promotions/promotions.routes.js';
import financeRoutes from '../modules/finance/finance.routes.js';
// NEW: Terminology System
import terminologyRoutes from './terminology.routes.js';
import { getSupabase } from '../database/connection.js';
import { asyncHandler } from '../middleware/async-handler.js';

const router = Router();

// API Version Info
router.get('/', (_req: Request, res: Response) => {
  res.json({
    version: '1.1.0',
    apiVersion: 'v1',
    status: 'stable',
    deprecation: null,
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      modules: '/api/v1/modules',
      terminology: '/api/v1/terminology',
    },
  });
});

// Public asset proxy — downloads files from Supabase storage server-side and streams
// them to the client. No redirect is issued, so the Supabase project URL never appears
// anywhere in the browser (not in HTML, JS, API responses, or the network tab).
// No authentication required; these are public brand/content assets.
router.get('/assets/*', asyncHandler(async (req: Request, res: Response) => {
  const storagePath = (req.params as any)[0] as string;

  if (!storagePath || storagePath.includes('..')) {
    return res.status(400).json({ success: false, error: 'Invalid asset path' }) as any;
  }

  const supabase = getSupabase();

  const { data: fileData, error } = await supabase.storage
    .from('assets')
    .download(storagePath);

  if (error || !fileData) {
    return res.status(404).json({ success: false, error: 'Asset not found' }) as any;
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());

  res.setHeader('Content-Type', fileData.type || 'application/octet-stream');
  // 24 h browser cache — filenames include a timestamp so they never collide across uploads
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}));

// Core routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/support', supportRoutes);
router.use('/finance', financeRoutes);

// NEW: Terminology System
router.use('/terminology', terminologyRoutes);

// Staff Module Operations (dynamic routes for all module types)
router.use('/staff', moduleStaffRoutes);

// All module routes now served exclusively via dynamic module router

// Feature routes
router.use('/loyalty', loyaltyRoutes);
router.use('/giftcards', giftcardRoutes);
router.use('/coupons', couponRoutes);
router.use('/housekeeping', housekeepingRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/manager', managerRoutes);

// Mobile app support
router.use('/devices', devicesRoutes);

// New advanced routes
router.use('/promotions', promotionsRoutes);

export default router;
