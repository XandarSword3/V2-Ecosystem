/**
 * Two-Factor Authentication Service Unit Tests
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Set JWT_SECRET before any imports that might need it
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-min-32-chars';

// Mock QRCode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode'),
  },
}));

// Mock otplib authenticator
vi.mock('otplib', () => ({
  authenticator: {
    options: {},
    generateSecret: vi.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
    keyuri: vi.fn().mockReturnValue('otpauth://totp/V2%20Resort:test@test.com?secret=JBSWY3DPEHPK3PXP&issuer=V2%20Resort'),
    verify: vi.fn().mockReturnValue(true),
  },
}));

// Mock database connection
const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  insert: vi.fn(() => mockSupabaseClient),
  update: vi.fn(() => mockSupabaseClient),
  delete: vi.fn(() => mockSupabaseClient),
  upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
  eq: vi.fn(() => mockSupabaseClient),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
};

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabaseClient,
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocking
import { twoFactorService } from '../../src/services/two-factor.service.js';
import { authenticator } from 'otplib';

describe('Two-Factor Authentication Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSetup', () => {
    it('should generate a new secret and QR code', async () => {
      const result = await twoFactorService.generateSetup('user-123', 'test@example.com');
      
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeDataUrl');
      expect(result).toHaveProperty('backupCodes');
      expect(result.qrCodeDataUrl).toContain('data:image/png');
    });

    it('should generate backup codes', async () => {
      const result = await twoFactorService.generateSetup('user-123', 'test@example.com');
      
      expect(result.backupCodes).toBeDefined();
      expect(Array.isArray(result.backupCodes)).toBe(true);
      expect(result.backupCodes.length).toBe(8);
    });

    it('should store pending setup in database', async () => {
      await twoFactorService.generateSetup('user-123', 'test@example.com');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('two_factor_pending');
      expect(mockSupabaseClient.upsert).toHaveBeenCalled();
    });

    it('should generate unique secret using authenticator', async () => {
      await twoFactorService.generateSetup('user-123', 'test@example.com');
      
      expect(authenticator.generateSecret).toHaveBeenCalledWith(20);
    });

    it('should generate OTP auth URL with correct parameters', async () => {
      await twoFactorService.generateSetup('user-123', 'test@example.com');
      
      expect(authenticator.keyuri).toHaveBeenCalledWith(
        'test@example.com',
        'V2 Resort',
        expect.any(String)
      );
    });
  });

  describe('verifyAndEnable', () => {
    it('should reject when no pending setup exists', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await twoFactorService.verifyAndEnable('user-123', '123456');
      
      expect(result).toBe(false);
    });

    it('should reject expired setup', async () => {
      // Create a properly formatted encrypted secret
      const crypto = await import('crypto');
      const key = 'fallback-key';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        crypto.createHash('sha256').update(key).digest(),
        iv
      );
      let encrypted = cipher.update('JBSWY3DPEHPK3PXP', 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const encryptedSecret = iv.toString('hex') + ':' + encrypted;

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          user_id: 'user-123',
          secret: encryptedSecret,
          backup_codes: ['hash1', 'hash2'],
          expires_at: new Date(Date.now() - 60000).toISOString(), // Expired
        },
        error: null,
      });

      const result = await twoFactorService.verifyAndEnable('user-123', '123456');
      
      expect(result).toBe(false);
    });
  });

  describe('verifyCode', () => {
    it('should return false when 2FA is not enabled', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await twoFactorService.verifyCode('user-123', '123456');
      
      expect(result).toBe(false);
    });
  });

  describe('disable', () => {
    it('should reject disable when verification fails', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await twoFactorService.disable('user-123', 'wrong');
      
      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return enabled status with backup code count', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          enabled_at: '2024-01-01T00:00:00Z',
          backup_codes: ['code1', 'code2', 'code3'],
        },
        error: null,
      });

      const result = await twoFactorService.getStatus('user-123');
      
      expect(result.enabled).toBe(true);
      expect(result.enabledAt).toBe('2024-01-01T00:00:00Z');
      expect(result.backupCodesRemaining).toBe(3);
    });

    it('should return disabled status when 2FA not enabled', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await twoFactorService.getStatus('user-123');
      
      expect(result.enabled).toBe(false);
      expect(result.enabledAt).toBeUndefined();
    });
  });

  describe('isEnabled', () => {
    it('should return true when 2FA is enabled', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { two_factor_enabled: true },
        error: null,
      });

      const result = await twoFactorService.isEnabled('user-123');
      
      expect(result).toBe(true);
    });

    it('should return false when 2FA is not enabled', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { two_factor_enabled: false },
        error: null,
      });

      const result = await twoFactorService.isEnabled('user-123');
      
      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await twoFactorService.isEnabled('nonexistent');
      
      expect(result).toBe(false);
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should return null when verification fails', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await twoFactorService.regenerateBackupCodes('user-123', 'wrong');
      
      expect(result).toBeNull();
    });
  });
});

describe('Backup Code Format', () => {
  it('backup codes should follow expected format', async () => {
    const result = await twoFactorService.generateSetup('user-123', 'test@example.com');
    
    // Backup codes should be in format XXXX-XXXX
    const codePattern = /^[A-F0-9]{4}-[A-F0-9]{4}$/;
    
    for (const code of result.backupCodes) {
      expect(codePattern.test(code)).toBe(true);
    }
  });
});
