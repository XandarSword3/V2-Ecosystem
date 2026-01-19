import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChainableMock } from '../utils';

// Mock dependencies before importing
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock otplib v13 - uses functional API with standalone exports
// Define mocks inside factory to avoid hoisting issues
vi.mock('otplib', () => {
  const mockGenerateSecret = vi.fn().mockReturnValue('ABCDEFGHIJKLMNOP1234');
  const mockGenerateURI = vi.fn().mockReturnValue('otpauth://totp/V2%20Resort:test%40example.com?secret=ABCDEFGHIJKLMNOP1234');
  const mockGenerate = vi.fn().mockReturnValue('123456');
  const mockVerify = vi.fn().mockReturnValue(true);
  
  return {
    generateSecret: mockGenerateSecret,
    generateURI: mockGenerateURI,
    generate: mockGenerate,
    verify: mockVerify
  };
});

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qrcode-data')
  }
}));

// Set JWT_SECRET before importing service
process.env.JWT_SECRET = 'test-jwt-secret-for-encryption-key-testing';

import { getSupabase } from '../../../src/database/connection';
import { generateSecret, generateURI, generate, verify } from 'otplib';
import { twoFactorService } from '../../../src/services/two-factor.service';

describe('TwoFactorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSetup', () => {
    it('should generate setup with secret, QR code, and backup codes', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ id: 'pending-1' }))
      } as any);

      const result = await twoFactorService.generateSetup('user-123', 'test@example.com');

      expect(result.secret).toBe('ABCDEFGHIJKLMNOP1234');
      expect(result.qrCodeDataUrl).toContain('data:image/png');
      expect(result.backupCodes).toHaveLength(8);
      expect(result.backupCodes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });
  });

  describe('verifyAndEnable', () => {
    it('should return false when no pending setup exists', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'PGRST116' }))
      } as any);

      const result = await twoFactorService.verifyAndEnable('user-123', '123456');

      expect(result).toBe(false);
    });

    it('should return false when setup is expired', async () => {
      vi.mocked(getSupabase).mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(function(this: any) {
            return {
              single: vi.fn().mockResolvedValue({
                data: {
                  expires_at: new Date(Date.now() - 60000).toISOString() // Expired
                },
                error: null
              })
            };
          })
        }))
      } as any));

      const result = await twoFactorService.verifyAndEnable('user-123', '123456');

      expect(result).toBe(false);
    });
  });

  describe('verifyCode', () => {
    it('should return false when no active 2FA exists', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'PGRST116' }))
      } as any);

      const result = await twoFactorService.verifyCode('user-123', '123456');

      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return enabled status', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({
          enabled_at: '2024-01-01T00:00:00Z',
          backup_codes: ['code1', 'code2', 'code3']
        }))
      } as any);

      const status = await twoFactorService.getStatus('user-123');

      expect(status.enabled).toBe(true);
      expect(status.enabledAt).toBe('2024-01-01T00:00:00Z');
      expect(status.backupCodesRemaining).toBe(3);
    });

    it('should return disabled status when not set up', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'PGRST116' }))
      } as any);

      const status = await twoFactorService.getStatus('user-123');

      expect(status.enabled).toBe(false);
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should return null when verification fails', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'PGRST116' }))
      } as any);

      const codes = await twoFactorService.regenerateBackupCodes('user-123', '123456');

      expect(codes).toBeNull();
    });
  });
});
