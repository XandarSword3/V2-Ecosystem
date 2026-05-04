import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { rateLimits } from '../../middleware/userRateLimit.middleware.js';
import * as snackImportController from './controllers/snack-import.controller.js';

const router = Router();

// Multer config for 5MB limit in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const adminRoles = ['admin', 'super_admin'];

/**
 * @route POST /api/snack/import/parse
 * @desc Parse snack data from file, JSON or text
 * @access Admin/SuperAdmin
 */
router.post('/import/parse',
  authenticate,
  authorize(...adminRoles),
  rateLimits.standard,
  upload.single('file'),
  snackImportController.parseImport
);

/**
 * @route POST /api/snack/import/commit
 * @desc Commit approved snack items to database
 * @access Admin/SuperAdmin
 */
router.post('/import/commit',
  authenticate,
  authorize(...adminRoles),
  rateLimits.write,
  snackImportController.commitImport
);

export default router;
