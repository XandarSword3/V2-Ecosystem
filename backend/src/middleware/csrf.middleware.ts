/**
 * CSRF Protection Middleware
 * 
 * Implements the Double Submit Cookie pattern for CSRF protection.
 * This approach is stateless and works well with JWT-based authentication.
 * 
 * How it works:
 * 1. Server generates a random CSRF token and sets it as a cookie
 * 2. Client must include the same token in the X-CSRF-Token header
 * 3. Server validates that cookie value === header value
 * 
 * The attacker cannot read the cookie due to SameSite policy,
 * so they cannot forge a valid request with matching header.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Methods that don't require CSRF protection (safe methods)
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Paths that are exempt from CSRF protection
const EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/payments/webhook', // Stripe webhooks have their own signature verification
  '/health',
  '/healthz',
  '/api/health',
];

/**
 * Generate a cryptographically secure random token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF token cookie on response
 */
export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript to include in header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });
}

/**
 * Get CSRF token from request cookie
 */
export function getCsrfTokenFromCookie(req: Request): string | undefined {
  return req.cookies?.[CSRF_COOKIE_NAME];
}

/**
 * Get CSRF token from request header
 */
export function getCsrfTokenFromHeader(req: Request): string | undefined {
  return req.headers[CSRF_HEADER_NAME] as string | undefined;
}

/**
 * Check if path is exempt from CSRF protection
 */
function isExemptPath(path: string): boolean {
  return EXEMPT_PATHS.some(exempt => path.startsWith(exempt));
}

/**
 * CSRF Token Generation Endpoint Handler
 * Call this to get a fresh CSRF token
 */
export function csrfTokenHandler(req: Request, res: Response): void {
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  res.json({ success: true, csrfToken: token });
}

/**
 * CSRF Protection Middleware
 * 
 * Validates that the CSRF token in the cookie matches the one in the header
 * for all non-safe HTTP methods (POST, PUT, PATCH, DELETE).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF check for safe methods
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Skip CSRF check for exempt paths
  if (isExemptPath(req.path)) {
    return next();
  }

  // Get tokens from cookie and header
  const cookieToken = getCsrfTokenFromCookie(req);
  const headerToken = getCsrfTokenFromHeader(req);

  // If no cookie token exists, generate one and require retry
  if (!cookieToken) {
    const newToken = generateCsrfToken();
    setCsrfCookie(res, newToken);
    logger.warn(`CSRF: No token cookie present for ${req.method} ${req.path}`);
    res.status(403).json({
      success: false,
      error: 'CSRF token missing. Please retry the request.',
      csrfToken: newToken,
    });
    return;
  }

  // Validate header token exists
  if (!headerToken) {
    logger.warn(`CSRF: No token header for ${req.method} ${req.path} from ${req.ip}`);
    res.status(403).json({
      success: false,
      error: 'CSRF token header missing. Include X-CSRF-Token header.',
    });
    return;
  }

  // Compare tokens using timing-safe comparison
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  
  if (cookieBuffer.length !== headerBuffer.length || 
      !crypto.timingSafeEqual(cookieBuffer, headerBuffer)) {
    logger.warn(`CSRF: Token mismatch for ${req.method} ${req.path} from ${req.ip}`);
    res.status(403).json({
      success: false,
      error: 'CSRF token validation failed.',
    });
    return;
  }

  // Token is valid, proceed
  next();
}

/**
 * Middleware to ensure CSRF cookie is always set
 * Use this on routes that serve the initial page load
 */
export function ensureCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (!getCsrfTokenFromCookie(req)) {
    const token = generateCsrfToken();
    setCsrfCookie(res, token);
  }
  next();
}
