/**
 * Mobile Check-in Routes
 * Phase 4.1: Route definitions for mobile check-in module
 */

import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth.middleware.js';
import * as controller from './mobile-checkin.controller';
import { getMyStatement } from '../users/user.controller.js';
import { getMyPayments } from '../payments/payment.controller.js';

const router = Router();

// =============================================
// MOBILE PARITY ROUTES
// =============================================
// Mirror core account-finance endpoints for mobile clients.
router.get('/me/statement', authenticate, getMyStatement);
router.get('/me/payments', authenticate, getMyPayments);

// =============================================
// PRE-ARRIVAL REGISTRATION ROUTES
// =============================================

// Create registration for a booking (staff)
router.post(
  '/registrations/booking/:bookingId',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.createRegistration
);

// Get registration by access token (guest - no auth required)
router.get(
  '/registrations/token/:token',
  controller.getRegistrationByToken
);

// Update registration data (guest - token validated in service)
router.patch(
  '/registrations/:registrationId',
  controller.updateRegistration
);

// Submit registration for review
router.post(
  '/registrations/:registrationId/submit',
  controller.submitRegistration
);

// Approve registration (staff)
router.post(
  '/registrations/:registrationId/approve',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.approveRegistration
);

// Reject registration (staff)
router.post(
  '/registrations/:registrationId/reject',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.rejectRegistration
);

// Get pending registrations for property
router.get(
  '/registrations/pending/:propertyId',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.getPendingRegistrations
);

// =============================================
// DOCUMENT ROUTES
// =============================================

// Upload document
router.post(
  '/registrations/:registrationId/documents',
  controller.uploadDocument
);

// Verify document (staff)
router.post(
  '/documents/:documentId/verify',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.verifyDocument
);

// Get guest documents
router.get(
  '/guests/:guestId/documents',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.getGuestDocuments
);

// =============================================
// SIGNATURE ROUTES
// =============================================

// Capture signature
router.post(
  '/registrations/:registrationId/signature',
  controller.captureSignature
);

// =============================================
// TERMS ROUTES
// =============================================

// Accept terms
router.post(
  '/guests/:guestId/terms/:termsId/accept',
  controller.acceptTerms
);

// Get current terms for property
router.get(
  '/terms/:propertyId/:termsType',
  controller.getCurrentTerms
);

// =============================================
// MOBILE KEY ROUTES
// =============================================

// Request mobile key
router.post(
  '/keys/booking/:bookingId',
  optionalAuth, // Guest can request via app or staff can issue
  controller.requestMobileKey
);

// Get mobile key by ID
router.get(
  '/keys/:keyId',
  optionalAuth,
  controller.getMobileKey
);

// Get mobile keys for booking
router.get(
  '/keys/booking/:bookingId',
  optionalAuth,
  controller.getMobileKeyByBooking
);

// Revoke mobile key (staff)
router.delete(
  '/keys/:keyId',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.revokeMobileKey
);

// Validate key access (lock system callback)
router.post(
  '/keys/:keyId/validate',
  controller.validateKeyAccess
);

// =============================================
// CHECK-IN SESSION ROUTES
// =============================================

// Start check-in session
router.post(
  '/sessions/booking/:bookingId',
  optionalAuth,
  controller.startCheckinSession
);

// Update check-in session step
router.patch(
  '/sessions/:sessionId',
  controller.updateCheckinSession
);

// Complete check-in
router.post(
  '/sessions/:sessionId/complete',
  controller.completeCheckin
);

// =============================================
// PUSH NOTIFICATION ROUTES
// =============================================

// Register push token
router.post(
  '/push/register/:guestId/:propertyId',
  controller.registerPushToken
);

// Send check-in reminder (staff)
router.post(
  '/push/reminder/:bookingId',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.sendCheckinReminder
);

// Send room ready notification (staff)
router.post(
  '/push/room-ready/:bookingId',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'housekeeping'),
  controller.sendRoomReadyNotification
);

export default router;
