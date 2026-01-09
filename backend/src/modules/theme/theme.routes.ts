import { Router } from 'express';
import { getThemeSettings, updateThemeSettings } from './theme.controller';
import { authenticate } from '../../middleware/auth.middleware'; // Assuming an auth middleware for admin routes

const router = Router();

// Public route to get theme settings (e.g., for frontend to display)
router.get('/', getThemeSettings);

// Admin route to update theme settings (requires authentication and possibly admin role)
router.put('/', authenticate, updateThemeSettings); // Using authenticate as an example

export default router;