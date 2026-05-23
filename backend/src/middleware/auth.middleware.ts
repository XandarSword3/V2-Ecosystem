import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getSupabase } from '../database/connection.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { isTokenBlacklisted } from '../services/token-blacklist.service.js';

interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  tokenVersion?: number;
  jti?: string;
  iat?: number;
  exp?: number;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const token = authHeader.slice(7);

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (err) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    // Check token_version (covers logout-all-devices)
    if (payload.userId && payload.tokenVersion !== undefined) {
      const supabase = getSupabase();
      const { data: user } = await supabase
        .from('users')
        .select('token_version, is_active')
        .eq('id', payload.userId)
        .single();

      if (!user || !user.is_active) {
        res.status(401).json({ success: false, error: 'Account not found or disabled' });
        return;
      }

      const dbVersion = user.token_version ?? 0;
      if ((payload.tokenVersion ?? 0) < dbVersion) {
        res.status(401).json({ success: false, error: 'Token has been invalidated. Please log in again.' });
        return;
      }
    }

    // P3: Check individual token blacklist (covers per-session logout)
    if (payload.jti) {
      const blacklisted = await isTokenBlacklisted(payload.jti);
      if (blacklisted) {
        res.status(401).json({ success: false, error: 'Token has been revoked. Please log in again.' });
        return;
      }
    }

    req.user = {
      userId:       payload.userId,
      id:           payload.userId,
      email:        payload.email,
      roles:        payload.roles || [],
      tokenVersion: payload.tokenVersion,
      jti:          payload.jti,
    };

    next();
  } catch (err) {
    logger.error('Authentication error:', err);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }
  authenticate(req, res, next);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  next();
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (roles.length > 0 && !roles.some(r => req.user!.roles.includes(r))) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    next();
  };
}

// Alias used by several route files
export const optionalAuth = optionalAuthenticate;
