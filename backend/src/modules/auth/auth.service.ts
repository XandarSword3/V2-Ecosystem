import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from "../../database/connection.js";
import { generateTokens, verifyRefreshToken } from "./auth.utils.js";
import { config } from "../../config/index";
import { logger } from "../../utils/logger.js";
import { emailService } from "../../services/email.service.js";
import { AppError } from "../../utils/errors.js";
import { validatePassword } from "../../services/password-policy.service.js";
import { isAccountLocked, recordFailedAttempt, recordSuccessfulLogin } from "./lockout.service.js";
import { blacklistToken } from "../../services/token-blacklist.service.js";
import { scopeToRoles, scopeIsPlatformAdmin } from "../../security/permissions.js";

interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  preferredLanguage?: 'en' | 'ar' | 'fr';
  tenantId?: string; // Required for non-platform scopes (customer, tenant_staff, etc.)
}

export async function register(data: RegisterData) {
  const supabase = getSupabase();

  // Check if email exists
  const { data: existing, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('email', data.email.toLowerCase())
    .limit(1);

  if (checkError) {
    logger.error('Error checking email during registration:', checkError.message);
    throw checkError;
  }
  if (existing && existing.length > 0) {
    throw new Error('Email already registered');
  }

  // Enforce password policy at registration
  const policyResult = await validatePassword(data.password);
  if (!policyResult.valid) {
    throw new Error(`Password does not meet policy: ${policyResult.errors.join(', ')}`);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Validate that non-platform registrations have a tenant context.
  // The DB enforces CHECK (scope IN ('super_admin','platform_admin') OR tenant_id IS NOT NULL),
  // so inserting a 'customer' row without tenant_id will 500. Fail fast here with a clear message.
  if (!data.tenantId) {
    throw new AppError('Registration requires a tenant context', 400, 'MISSING_TENANT_CONTEXT');
  }

  // Create user
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email: data.email.toLowerCase(),
      password_hash: passwordHash,
      full_name: data.fullName,
      phone: data.phone,
      preferred_language: data.preferredLanguage || 'en',
      email_verified: false, // Must verify via email link before login is allowed
      tenant_id: data.tenantId,
    })
    .select('id, email, full_name')
    .single();

  if (userError) {
    logger.error('Error creating user:', userError.message);
    throw userError;
  }

  // scope is set to 'customer' by DEFAULT in the database schema
  // FIX: Send email verification link (fire-and-forget — don't block registration)
  sendVerificationEmail(user.id, user.email, user.full_name).catch(err => {
    logger.error('Failed to send verification email:', err);
  });

  // Do NOT issue tokens at registration — user must verify email first.
  // The login endpoint enforces email_verified = true before issuing tokens.
  return { user };
}

export async function login(email: string, password: string, meta: SessionMeta) {
  const supabase = getSupabase();

  // Find user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (userError || !user) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.is_active) {
    throw new AppError('Account is disabled', 403, 'ACCOUNT_DISABLED');
  }

  // FIX: Check account lockout before verifying password
  const lockStatus = await isAccountLocked(email.toLowerCase());
  if (lockStatus.locked) {
    throw new AppError(lockStatus.message || 'Account is temporarily locked', 429, 'ACCOUNT_LOCKED');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    // FIX: Record failed attempt for lockout tracking
    await recordFailedAttempt(
      email.toLowerCase(),
      email,
      meta.ipAddress,
      meta.userAgent
    );
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // FIX: Clear lockout on successful login
  await recordSuccessfulLogin(email.toLowerCase());

  // FIX: Issue 5 — Enforce email verification before allowing login
  if (!user.email_verified) {
    throw new AppError('Email not verified. Please check your inbox for the verification link.', 403, 'EMAIL_NOT_VERIFIED');
  }

  // Check if 2FA is enabled
  if (user.two_factor_enabled) {
    return {
      requiresTwoFactor: true,
      userId: user.id,
      email: user.email,
      message: 'Two-factor authentication required',
    };
  }

  // Get user scope - this is the new source of truth
  const userScope = user.scope || 'customer';
  
  // Derive roles[] from scope for backward compatibility
  const roleNames = scopeToRoles(userScope as any);
  
  // Derive isPlatformAdmin from scope
  const isPlatformAdmin = scopeIsPlatformAdmin(userScope as any);

  // Q103 — Enforce mandatory 2FA for privileged scopes.
  // A super_admin or tenant_admin without 2FA enabled is blocked here
  // and must complete 2FA enrollment before tokens are issued.
  const requiresMandatory2FA =
    userScope === 'super_admin' ||
    userScope === 'tenant_admin' ||
    userScope === 'platform_admin' ||
    userScope === 'tenant_owner';
  if (requiresMandatory2FA && !user.two_factor_enabled) {
    return {
      requiresTwoFactorSetup: true,
      userId: user.id,
      email: user.email,
      message: 'Two-factor authentication is mandatory for admin accounts. Please enrol in 2FA before logging in.',
    };
  }

  // Generate tokens
  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    scope: userScope,
    roles: roleNames,
    tokenVersion: user.token_version ?? 0,
    tenantId: user.tenant_id ?? undefined,
    isPlatformAdmin,
  });

  // Create session
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      tenant_id: user.tenant_id,
      token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: expiresAt.toISOString(),
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
      session_type: 'session',
    });

  if (sessionError) {
    logger.error('Error creating session:', sessionError.message);
  }

  // Update last login
  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      profileImageUrl: user.profile_image_url,
      preferredLanguage: user.preferred_language,
      scope: userScope,
      roles: roleNames,
      is_platform_admin: isPlatformAdmin,
    },
    tokens,
  };
}

