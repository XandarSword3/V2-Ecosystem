import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from "../../middleware/auth.middleware";
import { rateLimits } from "../../middleware/userRateLimit.middleware.js";
import { requireModulePropertyAccess } from '../../middleware/propertyAccess.middleware.js';
// Import from refactored controllers
import * as poolController from "./controllers/index";
import membershipRoutes from './membership.controller';

const router = Router();
const poolPropertyScope = requireModulePropertyAccess('pool');

// Public routes
router.get('/sessions', poolController.getSessions);
router.get('/sessions/:id', poolController.getSession);
router.get('/availability', poolController.getAvailability);

// Customer routes (rate limited - financial operations)
router.post('/tickets', optionalAuth, rateLimits.write, poolController.purchaseTicket);
router.get('/tickets/:id', optionalAuth, poolController.getTicket);
router.delete('/tickets/:id', authenticate, poolController.cancelTicket);

// Authenticated customer routes
router.get('/my-tickets', authenticate, poolPropertyScope, poolController.getMyTickets);

// Staff routes
const staffRoles = ['staff', 'pool_staff', 'pool_admin', 'super_admin'];
router.post('/staff/validate', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.validateTicket);
router.post('/staff/tickets', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.createStaffTicket);
// Compatibility: Phase 2 client posts /pool/tickets/:id/validate
router.post('/tickets/:id/validate', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.validateTicket);
router.post('/tickets/:id/entry', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.recordEntry);
router.post('/tickets/:id/exit', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.recordExit);
router.get('/staff/capacity', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.getCurrentCapacity);
router.get('/staff/tickets/today', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.getTodayTickets);
router.get('/staff/maintenance', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.getMaintenanceLogs);
router.post('/staff/maintenance', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.createMaintenanceLog);

// Bracelet management routes (staff)
router.post('/tickets/:id/bracelet', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.assignBracelet);
router.delete('/tickets/:id/bracelet', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.returnBracelet);
router.get('/staff/bracelets/active', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.getActiveBracelets);
router.get('/staff/bracelets/search', authenticate, poolPropertyScope, authorize(...staffRoles), poolController.searchByBracelet);

// Admin routes
const adminRoles = ['pool_admin', 'super_admin'];
router.get('/settings', poolController.getPoolSettings);
router.put('/admin/settings', authenticate, poolPropertyScope, authorize(...adminRoles), poolController.updatePoolSettings);
router.post('/admin/reset-occupancy', authenticate, poolPropertyScope, authorize(...adminRoles), poolController.resetOccupancy);
router.post('/admin/sessions', authenticate, poolPropertyScope, authorize(...adminRoles), poolController.createSession);
router.put('/admin/sessions/:id', authenticate, poolPropertyScope, authorize(...adminRoles), poolController.updateSession);
router.delete('/admin/sessions/:id', authenticate, poolPropertyScope, authorize(...adminRoles), poolController.deleteSession);
router.get('/admin/reports/daily', authenticate, poolPropertyScope, authorize(...adminRoles), poolController.getDailyReport);
router.post('/sessions/:id/capacity/override', authenticate, poolPropertyScope, authorize('manager', 'pool_admin', 'admin', 'super_admin'), poolController.overrideSessionCapacity);
router.post('/admin/sessions/:id/capacity/override', authenticate, poolPropertyScope, authorize('manager', 'pool_admin', 'admin', 'super_admin'), poolController.overrideSessionCapacity);

// Membership routes (mount entire membership sub-router)
router.use('/memberships', membershipRoutes);

export default router;
