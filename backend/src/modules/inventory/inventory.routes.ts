import { Router, RequestHandler } from 'express';
import { inventoryController } from './inventory.controller.js';
import { inventoryAdvancedController } from './inventory-advanced.controller.js';
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
router.delete('/items/:itemId/menu-ingredients', ...adminAuth, inventoryController.deleteMenuItemIngredients.bind(inventoryController));

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

// ── Advanced: Wastage ──
router.post('/wastage', ...staffAuth, inventoryAdvancedController.recordWastage.bind(inventoryAdvancedController));
router.post('/wastage/:id/approve', ...adminAuth, inventoryAdvancedController.approveWastage.bind(inventoryAdvancedController));

// ── Advanced: Physical Counts & Variance ──
router.post('/physical-count', ...staffAuth, inventoryAdvancedController.recordPhysicalCount.bind(inventoryAdvancedController));
router.get('/variance-report', ...adminAuth, inventoryAdvancedController.getVarianceReport.bind(inventoryAdvancedController));

// ── Advanced: Purchase Orders ──
router.get('/purchase-orders', ...staffAuth, inventoryAdvancedController.getPurchaseOrders.bind(inventoryAdvancedController));
router.post('/purchase-orders', ...adminAuth, inventoryAdvancedController.createPurchaseOrder.bind(inventoryAdvancedController));
router.post('/purchase-orders/:id/receive', ...adminAuth, inventoryAdvancedController.receivePurchaseOrder.bind(inventoryAdvancedController));

// ── Advanced: Suppliers ──
router.get('/suppliers', ...staffAuth, inventoryAdvancedController.getSuppliers.bind(inventoryAdvancedController));
router.post('/suppliers', ...adminAuth, inventoryAdvancedController.createSupplier.bind(inventoryAdvancedController));

// ── Advanced: Batches ──
router.get('/items/:itemId/batches', ...staffAuth, inventoryAdvancedController.getItemBatches.bind(inventoryAdvancedController));

// ── Advanced: Order deduction ──
router.post('/deduct-for-order', ...staffAuth, inventoryAdvancedController.deductForOrder.bind(inventoryAdvancedController));

// ── Advanced: Cost Analysis & Dashboard ──
router.get('/menu-cost-analysis/:menuItemId', ...adminAuth, inventoryAdvancedController.getMenuItemCostAnalysis.bind(inventoryAdvancedController));
router.get('/dashboard-stats', ...adminAuth, inventoryAdvancedController.getDashboardStats.bind(inventoryAdvancedController));

export default router;
