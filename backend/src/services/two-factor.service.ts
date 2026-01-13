/**
 * Two-Factor Authentication Service
 * TOTP-based 2FA using authenticator apps (Google Authenticator, Authy, etc.)
 */

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

// Configure authenticator options (v12.x API)
authenticator.options = {
  digits: 6,
  step: 30, // 30 second window
  window: 1, // Allow 1 step before/after for clock drift
};

interface TwoFactorSetup {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

interface TwoFactorStatus {
  enabled: boolean;
  enabledAt?: string;
  backupCodesRemaining?: number;
}

class TwoFactorService {
  private readonly APP_NAME = 'V2 Resort';
  
  /**
   * Generate a new 2FA secret and QR code for setup
   */
  async generateSetup(userId: string, userEmail: string): Promise<TwoFactorSetup> {
    // Generate secret
    const secret = authenticator.generateSecret(20);
    
    // Generate OTP Auth URL for QR code
    const otpAuthUrl = authenticator.keyuri(userEmail, this.APP_NAME, secret);
    
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#0891b2',
        light: '#ffffff',
      },
    });
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes(8);
    
    // Store pending setup in database (not yet verified)
    const supabase = getSupabase();
    await supabase
      .from('two_factor_pending')
      .upsert({
        user_id: userId,
        secret: this.encryptSecret(secret),
        backup_codes: backupCodes.map(code => this.hashBackupCode(code)),
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
      }, {
        onConflict: 'user_id',
      });
    
    logger.info(`2FA setup initiated for user: ${userId}`);
    
    return {
      secret, // Only shown once during setup
      qrCodeDataUrl,
      backupCodes, // Only shown once
    };
  }
  
  /**
   * Verify a TOTP code and enable 2FA
   */
  async verifyAndEnable(userId: string, code: string): Promise<boolean> {
    const supabase = getSupabase();
    
    // Get pending setup
    const { data: pending, error } = await supabase
      .from('two_factor_pending')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !pending) {
      logger.warn(`No pending 2FA setup found for user: ${userId}`);
      return false;
    }
    
    // Check expiry
    if (new Date(pending.expires_at) < new Date()) {
      await supabase.from('two_factor_pending').delete().eq('user_id', userId);
      logger.warn(`2FA setup expired for user: ${userId}`);
      return false;
    }
    
    // Decrypt secret and verify code
    const secret = this.decryptSecret(pending.secret);
    const isValid = authenticator.verify({ token: code, secret });
    
    if (!isValid) {
      logger.warn(`Invalid 2FA code during setup for user: ${userId}`);
      return false;
    }
    
    // Move to active 2FA
    await supabase.from('two_factor_auth').upsert({
      user_id: userId,
      secret: pending.secret,
      backup_codes: pending.backup_codes,
      enabled_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });
    
    // Update user record
    await supabase
      .from('users')
      .update({ two_factor_enabled: true })
      .eq('id', userId);
    
    // Delete pending setup
    await supabase.from('two_factor_pending').delete().eq('user_id', userId);
    
    logger.info(`2FA enabled for user: ${userId}`);
    return true;
  }
  
  /**
   * Verify a TOTP code during login
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const supabase = getSupabase();
    
    // Get active 2FA
    const { data: twoFactor, error } = await supabase
      .from('two_factor_auth')
      .select('secret, backup_codes')
      .eq('user_id', userId)
      .single();
    
    if (error || !twoFactor) {
      logger.warn(`No active 2FA found for user: ${userId}`);
      return false;
    }
    
    const secret = this.decryptSecret(twoFactor.secret);
    
    // Try TOTP verification first
    if (authenticator.verify({ token: code, secret })) {
      logger.info(`2FA code verified for user: ${userId}`);
      return true;
    }
    
    // Try backup codes
    const hashedCode = this.hashBackupCode(code);
    const backupCodes = twoFactor.backup_codes as string[];
    const codeIndex = backupCodes.indexOf(hashedCode);
    
    if (codeIndex !== -1) {
      // Remove used backup code
      backupCodes.splice(codeIndex, 1);
      await supabase
        .from('two_factor_auth')
        .update({ backup_codes: backupCodes })
        .eq('user_id', userId);
      
      logger.info(`Backup code used for user: ${userId}. Remaining: ${backupCodes.length}`);
      return true;
    }
    
    logger.warn(`Invalid 2FA code for user: ${userId}`);
    return false;
  }
  
  /**
   * Disable 2FA for a user
   */
  async disable(userId: string, code: string): Promise<boolean> {
    // Verify code first
    const isValid = await this.verifyCode(userId, code);
    if (!isValid) {
      return false;
    }
    
    const supabase = getSupabase();
    
    // Delete 2FA record
    await supabase.from('two_factor_auth').delete().eq('user_id', userId);
    
    // Update user record
    await supabase
      .from('users')
      .update({ two_factor_enabled: false })
      .eq('id', userId);
    
    logger.info(`2FA disabled for user: ${userId}`);
    return true;
  }
  
  /**
   * Get 2FA status for a user
   */
  async getStatus(userId: string): Promise<TwoFactorStatus> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('two_factor_auth')
      .select('enabled_at, backup_codes')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      enabledAt: data.enabled_at,
      backupCodesRemaining: (data.backup_codes as string[])?.length || 0,
    };
  }
  
  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, code: string): Promise<string[] | null> {
    // Verify current code first
    const isValid = await this.verifyCode(userId, code);
    if (!isValid) {
      return null;
    }
    
    const backupCodes = this.generateBackupCodes(8);
    
    const supabase = getSupabase();
    await supabase
      .from('two_factor_auth')
      .update({
        backup_codes: backupCodes.map(c => this.hashBackupCode(c)),
      })
      .eq('user_id', userId);
    
    logger.info(`Backup codes regenerated for user: ${userId}`);
    return backupCodes;
  }
  
  /**
   * Check if user has 2FA enabled
   */
  async isEnabled(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    
    const { data } = await supabase
      .from('users')
      .select('two_factor_enabled')
      .eq('id', userId)
      .single();
    
    return data?.two_factor_enabled || false;
  }
  
  // ============================================
  // Private Helper Methods
  // ============================================
  
  /**
   * Generate random backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8 character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }
  
  /**
   * Hash a backup code for storage
   */
  private hashBackupCode(code: string): string {
    const normalized = code.replace(/-/g, '').toUpperCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
  
  /**
   * Encrypt 2FA secret for storage
   */
  private encryptSecret(secret: string): string {
    const key = process.env.JWT_SECRET;
    if (!key) {
      throw new Error('JWT_SECRET environment variable is required for 2FA encryption');
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(key).digest(),
      iv
    );
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }
  
  /**
   * Decrypt 2FA secret from storage
   */
  private decryptSecret(encrypted: string): string {
    const key = process.env.JWT_SECRET;
    if (!key) {
      throw new Error('JWT_SECRET environment variable is required for 2FA decryption');
    }
    const [ivHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(key).digest(),
      iv
    );
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export const twoFactorService = new TwoFactorService();
