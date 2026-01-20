/**
 * OAuth Controller Unit Tests
 * 
 * Tests for Google and Facebook OAuth authentication flows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import * as oauthController from '../../src/modules/auth/oauth.controller.js';
import * as oauthService from '../../src/modules/auth/oauth.service.js';

// Mock the oauth service
vi.mock('../../src/modules/auth/oauth.service.js', () => ({
  generateOAuthState: vi.fn(),
  handleGoogleCallback: vi.fn(),
  handleFacebookCallback: vi.fn(),
}));

// Mock the config
vi.mock('../../src/config/index.js', () => ({
  config: {
    oauth: {
      google: {
        clientId: 'test-google-client-id',
        clientSecret: 'test-google-client-secret',
        callbackUrl: 'http://localhost:3001/api/auth/google/callback',
      },
      facebook: {
        clientId: 'test-facebook-client-id',
        clientSecret: 'test-facebook-client-secret',
        callbackUrl: 'http://localhost:3001/api/auth/facebook/callback',
      },
    },
    frontend: {
      url: 'http://localhost:3000',
    },
  },
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('OAuth Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = {
      query: {},
      cookies: {},
    };
    mockResponse = {
      redirect: vi.fn(),
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  describe('googleAuth', () => {
    it('should redirect to Google OAuth URL', () => {
      vi.mocked(oauthService.generateOAuthState).mockReturnValue('test-state-123');

      oauthController.googleAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(oauthService.generateOAuthState).toHaveBeenCalled();
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'oauth_state',
        'test-state-123',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
        })
      );
      expect(mockResponse.redirect).toHaveBeenCalled();

      const redirectUrl = (mockResponse.redirect as jest.Mock).mock.calls[0][0];
      expect(redirectUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(redirectUrl).toContain('client_id=test-google-client-id');
      expect(redirectUrl).toContain('state=test-state-123');
    });

    it('should include required OAuth scopes', () => {
      vi.mocked(oauthService.generateOAuthState).mockReturnValue('state-abc');

      oauthController.googleAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      const redirectUrl = (mockResponse.redirect as jest.Mock).mock.calls[0][0];
      expect(redirectUrl).toContain('scope=');
      expect(redirectUrl).toContain('email');
      expect(redirectUrl).toContain('profile');
    });
  });

  describe('googleCallback', () => {
    it('should handle successful Google callback', async () => {
      const mockUser = {
        user: {
          id: 'user-123',
          email: 'test@gmail.com',
          fullName: 'Test User',
          roles: ['customer'],
        },
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        isNewUser: false,
      };

      mockRequest.query = { code: 'auth-code-123', state: 'state-xyz' };
      mockRequest.cookies = { oauth_state: 'state-xyz' };

      vi.mocked(oauthService.handleGoogleCallback).mockResolvedValue(mockUser);

      await oauthController.googleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(oauthService.handleGoogleCallback).toHaveBeenCalledWith('auth-code-123');
      // Controller now passes tokens via URL params, not cookies
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/?oauth=success&accessToken=access-token-123&refreshToken=refresh-token-456'
      );
    });

    it('should redirect admin users to /admin', async () => {
      const mockUser = {
        user: {
          id: 'admin-123',
          email: 'admin@test.com',
          fullName: 'Admin User',
          roles: ['admin'],
        },
        accessToken: 'admin-access-token',
        refreshToken: 'admin-refresh-token',
        isNewUser: false,
      };

      mockRequest.query = { code: 'admin-code', state: 'admin-state' };
      mockRequest.cookies = { oauth_state: 'admin-state' };

      vi.mocked(oauthService.handleGoogleCallback).mockResolvedValue(mockUser);

      await oauthController.googleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/admin?oauth=success&accessToken=admin-access-token&refreshToken=admin-refresh-token'
      );
    });

    it('should redirect staff users to /staff', async () => {
      const mockUser = {
        user: {
          id: 'staff-123',
          email: 'staff@test.com',
          fullName: 'Staff User',
          roles: ['hotel_staff'],
        },
        accessToken: 'staff-access-token',
        refreshToken: 'staff-refresh-token',
        isNewUser: false,
      };

      mockRequest.query = { code: 'staff-code', state: 'staff-state' };
      mockRequest.cookies = { oauth_state: 'staff-state' };

      vi.mocked(oauthService.handleGoogleCallback).mockResolvedValue(mockUser);

      await oauthController.googleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/staff?oauth=success&accessToken=staff-access-token&refreshToken=staff-refresh-token'
      );
    });

    it('should reject callback with missing authorization code', async () => {
      mockRequest.query = { state: 'state-xyz' };
      mockRequest.cookies = { oauth_state: 'state-xyz' };

      await oauthController.googleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/login?error=')
      );
    });

    it('should reject callback with invalid state (CSRF protection)', async () => {
      mockRequest.query = { code: 'auth-code', state: 'invalid-state' };
      mockRequest.cookies = { oauth_state: 'valid-state' };

      await oauthController.googleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/login?error=')
      );
      expect(oauthService.handleGoogleCallback).not.toHaveBeenCalled();
    });

    it('should handle OAuth service error', async () => {
      mockRequest.query = { code: 'bad-code', state: 'state-xyz' };
      mockRequest.cookies = { oauth_state: 'state-xyz' };

      vi.mocked(oauthService.handleGoogleCallback).mockRejectedValue(
        new Error('Failed to authenticate')
      );

      await oauthController.googleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/login?error=')
      );
    });
  });

  describe('facebookAuth', () => {
    it('should redirect to Facebook OAuth URL', () => {
      vi.mocked(oauthService.generateOAuthState).mockReturnValue('fb-state-123');

      oauthController.facebookAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(oauthService.generateOAuthState).toHaveBeenCalled();
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'oauth_state',
        'fb-state-123',
        expect.objectContaining({
          httpOnly: true,
        })
      );
      expect(mockResponse.redirect).toHaveBeenCalled();

      const redirectUrl = (mockResponse.redirect as jest.Mock).mock.calls[0][0];
      expect(redirectUrl).toContain('facebook.com/v18.0/dialog/oauth');
      expect(redirectUrl).toContain('client_id=test-facebook-client-id');
    });
  });

  describe('facebookCallback', () => {
    it('should handle successful Facebook callback', async () => {
      const mockUser = {
        user: {
          id: 'fb-user-123',
          email: 'user@facebook.com',
          fullName: 'FB User',
          roles: ['customer'],
        },
        accessToken: 'fb-access-token',
        refreshToken: 'fb-refresh-token',
        isNewUser: true,
      };

      mockRequest.query = { code: 'fb-auth-code', state: 'fb-state' };
      mockRequest.cookies = { oauth_state: 'fb-state' };

      vi.mocked(oauthService.handleFacebookCallback).mockResolvedValue(mockUser);

      await oauthController.facebookCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(oauthService.handleFacebookCallback).toHaveBeenCalledWith('fb-auth-code');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'accessToken',
        'fb-access-token',
        expect.any(Object)
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:3000/?oauth=success');
    });

    it('should reject Facebook callback with state mismatch', async () => {
      mockRequest.query = { code: 'fb-code', state: 'wrong-state' };
      mockRequest.cookies = { oauth_state: 'correct-state' };

      await oauthController.facebookCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/login?error=')
      );
      expect(oauthService.handleFacebookCallback).not.toHaveBeenCalled();
    });
  });
});
