import { Router } from 'express';
import * as multiPropertyController from './multi-property.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== USER ROUTES ====================

// Get properties accessible to current user
router.get('/my-properties', multiPropertyController.getMyProperties);

// Switch active property
router.post('/switch-property', multiPropertyController.switchProperty);

// ==================== PROPERTY GROUPS (Admin) ====================

// Get all property groups
router.get('/groups', authorize('admin', 'super_admin'), multiPropertyController.getPropertyGroups);

// Create a new property group
router.post('/groups', authorize('super_admin'), multiPropertyController.createPropertyGroup);

// Get a specific property group
router.get('/groups/:groupId', authorize('admin', 'super_admin'), multiPropertyController.getPropertyGroup);

// Update a property group
router.put('/groups/:groupId', authorize('super_admin'), multiPropertyController.updatePropertyGroup);

// Get group summary with metrics
router.get('/groups/:groupId/summary', authorize('admin', 'super_admin'), multiPropertyController.getGroupSummary);

// Add property to group
router.post('/groups/:groupId/properties', authorize('super_admin'), multiPropertyController.addPropertyToGroup);

// Remove property from group
router.delete('/properties/:propertyId/group', authorize('super_admin'), multiPropertyController.removePropertyFromGroup);

// ==================== BENCHMARKING ====================

// Get benchmarks for a group
router.get('/groups/:groupId/benchmarks', authorize('admin', 'super_admin'), multiPropertyController.getGroupBenchmarks);

// Calculate/recalculate benchmarks
router.post('/groups/:groupId/benchmarks/calculate', authorize('admin', 'super_admin'), multiPropertyController.calculateBenchmarks);

// ==================== ACCESS MANAGEMENT (Super Admin) ====================

// Grant property access to user
router.post('/access/property/grant', authorize('super_admin'), multiPropertyController.grantPropertyAccess);

// Revoke property access from user
router.post('/access/property/revoke', authorize('super_admin'), multiPropertyController.revokePropertyAccess);

// Grant group access to user
router.post('/access/group/grant', authorize('super_admin'), multiPropertyController.grantGroupAccess);

// Revoke group access from user
router.post('/access/group/revoke', authorize('super_admin'), multiPropertyController.revokeGroupAccess);

export default router;

