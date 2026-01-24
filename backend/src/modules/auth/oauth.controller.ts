/**
 * OAuth Controller
 * 
 * Handles OAuth authentication flows for Google and Facebook.
 * Implements the OAuth 2.0 authorization code flow.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import * as oauthService from './oauth.service.js';

const FRONTEND_URL = config.frontendUrl || 'http://localhost:3000';

/**
 * GET /api/auth/google
 * Redirects to Google OAuth consent screen
 */
export function googleAuth(req: Request, res: Response): void {
  try {
    const { clientId, callbackUrl } = config.oauth.google;

    if (!clientId) {
      logger.error('Google OAuth not configured: missing GOOGLE_CLIENT_ID');
      res.redirect(`${FRONTEND_URL}/login?error=oauth_not_configured`);
      return;
    }

    // Generate state for CSRF protection
    const state = oauthService.generateOAuthState();

    // Store state in session/cookie for validation
    // Use 'none' for sameSite in development to allow cross-site cookies during OAuth redirect
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: config.env === 'production', // Must be secure in production with sameSite=none
      sameSite: config.env === 'production' ? 'lax' : 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/', // Ensure cookie is available on all paths
    });

    // Build Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', callbackUrl);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'email profile');
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');

    res.redirect(googleAuthUrl.toString());
  } catch (error) {
    logger.error('Error initiating Google OAuth:', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
  }
}

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback after user consent
 */
export async function googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      logger.warn('Google OAuth error:', oauthError);
      res.redirect(`${FRONTEND_URL}/login?error=oauth_denied`);
      return;
    }

    // Validate state for CSRF protection
    const storedState = req.cookies?.oauth_state;
    
    if (!state || state !== storedState) {
      logger.warn('OAuth state mismatch - possible CSRF attack');
      res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
      return;
    }

    // Clear state cookie
    res.clearCookie('oauth_state');

    if (!code || typeof code !== 'string') {
      res.redirect(`${FRONTEND_URL}/login?error=missing_code`);
      return;
    }

    // Exchange code for tokens and get user info
    const result = await oauthService.handleGoogleCallback(code);

    // Redirect based on user role
    const roles = result.user.roles || [];
    let redirectPath = '/';

    if (roles.includes('super_admin') || roles.includes('admin')) {
      redirectPath = '/admin';
    } else if (roles.some((r: string) => r.includes('staff') || r.includes('manager'))) {
      redirectPath = '/staff';
    }

    // Pass tokens in URL for frontend to capture (since httpOnly cookies don't work cross-port)
    // The frontend will read these from URL, store them, and clear from URL
    const redirectUrl = new URL(`${FRONTEND_URL}${redirectPath}`);
    redirectUrl.searchParams.set('oauth', 'success');
    redirectUrl.searchParams.set('accessToken', result.accessToken);
    redirectUrl.searchParams.set('refreshToken', result.refreshToken);
    
    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('Error handling Google OAuth callback:', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
}

/**
 * GET /api/auth/facebook
 * Redirects to Facebook OAuth consent screen
 */
export function facebookAuth(req: Request, res: Response): void {
  try {
    const { clientId, callbackUrl } = config.oauth.facebook;

    if (!clientId) {
      logger.error('Facebook OAuth not configured: missing FACEBOOK_CLIENT_ID');
      res.redirect(`${FRONTEND_URL}/login?error=oauth_not_configured`);
      return;
    }

    // Generate state for CSRF protection
    const state = oauthService.generateOAuthState();

    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });

    // Build Facebook OAuth URL
    const facebookAuthUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    facebookAuthUrl.searchParams.set('client_id', clientId);
    facebookAuthUrl.searchParams.set('redirect_uri', callbackUrl);
    facebookAuthUrl.searchParams.set('scope', 'email,public_profile');
    facebookAuthUrl.searchParams.set('state', state);

    res.redirect(facebookAuthUrl.toString());
  } catch (error) {
    logger.error('Error initiating Facebook OAuth:', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
  }
}

/**
 * GET /api/auth/facebook/callback
 * Handles Facebook OAuth callback after user consent
 */
