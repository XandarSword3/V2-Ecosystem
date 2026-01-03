import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from "../../middleware/auth.middleware";
import * as menuController from "./controllers/menu.controller";
import * as orderController from "./controllers/order.controller";
import * as tableController from "./controllers/table.controller";

const router = Router();

// ============================================
// Public Routes (Menu)
// ============================================
// Full menu endpoint (categories + items)
router.get('/menu', menuController.getFullMenu);
router.get('/menu/categories', menuController.getCategories);
router.get('/menu/items', menuController.getMenuItems);
router.get('/menu/items/:id', menuController.getMenuItem);
router.get('/menu/featured', menuController.getFeaturedItems);

// Direct category endpoint (for admin page compatibility)
router.get('/categories', menuController.getCategories);
router.get('/items', menuController.getMenuItems);

// ============================================
// Customer Routes (Orders)
// ============================================
router.post('/orders', optionalAuth, orderController.createOrder);
// router.get('/orders/:id', optionalAuth, orderController.getOrder); // Moved to end
// router.get('/orders/:id/status', orderController.getOrderStatus); // Moved to end

// Authenticated customer routes
router.get('/my-orders', authenticate, orderController.getMyOrders);

// ============================================
// Staff Routes
// ============================================
const staffRoles = ['staff', 'restaurant_staff', 'restaurant_admin', 'super_admin'];

router.get('/staff/orders', authenticate, authorize(...staffRoles), orderController.getStaffOrders);
router.patch('/staff/orders/:id/status', authenticate, authorize(...staffRoles), orderController.updateOrderStatus);
router.get('/staff/orders/live', authenticate, authorize(...staffRoles), orderController.getLiveOrders);

// Tables
router.get('/staff/tables', authenticate, authorize(...staffRoles), tableController.getTables);
router.patch('/staff/tables/:id', authenticate, authorize(...staffRoles), tableController.updateTable);

// ============================================
// Admin Routes (Menu Management)
// ============================================
const adminRoles = ['restaurant_admin', 'super_admin'];

// ... (Admin routes would go here if I had them in context, but I'll just append the moved routes at the end of the file)

// Moved parameterized routes to end
router.get('/orders/:id', optionalAuth, orderController.getOrder);
router.get('/orders/:id/status', orderController.getOrderStatus);

// Categories
router.post('/admin/categories', authenticate, authorize(...adminRoles), menuController.createCategory);
router.put('/admin/categories/:id', authenticate, authorize(...adminRoles), menuController.updateCategory);
router.delete('/admin/categories/:id', authenticate, authorize(...adminRoles), menuController.deleteCategory);

// Menu Items
router.post('/admin/items', authenticate, authorize(...adminRoles), menuController.createMenuItem);
router.put('/admin/items/:id', authenticate, authorize(...adminRoles), menuController.updateMenuItem);
router.delete('/admin/items/:id', authenticate, authorize(...adminRoles), menuController.deleteMenuItem);
router.patch('/admin/items/:id/availability', authenticate, authorize(...adminRoles), menuController.toggleAvailability);

// Admin Orders (for admin dashboard)
router.get('/admin/orders', authenticate, authorize(...adminRoles), orderController.getStaffOrders);
router.put('/admin/orders/:id/status', authenticate, authorize(...adminRoles), orderController.updateOrderStatus);
router.patch('/admin/orders/:id/status', authenticate, authorize(...adminRoles), orderController.updateOrderStatus);

// Tables
router.post('/admin/tables', authenticate, authorize(...adminRoles), tableController.createTable);
router.delete('/admin/tables/:id', authenticate, authorize(...adminRoles), tableController.deleteTable);

// Reports
router.get('/admin/reports/daily', authenticate, authorize(...adminRoles), orderController.getDailyReport);
router.get('/admin/reports/sales', authenticate, authorize(...adminRoles), orderController.getSalesReport);

export default router;
