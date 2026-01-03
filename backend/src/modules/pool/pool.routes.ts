import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from "../../middleware/auth.middleware";
import * as poolController from "./pool.controller";

const router = Router();

// Public routes
router.get('/sessions', poolController.getSessions);
router.get('/sessions/:id', poolController.getSession);
router.get('/availability', poolController.getAvailability);

// Customer routes
router.post('/tickets', optionalAuth, poolController.purchaseTicket);
router.get('/tickets/:id', poolController.getTicket);

// Authenticated customer routes
router.get('/my-tickets', authenticate, poolController.getMyTickets);

// Staff routes
const staffRoles = ['staff', 'pool_staff', 'pool_admin', 'super_admin'];
router.post('/staff/validate', authenticate, authorize(...staffRoles), poolController.validateTicket);
router.get('/staff/capacity', authenticate, authorize(...staffRoles), poolController.getCurrentCapacity);
router.get('/staff/tickets/today', authenticate, authorize(...staffRoles), poolController.getTodayTickets);

// Admin routes
const adminRoles = ['pool_admin', 'super_admin'];
router.get('/settings', poolController.getPoolSettings);
router.put('/admin/settings', authenticate, authorize(...adminRoles), poolController.updatePoolSettings);
router.post('/admin/sessions', authenticate, authorize(...adminRoles), poolController.createSession);
router.put('/admin/sessions/:id', authenticate, authorize(...adminRoles), poolController.updateSession);
router.delete('/admin/sessions/:id', authenticate, authorize(...adminRoles), poolController.deleteSession);
router.get('/admin/reports/daily', authenticate, authorize(...adminRoles), poolController.getDailyReport);

export default router;