export async function facebookCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      logger.warn('Facebook OAuth error:', oauthError);
      res.redirect(`${FRONTEND_URL}/login?error=oauth_denied`);
      return;
    }

    const storedState = req.cookies?.oauth_state;
    if (!state || state !== storedState) {
      logger.warn('OAuth state mismatch - possible CSRF attack');
      res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
      return;
    }

    res.clearCookie('oauth_state');

    if (!code || typeof code !== 'string') {
      res.redirect(`${FRONTEND_URL}/login?error=missing_code`);
      return;
    }

    const result = await oauthService.handleFacebookCallback(code);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const roles = result.user.roles || [];
    let redirectPath = '/';

    if (roles.includes('super_admin') || roles.includes('admin')) {
      redirectPath = '/admin';
    } else if (roles.some((r: string) => r.includes('staff') || r.includes('manager'))) {
      redirectPath = '/staff';
    }

    res.redirect(`${FRONTEND_URL}${redirectPath}?oauth=success`);
  } catch (error) {
    logger.error('Error handling Facebook OAuth callback:', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
}

/**
 * GET /api/auth/apple
 * Redirects to Apple Sign In consent screen
 */
export function appleAuth(req: Request, res: Response): void {
  try {
    const { clientId, callbackUrl } = config.oauth.apple;

    if (!clientId) {
      logger.error('Apple OAuth not configured: missing APPLE_CLIENT_ID');
      res.redirect(`${FRONTEND_URL}/login?error=oauth_not_configured`);
      return;
    }

    // Generate state for CSRF protection
    const state = oauthService.generateOAuthState();

    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    // Build Apple OAuth URL
    const appleAuthUrl = new URL('https://appleid.apple.com/auth/authorize');
    appleAuthUrl.searchParams.set('client_id', clientId);
    appleAuthUrl.searchParams.set('redirect_uri', callbackUrl);
    appleAuthUrl.searchParams.set('response_type', 'code id_token');
    appleAuthUrl.searchParams.set('response_mode', 'form_post');
    appleAuthUrl.searchParams.set('scope', 'name email');
    appleAuthUrl.searchParams.set('state', state);

    res.redirect(appleAuthUrl.toString());
  } catch (error) {
    logger.error('Error initiating Apple OAuth:', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
  }
}

/**
 * POST /api/auth/apple/callback
 * Handles Apple Sign In callback (form_post)
 * Apple uses POST with form data for the callback
 */
export async function appleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state, id_token, user: userJson, error: oauthError } = req.body;

    if (oauthError) {
      logger.warn('Apple OAuth error:', oauthError);
      res.redirect(`${FRONTEND_URL}/login?error=oauth_denied`);
      return;
    }

    const storedState = req.cookies?.oauth_state;
    if (!state || state !== storedState) {
      logger.warn('OAuth state mismatch - possible CSRF attack');
      res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
      return;
    }

    res.clearCookie('oauth_state');

    if (!code || !id_token) {
      res.redirect(`${FRONTEND_URL}/login?error=missing_code`);
      return;
    }

    // Parse user info if provided (Apple only sends this on first sign-in)
    let userName: { firstName?: string; lastName?: string } | undefined;
    if (userJson) {
      try {
        const userInfo = typeof userJson === 'string' ? JSON.parse(userJson) : userJson;
        userName = userInfo.name;
      } catch (e) {
        logger.warn('Failed to parse Apple user info:', e);
      }
    }

    const result = await oauthService.handleAppleCallback(code, id_token, userName);

    // Redirect with tokens
    const roles = result.user.roles || [];
    let redirectPath = '/';

    if (roles.includes('super_admin') || roles.includes('admin')) {
      redirectPath = '/admin';
    } else if (roles.some((r: string) => r.includes('staff') || r.includes('manager'))) {
      redirectPath = '/staff';
    }

    const redirectUrl = new URL(`${FRONTEND_URL}${redirectPath}`);
    redirectUrl.searchParams.set('oauth', 'success');
    redirectUrl.searchParams.set('accessToken', result.accessToken);
    redirectUrl.searchParams.set('refreshToken', result.refreshToken);
    
    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('Error handling Apple OAuth callback:', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
}
