import { Request, Response, NextFunction } from 'express';
import * as authService from "./auth.service";
import { loginSchema, registerSchema, changePasswordSchema } from "./auth.validation";
import { logger } from "../../utils/logger";

export async function register(req: Request, res: Response, next: NextFunction) {
  logger.info('=== REGISTER ATTEMPT ===');
  logger.info('Request body:', JSON.stringify(req.body, null, 2));
  try {
    const data = registerSchema.parse(req.body);
    logger.info('Validation passed for:', data.email);
    const result = await authService.register(data);
    logger.info('Registration successful for:', data.email);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    logger.error('=== REGISTER ERROR ===');
    logger.error('Error message:', error.message);
    logger.error('Error stack:', error.stack);
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  logger.info('=== LOGIN ATTEMPT ===');
  logger.info('Request body:', JSON.stringify({ email: req.body.email, passwordLength: req.body.password?.length }, null, 2));
  logger.info('IP:', req.ip);
  logger.info('User-Agent:', req.get('user-agent'));
  try {
    const data = loginSchema.parse(req.body);
    logger.info('Validation passed for email:', data.email);
    
    const result = await authService.login(data.email, data.password, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    logger.info('=== LOGIN SUCCESS ===');
    logger.info('User ID:', result.user.id);
    logger.info('User roles:', JSON.stringify(result.user.roles));
    logger.info('Access token generated:', result.tokens.accessToken.substring(0, 20) + '...');
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('=== LOGIN ERROR ===');
    logger.error('Error message:', error.message);
    logger.error('Error stack:', error.stack);
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
    await authService.resetPassword(token, newPassword);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
}
