import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth.middleware.js';
import { rateLimits } from '../../middleware/userRateLimit.middleware.js';
import { requireModulePropertyAccess } from '../../middleware/propertyAccess.middleware.js';
import * as snackController from './snack.controller.js';

const router = Router();
const snackPropertyScope = requireModulePropertyAccess('snack');

// Public routes
router.get('/categories', snackController.getCategories);
router.get('/items', snackController.getItems);
router.get('/items/:id', snackController.getItem);

// Customer routes
router.post('/orders', optionalAuth, rateLimits.write, snackController.createOrder);
router.get('/orders/my', authenticate, snackPropertyScope, snackController.getMyOrders);
router.get('/orders/:id', snackController.getOrder);
router.get('/orders/:id/status', snackController.getOrderStatus);

// Staff routes
const staffRoles = ['snack_bar_staff', 'snack_bar_admin', 'super_admin'];
router.get('/staff/orders', authenticate, snackPropertyScope, authorize(...staffRoles), snackController.getStaffOrders);
router.get('/staff/orders/live', authenticate, snackPropertyScope, authorize(...staffRoles), snackController.getLiveOrders);
router.patch('/staff/orders/:id/status', authenticate, snackPropertyScope, authorize(...staffRoles), snackController.updateOrderStatus);
router.put('/staff/orders/:id/status', authenticate, snackPropertyScope, authorize(...staffRoles), snackController.updateOrderStatus);
router.post('/staff/orders', authenticate, snackPropertyScope, authorize(...staffRoles), snackController.createStaffOrder);

// Admin routes
const adminRoles = ['snack_bar_admin', 'super_admin'];

// Categories
router.post('/admin/categories', authenticate, snackPropertyScope, authorize(...adminRoles), snackController.createCategory);
router.put('/admin/categories/:id', authenticate, snackPropertyScope, authorize(...adminRoles), snackController.updateCategory);
router.delete('/admin/categories/:id', authenticate, snackPropertyScope, authorize(...adminRoles), snackController.deleteCategory);

router.post('/admin/items', authenticate, snackPropertyScope, authorize(...adminRoles), snackController.createItem);
router.put('/admin/items/:id', authenticate, snackPropertyScope, authorize(...adminRoles), snackController.updateItem);
router.delete('/admin/items/:id', authenticate, snackPropertyScope, authorize(...adminRoles), snackController.deleteItem);
router.patch('/admin/items/:id/availability', authenticate, snackPropertyScope, authorize(...adminRoles), snackController.toggleAvailability);

export default router;
