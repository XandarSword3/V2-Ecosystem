import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { exportUserData, deleteUserData, getPortableData } from './gdpr.controller.js';
import { 
  getProfile, 
  updateProfile, 
  listUsers, 
  getUserById, 
  updateUserRoles 
} from './user.controller.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// =====================================
// GDPR Compliance Endpoints
// =====================================

// GDPR Article 15 - Right of Access
router.get('/me/data', exportUserData);

// GDPR Article 17 - Right to Erasure
router.delete('/me/data', deleteUserData);

// GDPR Article 20 - Right to Data Portability
router.post('/me/data/portable', getPortableData);

// =====================================
// Profile Endpoints
// =====================================

// Get user profile
router.get('/profile', getProfile);

// Update profile
router.put('/profile', updateProfile);

// =====================================
// Admin User Management
// =====================================

// Admin only: list all users
router.get('/', authorize('super_admin', 'admin'), listUsers);

// Admin only: get user by ID
router.get('/:id', authorize('super_admin', 'admin'), getUserById);

// Super admin only: update user roles
router.put('/:id/roles', authorize('super_admin'), updateUserRoles);

export default router;
