import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import * as publicController from './public.controller.js';

const router = Router();

// Site settings
router.get('/settings', publicController.getSettings);

// Weather
router.get('/weather', publicController.getWeather);

// Tax settings (mapped under /settings/tax for backward compatibility)
router.get('/settings/tax', publicController.getTaxSettings);
router.put('/settings/tax', authenticate, authorize('super_admin', 'admin'), publicController.updateTaxSettings);

export default router;
