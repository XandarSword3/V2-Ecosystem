import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from "../../middleware/auth.middleware";
import * as chaletController from "./chalet.controller";

const router = Router();

// Public routes
router.get('/', chaletController.getChalets);
router.get('/:id', chaletController.getChalet);
router.get('/:id/availability', chaletController.getAvailability);
router.get('/add-ons', chaletController.getAddOns);

// Customer booking routes
router.post('/bookings', optionalAuth, chaletController.createBooking);
router.get('/bookings/:id', chaletController.getBooking);
router.post('/bookings/:id/cancel', optionalAuth, chaletController.cancelBooking);

// Authenticated customer routes
router.get('/my-bookings', authenticate, chaletController.getMyBookings);

// Staff routes
const staffRoles = ['chalet_staff', 'chalet_admin', 'super_admin'];
router.get('/staff/bookings', authenticate, authorize(...staffRoles), chaletController.getStaffBookings);
router.get('/staff/bookings/today', authenticate, authorize(...staffRoles), chaletController.getTodayBookings);
router.patch('/staff/bookings/:id/check-in', authenticate, authorize(...staffRoles), chaletController.checkIn);
router.patch('/staff/bookings/:id/check-out', authenticate, authorize(...staffRoles), chaletController.checkOut);
router.patch('/staff/bookings/:id/status', authenticate, authorize(...staffRoles), chaletController.updateBookingStatus);

// Admin routes
const adminRoles = ['chalet_admin', 'super_admin'];
router.post('/admin/chalets', authenticate, authorize(...adminRoles), chaletController.createChalet);
router.put('/admin/chalets/:id', authenticate, authorize(...adminRoles), chaletController.updateChalet);
router.delete('/admin/chalets/:id', authenticate, authorize(...adminRoles), chaletController.deleteChalet);

router.post('/admin/add-ons', authenticate, authorize(...adminRoles), chaletController.createAddOn);
router.put('/admin/add-ons/:id', authenticate, authorize(...adminRoles), chaletController.updateAddOn);
router.delete('/admin/add-ons/:id', authenticate, authorize(...adminRoles), chaletController.deleteAddOn);

router.post('/admin/price-rules', authenticate, authorize(...adminRoles), chaletController.createPriceRule);
router.put('/admin/price-rules/:id', authenticate, authorize(...adminRoles), chaletController.updatePriceRule);
router.delete('/admin/price-rules/:id', authenticate, authorize(...adminRoles), chaletController.deletePriceRule);

export default router;
