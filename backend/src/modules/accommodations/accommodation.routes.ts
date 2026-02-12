// File: backend/src/modules/accommodations/accommodation.routes.ts
import { Router } from 'express';
import * as controller from "./accommodation.controller.js";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";


const router = Router();

// Public
router.get('/', controller.getUnits);
router.get('/:id', controller.getUnit);
router.get('/:id/availability', controller.getAvailability);
router.post('/bookings', controller.createBooking);

// Protected
// router.get('/bookings/my', requireAuth, controller.getMyBookings);

// Admin / Staff
// router.post('/', requireAuth, requireRole('admin'), controller.createUnit);
// router.put('/:id', requireAuth, requireRole('admin'), controller.updateUnit);


export default router;
