/**
 * OAuth Service
 * 
 * Handles OAuth authentication logic for Google and Facebook.
 * Manages user creation/linking and token generation.
 */

import crypto from 'crypto';
import { getSupabase } from '../../database/connection.js';
import { generateTokens } from './auth.utils.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { logActivity } from '../../utils/activityLogger.js';

interface OAuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  profileImageUrl?: string;
}

interface OAuthResult {
  user: OAuthUser;
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface FacebookUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

/**
 * Generate a random state string for CSRF protection
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Exchange Google authorization code for access token
 */
async function getGoogleAccessToken(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, callbackUrl } = config.oauth.google;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Failed to exchange Google code for token:', error);
    throw new Error('Failed to authenticate with Google');
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

/**
 * Get Google user info using access token
 */
async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get Google user info');
  }

  return response.json() as Promise<GoogleUserInfo>;
}

/**
 * Handle Google OAuth callback - exchange code and create/login user
 */
export async function handleGoogleCallback(code: string): Promise<OAuthResult> {
  // Exchange code for tokens
  const tokens = await getGoogleAccessToken(code);
  
  // Get user info from Google
  const googleUser = await getGoogleUserInfo(tokens.access_token);

  if (!googleUser.email) {
    throw new Error('Email not provided by Google');
  }

  // Find or create user
  return findOrCreateOAuthUser({
    provider: 'google',
    providerId: googleUser.id,
    email: googleUser.email,
    fullName: googleUser.name,
    profileImageUrl: googleUser.picture,
  });
}

/**
 * Exchange Facebook authorization code for access token
 */
async function getFacebookAccessToken(code: string): Promise<FacebookTokenResponse> {
  const { clientId, clientSecret, callbackUrl } = config.oauth.facebook;

  const url = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('code', code);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    logger.error('Failed to exchange Facebook code for token:', error);
    throw new Error('Failed to authenticate with Facebook');
  }

  return response.json() as Promise<FacebookTokenResponse>;
}

/**
 * Get Facebook user info using access token
 */
async function getFacebookUserInfo(accessToken: string): Promise<FacebookUserInfo> {
  const url = new URL('https://graph.facebook.com/v18.0/me');
  url.searchParams.set('fields', 'id,email,name,picture');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error('Failed to get Facebook user info');
  }

  return response.json() as Promise<FacebookUserInfo>;
}

/**
 * Handle Facebook OAuth callback - exchange code and create/login user
 */
export async function handleFacebookCallback(code: string): Promise<OAuthResult> {
  const tokens = await getFacebookAccessToken(code);
  const facebookUser = await getFacebookUserInfo(tokens.access_token);

  if (!facebookUser.email) {
    throw new Error('Email not provided by Facebook. Please ensure email permission is granted.');
  }

  return findOrCreateOAuthUser({
    provider: 'facebook',
    providerId: facebookUser.id,
    email: facebookUser.email,
    fullName: facebookUser.name,
    profileImageUrl: facebookUser.picture?.data?.url,
  });
}

// ============================================
// Apple Sign-In Support
// ============================================

interface AppleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  id_token: string;
}

interface AppleIdTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string; // User ID
  email?: string;
  email_verified?: string | boolean;
  is_private_email?: string | boolean;
  auth_time: number;
  nonce_supported: boolean;
}

/**
 * Generate Apple client secret JWT
 * Apple requires a JWT signed with your private key instead of a static secret
 */
async function generateAppleClientSecret(): Promise<string> {
  const { clientId, teamId, keyId, privateKey } = config.oauth.apple;
  
  if (!teamId || !keyId || !privateKey) {
    throw new Error('Apple OAuth not fully configured');
  }

  // Replace escaped newlines with actual newlines
  const key = privateKey.replace(/\\n/g, '\n');
  
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (86400 * 180); // 180 days

  // Create JWT header and payload
  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  };

  const payload = {
    iss: teamId,
    iat: now,
    exp: expiresAt,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  // Use jose library for JWT signing (you'll need to add this dependency)
  // For now, we'll use a simple implementation
  const jwt = await signJWT(header, payload, key);
  return jwt;
}

/**
 * Simple JWT signing for Apple (ES256)
 */
async function signJWT(header: object, payload: object, privateKey: string): Promise<string> {
  const crypto = await import('crypto');
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('SHA256');
  sign.update(signatureInput);
  sign.end();
  
  const signature = sign.sign(privateKey);
  
  // Convert DER signature to raw r||s format for ES256
  const r = signature.subarray(4, 4 + signature[3]);
  const sOffset = 4 + signature[3] + 2;
  const s = signature.subarray(sOffset);
  
  // Pad to 32 bytes each
  const rPadded = Buffer.alloc(32);
  r.copy(rPadded, 32 - r.length);
  const sPadded = Buffer.alloc(32);
  s.copy(sPadded, 32 - s.length);
  
  const rawSignature = Buffer.concat([rPadded, sPadded]);
  const encodedSignature = rawSignature.toString('base64url');

  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Exchange Apple authorization code for access token
 */
async function getAppleAccessToken(code: string): Promise<AppleTokenResponse> {
  const { clientId, callbackUrl } = config.oauth.apple;
  const clientSecret = await generateAppleClientSecret();

  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Failed to exchange Apple code for token:', error);
    throw new Error('Failed to authenticate with Apple');
  }

  return response.json() as Promise<AppleTokenResponse>;
}

