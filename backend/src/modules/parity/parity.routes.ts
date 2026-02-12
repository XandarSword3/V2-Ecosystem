import { Router } from 'express';
import * as parityController from './parity.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin', 'super_admin'));

// ==================== CONFIGURATION ====================

// Get parity config for property
router.get('/properties/:propertyId/config', parityController.getConfig);

// Update parity config
router.put('/properties/:propertyId/config', parityController.updateConfig);

// ==================== PARITY CHECKS ====================

// Run single parity check
router.post('/properties/:propertyId/check', parityController.runCheck);

// Run full parity check for property
router.post('/properties/:propertyId/check/full', parityController.runFullCheck);

// Get check history
router.get('/properties/:propertyId/history', parityController.getCheckHistory);

// ==================== ALERTS ====================

// Get alerts
router.get('/properties/:propertyId/alerts', parityController.getAlerts);

// Acknowledge alert
router.post('/alerts/:alertId/acknowledge', parityController.acknowledgeAlert);

// Resolve alert
router.post('/alerts/:alertId/resolve', parityController.resolveAlert);

// Ignore alert
router.post('/alerts/:alertId/ignore', parityController.ignoreAlert);

// ==================== DASHBOARD ====================

// Get parity dashboard
router.get('/properties/:propertyId/dashboard', parityController.getDashboard);

export default router;