/**
 * Complete login after 2FA verification
 */
export async function completeLoginAfter2FA(userId: string, meta: SessionMeta) {
  const supabase = getSupabase();

  // Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  if (!user.is_active) {
    throw new AppError('Account is disabled', 403, 'ACCOUNT_DISABLED');
  }

  // Get user scope - this is the new source of truth
  const userScope = user.scope || 'customer';
  
  // Derive roles[] from scope for backward compatibility
  const roleNames = scopeToRoles(userScope as any);
  
  // Derive isPlatformAdmin from scope
  const isPlatformAdmin = scopeIsPlatformAdmin(userScope as any);

  // Generate tokens
  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    scope: userScope,
    roles: roleNames,
    tokenVersion: user.token_version ?? 0,
    tenantId: user.tenant_id ?? undefined,
    isPlatformAdmin,
  });

  // Create session
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      tenant_id: user.tenant_id,
      token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: expiresAt.toISOString(),
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
      session_type: 'session',
    });

  if (sessionError) {
    logger.error('Error creating session after 2FA:', sessionError.message);
  }

  // Update last login
  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      profileImageUrl: user.profile_image_url,
      preferredLanguage: user.preferred_language,
      scope: userScope,
      roles: roleNames,
      is_platform_admin: isPlatformAdmin,
    },
    tokens,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const supabase = getSupabase();

  // Verify refresh token
  const payload = verifyRefreshToken(refreshToken);

  // Find session — filter to real sessions only so reset/verify tokens can't refresh
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('refresh_token', refreshToken)
    .eq('session_type', 'session')
    .single();

  if (sessionError || !session || !session.is_active) {
    throw new Error('Invalid refresh token');
  }

  // Get user with roles
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user_id)
    .single();

  if (userError || !user || !user.is_active) {
    throw new Error('User not found or inactive');
  }

  // Check token_version - if user's version has been incremented, reject this token
  const userTokenVersion = user.token_version ?? 0;
  const tokenTokenVersion = payload.tokenVersion ?? 0;
  if (tokenTokenVersion < userTokenVersion) {
    // Token was issued before a logout-all-devices, invalidate this session
    await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('id', session.id);
    throw new Error('Token has been invalidated. Please log in again.');
  }

  // Get user scope - this is the new source of truth
  const userScope = user.scope || 'customer';
  
  // Derive roles[] from scope for backward compatibility
  const roleNames = scopeToRoles(userScope as any);
  
  // Derive isPlatformAdmin from scope
  const isPlatformAdmin = scopeIsPlatformAdmin(userScope as any);

  // Generate new tokens
  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    scope: userScope,
    roles: roleNames,
    tokenVersion: user.token_version ?? 0,
    tenantId: user.tenant_id ?? undefined,
    isPlatformAdmin,
  });

  // Update session
  await supabase
    .from('sessions')
    .update({
      token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    })
    .eq('id', session.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      profileImageUrl: user.profile_image_url,
      preferredLanguage: user.preferred_language,
      scope: userScope,
      roles: roleNames,
      is_platform_admin: isPlatformAdmin,
    },
    tokens,
  };
}

