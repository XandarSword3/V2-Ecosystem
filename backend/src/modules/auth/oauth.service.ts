/**
 * OAuth Service
 * 
 * Handles OAuth authentication logic for Google and Facebook.
 * Manages user creation/linking and token generation.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getSupabase } from '../../database/connection.js';
import { generateTokens } from './auth.utils.js';
import { config } from '../../config/index';
import { logger } from '../../utils/logger.js';
import { logActivity } from '../../utils/activityLogger.js';
import { scopeToRoles } from '../../security/permissions.js';

interface OAuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  scope?: string;
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

// Apple JWKS cache to avoid fetching on every login
let appleJWKSCache: { keys: Array<{ kty: string; kid: string; use: string; alg: string; n: string; e: string }>; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch Apple's public keys (JWKS) for ID token verification
 * Caches keys for 1 hour to reduce external requests
 */
async function getApplePublicKeys() {
  const now = Date.now();
  if (appleJWKSCache && (now - appleJWKSCache.fetchedAt) < JWKS_CACHE_TTL) {
    return appleJWKSCache.keys;
  }

  const response = await fetch('https://appleid.apple.com/auth/keys');
  if (!response.ok) {
    throw new Error(`Failed to fetch Apple JWKS: ${response.status}`);
  }

  const jwks = await response.json() as { keys: typeof appleJWKSCache extends null ? never : NonNullable<typeof appleJWKSCache>['keys'] };
  appleJWKSCache = { keys: jwks.keys, fetchedAt: now };
  return jwks.keys;
}

/**
 * Verify Apple ID token using JWKS signature verification
 * Fetches Apple's public keys and verifies the JWT signature cryptographically
 */
async function verifyAppleIdToken(idToken: string): Promise<AppleIdTokenPayload> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Apple ID token format');
  }

  // Decode header to get the key ID (kid)
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as { kid: string; alg: string };

  // Fetch Apple's public keys and find the matching key
  const keys = await getApplePublicKeys();
  const signingKey = keys.find(k => k.kid === header.kid);

  if (!signingKey) {
    // Key not found — cache may be stale, force refresh
    appleJWKSCache = null;
    const refreshedKeys = await getApplePublicKeys();
    const retryKey = refreshedKeys.find(k => k.kid === header.kid);
    if (!retryKey) {
      throw new Error('Apple signing key not found in JWKS');
    }
    return verifyWithKey(idToken, retryKey);
  }

  return verifyWithKey(idToken, signingKey);
}

/**
 * Verify JWT with a specific JWK
 */
function verifyWithKey(
  idToken: string,
  jwk: { kty: string; kid: string; alg: string; n: string; e: string }
): AppleIdTokenPayload {
  // Convert JWK to PEM using Node.js crypto
  const publicKey = crypto.createPublicKey({
    key: {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
    },
    format: 'jwk',
  });

  // Verify the token signature + standard claims
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: [jwk.alg as jwt.Algorithm],
    issuer: 'https://appleid.apple.com',
    audience: config.oauth.apple.clientId,
  }) as AppleIdTokenPayload;

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
  // Verify the ID token cryptographically using Apple's JWKS
  const tokenPayload = await verifyAppleIdToken(idToken);

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
    .select('id, email, full_name, profile_image_url, token_version')
    .eq('oauth_provider', data.provider)
    .eq('oauth_provider_id', data.providerId)
    .single();

  // If not found by OAuth ID, try to find by email
  if (!existingUser) {
    const { data: emailUser } = await supabase
      .from('users')
      .select('id, email, full_name, profile_image_url, oauth_provider, token_version, scope')
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
          .select('id, email, full_name, profile_image_url, token_version, scope')
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
        scope: 'customer', // scope is the authorization source of truth
      })
      .select('id, email, full_name, profile_image_url, token_version, scope')
      .single();

    if (createError) {
      logger.error('Failed to create OAuth user:', createError);
      throw new Error('Failed to create account');
    }

    existingUser = newUser;
    isNewUser = true;

    logger.info(`Created new ${data.provider} OAuth user: ${newUser.id}`);
  }

  // Derive roles[] from scope (the single source of truth), not user_roles.
  const userScope = (existingUser as any).scope || 'customer';
  const roles = scopeToRoles(userScope as any);

  // Generate JWT tokens
  const { accessToken, refreshToken } = generateTokens({
    userId: existingUser.id,
    email: existingUser.email,
    roles,
    scope: userScope,
    tokenVersion: existingUser.token_version ?? 0,
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
      scope: userScope,
      profileImageUrl: existingUser.profile_image_url,
    },
    accessToken,
    refreshToken,
    isNewUser,
  };
}
