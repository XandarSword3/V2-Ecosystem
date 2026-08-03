import { Router } from 'express';
import { customizationController } from '../controllers/customization.controller.js';
import { authenticate, authorize } from '../../../middleware/auth.middleware.js';
import { validatePropertyAccess } from '../../../middleware/propertyAccess.middleware.js';

const router = Router();

// ==========================================
// ADMIN ROUTES (require authentication)
// ==========================================

// Groups
// validatePropertyAccess added here so req.propertyId is actually populated
// before the controller — createGroup requires it (customization_groups.
// property_id is NOT NULL). Not added to the other admin routes below since
// their controllers/services don't currently read propertyId; add it
// per-route if/when that changes rather than blanket-applying router.use()
// (which would also hit the unauthenticated PUBLIC ROUTES at the bottom of
// this file and could 401 legitimate customer traffic that sends
// x-property-id — see validatePropertyAccess's own 401 branch).
router.post('/groups', authenticate, authorize('admin', 'manager'), validatePropertyAccess,
  customizationController.createGroup.bind(customizationController));

router.put('/groups/:id', authenticate, authorize('admin', 'manager'),
  customizationController.updateGroup.bind(customizationController));

router.delete('/groups/:id', authenticate, authorize('admin', 'manager'),
  customizationController.deleteGroup.bind(customizationController));

router.get('/groups/:id', authenticate,
  customizationController.getGroup.bind(customizationController));

router.get('/groups', authenticate, validatePropertyAccess,
  customizationController.listGroups.bind(customizationController));

// Options
router.post('/options', authenticate, authorize('admin', 'manager'),
  customizationController.createOption.bind(customizationController));

router.put('/options/:id', authenticate, authorize('admin', 'manager'),
  customizationController.updateOption.bind(customizationController));

router.delete('/options/:id', authenticate, authorize('admin', 'manager'),
  customizationController.deleteOption.bind(customizationController));

router.get('/groups/:groupId/options', authenticate,
  customizationController.getOptionsForGroup.bind(customizationController));

// Entity linking
router.post('/entity-links', authenticate, authorize('admin', 'manager'),
  customizationController.linkToEntity.bind(customizationController));

router.put('/entity-links/:id', authenticate, authorize('admin', 'manager'),
  customizationController.updateEntityLink.bind(customizationController));

router.delete('/entity-links/:id', authenticate, authorize('admin', 'manager'),
  customizationController.unlinkFromEntity.bind(customizationController));

router.get('/entity-links', authenticate,
  customizationController.getEntityLinks.bind(customizationController));

// ==========================================
// TRANSACTIONAL ORDER OPERATIONS (staff)
// ==========================================

// Create transactional order snapshot with inventory
router.post('/orders/snapshot', authenticate, authorize('admin', 'manager', 'staff'),
  customizationController.createOrderSnapshot.bind(customizationController));

// Reverse inventory for refund/cancellation
router.post('/orders/reverse', authenticate, authorize('admin', 'manager'),
  customizationController.reverseOrderItemInventory.bind(customizationController));

// Get reversible customizations for an order
router.get('/orders/:orderType/:orderId/reversible', authenticate, authorize('admin', 'manager'),
  customizationController.getReversibleCustomizations.bind(customizationController));

// ==========================================
// OBSERVABILITY ENDPOINTS (admin)
// ==========================================

// Get customization events for monitoring
router.get('/events', authenticate, authorize('admin', 'manager'),
  customizationController.getEvents.bind(customizationController));

// Get metrics summary for performance monitoring
router.get('/metrics', authenticate, authorize('admin', 'manager'),
  customizationController.getMetricsSummary.bind(customizationController));

// ==========================================
// DUAL-WRITE MONITORING (admin)
// ==========================================

// Get dual-write match rate statistics
router.get('/dual-write/stats', authenticate, authorize('admin'),
  customizationController.getDualWriteStats.bind(customizationController));

// Get dual-write discrepancies
router.get('/dual-write/discrepancies', authenticate, authorize('admin'),
  customizationController.getDualWriteDiscrepancies.bind(customizationController));

// ==========================================
// PUBLIC ROUTES (customer-facing)
// ==========================================

// Get customizations for an entity (catalog item, accommodation unit, etc.)
router.get('/for-entity/:entityType/:entityId',
  customizationController.getCustomizationsForEntity.bind(customizationController));

// Validate selections before checkout
router.post('/validate',
  customizationController.validateSelections.bind(customizationController));

// Get customizations for an order (for receipts)
router.get('/orders/:orderType/:orderId',
  customizationController.getOrderCustomizations.bind(customizationController));

export default router;
