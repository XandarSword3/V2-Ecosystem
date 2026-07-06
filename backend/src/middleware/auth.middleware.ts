import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { isTokenBlacklisted } from '../services/token-blacklist.service.js';
import { verifyToken, verifyTwoFactorSetupToken } from '../modules/auth/auth.utils.js';

interface JwtPayload {
  userId: string;
  email: string;
  scope: string;
  roles: string[];
  tokenVersion?: number;
  jti?: string;
  iat?: number;
  exp?: number;
  tenantId?: string;
  isPlatformAdmin?: boolean;
}

async function resolveUserFromToken(token: string): Promise<JwtPayload> {
  const payload = verifyToken(token) as JwtPayload & { purpose?: string };

  // Special-purpose tokens (e.g. the 2FA-enrollment setup token — see
  // generateTwoFactorSetupToken in auth.utils.ts) are signed with the same
  // secret but must never work as a general bearer access token. Normal
  // access tokens never carry a `purpose` claim, so any token that does is
  // rejected here unconditionally.
  if (payload.purpose) {
    throw new Error('Invalid or expired token');
  }

  if (payload.userId && payload.tokenVersion !== undefined) {
    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('users')
      .select('token_version, is_active')
      .eq('id', payload.userId)
      .single();

    if (!user || !user.is_active) {
      throw new Error('Account deactivated');
    }

    const dbVersion = user.token_version ?? 0;
    if ((payload.tokenVersion ?? 0) < dbVersion) {
      throw new Error('Session expired, please log in again');
    }
  }

  if (payload.jti) {
    const blacklisted = await isTokenBlacklisted(payload.jti);
    if (blacklisted) {
      throw new Error('Session expired, please log in again');
    }
  }

  return payload;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }

    const token = authHeader.slice(7);

    let payload: JwtPayload;
    try {
      payload = await resolveUserFromToken(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid or expired token';
      if (message === 'Account deactivated' || message === 'Session expired, please log in again') {
        res.status(401).json({ success: false, error: message });
        return;
      }
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    req.user = {
      userId: payload.userId,
      id: payload.userId,
      email: payload.email,
      scope: payload.scope,
      roles: payload.roles || [],
      tokenVersion: payload.tokenVersion,
      jti: payload.jti,
      tenantId: payload.tenantId,
      isPlatformAdmin: payload.isPlatformAdmin ?? false,
    };

    next();
  } catch (err) {
    logger.error('Authentication error:', err);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = await resolveUserFromToken(token);
    req.user = {
      userId:          payload.userId,
      id:              payload.userId,
      email:           payload.email,
      scope:           payload.scope,
      roles:           payload.roles || [],
      tokenVersion:    payload.tokenVersion,
      jti:             payload.jti,
      tenantId:        payload.tenantId,
      isPlatformAdmin: payload.isPlatformAdmin ?? false,
    };
  } catch {
    // Optional auth should never block the request
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }
  next();
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    // Scope check (primary — scope is the canonical source of truth).
    // super_admin scope passes all guards unconditionally.
    const userScope = req.user.scope;
    if (userScope === 'super_admin') {
      next();
      return;
    }
    // Role check (backward compat: roles[] are derived from scope via scopeToRoles).
    const userRoles = req.user.roles || [];
    if (userRoles.includes('super_admin')) {
      next();
      return;
    }
    // Accept if scope OR any derived role satisfies the required role list.
    if (roles.length > 0 && !roles.some(r => r === userScope || userRoles.includes(r))) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// Alias used by several route files
export const optionalAuth = optionalAuthenticate;

/**
 * Accepts ONLY the short-lived 2FA-enrollment setup token (see
 * generateTwoFactorSetupToken, auth.utils.ts) — issued by login() in place
 * of real session tokens when a privileged account is blocked pending
 * mandatory 2FA setup. Scoped narrowly: it authenticates the request but
 * grants no general permissions (scope is deliberately left empty), and it
 * refuses outright once 2FA is already enabled, since the token has
 * nothing left to do at that point.
 */
export async function authenticateTwoFactorSetup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }

    const token = authHeader.slice(7);

    let payload: { userId: string; email: string; purpose: string };
    try {
      payload = verifyTwoFactorSetupToken(token);
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired setup token. Please log in again to restart 2FA enrollment.' });
      return;
    }

    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('users')
      .select('id, email, two_factor_enabled, is_active')
      .eq('id', payload.userId)
      .maybeSingle();

    if (!user || !user.is_active) {
      res.status(401).json({ success: false, error: 'Account not found or deactivated' });
      return;
    }

    // Defense in depth: if 2FA got enabled through some other path since
    // this token was issued, it has nothing left to authorize.
    if (user.two_factor_enabled) {
      res.status(400).json({ success: false, error: '2FA is already enabled. Please log in normally.' });
      return;
    }

    req.user = {
      userId: user.id,
      id: user.id,
      email: user.email,
      scope: '', // deliberately empty — no general API scope, enrollment routes only
      roles: [],
      isPlatformAdmin: false,
    };

    next();
  } catch (err) {
    logger.error('2FA-setup authentication error:', err);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

/**
 * Used only by the /2fa/setup and /2fa/enable routes, which need to work
 * for two different callers:
 *   1. An already-logged-in user voluntarily enabling 2FA from account
 *      settings — a normal access token, verified by `authenticate`.
 *   2. A freshly-provisioned privileged account blocked at login pending
 *      mandatory 2FA (Q103) — the short-lived setup token from
 *      generateTwoFactorSetupToken, verified by `authenticateTwoFactorSetup`.
 * jwt.decode() (unverified) is used only to pick which path to verify
 * through — the actual trust decision still happens inside whichever of
 * the two functions below actually runs.
 */
export async function authenticateForTwoFactorEnrollment(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  let purpose: string | undefined;
  try {
    const decoded = jwt.decode(token) as { purpose?: string } | null;
    purpose = decoded?.purpose;
  } catch {
    // Malformed token — fall through to `authenticate`, which will reject it properly.
  }

  if (purpose === 'twofa_setup') {
    await authenticateTwoFactorSetup(req, res, next);
    return;
  }

  await authenticate(req, res, next);
}
