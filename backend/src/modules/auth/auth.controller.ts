import dayjs from 'dayjs';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { z } from 'zod';
import * as authService from "./auth.service";
import { loginSchema, registerSchema, changePasswordSchema } from "./auth.validation";
import { logger } from "../../utils/logger";
import { emailService } from "../../services/email.service";
import { config } from "../../config";
import { logActivity } from "../../utils/activityLogger";
import { getErrorMessage } from "../../types/index.js";

const isProduction = config.env === 'production';

export async function register(req: Request, res: Response, next: NextFunction) {
  const body = req.body;
  try {
    const data = registerSchema.parse(body) as authService.RegisterData;
    const result = await authService.register(data);

    await logActivity({
      user_id: result.user.id,
      action: 'REGISTER',
      resource: 'auth',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      new_value: { email: data.email, fullName: data.fullName }
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
        code: 'VALIDATION_ERROR',
      });
    }
    const message = getErrorMessage(error);
    logger.error('Registration failed:', message);

    // FIX: Issue 20 — Prevent email enumeration
    if (message.includes('Email already registered')) {
      // Fire-and-forget email notification
      emailService.sendAccountExistsNotification(body.email, body.fullName).catch(err => {
        logger.error('[AUTH] Failed to send account-exists notification:', err);
      });

      return res.status(201).json({
        success: true,
        message: "If this email is new, you'll receive a confirmation shortly.",
        _status: 'Account already exists (enumeration protected)'
      });
    }

    // Only expose error details in development
    res.status(500).json({
      success: false,
      error: isProduction ? 'Registration failed. Please try again.' : message
    });
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);

    const result = await authService.login(data.email, data.password, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Check if 2FA is required
    if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
      return res.json({
        success: true,
        data: {
          requiresTwoFactor: true,
          userId: result.userId,
          email: result.email,
        },
        message: 'Two-factor authentication required',
      });
    }

    // At this point, result is a full login response
    const loginResult = result as { user: { id: string; email: string; fullName: string; profileImageUrl: string; preferredLanguage: string; roles: string[] }; tokens: { accessToken: string; refreshToken: string } };

    // SECURITY FIX (HIGH-009): Rotate CSRF token after successful login to prevent session fixation
    const { generateCsrfToken, setCsrfCookie } = await import('../../middleware/csrf.middleware.js');
    const newCsrfToken = generateCsrfToken();
    setCsrfCookie(res, newCsrfToken);

    await logActivity({
      user_id: loginResult.user.id,
      action: 'LOGIN',
      resource: 'auth',
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    res.json({ success: true, data: loginResult, csrfToken: newCsrfToken });
  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
        code: 'VALIDATION_ERROR',
      });
    }

    // FIX: Issue 5 — Handle unverified email with a specific response + resend URL
    const errMsg = getErrorMessage(error);
    if (errMsg.includes('Email not verified')) {
      return res.status(403).json({
        success: false,
        error: errMsg,
        code: 'EMAIL_NOT_VERIFIED',
        resendUrl: '/api/v1/auth/resend-verification',
      });
    }

    logger.warn(`Login failed for email: ${req.body.email}`);
    next(error);
  }
}

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Refresh token required' });
  }
  try {
    const result = await authService.refreshAccessToken(refreshToken);
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('token') ||
      lowerMessage.includes('jwt') ||
      lowerMessage.includes('malformed') ||
      lowerMessage.includes('expired')
    ) {
      return res.status(401).json({
        success: false,
        error: message,
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    throw error;
  }
});

export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getUserById(req.user!.userId);
  res.json({ success: true, data: user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const refreshToken = req.body?.refreshToken;
  await authService.logout(userId, refreshToken || undefined);

  await logActivity({
    user_id: userId,
    action: 'LOGOUT',
    resource: 'auth',
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  });

  res.json({ success: true, message: 'Logged out successfully' });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const data = changePasswordSchema.parse(req.body);
  await authService.changePassword(req.user!.userId, data.currentPassword, data.newPassword);

  await logActivity({
    user_id: req.user!.userId,
    action: 'CHANGE_PASSWORD',
    resource: 'auth',
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  });

  res.json({ success: true, message: 'Password changed successfully' });
});

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    await authService.sendPasswordResetEmail(email);
    res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    // Don't reveal if email exists
    logger.error('Forgot password error:', error);
    res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  }
}

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  const result = await authService.resetPassword(token, newPassword);

  await logActivity({
    user_id: (result as any).user_id || 'unknown', // Assuming resetPassword returns user_id
    action: 'RESET_PASSWORD',
    resource: 'auth',
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  });

  res.json({ success: true, message: 'Password reset successfully' });
});

// GET /api/auth/verify-email?token=...
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'Verification token is required' });
  }

  await authService.verifyEmail(token);
  res.json({ success: true, message: 'Email verified successfully' });
});

// POST /api/auth/resend-verification
export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const supabase = (await import('../../database/connection.js')).getSupabase();
  const { data: user } = await supabase
    .from('users')
    .select('id, email, full_name, email_verified')
    .eq('id', userId)
    .single();

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  if (user.email_verified) {
    return res.json({ success: true, message: 'Email is already verified' });
  }

  await authService.sendVerificationEmail(user.id, user.email, user.full_name);
  res.json({ success: true, message: 'Verification email sent' });
});
