/**
 * API Version 1 Router
 * 
 * Provides API versioning support for mobile apps and external integrations.
 * All routes are available at /api/v1/* while maintaining backward compatibility
 * with the existing /api/* endpoints.
 * 
 * Mobile apps should use /api/v1/* endpoints to ensure version compatibility
 * during future API updates.
 * 
 * @module routes/v1
 * @version 1.0.0
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
import devicesRoutes from '../modules/devices/devices.routes.js';
import { requireModule } from '../middleware/moduleGuard.middleware.js';

const router = Router();

// API Version Info
router.get('/', (_req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    apiVersion: 'v1',
    status: 'stable',
    deprecation: null,
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      restaurant: '/api/v1/restaurant',
      chalets: '/api/v1/chalets',
      pool: '/api/v1/pool',
      snack: '/api/v1/snack',
      payments: '/api/v1/payments',
      admin: '/api/v1/admin',
      reviews: '/api/v1/reviews',
      support: '/api/v1/support',
      loyalty: '/api/v1/loyalty',
      giftcards: '/api/v1/giftcards',
      coupons: '/api/v1/coupons',
      housekeeping: '/api/v1/housekeeping',
      inventory: '/api/v1/inventory',
      manager: '/api/v1/manager',
      devices: '/api/v1/devices',
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

// Module-protected routes
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

export default router;
