import { Router } from 'express';
import * as authController from "./auth.controller";
import * as twoFactorController from "./two-factor.controller";
import * as oauthController from "./oauth.controller";
import * as biometricController from "./biometric.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// OAuth routes
router.get('/google', oauthController.googleAuth);
router.get('/google/callback', oauthController.googleCallback);
router.get('/facebook', oauthController.facebookAuth);
router.get('/facebook/callback', oauthController.facebookCallback);
router.get('/apple', oauthController.appleAuth);
router.post('/apple/callback', oauthController.appleCallback); // Apple uses POST

// 2FA verification (during login flow - semi-public)
router.post('/2fa/verify', twoFactorController.verifyTwoFactor);

// Biometric/WebAuthn routes (semi-public for authentication)
router.post('/biometric/authenticate-begin', biometricController.authenticateBegin);
router.post('/biometric/authenticate-complete', biometricController.authenticateComplete);

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

// Biometric management (protected)
router.post('/biometric/register-begin', authenticate, biometricController.registerBegin);
router.post('/biometric/register-complete', authenticate, biometricController.registerComplete);
router.get('/biometric/credentials', authenticate, biometricController.listCredentials);
router.delete('/biometric/credentials/:id', authenticate, biometricController.deleteCredential);

export default router;
