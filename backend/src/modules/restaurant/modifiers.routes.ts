import { Router } from 'express';
import { modifiersController } from './modifiers.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();
const adminRoles = ['admin', 'super_admin', 'restaurant_admin', 'manager'];

// Public (View)
router.get('/', modifiersController.getGroups);

// Admin (Manage)
router.post('/', authenticate, authorize(...adminRoles), modifiersController.createGroup);
router.put('/:id', authenticate, authorize(...adminRoles), modifiersController.updateGroup);
router.delete('/:id', authenticate, authorize(...adminRoles), modifiersController.deleteGroup);

export default router;
