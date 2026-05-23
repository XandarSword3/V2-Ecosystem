/**
 * Group Bookings Routes
 * Phase 3.3: Route definitions for group management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import * as groupsController from './groups.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// =============================================
// GROUP RESERVATIONS
// =============================================

router.post(
  '/properties/:propertyId/groups',
  authorize('admin', 'manager', 'sales'),
  groupsController.createGroupReservation
);

router.get(
  '/properties/:propertyId/groups',
  authorize('admin', 'manager', 'sales', 'front_desk'),
  groupsController.getGroupReservations
);

router.get(
  '/groups/:groupId',
  authorize('admin', 'manager', 'sales', 'front_desk'),
  groupsController.getGroupById
);

router.patch(
  '/groups/:groupId',
  authorize('admin', 'manager', 'sales'),
  groupsController.updateGroupReservation
);

router.post(
  '/groups/:groupId/cancel',
  authorize('admin', 'manager'),
  groupsController.cancelGroupReservation
);

// =============================================
// ROOM BLOCKS
// =============================================

router.post(
  '/groups/:groupId/blocks',
  authorize('admin', 'manager', 'sales'),
  groupsController.addRoomBlock
);

router.post(
  '/groups/:groupId/blocks/range',
  authorize('admin', 'manager', 'sales'),
  groupsController.addRoomBlocksForDateRange
);

router.post(
  '/blocks/:blockId/release',
  authorize('admin', 'manager', 'sales'),
  groupsController.releaseRoomBlock
);

// =============================================
// GROUP BOOKINGS
// =============================================

router.post(
  '/groups/:groupId/bookings',
  authorize('admin', 'manager', 'sales', 'front_desk'),
  groupsController.addGroupBooking
);

router.post(
  '/groups/:groupId/rooming-list',
  authorize('admin', 'manager', 'sales'),
  groupsController.importRoomingList
);

router.post(
  '/group-bookings/:bookingId/cancel',
  authorize('admin', 'manager', 'sales', 'front_desk'),
  groupsController.cancelGroupBooking
);

// =============================================
// GROUP EVENTS
// =============================================

router.post(
  '/groups/:groupId/events',
  authorize('admin', 'manager', 'sales'),
  groupsController.addGroupEvent
);

router.patch(
  '/events/:eventId',
  authorize('admin', 'manager', 'sales'),
  groupsController.updateGroupEvent
);

// =============================================
// CONTRACTS
// =============================================

router.post(
  '/groups/:groupId/contract',
  authorize('admin', 'manager', 'sales'),
  groupsController.generateContract
);

router.post(
  '/contracts/:contractId/sign',
  authorize('admin', 'manager', 'sales'),
  groupsController.signContract
);

// =============================================
// INVOICES & PAYMENTS
// =============================================

router.post(
  '/groups/:groupId/invoices',
  authorize('admin', 'manager', 'sales'),
  groupsController.createInvoice
);

router.post(
  '/groups/:groupId/payments',
  authorize('admin', 'manager', 'front_desk'),
  groupsController.recordPayment
);

// =============================================
// ACTIVITY LOG
// =============================================

router.get(
  '/groups/:groupId/activity',
  authorize('admin', 'manager', 'sales'),
  groupsController.getActivityLog
);

// =============================================
// CUTOFF MANAGEMENT
// =============================================

router.post(
  '/groups/process-cutoffs',
  authorize('admin', 'manager'),
  groupsController.processAutomaticCutoffs
);

router.get(
  '/properties/:propertyId/groups/upcoming-cutoffs',
  authorize('admin', 'manager', 'sales'),
  groupsController.getUpcomingCutoffs
);

export default router;
