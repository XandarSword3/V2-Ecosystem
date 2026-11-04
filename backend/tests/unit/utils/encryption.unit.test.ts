import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  hash,
  verifyHash,
  generateToken,
  generateSecureId,
} from '../../../src/utils/encryption.js';

describe('Encryption Utilities (Unit Tests)', () => {
  it('should encrypt and decrypt plaintext strings accurately', () => {
    const sensitiveData = 'sk_live_very_secret_stripe_api_key_12345';
    const encrypted = encrypt(sensitiveData);
    expect(encrypted).not.toBe(sensitiveData);
    expect(typeof encrypted).toBe('string');

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(sensitiveData);
  });

  it('should return empty string when encrypting or decrypting empty/null string', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('should produce different ciphertexts for identical plaintext due to random salt/iv', () => {
    const text = 'repeatable_payload';
    const encrypted1 = encrypt(text);
    const encrypted2 = encrypt(text);

    expect(encrypted1).not.toBe(encrypted2);
    expect(decrypt(encrypted1)).toBe(text);
    expect(decrypt(encrypted2)).toBe(text);
  });

  it('should throw an error when attempting to decrypt corrupted or tampered ciphertext', () => {
    const validEncrypted = encrypt('valid_text');
    const buffer = Buffer.from(validEncrypted, 'base64');
    // Corrupt one byte of auth tag
    buffer[40] = buffer[40] ^ 0xff;
    const tampered = buffer.toString('base64');

    expect(() => decrypt(tampered)).toThrow('Failed to decrypt value');
  });

  it('should hash and verify passwords/tokens with salt', () => {
    const password = 'CorrectHorseBatteryStaple123!';
    const hashed = hash(password);
    expect(hashed).toContain(':');

    expect(verifyHash(password, hashed)).toBe(true);
    expect(verifyHash('WrongPassword', hashed)).toBe(false);
  });

  it('should generate secure tokens and IDs of requested lengths', () => {
    const token = generateToken(16);
    expect(typeof token).toBe('string');
    expect(token.length).toBe(32); // 16 bytes hex = 32 chars

    const secureId = generateSecureId(12);
    expect(typeof secureId).toBe('string');
    expect(secureId.length).toBeGreaterThan(10);
  });
});
