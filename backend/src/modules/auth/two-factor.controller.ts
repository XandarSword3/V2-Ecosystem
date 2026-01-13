/**
 * Two-Factor Authentication Controller
 * Handles 2FA setup, verification, and management
 */

import { Request, Response, NextFunction } from 'express';
import { twoFactorService } from '../../services/two-factor.service.js';
import { logActivity } from '../../utils/activityLogger.js';
import { logger } from '../../utils/logger.js';

/**
 * Get 2FA status for current user
 */
export async function getTwoFactorStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const status = await twoFactorService.getStatus(userId);
    
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Initialize 2FA setup - generates secret and QR code
 */
export async function initializeTwoFactor(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    
    if (!userId || !userEmail) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    // Check if already enabled
    const isEnabled = await twoFactorService.isEnabled(userId);
    if (isEnabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is already enabled. Disable it first to set up again.',
      });
    }
    
    const setup = await twoFactorService.generateSetup(userId, userEmail);
    
    await logActivity({
      user_id: userId,
      action: 'INITIATE',
      resource: 'two_factor_auth',
    });
    
    res.json({
      success: true,
      data: {
        qrCode: setup.qrCodeDataUrl,
        secret: setup.secret, // For manual entry
        backupCodes: setup.backupCodes, // Show once, user must save
      },
      message: 'Scan the QR code with your authenticator app, then verify with a code to complete setup.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify code and enable 2FA
 */
export async function enableTwoFactor(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Verification code required',
      });
    }
    
    const success = await twoFactorService.verifyAndEnable(userId, code);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code. Please try again.',
      });
    }
    
    await logActivity({
      user_id: userId,
      action: 'ENABLE',
      resource: 'two_factor_auth',
    });
    
    res.json({
      success: true,
      message: 'Two-factor authentication has been enabled successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Disable 2FA
 */
export async function disableTwoFactor(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Verification code required to disable 2FA',
      });
    }
    
    const success = await twoFactorService.disable(userId, code);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code.',
      });
    }
    
    await logActivity({
      user_id: userId,
      action: 'DISABLE',
      resource: 'two_factor_auth',
    });
    
    res.json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify 2FA code during login
 */
export async function verifyTwoFactor(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, code } = req.body;
    
    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        error: 'User ID and verification code required',
      });
    }
    
    const success = await twoFactorService.verifyCode(userId, code);
    
    if (!success) {
      await logActivity({
        user_id: userId,
        action: 'VERIFY_FAILED',
        resource: 'two_factor_auth',
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code.',
      });
    }
    
    res.json({
      success: true,
      message: 'Verification successful',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Current 2FA code required to regenerate backup codes',
      });
    }
    
    const backupCodes = await twoFactorService.regenerateBackupCodes(userId, code);
    
    if (!backupCodes) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code.',
      });
    }
    
    await logActivity({
      user_id: userId,
      action: 'REGENERATE',
      resource: 'two_factor_auth',
    });
    
    res.json({
      success: true,
      data: {
        backupCodes, // New codes - show once
      },
      message: 'New backup codes generated. Save these securely - they will not be shown again.',
    });
  } catch (error) {
    next(error);
  }
}
