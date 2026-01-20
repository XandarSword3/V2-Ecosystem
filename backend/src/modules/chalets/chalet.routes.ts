import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from "../../middleware/auth.middleware";
import { rateLimits } from "../../middleware/userRateLimit.middleware.js";
import * as chaletController from "./chalet.controller";

const router = Router();

// Public routes - specific routes BEFORE parameterized routes
router.get('/add-ons', chaletController.getAddOns);
// router.get('/', chaletController.getChalets); // Moved to end
// router.get('/:id', chaletController.getChalet); // Moved to end
// router.get('/:id/availability', chaletController.getAvailability); // Moved to end

// Customer booking routes (rate limited - financial operations)
router.post('/bookings', optionalAuth, rateLimits.write, chaletController.createBooking);
router.get('/bookings/:id', optionalAuth, chaletController.getBooking);
router.post('/bookings/:id/cancel', optionalAuth, rateLimits.write, chaletController.cancelBooking);

// Authenticated customer routes
router.get('/my-bookings', authenticate, chaletController.getMyBookings);

// Staff routes
const staffRoles = ['staff', 'chalet_staff', 'chalet_admin', 'super_admin'];
router.get('/staff/bookings', authenticate, authorize(...staffRoles), chaletController.getStaffBookings);
router.get('/staff/bookings/today', authenticate, authorize(...staffRoles), chaletController.getTodayBookings);
router.patch('/staff/bookings/:id/check-in', authenticate, authorize(...staffRoles), chaletController.checkIn);
router.patch('/staff/bookings/:id/check-out', authenticate, authorize(...staffRoles), chaletController.checkOut);
router.patch('/staff/bookings/:id/status', authenticate, authorize(...staffRoles), chaletController.updateBookingStatus);

// Admin routes
const adminRoles = ['chalet_admin', 'super_admin'];
router.get('/admin/add-ons', authenticate, authorize(...adminRoles), chaletController.getAdminAddOns);
router.post('/admin/chalets', authenticate, authorize(...adminRoles), chaletController.createChalet);
router.put('/admin/chalets/:id', authenticate, authorize(...adminRoles), chaletController.updateChalet);
router.delete('/admin/chalets/:id', authenticate, authorize(...adminRoles), chaletController.deleteChalet);

router.post('/admin/add-ons', authenticate, authorize(...adminRoles), chaletController.createAddOn);
router.put('/admin/add-ons/:id', authenticate, authorize(...adminRoles), chaletController.updateAddOn);
router.delete('/admin/add-ons/:id', authenticate, authorize(...adminRoles), chaletController.deleteAddOn);

router.get('/admin/price-rules', authenticate, authorize(...adminRoles), chaletController.getPriceRules);
router.post('/admin/price-rules', authenticate, authorize(...adminRoles), chaletController.createPriceRule);
router.put('/admin/price-rules/:id', authenticate, authorize(...adminRoles), chaletController.updatePriceRule);
router.delete('/admin/price-rules/:id', authenticate, authorize(...adminRoles), chaletController.deletePriceRule);

// Settings
router.get('/admin/settings', authenticate, authorize(...adminRoles), chaletController.getChaletSettings);
router.put('/admin/settings', authenticate, authorize(...adminRoles), chaletController.updateChaletSettings);

// Public routes (Moved to end to avoid conflict with specific routes)
router.get('/', chaletController.getChalets);
router.get('/:id', chaletController.getChalet);
router.get('/:id/availability', chaletController.getAvailability);

export default router;
