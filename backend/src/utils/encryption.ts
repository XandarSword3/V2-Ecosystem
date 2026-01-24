/**
 * Encryption Utility
 * 
 * Provides AES-256-GCM encryption for sensitive data storage.
 */

import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = env.ENCRYPTION_KEY || env.JWT_SECRET;
  if (!key) {
    throw new Error('ENCRYPTION_KEY or JWT_SECRET must be configured');
  }
  
  // Derive a consistent 32-byte key using SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a string value
 * Returns base64-encoded string containing: salt + iv + authTag + encrypted data
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Derive key with salt for added security
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
  
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine all parts: salt + iv + authTag + encrypted
  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'hex')
  ]);
  
  return combined.toString('base64');
}

/**
 * Decrypt an encrypted string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedText, 'base64');
    
    // Extract parts
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    // Derive key with same salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt value - data may be corrupted or key may have changed');
  }
}

/**
 * Hash a value (one-way, for comparison)
 */
export function hash(value: string, salt?: string): string {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(value, useSalt, 100000, 64, 'sha512')
    .toString('hex');
  
  return `${useSalt}:${hash}`;
}

/**
 * Verify a value against a hash
 */
export function verifyHash(value: string, hashedValue: string): boolean {
  const [salt, originalHash] = hashedValue.split(':');
  const hash = crypto
    .pbkdf2Sync(value, salt, 100000, 64, 'sha512')
    .toString('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(originalHash)
  );
}

/**
 * Generate a random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure random string (URL-safe)
 */
export function generateSecureId(length: number = 16): string {
  return crypto.randomBytes(length).toString('base64url');
}

export default {
  encrypt,
  decrypt,
  hash,
  verifyHash,
  generateToken,
  generateSecureId
};
