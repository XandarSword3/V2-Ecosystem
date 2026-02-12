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
import restaurantRoutes from '../modules/restaurant/restaurant.routes.js';
import snackRoutes from '../modules/snack/snack.routes.js';
import chaletRoutes from '../modules/chalets/chalet.routes.js';
import poolRoutes from '../modules/pool/pool.routes.js';
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
import reportsRoutes from '../modules/reports/reports.routes.js';
import { requireModule } from '../middleware/moduleGuard.middleware.js';

// NEW: Generic Routes & Terminology
import genericRoutes from './generic.routes.js';
import terminologyRoutes from './terminology.routes.js';

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
      // New Generic Endpoints
      units: '/api/v1/units',
      facilities: '/api/v1/facilities',
      dining: '/api/v1/dining',
      terminology: '/api/v1/terminology',
      // Legacy Endpoints
      restaurant: '/api/v1/restaurant',
      chalets: '/api/v1/chalets',
      pool: '/api/v1/pool',
    },
  });
});

// Core routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/support', supportRoutes);

// NEW: Terminology System
router.use('/terminology', terminologyRoutes);

// NEW: Generic White-Label Routes (Mixed in)
router.use('/', genericRoutes); // Mounts /units, /facilities, /dining

// Staff Module Operations (dynamic routes for all module types)
router.use('/staff', moduleStaffRoutes);

// Legacy Module-protected routes (Kept for backward compatibility)
router.use('/restaurant', requireModule('restaurant'), restaurantRoutes);
router.use('/snack', requireModule('snack-bar'), snackRoutes);
router.use('/chalets', requireModule('chalets'), chaletRoutes);
router.use('/pool', requireModule('pool'), poolRoutes);

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
router.use('/reports', reportsRoutes);

export default router;
