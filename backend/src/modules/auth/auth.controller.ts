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
import { isAppError } from "../../utils/errors.js";

const isProduction = config.env === 'production';

// SECURITY (C-1/H-4): the refresh token lives only in an httpOnly cookie —
// never in the JSON body, never readable by JS. The session marker is a
// second, non-httpOnly cookie carrying no token material, used solely so
// Next.js middleware can tell "is there a session" for route protection
// without ever handling the real token.
const REFRESH_TOKEN_COOKIE = 'refreshToken';
const SESSION_MARKER_COOKIE = 'x-auth-session';
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches session expiry in auth.service.ts

// Mirrors csrf.middleware.ts's SameSite logic: production runs the frontend
// on Vercel and the backend on Render — different registrable domains — so
// cross-site cookies need SameSite=None+Secure. Same-site localhost dev
// (different port, same host) only needs Lax.
function authCookieOptions(path: string) {
  return {
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  };
}

export function setAuthCookies(res: Response, refreshTokenValue: string) {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshTokenValue, {
    ...authCookieOptions('/api/v1/auth'),
    httpOnly: true,
  });
  res.cookie(SESSION_MARKER_COOKIE, '1', {
    ...authCookieOptions('/'),
    httpOnly: false, // must be readable by Next.js middleware
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
  res.clearCookie(SESSION_MARKER_COOKIE, { path: '/' });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  const body = req.body;
  try {
    const data = registerSchema.parse(body) as authService.RegisterData;
    // Inject tenant_id from the request's resolved tenant context.
    // The tenantAccess middleware populates req.tenant from X-Tenant-ID / X-Tenant-Slug headers.
    // This is required: the DB constraint enforces tenant_id IS NOT NULL for 'customer' scope.
    (data as authService.RegisterData).tenantId = req.tenant?.id;
    
    // Inject property_id from request context if available
    // First check if middleware already resolved it (req.propertyId)
    let propertyId = (req as any).propertyId;
    // If not, try to resolve from X-Property-Id header (might be a slug or UUID)
    if (!propertyId) {
      const propertyHeader = req.headers['x-property-id'] as string;
      if (propertyHeader) {
        // If it looks like a UUID, use it directly
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyHeader)) {
          propertyId = propertyHeader;
        } else {
          // Otherwise, resolve slug to UUID
          const supabase = (await import('../../database/connection.js')).getSupabase();
          const { data: property } = await supabase
            .from('properties')
            .select('id')
            .eq('slug', propertyHeader)
            .eq('tenant_id', req.tenant?.id)
            .maybeSingle();
          propertyId = property?.id;
        }
      }
    }
    (data as authService.RegisterData).propertyId = propertyId;
    
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
        error: error.issues[0].message,
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

    // Same tenant context register() uses — req.tenant is populated by
    // tenantAccess middleware from the subdomain/X-Tenant-Slug header.
    // Required now that email is scoped per-tenant, not platform-wide
    // (20260704010000_scope_users_email_uniqueness_per_tenant.sql).
    const meta: authService.SessionMeta = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };
    if (data.captchaToken) {
      meta.captchaToken = data.captchaToken;
    }

    const result = req.tenant?.id
      ? await authService.login(data.email, data.password, meta, req.tenant.id)
      : await authService.login(data.email, data.password, meta);

    // Check if 2FA is required (existing enrolled 2FA)
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

    // Check if 2FA enrollment is required (privileged accounts without 2FA set up)
    if ('requiresTwoFactorSetup' in result && result.requiresTwoFactorSetup) {
      return res.status(403).json({
        success: false,
        data: {
          requiresTwoFactorSetup: true,
          userId: result.userId,
          email: result.email,
          // Short-lived token that authenticateForTwoFactorEnrollment (auth.middleware.ts)
          // will accept for /2fa/setup and /2fa/enable ONLY — the account
          // has no real session yet, this is the only way in.
          twoFactorSetupToken: (result as any).twoFactorSetupToken,
        },
        message: result.message || 'Two-factor authentication is mandatory for admin accounts. Please enrol in 2FA before logging in.',
        code: 'TWO_FACTOR_SETUP_REQUIRED',
      });
    }

    // At this point, result is a full login response
    const loginResult = result as { user: { id: string; email: string; fullName: string; profileImageUrl: string; preferredLanguage: string; roles: string[] }; tokens: { accessToken: string; refreshToken: string } };

    // SECURITY FIX (HIGH-009): Rotate CSRF token after successful login to prevent session fixation
    const { generateCsrfToken, setCsrfCookie } = await import('../../middleware/csrf.middleware.js');
    const newCsrfToken = generateCsrfToken();
    setCsrfCookie(res, newCsrfToken, req);

    // SECURITY FIX (C-1): refresh token never leaves the server as JSON.
    setAuthCookies(res, loginResult.tokens.refreshToken);

    await logActivity({
      user_id: loginResult.user.id,
      action: 'LOGIN',
      resource: 'auth',
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    res.json({
      success: true,
      data: {
        user: loginResult.user,
        tokens: { accessToken: loginResult.tokens.accessToken },
      },
      csrfToken: newCsrfToken,
    });
  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues[0].message,
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
  // SECURITY FIX (C-1): refresh token now travels only as an httpOnly
  // cookie set at login — never read from the request body.
  const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!refreshTokenValue) {
    return res.status(401).json({ success: false, error: 'Refresh token required', code: 'INVALID_REFRESH_TOKEN' });
  }
  try {
    const result = await authService.refreshAccessToken(refreshTokenValue);

    // Rotate the refresh-token cookie (auth.service.ts issues a new refresh
    // token on every call and invalidates the old one in the sessions table).
    setAuthCookies(res, result.tokens.refreshToken);

    res.json({
      success: true,
      data: {
        user: result.user,
        tokens: { accessToken: result.tokens.accessToken },
      },
    });
  } catch (error: unknown) {
    // REFRESH_SESSION_NOT_FOUND (auth.service.ts) means this specific token no
    // longer matches any session row — which happens both when the token is
    // truly dead AND, benignly, when a concurrent refresh call (e.g. a second
    // browser tab, or React StrictMode's double-mount in dev) already won the
    // race and rotated it first. We can't tell those two apart here, so we must
    // NOT clear cookies in this case: doing so previously wiped out a sibling
    // call's freshly-set, perfectly valid cookie, permanently stranding the
    // user once their in-memory access token expired (~15 min later) with no
    // way left to refresh. Just 401 and let the client's own in-memory token
    // (from whichever call actually won) keep the session going.
    if (isAppError(error) && error.code === 'REFRESH_SESSION_NOT_FOUND') {
      return res.status(401).json({
        success: false,
        error: error.message,
        code: 'REFRESH_SESSION_NOT_FOUND',
      });
    }

    const message = getErrorMessage(error);
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('token') ||
      lowerMessage.includes('jwt') ||
      lowerMessage.includes('malformed') ||
      lowerMessage.includes('expired')
    ) {
      // Genuinely stale/invalid refresh token (bad signature, expired JWT, or an
      // explicit token_version invalidation) — clear both cookies so the client
      // falls back to a clean login instead of retrying with a dead cookie.
      clearAuthCookies(res);
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
  // SECURITY FIX (C-1): refresh token now lives in the httpOnly cookie, not the body.
  const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE];
  // SECURITY FIX: pass JTI so the access token is immediately blacklisted on logout,
  // not just after its 15-minute natural expiry.
  const accessTokenJti = req.user!.jti;
  await authService.logout(userId, refreshTokenValue || undefined, accessTokenJti);

  await logActivity({
    user_id: userId,
    action: 'LOGOUT',
    resource: 'auth',
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  });

  clearAuthCookies(res);
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
    if (req.tenant?.id) {
      await authService.sendPasswordResetEmail(email, req.tenant.id);
    } else {
      await authService.sendPasswordResetEmail(email);
    }
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
