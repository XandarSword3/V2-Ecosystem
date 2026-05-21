/**
 * install.routes.ts
 *
 * Mounted at /api/install (public — no authentication required).
 * These routes MUST remain outside the authenticated apiRouter so
 * they are reachable before any user account exists.
 */

import { Router } from 'express';
import * as installController from './install.controller.js';

const router = Router();

// GET /api/install/status
// Returns whether the system has been initialized on this machine.
router.get('/status', installController.getInstallStatus);

// POST /api/install
// Runs the one-time installation: seeds roles, creates the first super_admin,
// records the machine ID.  Rejected with 409 if already initialized.
router.post('/', installController.runInstall);

export default router;
