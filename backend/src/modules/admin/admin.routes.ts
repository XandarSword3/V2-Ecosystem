import { Router } from 'express';
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as adminController from "./admin.controller";

const router = Router();

// All admin routes require super_admin role
router.use(authenticate);
router.use(authorize('super_admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/dashboard/revenue', adminController.getRevenueStats);

// Users
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/roles', adminController.updateUserRoles);
router.delete('/users/:id', adminController.deleteUser);

// Roles
router.get('/roles', adminController.getRoles);
router.post('/roles', adminController.createRole);
router.put('/roles/:id', adminController.updateRole);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

// Reports
router.get('/reports/overview', adminController.getOverviewReport);
router.get('/reports/export', adminController.exportReport);

// Notifications
router.get('/notifications', adminController.getNotifications);

export default router;
