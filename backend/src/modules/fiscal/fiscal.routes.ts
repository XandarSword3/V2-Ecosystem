import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { validatePropertyAccess } from '../../middleware/propertyAccess.middleware.js';
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

// All property-scoped fiscal routes run validatePropertyAccess: the
// x-property-id header is validated against the caller's tenant + property
// assignments (and cross-tenant ownership) before it may become
// req.propertyId. resolveProperty reads ONLY that validated value — a client
// can no longer spoof a property it doesn't have access to.
router.get('/profiles', authenticate, validatePropertyAccess, authorize(...STAFF_ROLES), listProfiles);
router.post('/profiles', authenticate, validatePropertyAccess, authorize('admin', 'super_admin'), createProfile);
router.patch('/profiles/:id', authenticate, validatePropertyAccess, authorize('admin', 'super_admin'), updateProfile);

// Fiscal documents.
router.post('/documents/issue', authenticate, validatePropertyAccess, authorize(...STAFF_ROLES), issueDocument);
router.get('/documents', authenticate, validatePropertyAccess, authorize(...STAFF_ROLES), listDocuments);
router.get('/documents/:id', authenticate, validatePropertyAccess, authorize(...STAFF_ROLES), getDocument);
router.post('/documents/:id/cancel', authenticate, validatePropertyAccess, authorize('admin', 'super_admin'), cancelDocument);
router.post('/documents/:id/submit', authenticate, validatePropertyAccess, authorize('admin', 'super_admin'), submitDocument);

export default router;
