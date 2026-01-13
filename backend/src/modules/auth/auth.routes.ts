import { Router } from 'express';
import * as authController from "./auth.controller";
import * as twoFactorController from "./two-factor.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// 2FA verification (during login flow - semi-public)
router.post('/2fa/verify', twoFactorController.verifyTwoFactor);

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/logout', authenticate, authController.logout);
router.put('/change-password', authenticate, authController.changePassword);

// 2FA management (protected)
router.get('/2fa/status', authenticate, twoFactorController.getTwoFactorStatus);
router.post('/2fa/setup', authenticate, twoFactorController.initializeTwoFactor);
router.post('/2fa/enable', authenticate, twoFactorController.enableTwoFactor);
router.post('/2fa/disable', authenticate, twoFactorController.disableTwoFactor);
router.post('/2fa/backup-codes', authenticate, twoFactorController.regenerateBackupCodes);

export default router;
