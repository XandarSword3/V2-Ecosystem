import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from "../../middleware/auth.middleware";
import { rateLimits } from "../../middleware/userRateLimit.middleware.js";
import { requireModulePropertyAccess } from '../../middleware/propertyAccess.middleware.js';
import * as chaletController from "./chalet.controller";
import bookingImportRoutes from './booking-import.routes.js';

const router = Router();
const chaletsPropertyScope = requireModulePropertyAccess('chalets');

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
router.get('/my-bookings', authenticate, chaletsPropertyScope, chaletController.getMyBookings);

// Staff routes
const staffRoles = ['staff', 'chalet_staff', 'chalet_admin', 'super_admin'];
const managerOrAdminRoles = ['manager', 'admin', 'super_admin', 'chalet_admin'];
router.get('/staff/bookings', authenticate, chaletsPropertyScope, authorize(...staffRoles), chaletController.getStaffBookings);
router.get('/staff/bookings/today', authenticate, chaletsPropertyScope, authorize(...staffRoles), chaletController.getTodayBookings);
router.post('/staff/bookings', authenticate, chaletsPropertyScope, authorize(...staffRoles), chaletController.createStaffBooking);
router.patch('/staff/bookings/:id/check-in', authenticate, chaletsPropertyScope, authorize(...staffRoles), chaletController.checkIn);
router.patch('/staff/bookings/:id/check-out', authenticate, chaletsPropertyScope, authorize(...staffRoles), chaletController.checkOut);
router.patch('/staff/bookings/:id/status', authenticate, chaletsPropertyScope, authorize(...staffRoles), chaletController.updateBookingStatus);
router.post('/bookings/:id/deposit/charge', authenticate, chaletsPropertyScope, authorize(...managerOrAdminRoles), chaletController.chargeDeposit);
router.post('/bookings/:id/deposit/release', authenticate, chaletsPropertyScope, authorize(...managerOrAdminRoles), chaletController.releaseDeposit);
// Compatibility aliases for phase checks / older clients.
router.post('/bookings/:id/damage-deposit/charge', authenticate, chaletsPropertyScope, authorize(...managerOrAdminRoles), chaletController.chargeDeposit);
router.post('/bookings/:id/damage-deposit/release', authenticate, chaletsPropertyScope, authorize(...managerOrAdminRoles), chaletController.releaseDeposit);

// Admin routes
const adminRoles = ['chalet_admin', 'super_admin'];
router.get('/admin/add-ons', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.getAdminAddOns);
router.post('/admin/chalets', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.createChalet);
router.put('/admin/chalets/:id', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.updateChalet);
router.delete('/admin/chalets/:id', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.deleteChalet);

router.post('/admin/add-ons', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.createAddOn);
router.put('/admin/add-ons/:id', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.updateAddOn);
router.delete('/admin/add-ons/:id', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.deleteAddOn);

router.get('/admin/price-rules', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.getPriceRules);
router.post('/admin/price-rules', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.createPriceRule);
router.put('/admin/price-rules/:id', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.updatePriceRule);
router.delete('/admin/price-rules/:id', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.deletePriceRule);

// Settings
router.get('/admin/settings', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.getChaletSettings);
router.put('/admin/settings', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.updateChaletSettings);

// Admin calendar & date blocking
router.get('/admin/chalets/:id/calendar', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.getAdminCalendar);
router.post('/admin/chalets/:id/block-dates', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.blockDates);
router.post('/admin/chalets/:id/unblock-dates', authenticate, chaletsPropertyScope, authorize(...adminRoles), chaletController.unblockDates);

// Public routes (Moved to end to avoid conflict with specific routes)
router.get('/', chaletController.getChalets);
router.get('/:id', chaletController.getChalet);
router.get('/:id/availability', chaletController.getAvailability);
router.get('/:id/daily-prices', chaletController.getDailyPrices);

// Import routes - engine-type based for multi_day_booking
router.use('/import', bookingImportRoutes);

export default router;
