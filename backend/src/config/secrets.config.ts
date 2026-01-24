/**
 * V2 Resort - Secrets Management
 * Secure secrets loading and rotation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface SecretConfig {
  name: string;
  required: boolean;
  default?: string;
  validator?: (value: string) => boolean;
  description?: string;
}

// Define all secrets used by the application
const SECRET_DEFINITIONS: SecretConfig[] = [
  // Database
  { name: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
  { name: 'SUPABASE_URL', required: true, description: 'Supabase project URL' },
  { name: 'SUPABASE_ANON_KEY', required: true, description: 'Supabase anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase service role key' },
  
  // Authentication
  { name: 'JWT_SECRET', required: true, validator: (v) => v.length >= 32, description: 'JWT signing secret (min 32 chars)' },
  { name: 'JWT_REFRESH_SECRET', required: true, validator: (v) => v.length >= 32, description: 'JWT refresh token secret' },
  { name: 'SESSION_SECRET', required: true, validator: (v) => v.length >= 32, description: 'Session cookie secret' },
  
  // Stripe
  { name: 'STRIPE_SECRET_KEY', required: true, validator: (v) => v.startsWith('sk_'), description: 'Stripe secret API key' },
  { name: 'STRIPE_WEBHOOK_SECRET', required: true, validator: (v) => v.startsWith('whsec_'), description: 'Stripe webhook signing secret' },
  
  // Email
  { name: 'SENDGRID_API_KEY', required: false, validator: (v) => v.startsWith('SG.'), description: 'SendGrid API key' },
  
  // SMS
  { name: 'TWILIO_ACCOUNT_SID', required: false, validator: (v) => v.startsWith('AC'), description: 'Twilio account SID' },
  { name: 'TWILIO_AUTH_TOKEN', required: false, description: 'Twilio auth token' },
  
  // Redis
  { name: 'REDIS_URL', required: false, default: 'redis://localhost:6379', description: 'Redis connection URL' },
  
  // Encryption
  { name: 'ENCRYPTION_KEY', required: true, validator: (v) => v.length === 64, description: 'AES-256 encryption key (64 hex chars)' },
  
  // External APIs
  { name: 'WEATHER_API_KEY', required: false, description: 'Weather API key' },
  { name: 'GOOGLE_MAPS_API_KEY', required: false, description: 'Google Maps API key' },
  
  // Sentry
  { name: 'SENTRY_DSN', required: false, description: 'Sentry error tracking DSN' },
  
  // Unsubscribe
  { name: 'UNSUBSCRIBE_SECRET', required: false, description: 'Secret for email unsubscribe tokens' },
];

class SecretsManager {
  private secrets: Map<string, string> = new Map();
  private rotationCallbacks: Map<string, Array<(newValue: string) => void>> = new Map();
  private lastRotation: Map<string, Date> = new Map();

  constructor() {
    this.loadSecrets();
  }

  /**
   * Load secrets from environment and optionally from secrets file
   */
  private loadSecrets(): void {
    // First, load from environment variables
    for (const def of SECRET_DEFINITIONS) {
      const value = process.env[def.name];
      
      if (value) {
        this.secrets.set(def.name, value);
      } else if (def.default) {
        this.secrets.set(def.name, def.default);
      }
    }

    // Check for secrets file (for Docker secrets or mounted files)
    const secretsPath = process.env.SECRETS_FILE_PATH || '/run/secrets';
    if (fs.existsSync(secretsPath)) {
      this.loadFromSecretsDirectory(secretsPath);
    }

    // Validate all secrets
    this.validateSecrets();
  }

  /**
   * Load secrets from a directory (Docker secrets pattern)
   */
  private loadFromSecretsDirectory(dirPath: string): void {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const secretName = file.toUpperCase().replace(/-/g, '_');
        const filePath = path.join(dirPath, file);
        
        try {
          const value = fs.readFileSync(filePath, 'utf8').trim();
          this.secrets.set(secretName, value);
        } catch (err) {
          console.warn(`[Secrets] Could not read secret file: ${file}`);
        }
      }
    } catch (err) {
      // Directory doesn't exist or isn't readable - that's OK
    }
  }

  /**
   * Validate all required secrets
   */
  private validateSecrets(): void {
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const def of SECRET_DEFINITIONS) {
      const value = this.secrets.get(def.name);

      if (def.required && !value) {
        missing.push(def.name);
        continue;
      }

      if (value && def.validator && !def.validator(value)) {
        invalid.push(`${def.name} (${def.description})`);
      }
    }

    if (missing.length > 0) {
      console.error('[Secrets] Missing required secrets:', missing.join(', '));
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Missing required secrets: ${missing.join(', ')}`);
      }
    }

    if (invalid.length > 0) {
      console.warn('[Secrets] Invalid secret values:', invalid.join(', '));
    }

    console.log(`[Secrets] Loaded ${this.secrets.size} secrets`);
  }

  /**
   * Get a secret value
   */
  get(name: string): string | undefined {
    return this.secrets.get(name);
  }

  /**
   * Get a secret value (throws if not found)
   */
  getRequired(name: string): string {
    const value = this.secrets.get(name);
    if (!value) {
      throw new Error(`Required secret not found: ${name}`);
    }
    return value;
  }

  /**
   * Check if a secret exists
   */
  has(name: string): boolean {
    return this.secrets.has(name);
  }

  /**
   * Rotate a secret (for key rotation)
   */
  async rotate(name: string, newValue: string): Promise<void> {
    const oldValue = this.secrets.get(name);
    
    // Validate the new value
    const def = SECRET_DEFINITIONS.find((d) => d.name === name);
    if (def?.validator && !def.validator(newValue)) {
      throw new Error(`Invalid value for secret: ${name}`);
    }

    // Update the secret
    this.secrets.set(name, newValue);
    this.lastRotation.set(name, new Date());

    // Notify all registered callbacks
    const callbacks = this.rotationCallbacks.get(name) || [];
    for (const callback of callbacks) {
      try {
        callback(newValue);
      } catch (err) {
        console.error(`[Secrets] Rotation callback error for ${name}:`, err);
      }
    }

    // Log the rotation (without values)
    console.log(`[Secrets] Rotated secret: ${name}`);
  }

  /**
   * Register callback for secret rotation
   */
  onRotation(name: string, callback: (newValue: string) => void): void {
    if (!this.rotationCallbacks.has(name)) {
      this.rotationCallbacks.set(name, []);
    }
    this.rotationCallbacks.get(name)!.push(callback);
  }

  /**
   * Get rotation history
   */
  getRotationHistory(): Map<string, Date> {
    return new Map(this.lastRotation);
  }

  /**
   * Generate a secure random secret
   */
  static generateSecret(length: number = 32, encoding: BufferEncoding = 'hex'): string {
    return crypto.randomBytes(length).toString(encoding);
  }

  /**
   * Generate an encryption key
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex'); // 256 bits
  }

  /**
   * Encrypt a value using the app's encryption key
   */
  encrypt(plaintext: string): string {
    const key = this.getRequired('ENCRYPTION_KEY');
    const keyBuffer = Buffer.from(key, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Return IV + AuthTag + Encrypted as base64
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypt a value using the app's encryption key
   */
  decrypt(ciphertext: string): string {
    const key = this.getRequired('ENCRYPTION_KEY');
    const keyBuffer = Buffer.from(key, 'hex');
    
    const combined = Buffer.from(ciphertext, 'base64');
    const iv = combined.subarray(0, 16);
    const authTag = combined.subarray(16, 32);
    const encrypted = combined.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Hash a value (one-way)
   */
  hash(value: string, salt?: string): string {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(value, actualSalt, 100000, 64, 'sha512');
    return `${actualSalt}:${hash.toString('hex')}`;
  }

  /**
   * Verify a hashed value
   */
  verifyHash(value: string, storedHash: string): boolean {
    const [salt, originalHash] = storedHash.split(':');
    const hash = crypto.pbkdf2Sync(value, salt, 100000, 64, 'sha512');
    return crypto.timingSafeEqual(
      Buffer.from(hash.toString('hex')),
      Buffer.from(originalHash)
    );
  }

  /**
   * Audit secrets configuration
   */
  audit(): {
    total: number;
    configured: number;
    missing: string[];
    optional_missing: string[];
    warnings: string[];
  } {
    const missing: string[] = [];
    const optionalMissing: string[] = [];
    const warnings: string[] = [];

    for (const def of SECRET_DEFINITIONS) {
      const value = this.secrets.get(def.name);

      if (!value) {
        if (def.required) {
          missing.push(def.name);
        } else {
          optionalMissing.push(def.name);
        }
      } else if (def.validator && !def.validator(value)) {
        warnings.push(`${def.name}: Invalid format`);
      }
    }

    // Check for weak secrets in development
    if (process.env.NODE_ENV !== 'production') {
      const jwtSecret = this.secrets.get('JWT_SECRET');
      if (jwtSecret && jwtSecret.length < 64) {
        warnings.push('JWT_SECRET: Consider using a longer secret in production');
      }
    }

    return {
      total: SECRET_DEFINITIONS.length,
      configured: this.secrets.size,
      missing,
      optional_missing: optionalMissing,
      warnings,
    };
  }

  /**
   * Get list of all secret names (not values!)
   */
  listSecretNames(): string[] {
    return Array.from(this.secrets.keys());
  }

  /**
   * Mask a secret value for logging
   */
  static mask(value: string | undefined): string {
    if (!value) return '[not set]';
    if (value.length <= 8) return '****';
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }
}

// Singleton instance
export const secretsManager = new SecretsManager();

// Convenience exports
export const getSecret = (name: string) => secretsManager.get(name);
export const getRequiredSecret = (name: string) => secretsManager.getRequired(name);
export const encryptValue = (value: string) => secretsManager.encrypt(value);
export const decryptValue = (value: string) => secretsManager.decrypt(value);
