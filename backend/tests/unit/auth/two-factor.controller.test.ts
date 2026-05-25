/**
 * Two-Factor Authentication Controller Tests
 */
import type { Request, Response, NextFunction } from 'express';
import { createMockReqRes } from '../utils';

// Mock the two-factor service - must be inline due to hoisting
vi.mock('../../../src/services/two-factor.service.js', () => ({
  twoFactorService: {
    getStatus: vi.fn(),
    isEnabled: vi.fn(),
    generateSetup: vi.fn(),
    verifyAndEnable: vi.fn(),
    disable: vi.fn(),
    verify: vi.fn(),
    verifyBackupCode: vi.fn(),
    regenerateBackupCodes: vi.fn(),
  },
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/modules/auth/auth.service.js', () => ({
  completeLoginAfter2FA: vi.fn(),
}));

import * as twoFactorController from '../../../src/modules/auth/two-factor.controller';
import { twoFactorService } from '../../../src/services/two-factor.service.js';

describe('Two-Factor Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockReqRes();
    mockReq = mocks.req;
    mockRes = mocks.res;
    mockNext = mocks.next;
  });

  describe('getTwoFactorStatus', () => {
    it('should return 401 if user not authenticated', async () => {
      mockReq.user = undefined;

      await twoFactorController.getTwoFactorStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized' });
    });

    it('should return 2FA status for authenticated user', async () => {
      mockReq.user = { userId: 'user-1', email: 'user@example.com' };
      vi.mocked(twoFactorService.getStatus).mockResolvedValue({
        enabled: true,
        method: 'totp',
        backupCodesRemaining: 5,
      });

      await twoFactorController.getTwoFactorStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(twoFactorService.getStatus).toHaveBeenCalledWith('user-1');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          enabled: true,
          method: 'totp',
          backupCodesRemaining: 5,
        },
      });
    });

    it('should call next on error', async () => {
      mockReq.user = { userId: 'user-1', email: 'user@example.com' };
      const error = new Error('Database error');
      vi.mocked(twoFactorService.getStatus).mockRejectedValue(error);

      await twoFactorController.getTwoFactorStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('initializeTwoFactor', () => {
    it('should return 401 if user not authenticated', async () => {
      mockReq.user = undefined;

      await twoFactorController.initializeTwoFactor(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return error if 2FA already enabled', async () => {
      mockReq.user = { userId: 'user-1', email: 'user@example.com' };
      vi.mocked(twoFactorService.isEnabled).mockResolvedValue(true);

      await twoFactorController.initializeTwoFactor(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: '2FA is already enabled. Disable it first to set up again.',
      });
    });

    it('should generate setup for user', async () => {
      mockReq.user = { userId: 'user-1', email: 'user@example.com' };
      vi.mocked(twoFactorService.isEnabled).mockResolvedValue(false);
      vi.mocked(twoFactorService.generateSetup).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc123',
        secret: 'JBSWY3DPEHPK3PXP',
        backupCodes: ['CODE1', 'CODE2', 'CODE3'],
      });

      await twoFactorController.initializeTwoFactor(mockReq as Request, mockRes as Response, mockNext);

      expect(twoFactorService.generateSetup).toHaveBeenCalledWith('user-1', 'user@example.com');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          qrCode: 'data:image/png;base64,abc123',
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: ['CODE1', 'CODE2', 'CODE3'],
        },
        message: expect.stringContaining('Scan the QR code'),
      });
    });
  });

  describe('enableTwoFactor', () => {
    it('should return 401 if user not authenticated', async () => {
      mockReq.user = undefined;

      await twoFactorController.enableTwoFactor(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return error if code not provided', async () => {
      mockReq.user = { userId: 'user-1', email: 'user@example.com' };
      mockReq.body = {};

      await twoFactorController.enableTwoFactor(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Verification code required',
      });
    });

    it('should return error if code is invalid', async () => {
      mockReq.user = { userId: 'user-1', email: 'user@example.com' };
      mockReq.body = { code: '123456' };
      vi.mocked(twoFactorService.verifyAndEnable).mockResolvedValue(false);

      await twoFactorController.enableTwoFactor(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid verification code. Please try again.',
      });
    });

    it('should enable 2FA on valid code', async () => {
      mockReq.user = { userId: 'user-1', email: 'user@example.com' };
      mockReq.body = { code: '123456' };
      vi.mocked(twoFactorService.verifyAndEnable).mockResolvedValue(true);

      await twoFactorController.enableTwoFactor(mockReq as Request, mockRes as Response, mockNext);

      expect(twoFactorService.verifyAndEnable).toHaveBeenCalledWith('user-1', '123456');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Two-factor authentication has been enabled successfully.',
      });
    });
  });
});
