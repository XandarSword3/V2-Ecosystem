import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from "../../database/connection.js";
import { generateTokens, verifyRefreshToken } from "./auth.utils.js";
import { config } from "../../config/index.js";

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
  const supabase = getSupabase();

  // Check if email exists
  const { data: existing, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('email', data.email.toLowerCase())
    .limit(1);

  if (checkError) throw checkError;
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

  if (userError) throw userError;

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
    throw new Error('Invalid credentials');
  }

  if (!user.is_active) {
    throw new Error('Account is disabled');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  // Get user roles
  const { data: userRolesList, error: rolesError } = await supabase
    .from('user_roles')
    .select(`
      roles (name)
    `)
    .eq('user_id', user.id);

  if (rolesError) throw rolesError;

  const roleNames = (userRolesList || []).map((r: any) => r.roles?.name).filter(Boolean);

  // Generate tokens
  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    roles: roleNames,
  });

  // Create session
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: expiresAt.toISOString(),
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    });

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
    roles: (userRolesList || []).map((r: any) => r.roles),
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
  // TODO: Implement email sending
  // Generate reset token, store it, send email
  throw new Error('Not implemented');
}

export async function resetPassword(token: string, newPassword: string) {
  // TODO: Implement password reset
  throw new Error('Not implemented');
}
