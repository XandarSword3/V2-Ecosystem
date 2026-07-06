/**
 * Two-Factor Authentication Service
 * TOTP-based 2FA using authenticator apps (Google Authenticator, Authy, etc.)
 */

import { generate, verify, generateSecret, generateURI } from 'otplib';
import QRCode from 'qrcode';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

// TOTP configuration
const TOTP_OPTIONS = {
  digits: 6 as const,
  period: 30, // 30 second window
  algorithm: 'sha1' as const,
};

// otplib v13's `verify()` defaults epochTolerance to 0 seconds, meaning the
// submitted code must land in the exact current time step with zero
// allowance for clock drift, network latency, or the time it takes a user
// to type the code. RFC 6238 recommends allowing at least one step of
// tolerance in each direction; we apply that only at verification time
// (not generation) so setup/issuance is unaffected.
const TOTP_VERIFY_TOLERANCE = {
  epochTolerance: [30, 30] as [number, number], // ±1 step (30s) past and future
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
  private readonly APP_NAME = 'V2 Ecosystem';

  /**
   * two_factor_pending.tenant_id and two_factor_auth.{tenant_id,property_id}
   * are NOT NULL (added later by the audit-isolation migration, which loops
   * over every table with these columns rather than 2FA being intentionally
   * property-scoped). property_id has no real meaning for a user-level
   * security feature, so we resolve the enrolling user's own tenant's
   * headquarters property (falling back to their oldest active property)
   * rather than inventing a value — reusing another tenant's property row
   * here would be a cross-tenant leak of exactly the kind this codebase's
   * isolation work has been fixing.
   */
  private async resolveTenantId(userId: string): Promise<string> {
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (error || !user?.tenant_id) {
      throw new Error(`Unable to resolve tenant for user ${userId} during 2FA setup`);
    }
    return user.tenant_id;
  }

  private async resolveDefaultPropertyId(tenantId: string): Promise<string> {
    const supabase = getSupabase();
    const { data: property, error } = await supabase
      .from('properties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('is_headquarters', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !property?.id) {
      throw new Error(`Unable to resolve a default property for tenant ${tenantId} during 2FA setup`);
    }
    return property.id;
  }
  
  /**
   * Generate a new 2FA secret and QR code for setup
   */
  async generateSetup(userId: string, userEmail: string): Promise<TwoFactorSetup> {
    // Generate secret (v13 functional API)
    const secret = generateSecret({ length: 20 });
    
    // Generate OTP Auth URL for QR code (v13 functional API)
    const otpAuthUrl = generateURI({
      secret,
      issuer: this.APP_NAME,
      label: userEmail,
      ...TOTP_OPTIONS,
    });
    
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

    const tenantId = await this.resolveTenantId(userId);

    // Store pending setup in database (not yet verified)
    const supabase = getSupabase();
    const { error: upsertError } = await supabase
      .from('two_factor_pending')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        secret: this.encryptSecret(secret),
        backup_codes: backupCodes.map(code => this.hashBackupCode(code)),
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      logger.error(`Failed to persist 2FA pending setup for user ${userId}: ${upsertError.message}`);
      throw new Error('Failed to initialize 2FA setup. Please try again.');
    }
    
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
      const { error: expireDeleteError } = await supabase
        .from('two_factor_pending')
        .delete()
        .eq('user_id', userId);
      if (expireDeleteError) {
        logger.warn(`Failed to clean up expired 2FA pending setup for user ${userId}: ${expireDeleteError.message}`);
      }
      logger.warn(`2FA setup expired for user: ${userId}`);
      return false;
    }
    
    // Decrypt secret and verify code (v13 functional API)
    const secret = this.decryptSecret(pending.secret);
    const result = await verify({ token: code, secret, ...TOTP_OPTIONS, ...TOTP_VERIFY_TOLERANCE });
    
    if (!result.valid) {
      logger.warn(`Invalid 2FA code during setup for user: ${userId}`);
      return false;
    }
    
    // Move to active 2FA. tenant_id is reused from the already-resolved
    // pending record; property_id is resolved fresh since two_factor_pending
    // has no property_id column (see class comment above resolveTenantId).
    const propertyId = await this.resolveDefaultPropertyId(pending.tenant_id);

    const { error: activateError } = await supabase.from('two_factor_auth').upsert({
      user_id: userId,
      tenant_id: pending.tenant_id,
      property_id: propertyId,
      secret: pending.secret,
      backup_codes: pending.backup_codes,
      enabled_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

    if (activateError) {
      logger.error(`Failed to activate 2FA for user ${userId}: ${activateError.message}`);
      throw new Error('Failed to enable 2FA. Please try again.');
    }
    
    // Update user record
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ two_factor_enabled: true })
      .eq('id', userId);

    if (userUpdateError) {
      logger.error(`2FA activated for user ${userId} but failed to set two_factor_enabled flag: ${userUpdateError.message}`);
      throw new Error('2FA was enabled but the account flag failed to update. Please contact support.');
    }
    
    // Delete pending setup (non-critical: 2FA is already active at this point,
    // a leftover pending row is harmless and gets overwritten on next setup)
    const { error: cleanupError } = await supabase
      .from('two_factor_pending')
      .delete()
      .eq('user_id', userId);
    if (cleanupError) {
      logger.warn(`2FA enabled for user ${userId} but failed to clean up pending setup row: ${cleanupError.message}`);
    }
    
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
    
    // Try TOTP verification first (v13 functional API)
    const result = await verify({ token: code, secret, ...TOTP_OPTIONS, ...TOTP_VERIFY_TOLERANCE });
    if (result.valid) {
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
      const { error: backupUpdateError } = await supabase
        .from('two_factor_auth')
        .update({ backup_codes: backupCodes })
        .eq('user_id', userId);

      if (backupUpdateError) {
        // The code itself was valid, so we still let the user in — but log
        // loudly, since a failed write here means this backup code stays
        // usable again instead of being single-use.
        logger.error(`Backup code verified for user ${userId} but failed to persist as consumed: ${backupUpdateError.message}`);
      } else {
        logger.info(`Backup code used for user: ${userId}. Remaining: ${backupCodes.length}`);
      }
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
    
    // Update user record first: if this fails we abort before touching the
    // two_factor_auth row, so we never end up with two_factor_enabled=true
    // and no matching row — that combination would permanently lock the
    // user out, since verifyCode would have nothing left to check against.
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ two_factor_enabled: false })
      .eq('id', userId);

    if (userUpdateError) {
      logger.error(`Failed to disable 2FA flag for user ${userId}: ${userUpdateError.message}`);
      return false;
    }

    // Delete 2FA record
    const { error: deleteError } = await supabase
      .from('two_factor_auth')
      .delete()
      .eq('user_id', userId);
    if (deleteError) {
      logger.error(`2FA disabled for user ${userId} but failed to remove two_factor_auth row: ${deleteError.message}`);
    }
    
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
    const { error } = await supabase
      .from('two_factor_auth')
      .update({
        backup_codes: backupCodes.map(c => this.hashBackupCode(c)),
      })
      .eq('user_id', userId);

    if (error) {
      logger.error(`Failed to persist regenerated backup codes for user ${userId}: ${error.message}`);
      return null;
    }
    
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
    // SECURITY: AES-256-GCM provides authenticated encryption (integrity + confidentiality)
    const iv = crypto.randomBytes(12); // GCM standard: 12-byte IV
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      crypto.createHash('sha256').update(key).digest(),
      iv
    );
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + encrypted + ':' + authTag;
  }

  /**
   * Decrypt 2FA secret from storage
   */
  private decryptSecret(encrypted: string): string {
    const key = process.env.JWT_SECRET;
    if (!key) {
      throw new Error('JWT_SECRET environment variable is required for 2FA decryption');
    }
    const parts = encrypted.split(':');
    // Support legacy CBC format (2 parts: iv:data) for backwards compatibility during migration
    if (parts.length === 2) {
      const [ivHex, encryptedData] = parts;
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
    // GCM format (3 parts: iv:data:authTag)
    const [ivHex, encryptedData, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      crypto.createHash('sha256').update(key).digest(),
      iv
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export const twoFactorService = new TwoFactorService();