export async function logout(userId: string, refreshToken?: string, accessTokenJti?: string) {
  const supabase = getSupabase();

  if (refreshToken) {
    // Single-session logout
    // 1. Deactivate the session
    const { data: session } = await supabase
      .from('sessions')
      .select('id, token')
      .eq('refresh_token', refreshToken)
      .maybeSingle();

    await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('refresh_token', refreshToken);

    // 2. Blacklist the access token so it's immediately invalid even before JWT expiry (P3)
    if (accessTokenJti) {
      // Access tokens expire after JWT_EXPIRES_IN (default 15m)
      const expiresIn = config.jwt.expiresIn || '15m';
      const ms = parseJwtExpiry(expiresIn);
      await blacklistToken(accessTokenJti, userId, new Date(Date.now() + ms));
    }
  } else {
    // Logout all sessions — increment token_version to invalidate all JWTs
    await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('user_id', userId);

    try {
      await supabase.rpc('increment_token_version', { p_user_id: userId });
    } catch {
      const { data: user } = await supabase
        .from('users')
        .select('token_version')
        .eq('id', userId)
        .single();

      await supabase
        .from('users')
        .update({ token_version: (user?.token_version ?? 0) + 1 })
        .eq('id', userId);
    }
  }
}

/** Parse JWT expiry string like '15m', '1h', '7d' into milliseconds */
function parseJwtExpiry(expiry: string): number {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1), 10);
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default:  return 15 * 60 * 1000; // fallback 15 minutes
  }
}

export async function getCurrentUser(userId: string) {
  const supabase = getSupabase();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone, profile_image_url, preferred_language, scope, tenant_id')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Get user scope - this is the new source of truth
  const userScope = user.scope || 'customer';
  
  // Derive roles[] from scope for backward compatibility
  const roleNames = scopeToRoles(userScope as any);
  
  // Derive isPlatformAdmin from scope
  const isPlatformAdmin = scopeIsPlatformAdmin(userScope as any);

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    profileImageUrl: user.profile_image_url,
    preferredLanguage: user.preferred_language,
    scope: userScope,
    tenantId: user.tenant_id,
    roles: roleNames,
    is_platform_admin: isPlatformAdmin,
  };
}

