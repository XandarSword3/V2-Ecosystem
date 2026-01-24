import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from "./auth.service";
import { loginSchema, registerSchema, changePasswordSchema } from "./auth.validation";
import { logger } from "../../utils/logger";
import { config } from "../../config";
import { logActivity } from "../../utils/activityLogger";
import { getErrorMessage } from "../../types/index.js";

const isProduction = config.env === 'production';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
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
    
    // Handle known business errors with appropriate status codes
    if (message.includes('Email already registered')) {
      return res.status(409).json({
        success: false,
        error: message,
        code: 'EMAIL_EXISTS',
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

    await logActivity({
      user_id: loginResult.user.id,
      action: 'LOGIN',
      resource: 'auth',
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    res.json({ success: true, data: loginResult });
  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
        code: 'VALIDATION_ERROR',
      });
    }
    logger.warn(`Login failed for email: ${req.body.email}`);
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }
    const result = await authService.refreshAccessToken(refreshToken);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getUserById(req.user!.userId);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await authService.logout(token);

      await logActivity({
        user_id: req.user!.userId,
        action: 'LOGOUT',
        resource: 'auth',
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

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

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}
