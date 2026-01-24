import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from "../../database/connection.js";
import { generateTokens, verifyRefreshToken } from "./auth.utils.js";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import { emailService } from "../../services/email.service.js";
import { AppError } from "../../utils/AppError.js";

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

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Create user
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email: data.email.toLowerCase(),
      password_hash: passwordHash,
      full_name: data.fullName,
      phone: data.phone,
      preferred_language: data.preferredLanguage || 'en',
    })
    .select('id, email, full_name')
    .single();

  if (userError) {
    logger.error('Error creating user:', userError.message);
    throw userError;
  }

  // Assign default customer role
  const { data: customerRole, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'customer')
    .limit(1);

  if (!roleError && customerRole && customerRole.length > 0) {
    await supabase
      .from('user_roles')
      .insert({
        user_id: user.id,
        role_id: customerRole[0].id,
      });
  }

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
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.is_active) {
    throw new AppError('Account is disabled', 403);
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    throw new AppError('Invalid credentials', 401);
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

  // Get user roles
  const { data: userRolesList, error: rolesError } = await supabase
    .from('user_roles')
    .select(`
      role_id,
      roles (id, name, display_name)
    `)
    .eq('user_id', user.id);

  if (rolesError) {
    logger.error('Error getting user roles:', rolesError.message);
    throw rolesError;
  }

  // Handle Supabase join which may return roles as array or object
  interface RoleJoinResult { role_id?: string; roles?: { name?: string }[] | { name?: string } | null }
  const roleNames = ((userRolesList || []) as RoleJoinResult[]).map((r) => {
    const roles = r.roles;
    if (!roles) return undefined;
    if (Array.isArray(roles)) return roles[0]?.name;
    return (roles as { name?: string }).name;
  }).filter(Boolean) as string[];

  // Generate tokens
  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    roles: roleNames,
    tokenVersion: user.token_version ?? 0,
  });

  // Create session
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: expiresAt.toISOString(),
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
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
      roles: roleNames,
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
    throw new AppError('User not found', 404);
  }

  if (!user.is_active) {
    throw new AppError('Account is disabled', 403);
  }

  // Get user roles
  const { data: userRolesList, error: rolesError } = await supabase
    .from('user_roles')
    .select(`
      role_id,
      roles (id, name, display_name)
    `)
    .eq('user_id', user.id);

  if (rolesError) throw rolesError;

  interface RoleJoinResult { role_id?: string; roles?: { name?: string }[] | { name?: string } | null }
  const roleNames = ((userRolesList || []) as RoleJoinResult[]).map((r) => {
    const roles = r.roles;
    if (!roles) return undefined;
    if (Array.isArray(roles)) return roles[0]?.name;
    return (roles as { name?: string }).name;
  }).filter(Boolean) as string[];

  // Generate tokens
  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    roles: roleNames,
    tokenVersion: user.token_version ?? 0,
  });

  // Create session
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: expiresAt.toISOString(),
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
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
      roles: roleNames,
    },
    tokens,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const supabase = getSupabase();

  // Verify refresh token
  const payload = verifyRefreshToken(refreshToken);

  // Find session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('refresh_token', refreshToken)
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

  const { data: userRolesList } = await supabase
    .from('user_roles')
    .select(`
      roles (name)
    `)
    .eq('user_id', user.id);

  interface RoleJoinResult { roles?: { name?: string }[] | { name?: string } | null }
  const roleNames = ((userRolesList || []) as RoleJoinResult[]).map((r) => {
    const roles = r.roles;
    if (!roles) return undefined;
    if (Array.isArray(roles)) return roles[0]?.name;
    return (roles as { name?: string }).name;
  }).filter(Boolean) as string[];

  // Generate new tokens
  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    roles: roleNames,
    tokenVersion: user.token_version ?? 0,
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
      roles: roleNames,
    },
    tokens,
  };
}

export async function logout(userId: string, refreshToken?: string) {
  const supabase = getSupabase();

  if (refreshToken) {
    // Logout specific session
    await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('refresh_token', refreshToken);
  } else {
    // Logout all sessions - increment token_version to invalidate all JWTs
    await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('user_id', userId);
    
    // Increment token_version to invalidate all previously issued JWTs
    try {
      await supabase.rpc('increment_token_version', { p_user_id: userId });
    } catch {
      // Fallback if RPC doesn't exist: direct update
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

export async function getCurrentUser(userId: string) {
  const supabase = getSupabase();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone, profile_image_url, preferred_language')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new Error('User not found');
  }

  // Get roles
  const { data: userRolesList } = await supabase
    .from('user_roles')
    .select(`
      roles (name)
    `)
    .eq('user_id', userId);

  interface RoleJoinResult { roles?: { name?: string }[] | { name?: string } | null }
  const roleNames = ((userRolesList || []) as RoleJoinResult[]).map((r) => {
    const roles = r.roles;
    if (!roles) return undefined;
    if (Array.isArray(roles)) return roles[0]?.name;
    return (roles as { name?: string }).name;
  }).filter(Boolean) as string[];

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    profileImageUrl: user.profile_image_url,
    preferredLanguage: user.preferred_language,
    roles: roleNames,
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
    throw new AppError('User not found', 404);
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw new AppError('Current password is incorrect', 400);
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
    throw new AppError('Failed to update password', 500);
  }

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
    .select('id, full_name, email')
    .eq('email', email.toLowerCase())
    .single();

  if (userError || !user) {
    // Don't reveal if email exists - just return silently
    return;
  }

  // Generate reset token
  const resetToken = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Delete any existing reset tokens for this user
  await supabase
    .from('sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('is_active', true)
    .not('refresh_token', 'is', null);

  // Store token in sessions table
  const { error: insertError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      token: resetToken,
      refresh_token: resetToken,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });

  if (insertError) {
    logger.error('Failed to store reset token:', insertError.message);
    throw new Error('Failed to initiate password reset');
  }

  // Send email with reset link
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

  await emailService.sendEmail({
    to: user.email,
    subject: 'Reset Your Password - V2 Resort',
    html: `
      <h1>Password Reset Request</h1>
      <p>Hi ${user.full_name},</p>
      <p>You requested to reset your password. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>Thanks,<br>V2 Resort Team</p>
    `,
  });
}

export async function resetPassword(token: string, newPassword: string) {
  const supabase = getSupabase();

  // Find valid reset token
  const { data: sessions, error: sessionError } = await supabase
    .from('sessions')
    .select('id, user_id, expires_at, refresh_token')
    .eq('refresh_token', token)
    .eq('is_active', true);

  const session = sessions?.[0];

  if (sessionError || !session) {
    throw new Error('Invalid or expired reset token');
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
    throw new Error('Reset token has expired');
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
    throw new Error('Failed to update password');
  }

  // Invalidate reset token
  await supabase.from('sessions').delete().eq('id', session.id);

  // Invalidate all other sessions for security
  await supabase
    .from('sessions')
    .update({ is_active: false })
    .eq('user_id', session.user_id);

  return { user_id: session.user_id };
}