export async function getUserById(userId: string) {
  return getCurrentUser(userId);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const supabase = getSupabase();

  // Get user with password hash
  const { data: user, error } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_CREDENTIALS');
  }

  // FIX: Iteration 20 - Enforce password policy on password change
  const policyResult = await validatePassword(newPassword);
  if (!policyResult.valid) {
    throw new AppError(`Password does not meet policy: ${policyResult.errors.join(', ')}`, 400, 'PASSWORD_POLICY_VIOLATION');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Update password
  const { error: updateError } = await supabase
    .from('users')
    .update({
      password_hash: newPasswordHash,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (updateError) {
    throw new AppError('Failed to update password', 500, 'INTERNAL_ERROR');
  }

  // Q102 — Invalidate all active sessions after a password change so that
  // stolen tokens cannot be replayed. Increments token_version which
  // immediately rejects all existing JWTs on the next request.
  await logout(userId);

  logger.info(`Password changed for user ${userId}`);
}

export async function disable2FA(userId: string) {
  const supabase = getSupabase();

  await supabase
    .from('users')
    .update({
      two_factor_enabled: false,
      two_factor_secret: null,
      backup_codes: null,
    })
    .eq('id', userId);

  // Invalidate all sessions
  await supabase
    .from('sessions')
    .update({ is_active: false })
    .eq('user_id', userId);
}

export async function sendPasswordResetEmail(email: string) {
  const supabase = getSupabase();

  // Find user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, full_name, email, tenant_id')
    .eq('email', email.toLowerCase())
    .single();

  if (userError || !user) {
    // Don't reveal if email exists - just return silently
    return;
  }

  // Generate reset token
  const resetToken = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Delete any existing password-reset tokens for this user (one active at a time)
  await supabase
    .from('sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('session_type', 'password_reset');

  // Store token in sessions table
  const { error: insertError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      tenant_id: user.tenant_id,
      token: resetToken,
      refresh_token: resetToken,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      session_type: 'password_reset',
    });

  if (insertError) {
    logger.error('Failed to store reset token:', insertError.message);
    throw new Error('Failed to initiate password reset');
  }

  // Send email with reset link
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

  await emailService.sendEmail({
    to: user.email,
    subject: 'Reset Your Password - V2 Ecosystem',
    html: `
      <h1>Password Reset Request</h1>
      <p>Hi ${user.full_name},</p>
      <p>You requested to reset your password. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>Thanks,<br>V2 Ecosystem Team</p>
    `,
  });
}

export async function resetPassword(token: string, newPassword: string) {
  const supabase = getSupabase();

  // Find valid reset token — scoped to password_reset rows only
  const { data: sessions, error: sessionError } = await supabase
    .from('sessions')
    .select('id, user_id, expires_at, refresh_token')
    .eq('refresh_token', token)
    .eq('is_active', true)
    .eq('session_type', 'password_reset');

  const session = sessions?.[0];

  if (sessionError || !session) {
    throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
  }

  // Check expiration - handle timezone properly
  let expiresAtStr = session.expires_at;
  if (!expiresAtStr.endsWith('Z') && !expiresAtStr.includes('+')) {
    expiresAtStr = expiresAtStr + 'Z';
  }
  const expiresAtDate = new Date(expiresAtStr);
  const now = new Date();

  if (expiresAtDate < now) {
    await supabase.from('sessions').delete().eq('id', session.id);
    throw new AppError('Reset token has expired', 400, 'TOKEN_EXPIRED');
  }

  // FIX: Iteration 20 - Enforce password policy on password reset
  const policyResult = await validatePassword(newPassword);
  if (!policyResult.valid) {
    throw new AppError(`Password does not meet policy: ${policyResult.errors.join(', ')}`, 400, 'PASSWORD_POLICY_VIOLATION');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update user password
  const { error: updateError } = await supabase
    .from('users')
    .update({
      password_hash: hashedPassword,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.user_id);

  if (updateError) {
    logger.error('Failed to update password:', updateError.message);
    throw new AppError('Failed to update password', 500, 'INTERNAL_ERROR');
  }

  // Invalidate reset token
  await supabase.from('sessions').delete().eq('id', session.id);

  // Invalidate all other sessions for security and increment token version
  await logout(session.user_id);

  return { user_id: session.user_id };
}

/**
 * Send email verification link
 * Generates a token, stores it in sessions table, and emails a verification link
 */
export async function sendVerificationEmail(userId: string, email: string, fullName: string) {
  const supabase = getSupabase();

  // Generate verification token
  const verificationToken = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Delete any existing verification tokens for this user (one active at a time)
  await supabase
    .from('sessions')
    .delete()
    .eq('user_id', userId)
    .eq('session_type', 'email_verification');

  // Get user's tenant_id
  const { data: user } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();

  // Store token in sessions table
  await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      tenant_id: user?.tenant_id,
      token: verificationToken,
      refresh_token: verificationToken,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      session_type: 'email_verification',
    });

  // Send verification email
  const verifyUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;

  await emailService.sendEmail({
    to: email,
    subject: 'Verify Your Email - V2 Ecosystem',
    html: `
      <h1>Welcome to V2 Ecosystem!</h1>
      <p>Hi ${fullName},</p>
      <p>Thanks for registering. Please verify your email by clicking the button below:</p>
      <p><a href="${verifyUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p>Thanks,<br>V2 Ecosystem Team</p>
    `,
  });

  logger.info(`Verification email sent to ${email}`);
}

/**
 * Verify email using token
 * Validates the token, marks email as verified, and cleans up
 */
export async function verifyEmail(token: string) {
  const supabase = getSupabase();

  // Find valid verification token — scoped to email_verification rows only
  const { data: sessions, error: sessionError } = await supabase
    .from('sessions')
    .select('id, user_id, expires_at')
    .eq('refresh_token', token)
    .eq('is_active', true)
    .eq('session_type', 'email_verification');

  const session = sessions?.[0];

  if (sessionError || !session) {
    throw new AppError('Invalid verification token', 400, 'INVALID_TOKEN');
  }

  // Check expiration
  let expiresAtStr = session.expires_at;
  if (!expiresAtStr.endsWith('Z') && !expiresAtStr.includes('+')) {
    expiresAtStr = expiresAtStr + 'Z';
  }
  const expiresAtDate = new Date(expiresAtStr);

  if (expiresAtDate < new Date()) {
    await supabase.from('sessions').delete().eq('id', session.id);
    throw new AppError('Verification link has expired. Please request a new one.', 400, 'TOKEN_EXPIRED');
  }

  // Mark email as verified
  const { error: updateError } = await supabase
    .from('users')
    .update({
      email_verified: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.user_id);

  if (updateError) {
    logger.error('Failed to verify email:', updateError.message);
    throw new AppError('Failed to verify email', 500, 'INTERNAL_ERROR');
  }

  // Clean up verification token
  await supabase.from('sessions').delete().eq('id', session.id);

  logger.info(`Email verified for user ${session.user_id}`);
  return { user_id: session.user_id };
}
