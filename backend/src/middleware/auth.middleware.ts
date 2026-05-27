import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { isTokenBlacklisted } from '../services/token-blacklist.service.js';
import { verifyToken } from '../modules/auth/auth.utils.js';

interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  tokenVersion?: number;
  jti?: string;
  iat?: number;
  exp?: number;
  tenantId?: string;
  isPlatformAdmin?: boolean;
}

async function resolveUserFromToken(token: string): Promise<JwtPayload> {
  const payload = verifyToken(token) as JwtPayload;

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
      userId:          payload.userId,
      id:              payload.userId,
      email:           payload.email,
      roles:           payload.roles || [],
      tokenVersion:    payload.tokenVersion,
      jti:             payload.jti,
      tenantId:        payload.tenantId,
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
      userId:       payload.userId,
      id:           payload.userId,
      email:        payload.email,
      roles:        payload.roles || [],
      tokenVersion: payload.tokenVersion,
      jti:          payload.jti,
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
    const userRoles = req.user.roles || [];
    if (userRoles.includes('super_admin')) {
      next();
      return;
    }
    if (roles.length > 0 && !roles.some(r => userRoles.includes(r))) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// Alias used by several route files
export const optionalAuth = optionalAuthenticate;
