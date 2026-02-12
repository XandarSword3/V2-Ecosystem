import { Router } from 'express';
import * as gdprController from './gdpr.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== USER ROUTES ====================

// Privacy Dashboard - Get all privacy data in one call
router.get('/dashboard', gdprController.getPrivacyDashboard);

// Data Export (GDPR Article 20 - Right to Data Portability)
router.post('/export/request', gdprController.requestExport);
router.get('/export/status', gdprController.getExportStatus);
router.get('/export/download/:requestId', gdprController.downloadExport);

// Data Deletion (GDPR Article 17 - Right to Erasure)
router.post('/deletion/request', gdprController.requestDeletion);
router.get('/deletion/status', gdprController.getDeletionStatus);

// Consent Management (GDPR Article 7)
router.get('/consents', gdprController.getConsents);
router.put('/consents', gdprController.updateConsent);
router.put('/consents/bulk', gdprController.updateMultipleConsents);

// Processing Log (GDPR Article 15 - Right of Access)
router.get('/processing-log', gdprController.getProcessingLog);

// Data Sharing Log
router.get('/data-sharing', gdprController.getDataSharingLog);

// ==================== ADMIN ROUTES ====================

// Retention Policies
router.get('/admin/retention-policies', authorize('admin', 'super_admin'), gdprController.getRetentionPolicies);
router.put('/admin/retention-policies/:policyId', authorize('admin', 'super_admin'), gdprController.updateRetentionPolicy);

// Deletion Request Management
router.get('/admin/deletion-requests', authorize('admin', 'super_admin'), gdprController.listDeletionRequests);
router.post('/admin/deletion-requests/:requestId/approve', authorize('admin', 'super_admin'), gdprController.approveDeletion);
router.post('/admin/deletion-requests/:requestId/reject', authorize('admin', 'super_admin'), gdprController.rejectDeletion);

// Cleanup Jobs
router.post('/admin/cleanup/retention', authorize('admin', 'super_admin'), gdprController.triggerRetentionCleanup);
router.post('/admin/cleanup/exports', authorize('admin', 'super_admin'), gdprController.cleanupExpiredExports);

export default router;
