/**
 * OAuth Controller Tests
 */
import type { Request, Response, NextFunction } from 'express';
import { createMockReqRes } from '../utils';

// Mock dependencies - must be defined inline due to hoisting
vi.mock('../../../src/config/index.js', () => ({
  config: {
    frontendUrl: 'http://localhost:3000',
    env: 'test',
    oauth: {
      google: {
        clientId: 'test-google-client-id',
        clientSecret: 'test-google-secret',
        callbackUrl: 'http://localhost:3001/api/auth/google/callback',
      },
      facebook: {
        clientId: 'test-facebook-client-id',
        clientSecret: 'test-facebook-secret',
        callbackUrl: 'http://localhost:3001/api/auth/facebook/callback',
      },
    },
  },
}));

vi.mock('../../../src/modules/auth/oauth.service.js', () => ({
  generateOAuthState: vi.fn(() => 'mock-state-token'),
  handleGoogleCallback: vi.fn(),
  handleFacebookCallback: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as oauthController from '../../../src/modules/auth/oauth.controller';
import * as oauthService from '../../../src/modules/auth/oauth.service.js';

describe('OAuth Controller', () => {
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

  describe('googleAuth', () => {
    it('should redirect to Google OAuth consent screen', () => {
      oauthController.googleAuth(mockReq as Request, mockRes as Response);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'oauth_state',
        'mock-state-token',
        expect.objectContaining({
          httpOnly: true,
          maxAge: 10 * 60 * 1000,
        })
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth')
      );
    });

    it('should include required OAuth parameters', () => {
      oauthController.googleAuth(mockReq as Request, mockRes as Response);

      const redirectUrl = (mockRes.redirect as any).mock.calls[0][0];
      expect(redirectUrl).toContain('client_id=test-google-client-id');
      expect(redirectUrl).toContain('response_type=code');
      expect(redirectUrl).toContain('scope=email+profile');
      expect(redirectUrl).toContain('state=mock-state-token');
    });
  });

  describe('googleCallback', () => {
    it('should handle OAuth error response', async () => {
      mockReq.query = { error: 'access_denied' };

      await oauthController.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000/login?error=oauth_denied');
    });

    it('should reject state mismatch (CSRF protection)', async () => {
      mockReq.query = { code: 'auth-code', state: 'incoming-state' };
      mockReq.cookies = { oauth_state: 'different-state' };

      await oauthController.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000/login?error=invalid_state');
    });

    it('should handle missing code', async () => {
      mockReq.query = { state: 'valid-state' };
      mockReq.cookies = { oauth_state: 'valid-state' };

      await oauthController.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000/login?error=missing_code');
    });

    it('should handle successful callback for regular user', async () => {
      mockReq.query = { code: 'valid-auth-code', state: 'valid-state' };
      mockReq.cookies = { oauth_state: 'valid-state' };

      vi.mocked(oauthService.handleGoogleCallback).mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com', roles: ['customer'] },
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });

      await oauthController.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('oauth_state');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'accessToken',
        'access-token-123',
        expect.any(Object)
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token-456',
        expect.any(Object)
      );
      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000/?oauth=success');
    });

    it('should redirect admin to admin dashboard', async () => {
      mockReq.query = { code: 'valid-auth-code', state: 'valid-state' };
      mockReq.cookies = { oauth_state: 'valid-state' };

      vi.mocked(oauthService.handleGoogleCallback).mockResolvedValue({
        user: { id: 'admin-1', email: 'admin@example.com', roles: ['admin'] },
        accessToken: 'admin-token',
        refreshToken: 'refresh-token',
      });

      await oauthController.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/admin')
      );
    });

    it('should redirect staff to staff dashboard', async () => {
      mockReq.query = { code: 'valid-auth-code', state: 'valid-state' };
      mockReq.cookies = { oauth_state: 'valid-state' };

      vi.mocked(oauthService.handleGoogleCallback).mockResolvedValue({
        user: { id: 'staff-1', email: 'staff@example.com', roles: ['staff'] },
        accessToken: 'staff-token',
        refreshToken: 'refresh-token',
      });

      await oauthController.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/staff')
      );
    });

    it('should handle callback service error', async () => {
      mockReq.query = { code: 'valid-auth-code', state: 'valid-state' };
      mockReq.cookies = { oauth_state: 'valid-state' };

      vi.mocked(oauthService.handleGoogleCallback).mockRejectedValue(new Error('Token exchange failed'));

      await oauthController.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000/login?error=oauth_failed');
    });
  });
});
