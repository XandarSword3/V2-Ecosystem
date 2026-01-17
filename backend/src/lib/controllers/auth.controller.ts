/**
 * Auth Controller Factory
 * 
 * Thin controller layer that handles HTTP concerns only.
 * All business logic is delegated to the AuthService.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthService, AuthServiceError } from '../services/auth.service.js';
import type { ActivityLoggerService } from '../container/types.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().optional(),
  preferredLanguage: z.enum(['en', 'ar', 'fr']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// ============================================
// CONTROLLER TYPES
// ============================================

export interface AuthControllerDependencies {
  authService: AuthService;
  activityLogger: ActivityLoggerService;
}

export interface AuthController {
  register(req: Request, res: Response, next: NextFunction): Promise<void>;
  login(req: Request, res: Response, next: NextFunction): Promise<void>;
  refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
  getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void>;
  logout(req: Request, res: Response, next: NextFunction): Promise<void>;
  changePassword(req: Request, res: Response, next: NextFunction): Promise<void>;
  forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
  resetPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
}

// ============================================
// CONTROLLER FACTORY
// ============================================

export function createAuthController(deps: AuthControllerDependencies): AuthController {
  const { authService, activityLogger } = deps;

  function handleError(error: unknown, res: Response, next: NextFunction) {
    if ((error as AuthServiceError).code) {
      const authError = error as AuthServiceError;
      res.status(authError.statusCode).json({
        success: false,
        error: authError.message,
        code: authError.code,
      });
      return;
    }
    next(error);
  }

  return {
    async register(req: Request, res: Response, next: NextFunction) {
      try {
        const data = registerSchema.parse(req.body);
        const result = await authService.register(data);

        res.status(201).json({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            success: false,
            error: error.errors[0].message,
            code: 'VALIDATION_ERROR',
          });
          return;
        }
        handleError(error, res, next);
      }
    },

    async login(req: Request, res: Response, next: NextFunction) {
      try {
        const data = loginSchema.parse(req.body);
        const result = await authService.login({
          email: data.email,
          password: data.password,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            success: false,
            error: error.errors[0].message,
            code: 'VALIDATION_ERROR',
          });
          return;
        }
        handleError(error, res, next);
      }
    },

    async refreshToken(req: Request, res: Response, next: NextFunction) {
      try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
          res.status(400).json({
            success: false,
            error: 'Refresh token required',
            code: 'MISSING_TOKEN',
          });
          return;
        }

        const result = await authService.refreshAccessToken(refreshToken);
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        handleError(error, res, next);
      }
    },

    async getCurrentUser(req: Request, res: Response, next: NextFunction) {
      try {
        const user = await authService.getUserById(req.user!.userId);
        res.json({
          success: true,
          data: user,
        });
      } catch (error) {
        handleError(error, res, next);
      }
    },

    async logout(req: Request, res: Response, next: NextFunction) {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
          await authService.logout(token);
          await activityLogger.log('LOGOUT', {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          }, req.user!.userId);
        }

        res.json({
          success: true,
          message: 'Logged out successfully',
        });
      } catch (error) {
        handleError(error, res, next);
      }
    },

    async changePassword(req: Request, res: Response, next: NextFunction) {
      try {
        const data = changePasswordSchema.parse(req.body);
        await authService.changePassword(
          req.user!.userId,
          data.currentPassword,
          data.newPassword
        );

        res.json({
          success: true,
          message: 'Password changed successfully',
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            success: false,
            error: error.errors[0].message,
            code: 'VALIDATION_ERROR',
          });
          return;
        }
        handleError(error, res, next);
      }
    },

    async forgotPassword(req: Request, res: Response, next: NextFunction) {
      try {
        const { email } = req.body;
        await authService.sendPasswordResetEmail(email);
        
        // Always return success to not reveal if email exists
        res.json({
          success: true,
          message: 'If the email exists, a reset link has been sent',
        });
      } catch (error) {
        // Don't reveal errors for security
        res.json({
          success: true,
          message: 'If the email exists, a reset link has been sent',
        });
      }
    },

    async resetPassword(req: Request, res: Response, next: NextFunction) {
      try {
        const data = resetPasswordSchema.parse(req.body);
        await authService.resetPassword(data.token, data.newPassword);

        res.json({
          success: true,
          message: 'Password reset successfully',
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            success: false,
            error: error.errors[0].message,
            code: 'VALIDATION_ERROR',
          });
          return;
        }
        handleError(error, res, next);
      }
    },
  };
}
