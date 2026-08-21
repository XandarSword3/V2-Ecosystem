import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import {
  cancelDocument,
  createProfile,
  getDocument,
  issueDocument,
  listDocuments,
  listJurisdictions,
  listProfiles,
  submitDocument,
  updateProfile,
  STAFF_ROLES,
} from './fiscal.controller.js';

const router = Router();

// Jurisdiction adapter catalog (needed by the onboarding wizard).
router.get('/jurisdictions', listJurisdictions);

// Fiscal profiles — staff can read, admin configures.
router.get('/profiles', authenticate, authorize(...STAFF_ROLES), listProfiles);
router.post('/profiles', authenticate, authorize('admin', 'super_admin'), createProfile);
router.patch('/profiles/:id', authenticate, authorize('admin', 'super_admin'), updateProfile);

// Fiscal documents.
router.post('/documents/issue', authenticate, authorize(...STAFF_ROLES), issueDocument);
router.get('/documents', authenticate, authorize(...STAFF_ROLES), listDocuments);
router.get('/documents/:id', authenticate, authorize(...STAFF_ROLES), getDocument);
router.post('/documents/:id/cancel', authenticate, authorize('admin', 'super_admin'), cancelDocument);
router.post('/documents/:id/submit', authenticate, authorize('admin', 'super_admin'), submitDocument);

export default router;
