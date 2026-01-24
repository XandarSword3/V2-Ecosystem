import { Router, RequestHandler } from 'express';
import { inventoryController } from './inventory.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require staff/admin authentication
const staffAuth: RequestHandler[] = [authenticate, authorize('staff', 'admin', 'super_admin')];
const adminAuth: RequestHandler[] = [authenticate, authorize('admin', 'super_admin')];

// Categories
router.get('/categories', ...staffAuth, inventoryController.getCategories.bind(inventoryController));
router.post('/categories', ...adminAuth, inventoryController.createCategory.bind(inventoryController));
router.put('/categories/:id', ...adminAuth, inventoryController.updateCategory.bind(inventoryController));
router.delete('/categories/:id', ...adminAuth, inventoryController.deleteCategory.bind(inventoryController));

// Items
router.get('/items', ...staffAuth, inventoryController.getItems.bind(inventoryController));
router.get('/items/:id', ...staffAuth, inventoryController.getItem.bind(inventoryController));
router.post('/items', ...adminAuth, inventoryController.createItem.bind(inventoryController));
router.put('/items/:id', ...adminAuth, inventoryController.updateItem.bind(inventoryController));
router.delete('/items/:id', ...adminAuth, inventoryController.deleteItem.bind(inventoryController));
router.post('/items/:itemId/link-menu', ...adminAuth, inventoryController.linkToMenuItem.bind(inventoryController));

// Transactions
router.get('/transactions', ...staffAuth, inventoryController.getTransactions.bind(inventoryController));
router.post('/transactions', ...staffAuth, inventoryController.recordTransaction.bind(inventoryController));
router.post('/transactions/bulk', ...adminAuth, inventoryController.bulkTransaction.bind(inventoryController));

// Alerts
router.get('/alerts', ...staffAuth, inventoryController.getAlerts.bind(inventoryController));
router.post('/alerts/:id/resolve', ...staffAuth, inventoryController.resolveAlert.bind(inventoryController));

// Stats & Reports
router.get('/stats', ...adminAuth, inventoryController.getStats.bind(inventoryController));
router.get('/report', ...adminAuth, inventoryController.generateReport.bind(inventoryController));

// Cron endpoints
router.post('/check-expiring', ...adminAuth, inventoryController.checkExpiringItems.bind(inventoryController));

export default router;
