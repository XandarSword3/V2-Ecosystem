/**
 * Auth Service
 * 
 * Business logic for authentication with dependency injection.
 * All dependencies are injected via constructor, making this fully testable.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type {
  AuthRepository,
  AuthUser,
  AuthTokens,
  EmailService,
  LoggerService,
  ActivityLoggerService,
  AppConfig,
} from '../container/types.js';

// ============================================
// ERROR TYPES
// ============================================

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

// ============================================
// SERVICE TYPES
// ============================================

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  preferredLanguage?: 'en' | 'ar' | 'fr';
}

export interface LoginData {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    fullName: string;
    profileImageUrl?: string;
    preferredLanguage: string;
    roles: string[];
  };
  tokens: AuthTokens;
}

// ============================================
// SERVICE DEPENDENCIES
// ============================================

export interface AuthServiceDependencies {
  authRepository: AuthRepository;
  emailService: EmailService;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  config: AppConfig;
}

// ============================================
// AUTH SERVICE
// ============================================

export interface AuthService {
  register(data: RegisterData): Promise<{ user: { id: string; email: string; fullName: string } }>;
  login(data: LoginData): Promise<AuthResult>;
  refreshAccessToken(refreshToken: string): Promise<{ tokens: AuthTokens }>;
  logout(token: string): Promise<void>;
  getUserById(userId: string): Promise<AuthUser & { roles: string[] }>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  sendPasswordResetEmail(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<{ userId: string }>;
  generateTokens(payload: TokenPayload): AuthTokens;
  verifyToken(token: string): TokenPayload;
  verifyRefreshToken(token: string): { userId: string };
}

export function createAuthService(deps: AuthServiceDependencies): AuthService {
  const { authRepository, emailService, logger, activityLogger, config } = deps;

  // ============================================
  // TOKEN UTILITIES
  // ============================================

  function parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: return 900;
    }
  }

  function generateTokens(payload: TokenPayload): AuthTokens {
    const accessExpiresIn = parseExpiryToSeconds(config.jwt.expiresIn);
    const refreshExpiresIn = parseExpiryToSeconds(config.jwt.refreshExpiresIn);

    const accessToken = jwt.sign(
      { userId: payload.userId, email: payload.email, roles: payload.roles },
      config.jwt.secret,
      { expiresIn: accessExpiresIn }
    );

    const refreshToken = jwt.sign(
      { userId: payload.userId, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: refreshExpiresIn }
    );

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }

  function verifyToken(token: string): TokenPayload {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  }

  function verifyRefreshToken(token: string): { userId: string } {
    const decoded = jwt.verify(token, config.jwt.refreshSecret) as { userId: string; type: string };
    if (decoded.type !== 'refresh') {
      throw new AuthServiceError('Invalid token type', 'INVALID_TOKEN_TYPE', 401);
    }
    return { userId: decoded.userId };
  }

  // ============================================
  // SERVICE METHODS
  // ============================================

  return {
    generateTokens,
    verifyToken,
    verifyRefreshToken,

    async register(data: RegisterData) {
      logger.info('[AUTH SERVICE] Starting registration for:', data.email);

      // Check if email exists
      const existing = await authRepository.getUserByEmail(data.email);
      if (existing) {
        logger.warn('[AUTH SERVICE] Email already exists:', data.email);
        throw new AuthServiceError('Email already registered', 'EMAIL_EXISTS', 409);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 12);

      // Create user
      const user = await authRepository.createUser({
        email: data.email.toLowerCase(),
        password_hash: passwordHash,
        full_name: data.fullName,
        phone: data.phone,
        preferred_language: data.preferredLanguage || 'en',
        email_verified: false,
        is_active: true,
      });

      logger.info('[AUTH SERVICE] User created with ID:', user.id);

      // Assign default customer role
      const customerRole = await authRepository.getRoleByName('customer');
      if (customerRole) {
        await authRepository.assignRole(user.id, customerRole.id);
        logger.info('[AUTH SERVICE] Customer role assigned');
      } else {
        logger.warn('[AUTH SERVICE] Could not find customer role');
      }

      await activityLogger.log('REGISTER', {
        email: data.email,
        fullName: data.fullName,
      }, user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
        },
      };
    },

    async login(data: LoginData): Promise<AuthResult> {
      logger.info('[AUTH SERVICE] Login attempt for:', data.email);

      // Find user
      const user = await authRepository.getUserByEmail(data.email);
      if (!user) {
        logger.warn('[AUTH SERVICE] User not found:', data.email);
        throw new AuthServiceError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      }

      if (!user.is_active) {
        logger.warn('[AUTH SERVICE] Account is disabled:', data.email);
        throw new AuthServiceError('Account is disabled', 'ACCOUNT_DISABLED', 403);
      }

      // Verify password
      const isValid = await bcrypt.compare(data.password, user.password_hash);
      if (!isValid) {
        logger.warn('[AUTH SERVICE] Invalid password for:', data.email);
        throw new AuthServiceError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      }

      // Get user roles
      const roles = await authRepository.getUserRoles(user.id);

      // Generate tokens
      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        roles,
      });

      // Create session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      try {
        await authRepository.createSession({
          user_id: user.id,
          token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          expires_at: expiresAt.toISOString(),
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          is_active: true,
        });
        logger.info('[AUTH SERVICE] Session created');
      } catch (error) {
        // Session is not critical, log and continue
        logger.error('[AUTH SERVICE] Error creating session:', error);
      }

      // Update last login
      await authRepository.updateUser(user.id, {
        last_login_at: new Date().toISOString(),
      });

      await activityLogger.log('LOGIN', {
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      }, user.id);

      logger.info('[AUTH SERVICE] Login successful for:', user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          profileImageUrl: user.profile_image_url,
          preferredLanguage: user.preferred_language,
          roles,
        },
        tokens,
      };
    },

    async refreshAccessToken(refreshToken: string) {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);

      // Find session
      const session = await authRepository.getSessionByRefreshToken(refreshToken);
      if (!session || !session.is_active) {
        throw new AuthServiceError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
      }

      // Check expiration
      if (new Date(session.expires_at) < new Date()) {
        await authRepository.deleteSession(session.id);
        throw new AuthServiceError('Session expired', 'SESSION_EXPIRED', 401);
      }

      // Get user with roles
      const user = await authRepository.getUserById(session.user_id);
      if (!user || !user.is_active) {
        throw new AuthServiceError('User not found or inactive', 'USER_INACTIVE', 401);
      }

      const roles = await authRepository.getUserRoles(user.id);

      // Generate new tokens
      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        roles,
      });

      // Update session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await authRepository.updateSession(session.id, {
        token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: expiresAt.toISOString(),
        last_activity: new Date().toISOString(),
      });

      return { tokens };
    },

    async logout(token: string) {
      await authRepository.invalidateSession(token);
      logger.info('[AUTH SERVICE] Session invalidated');
    },

    async getUserById(userId: string) {
      const user = await authRepository.getUserById(userId);
      if (!user) {
        throw new AuthServiceError('User not found', 'USER_NOT_FOUND', 404);
      }

      const roles = await authRepository.getUserRoles(userId);

      return {
        ...user,
        roles,
      };
    },

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
      const user = await authRepository.getUserById(userId);
      if (!user) {
        throw new AuthServiceError('User not found', 'USER_NOT_FOUND', 404);
      }

      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        throw new AuthServiceError('Current password is incorrect', 'INVALID_PASSWORD', 401);
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await authRepository.updateUser(userId, {
        password_hash: passwordHash,
      });

      // Invalidate all sessions for security
      await authRepository.invalidateUserSessions(userId);

      await activityLogger.log('CHANGE_PASSWORD', {}, userId);

      logger.info('[AUTH SERVICE] Password changed for user:', userId);
    },

    async sendPasswordResetEmail(email: string) {
      const user = await authRepository.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        logger.info('[AUTH SERVICE] Password reset requested for non-existent email:', email);
        return;
      }

      // Generate reset token
      const resetToken = uuidv4();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Create a session to store the reset token
      await authRepository.createSession({
        user_id: user.id,
        token: '',
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
          <p>Hi ${user.full_name},</p>
          <p>You requested to reset your password. Click the link below to set a new password:</p>
          <p><a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>Thanks,<br>V2 Resort Team</p>
        `,
      });

      logger.info('[AUTH SERVICE] Password reset email sent to:', email);
    },

    async resetPassword(token: string, newPassword: string) {
      // Find valid reset token
      const session = await authRepository.getSessionByRefreshToken(token);
      if (!session || !session.is_active) {
        throw new AuthServiceError('Invalid or expired reset token', 'INVALID_RESET_TOKEN', 400);
      }

      // Check expiration
      if (new Date(session.expires_at) < new Date()) {
        await authRepository.deleteSession(session.id);
        throw new AuthServiceError('Reset token has expired', 'TOKEN_EXPIRED', 400);
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update user password
      await authRepository.updateUser(session.user_id, {
        password_hash: passwordHash,
      });

      // Delete reset token session
      await authRepository.deleteSession(session.id);

      // Invalidate all other sessions for security
      await authRepository.invalidateUserSessions(session.user_id);

      await activityLogger.log('RESET_PASSWORD', {}, session.user_id);

      logger.info('[AUTH SERVICE] Password reset completed for user:', session.user_id);

      return { userId: session.user_id };
    },
  };
}
