/**
 * install.routes.ts
 *
 * Mounted at /api/install (public — no authentication required).
 * These routes MUST remain outside the authenticated apiRouter so
 * they are reachable before any user account exists.
 *
 * Kill switch:
 *   The entire install flow is gated behind INSTALL_ENABLED. It defaults to
 *   OFF (disabled) unless the env var is explicitly set to the string
 *   'true'. This is intentional — our primary deployment target (Vercel for
 *   the frontend, Render for the backend) provisions tenants through the
 *   platform-admin flow, not this local first-boot wizard, and the
 *   machine-ID fingerprinting this flow relies on doesn't make sense on
 *   serverless/ephemeral hosts anyway. Set INSTALL_ENABLED=true only for a
 *   genuine self-hosted first-boot install.
 */

import { Router } from 'express';
import * as installController from './install.controller.js';

const router = Router();

// GET /api/install/status
// Returns whether the system has been initialized on this machine.
// When disabled, always reports initialized so the frontend never shows the wizard.
router.get('/status', installController.getInstallStatus);

// POST /api/install
// Runs the one-time installation: seeds roles, creates the first super_admin,
// records the machine ID. Rejected with 409 if already initialized, or 403
// if the install flow is disabled via INSTALL_ENABLED.
router.post('/', installController.runInstall);

export default router;
