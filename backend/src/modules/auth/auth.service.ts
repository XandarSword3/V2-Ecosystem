import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from "../../database/connection.js";
import { generateTokens, verifyRefreshToken } from "./auth.utils.js";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import { emailService } from "../../services/email.service.js";
import { AppError } from "../../utils/AppError.js";

const isProduction = config.env === 'production';

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  preferredLanguage?: 'en' | 'ar' | 'fr';
}

interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

export async function register(data: RegisterData) {
  logger.info('[AUTH SERVICE] Starting registration for:', data.email);
  const supabase = getSupabase();

  // Check if email exists
  logger.info('[AUTH SERVICE] Checking if email exists...');
  const { data: existing, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('email', data.email.toLowerCase())
    .limit(1);

  if (checkError) {
    logger.error('[AUTH SERVICE] Error checking email:', checkError);
    throw checkError;
  }
  if (existing && existing.length > 0) {
    logger.warn('[AUTH SERVICE] Email already exists:', data.email);
    throw new Error('Email already registered');
  }

  // Hash password
  logger.info('[AUTH SERVICE] Hashing password...');
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Create user
  logger.info('[AUTH SERVICE] Creating user in database...');
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
    logger.error('[AUTH SERVICE] Error creating user:', userError);
    throw userError;
  }
  logger.info('[AUTH SERVICE] User created with ID:', user.id);

  // Assign default customer role
  logger.info('[AUTH SERVICE] Assigning customer role...');
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
    logger.info('[AUTH SERVICE] Customer role assigned');
  } else {
    logger.warn('[AUTH SERVICE] Could not assign customer role:', roleError);
  }

  return { user };
}

export async function login(email: string, password: string, meta: SessionMeta) {
  logger.info('[AUTH SERVICE] ========== LOGIN START ==========');
  logger.info('[AUTH SERVICE] Email:', email);
  const supabase = getSupabase();

  // Find user
  logger.info('[AUTH SERVICE] Step 1: Finding user in database...');
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (userError) {
    logger.error('[AUTH SERVICE] Database error finding user:', JSON.stringify(userError));
    throw new AppError('Invalid credentials', 401);
  }

  if (!user) {
    logger.error('[AUTH SERVICE] User not found for email:', email);
    throw new AppError('Invalid credentials', 401);
  }

  logger.info('[AUTH SERVICE] User found:', { id: user.id, email: user.email, is_active: user.is_active });

  if (!user.is_active) {
    logger.error('[AUTH SERVICE] Account is disabled for:', email);
    throw new AppError('Account is disabled', 403);
  }

  // Verify password
  if (!isProduction) {
    logger.info('[AUTH SERVICE] Step 2: Verifying password...');
  }
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    logger.warn('[AUTH SERVICE] Invalid password attempt for:', email);
    throw new AppError('Invalid credentials', 401);
  }

  // Get user roles
  if (!isProduction) {
    logger.info('[AUTH SERVICE] Step 3: Getting user roles...');
  }
  const { data: userRolesList, error: rolesError } = await supabase
    .from('user_roles')
    .select(`
      role_id,
      roles (id, name, display_name)
    `)
    .eq('user_id', user.id);

  if (rolesError) {
    logger.error('[AUTH SERVICE] Error getting roles:', JSON.stringify(rolesError));
    throw rolesError;
  }

  const roleNames = (userRolesList || []).map((r: any) => r.roles?.name).filter(Boolean);

  // Generate tokens
  if (!isProduction) {
    logger.info('[AUTH SERVICE] Step 4: Generating tokens...');
  }
  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    roles: roleNames,
  });

  // Create session
  logger.info('[AUTH SERVICE] Step 5: Creating session...');
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
    logger.error('[AUTH SERVICE] Error creating session:', JSON.stringify(sessionError));
    // Don't throw, session is not critical
  } else {
    logger.info('[AUTH SERVICE] Session created successfully');
  }

  // Update last login
  logger.info('[AUTH SERVICE] Step 6: Updating last login...');
  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  const result = {
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

  logger.info('[AUTH SERVICE] ========== LOGIN SUCCESS ==========');
  logger.info('[AUTH SERVICE] Returning user:', JSON.stringify(result.user, null, 2));

  return result;
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

  const { data: userRolesList, error: rolesError } = await supabase
    .from('user_roles')
    .select(`
      roles (name)
    `)
    .eq('user_id', user.id);

  if (rolesError) throw rolesError;

  const roleNames = (userRolesList || []).map((r: any) => r.roles?.name).filter(Boolean);

  // Generate new tokens
  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    roles: roleNames,
  });

  // Update session
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await supabase
    .from('sessions')
    .update({
      token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: expiresAt.toISOString(),
      last_activity: new Date().toISOString(),
    })
    .eq('id', session.id);

  return { tokens };
}

export async function logout(token: string) {
  const supabase = getSupabase();
  await supabase
    .from('sessions')
    .update({ is_active: false })
    .eq('token', token);
}

export async function getUserById(userId: string) {
  const supabase = getSupabase();

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, phone, profile_image_url, preferred_language, email_verified, created_at')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  // Get roles
  const { data: userRolesList, error: rolesError } = await supabase
    .from('user_roles')
    .select(`
      roles (name, display_name)
    `)
    .eq('user_id', userId);

  if (rolesError) throw rolesError;

  return {
    ...user,
    roles: (userRolesList || []).map((r: any) => r.roles?.name).filter(Boolean),
  };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const supabase = getSupabase();

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await supabase
    .from('users')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
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
    .select('id, name, email')
    .eq('email', email.toLowerCase())
    .single();

  if (userError || !user) {
    // Don't reveal if email exists
    logger.info(`Password reset requested for non-existent email: ${email}`);
    return;
  }

  // Generate reset token
  const resetToken = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store token (you may need to create a password_reset_tokens table)
  // For now, we'll use the sessions table with a special session type
  await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      refresh_token: resetToken,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });

  // Send email with reset link
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

  await emailService.sendEmail({
    to: user.email,
    subject: 'Reset Your Password - V2 Resort',
    html: `
      <h1>Password Reset Request</h1>
      <p>Hi ${user.name},</p>
      <p>You requested to reset your password. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>Thanks,<br>V2 Resort Team</p>
    `,
  });

  logger.info(`Password reset email sent to: ${email}`);
}

export async function resetPassword(token: string, newPassword: string) {
  const supabase = getSupabase();

  // Find valid reset token
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, user_id, expires_at')
    .eq('refresh_token', token)
    .eq('is_active', true)
    .single();

  if (sessionError || !session) {
    throw new Error('Invalid or expired reset token');
  }

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
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
    throw new Error('Failed to update password');
  }

  // Invalidate reset token
  await supabase.from('sessions').delete().eq('id', session.id);

  // Invalidate all other sessions for security
  await supabase
    .from('sessions')
    .update({ is_active: false })
    .eq('user_id', session.user_id);

  logger.info(`Password reset completed for user: ${session.user_id}`);
  return { user_id: session.user_id };
}
