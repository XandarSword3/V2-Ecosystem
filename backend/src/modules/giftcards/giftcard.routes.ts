import { Router } from 'express';
import { giftCardController } from './giftcard.controller.js';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth.middleware.js';
import { validatePropertyAccess, requirePropertyId } from '../../middleware/propertyAccess.middleware.js';

const router = Router();

// Public routes
// Note: GET /templates removed — gift card templates (static hardcoded products) are removed per Issue 17.
router.get('/check/:code', giftCardController.checkBalance.bind(giftCardController));

// Customer routes (purchase is open to guests; optionalAuth attaches user when logged in)
router.post('/purchase', optionalAuth, giftCardController.purchaseGiftCard.bind(giftCardController));
router.get('/my', authenticate, giftCardController.getMyGiftCards.bind(giftCardController));

// Checkout integration (requires auth for tracking)
router.post('/redeem', authenticate, giftCardController.redeemGiftCard.bind(giftCardController));

// Admin routes - both with and without /admin prefix for frontend compatibility
//
// validatePropertyAccess + requirePropertyId: previously these handlers derived
// property_id from a locally-defined getPropertyId() that fell back to "no
// filter" when the header was absent — any tenant_owner/tenant_admin omitting
// X-Property-Id (or supplying another tenant's property UUID, which
// validatePropertyAccess now verifies against req.tenant.id) got every
// tenant's gift cards, codes, and balances. See CONTEXT.md cross-tenant sweep.
router.get('/', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, giftCardController.getAllGiftCards.bind(giftCardController));
router.get('/admin', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, giftCardController.getAllGiftCards.bind(giftCardController));
router.get('/stats', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, giftCardController.getStats.bind(giftCardController));
router.get('/admin/stats', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, giftCardController.getStats.bind(giftCardController));
router.get('/:id', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, giftCardController.getGiftCard.bind(giftCardController));
router.post('/', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, giftCardController.createGiftCard.bind(giftCardController));
router.post('/admin', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, giftCardController.createGiftCard.bind(giftCardController));
router.put('/:id/disable', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, giftCardController.disableGiftCard.bind(giftCardController));
router.put('/admin/:id/disable', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, giftCardController.disableGiftCard.bind(giftCardController));

export default router;
