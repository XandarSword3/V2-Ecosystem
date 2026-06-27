import { Router } from 'express';
import * as authController from "./auth.controller";
import * as twoFactorController from "./two-factor.controller";
import * as oauthController from "./oauth.controller";
import * as biometricController from "./biometric.controller";
import { authenticate } from "../../middleware/auth.middleware";
import userRateLimit from "../../middleware/userRateLimit.middleware.js";

const router = Router();

// Auth-specific rate limiters (stricter than general API limits)
const loginLimiter = userRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    keyPrefix: 'rate:login:',
    message: 'Too many login attempts. Please try again later.'
});
const registerLimiter = userRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyPrefix: 'rate:register:',
    message: 'Too many registration attempts. Please try again later.'
});
const resetLimiter = userRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3,
    keyPrefix: 'rate:reset:',
    message: 'Too many password reset attempts. Please try again later.'
});
const twoFactorLimiter = userRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    keyPrefix: 'rate:2fa:',
    message: 'Too many 2FA attempts. Please try again later.'
});

// Public routes (rate limited)
router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', resetLimiter, authController.refreshToken);
router.post('/forgot-password', resetLimiter, authController.forgotPassword);
router.post('/reset-password', resetLimiter, authController.resetPassword);
router.get('/verify-email', authController.verifyEmail);

// OAuth routes
router.get('/google', oauthController.googleAuth);
router.get('/google/callback', oauthController.googleCallback);
router.get('/facebook', oauthController.facebookAuth);
router.get('/facebook/callback', oauthController.facebookCallback);
router.get('/apple', oauthController.appleAuth);
router.post('/apple/callback', oauthController.appleCallback); // Apple uses POST

// 2FA verification (during login flow - semi-public, rate limited)
router.post('/2fa/verify', twoFactorLimiter, twoFactorController.verifyTwoFactor);

// Biometric/WebAuthn routes (semi-public for authentication)
router.post('/biometric/authenticate-begin', biometricController.authenticateBegin);
router.post('/biometric/authenticate-complete', biometricController.authenticateComplete);

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/logout', authenticate, authController.logout);
router.put('/change-password', authenticate, authController.changePassword);
router.post('/resend-verification', authenticate, authController.resendVerification);

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
