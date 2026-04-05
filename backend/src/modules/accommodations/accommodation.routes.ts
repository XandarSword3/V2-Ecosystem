// File: backend/src/modules/accommodations/accommodation.routes.ts
import { Router } from 'express';
import * as controller from "./accommodation.controller.js";
import { authenticate, authorize, optionalAuth } from "../../middleware/auth.middleware.js";
import { createRateLimiter } from "../../middleware/api-security.middleware.js";

// Rate limit for public booking creation to prevent spam/DoS
const bookingRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many booking requests. Please try again later.',
});

const router = Router();

// Public (read-only)
router.get('/', controller.getUnits);
router.get('/:id', controller.getUnit);
router.get('/:id/availability', controller.getAvailability);

// Booking creation - requires authentication + rate limiting (SECURITY FIX: HIGH-002)
router.post('/bookings', authenticate, bookingRateLimit, controller.createBooking);

// Protected
// router.get('/bookings/my', authenticate, controller.getMyBookings);

// Admin / Staff
// router.post('/', authenticate, authorize('admin'), controller.createUnit);
// router.put('/:id', authenticate, authorize('admin'), controller.updateUnit);


export default router;
