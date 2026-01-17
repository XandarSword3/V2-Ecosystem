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

/**
 * Find existing user or create new one from OAuth data
 */
async function findOrCreateOAuthUser(data: {
  provider: 'google' | 'facebook';
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
  const roles = (userRoles as UserRoleRow[] | null)?.map((ur) => ur.roles?.name).filter(Boolean) as string[] || ['customer'];

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
