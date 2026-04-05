/**
 * Self-Service Kiosk Routes
 * Phase 4.2: Route definitions for kiosk operations
 */

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { authenticateDevice } from '../../middleware/deviceAuth.middleware.js';
import * as controller from './kiosk.controller';

const router = Router();

// =============================================
// DEVICE MANAGEMENT (Staff Only)
// =============================================

// Register new kiosk device
router.post(
  '/devices/:propertyId',
  authenticate,
  authorize('admin', 'manager'),
  controller.registerDevice
);

// Get device by ID
router.get(
  '/devices/:deviceId',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.getDevice
);

// Get all devices for property
router.get(
  '/devices/property/:propertyId',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.getPropertyDevices
);

// Update device status (from kiosk itself)
router.patch(
  '/devices/:deviceId/status',
  authenticateDevice,
  controller.updateDeviceStatus
);

// Update device config
router.patch(
  '/devices/:deviceId/config',
  authenticate,
  authorize('admin', 'manager'),
  controller.updateDeviceConfig
);

// Set maintenance mode
router.post(
  '/devices/:deviceId/maintenance',
  authenticate,
  authorize('admin', 'manager'),
  controller.setMaintenanceMode
);

// Deactivate device
router.delete(
  '/devices/:deviceId',
  authenticate,
  authorize('admin', 'manager'),
  controller.deactivateDevice
);

// Device heartbeat (from kiosk)
router.post(
  '/devices/:deviceId/heartbeat',
  authenticateDevice,
  controller.heartbeat
);

// =============================================
// SESSION MANAGEMENT
// =============================================

// Start session (from kiosk)
router.post(
  '/sessions/:kioskId',
  authenticateDevice,
  controller.startSession
);

// Get session
router.get(
  '/sessions/:sessionId',
  authenticateDevice,
  controller.getSession
);

// Update session step
router.patch(
  '/sessions/:sessionId/step',
  authenticateDevice,
  controller.updateSessionStep
);

// Abandon session
router.post(
  '/sessions/:sessionId/abandon',
  authenticateDevice,
  controller.abandonSession
);

// Transfer to desk (can be triggered by staff or kiosk)
router.post(
  '/sessions/:sessionId/transfer',
  authenticateDevice,
  controller.transferToDesk
);

// =============================================
// CHECK-IN / CHECK-OUT (Guest Facing)
// =============================================

// Initiate check-in
router.post(
  '/checkin/:kioskId',
  authenticateDevice,
  controller.initiateCheckin
);

// Complete check-in
router.post(
  '/checkin/:sessionId/complete',
  authenticateDevice,
  controller.completeCheckin
);

// Initiate check-out
router.post(
  '/checkout/:kioskId',
  authenticateDevice,
  controller.initiateCheckout
);

// Complete check-out
router.post(
  '/checkout/:sessionId/complete',
  authenticateDevice,
  controller.completeCheckout
);

// =============================================
// TRANSACTIONS
// =============================================

// Scan ID
router.post(
  '/transactions/:sessionId/:kioskId/id-scan',
  authenticateDevice,
  controller.scanId
);

// Encode key
router.post(
  '/transactions/:sessionId/:kioskId/key-encode',
  authenticateDevice,
  controller.encodeKey
);

// Process payment
router.post(
  '/transactions/:sessionId/:kioskId/payment',
  authenticateDevice,
  controller.processPayment
);

// Print receipt
router.post(
  '/transactions/:sessionId/:kioskId/receipt',
  authenticateDevice,
  controller.printReceipt
);

// =============================================
// KEY STOCK (Staff Only)
// =============================================

// Get key stock
router.get(
  '/key-stock/:kioskId',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.getKeyStock
);

// Refill key stock
router.post(
  '/key-stock/:kioskId/refill',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.refillKeyStock
);

// =============================================
// HARDWARE EVENTS
// =============================================

// Log hardware event (from kiosk)
router.post(
  '/hardware-events/:kioskId',
  authenticateDevice,
  controller.logHardwareEvent
);

// Resolve hardware event (staff)
router.post(
  '/hardware-events/:eventId/resolve',
  authenticate,
  authorize('admin', 'manager', 'maintenance'),
  controller.resolveHardwareEvent
);

// Get unresolved events
router.get(
  '/hardware-events',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'maintenance'),
  controller.getUnresolvedEvents
);

// =============================================
// SCREEN FLOWS
// =============================================

// Get flow configuration
router.get(
  '/flows/:propertyId/:flowType',
  authenticateDevice,
  controller.getScreenFlow
);

// Get screen content
router.get(
  '/flows/:flowId/content/:stepKey',
  authenticateDevice,
  controller.getScreenContent
);

// =============================================
// ANALYTICS (Staff Only)
// =============================================

router.get(
  '/analytics/:propertyId',
  authenticate,
  authorize('admin', 'manager'),
  controller.getKioskAnalytics
);

export default router;
