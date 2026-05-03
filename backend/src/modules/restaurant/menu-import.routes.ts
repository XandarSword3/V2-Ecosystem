import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { rateLimits } from '../../middleware/userRateLimit.middleware.js';
import * as menuImportController from './controllers/menu-import.controller.js';

const router = Router();

// Multer config for 5MB limit in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const adminRoles = ['admin', 'super_admin'];

/**
 * @route POST /api/restaurant/import/parse
 * @desc Parse menu data from file, JSON or text
 * @access Admin/SuperAdmin
 */
router.post('/import/parse',
  authenticate,
  authorize(...adminRoles),
  rateLimits.standard,
  upload.single('file'),
  menuImportController.parseImport
);

/**
 * @route POST /api/restaurant/import/commit
 * @desc Commit approved menu items to database
 * @access Admin/SuperAdmin
 */
router.post('/import/commit',
  authenticate,
  authorize(...adminRoles),
  rateLimits.write,
  menuImportController.commitImport
);

export default router;