/**
 * Decode and verify Apple ID token (simplified - production should verify signature)
 */
function decodeAppleIdToken(idToken: string): AppleIdTokenPayload {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Apple ID token');
  }

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  
  // Verify issuer
  if (payload.iss !== 'https://appleid.apple.com') {
    throw new Error('Invalid Apple ID token issuer');
  }

  // Verify audience (should be your client ID)
  if (payload.aud !== config.oauth.apple.clientId) {
    throw new Error('Invalid Apple ID token audience');
  }

  // Verify expiration
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Apple ID token expired');
  }

  return payload;
}

/**
 * Handle Apple Sign-In callback
 */
export async function handleAppleCallback(
  code: string, 
  idToken: string,
  userName?: { firstName?: string; lastName?: string }
): Promise<OAuthResult> {
  // Decode the ID token to get user info
  const tokenPayload = decodeAppleIdToken(idToken);
  
  if (!tokenPayload.email && !tokenPayload.sub) {
    throw new Error('Email not provided by Apple');
  }

  // Apple sometimes hides the email after first sign-in
  // The sub (subject) is the unique user identifier
  const email = tokenPayload.email || `${tokenPayload.sub}@privaterelay.appleid.com`;
  
  // Build full name from first sign-in data or default
  let fullName = 'Apple User';
  if (userName?.firstName || userName?.lastName) {
    fullName = [userName.firstName, userName.lastName].filter(Boolean).join(' ');
  }

  return findOrCreateOAuthUser({
    provider: 'apple',
    providerId: tokenPayload.sub,
    email,
    fullName,
    profileImageUrl: undefined, // Apple doesn't provide profile images
  });
}

/**
 * Find existing user or create new one from OAuth data
 */
async function findOrCreateOAuthUser(data: {
  provider: 'google' | 'facebook' | 'apple';
  providerId: string;
  email: string;
  fullName: string;
  profileImageUrl?: string;
}): Promise<OAuthResult> {
  const supabase = getSupabase();
  let isNewUser = false;

  // First, try to find user by OAuth provider ID
  let { data: existingUser, error: findError } = await supabase
    .from('users')
    .select('id, email, full_name, profile_image_url')
    .eq('oauth_provider', data.provider)
    .eq('oauth_provider_id', data.providerId)
    .single();

  // If not found by OAuth ID, try to find by email
  if (!existingUser) {
    const { data: emailUser } = await supabase
      .from('users')
      .select('id, email, full_name, profile_image_url, oauth_provider')
      .eq('email', data.email.toLowerCase())
      .single();

    if (emailUser) {
      // User exists with this email - link OAuth provider
      if (!emailUser.oauth_provider) {
        // Update user with OAuth info
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            oauth_provider: data.provider,
            oauth_provider_id: data.providerId,
            profile_image_url: emailUser.profile_image_url || data.profileImageUrl,
            email_verified: true, // OAuth emails are verified
          })
          .eq('id', emailUser.id)
          .select('id, email, full_name, profile_image_url')
          .single();

        if (updateError) {
          logger.error('Failed to link OAuth to existing user:', updateError);
          throw new Error('Failed to link account');
        }

        existingUser = updatedUser;
        logger.info(`Linked ${data.provider} OAuth to existing user: ${emailUser.id}`);
      } else {
        // User already has a different OAuth provider linked
        existingUser = emailUser;
        logger.info(`User ${emailUser.id} logging in via ${data.provider} (originally ${emailUser.oauth_provider})`);
      }
    }
  }

  // Create new user if not found
  if (!existingUser) {
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: data.email.toLowerCase(),
        full_name: data.fullName,
        oauth_provider: data.provider,
        oauth_provider_id: data.providerId,
        profile_image_url: data.profileImageUrl,
        email_verified: true, // OAuth emails are verified
        password_hash: null, // No password for OAuth users
      })
      .select('id, email, full_name, profile_image_url')
      .single();

    if (createError) {
      logger.error('Failed to create OAuth user:', createError);
      throw new Error('Failed to create account');
    }

    existingUser = newUser;
    isNewUser = true;

    // Assign default customer role
    const { data: customerRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'customer')
      .single();

    if (customerRole) {
      await supabase
        .from('user_roles')
        .insert({
          user_id: newUser.id,
          role_id: customerRole.id,
        });
    }

    logger.info(`Created new ${data.provider} OAuth user: ${newUser.id}`);
  }

  // Get user roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', existingUser.id);

  interface UserRoleRow {
    roles: { name: string } | null;
  }
  const roles = (userRoles as unknown as UserRoleRow[] | null)?.map((ur) => ur.roles?.name).filter(Boolean) as string[] || ['customer'];

  // Generate JWT tokens
  const { accessToken, refreshToken } = generateTokens({
    userId: existingUser.id,
    email: existingUser.email,
    roles,
  });

  // Log activity
  await logActivity({
    user_id: existingUser.id,
    action: isNewUser ? 'OAUTH_REGISTER' : 'OAUTH_LOGIN',
    resource: 'auth',
    new_value: { provider: data.provider },
  });

  return {
    user: {
      id: existingUser.id,
      email: existingUser.email,
      fullName: existingUser.full_name,
      roles,
      profileImageUrl: existingUser.profile_image_url,
    },
    accessToken,
    refreshToken,
    isNewUser,
  };
}
