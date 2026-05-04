import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { rateLimits } from '../../middleware/userRateLimit.middleware.js';
import * as housekeepingImportController from './controllers/housekeeping-import.controller.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const adminRoles = ['admin', 'super_admin'];

router.post('/parse',
  authenticate,
  authorize(...adminRoles),
  rateLimits.standard,
  upload.single('file'),
  housekeepingImportController.parseImport
);

router.post('/commit',
  authenticate,
  authorize(...adminRoles),
  rateLimits.write,
  housekeepingImportController.commitImport
);

export default router;
