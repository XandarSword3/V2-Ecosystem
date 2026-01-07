import { Router } from 'express';
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as adminController from "./admin.controller";
import * as modulesController from "./modules.controller";

import * as usersController from "./users.controller";
import * as permissionsController from "./permissions.controller";

const router = Router();

// All admin routes require super_admin role
router.use(authenticate);
router.use(authorize('super_admin'));

// Modules
router.get('/modules', modulesController.getModules);
router.get('/modules/:id', modulesController.getModule);
router.post('/modules', modulesController.createModule);
router.put('/modules/:id', modulesController.updateModule);
router.delete('/modules/:id', modulesController.deleteModule);

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/dashboard/revenue', adminController.getRevenueStats);

// Users (Enhanced)
router.get('/users', usersController.getUsers); // Supports ?type=customer|staff|...
router.post('/users', adminController.createUser);
router.get('/users/:id', usersController.getUserDetails); // Enhanced details
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/roles', adminController.updateUserRoles);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/permissions', permissionsController.updateUserPermissions); // User Override

// Roles & Permissions
router.get('/roles', adminController.getRoles);
router.post('/roles', adminController.createRole);
router.put('/roles/:id', adminController.updateRole);
router.get('/roles/:id/permissions', permissionsController.getRolePermissions);
router.put('/roles/:id/permissions', permissionsController.updateRolePermissions);
router.get('/permissions', permissionsController.getAllPermissions);

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
