import { Router } from 'express';
import { modifiersController } from './modifiers.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();
const adminRoles = ['admin', 'super_admin', 'restaurant_admin', 'manager'];

// Public (View)
router.get('/', modifiersController.getGroups);

// Admin (Manage Groups)
router.post('/', authenticate, authorize(...adminRoles), modifiersController.createGroup);
router.put('/:id', authenticate, authorize(...adminRoles), modifiersController.updateGroup);
router.delete('/:id', authenticate, authorize(...adminRoles), modifiersController.deleteGroup);

// Admin (Manage Options)
router.post('/:groupId/options', authenticate, authorize(...adminRoles), modifiersController.createOption);
router.put('/options/:optionId', authenticate, authorize(...adminRoles), modifiersController.updateOption);
router.delete('/options/:optionId', authenticate, authorize(...adminRoles), modifiersController.deleteOption);

// Menu item modifier links
router.get('/items/:menuItemId', modifiersController.getItemModifiers);
router.put('/items/:menuItemId', authenticate, authorize(...adminRoles), modifiersController.setItemModifiers);

export default router;
