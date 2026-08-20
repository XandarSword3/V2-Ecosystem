
// =============================================================================
// Chainable Supabase Query Mock
// =============================================================================

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike'];
  chainMethods.forEach((method) => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function (resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null }),
    }),
    then: (resolve: (v: unknown) => void) => resolve({ data: insertData, error: null }),
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null }),
    }),
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach((method) => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null }),
  });
  updateChain.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);

  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach((method) => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// =============================================================================
// Test Data
// =============================================================================

const mockExistingUser = {
  id: 'user-123',
  email: 'test@example.com',
  full_name: 'Test User',
  profile_image_url: 'https://example.com/avatar.jpg',
  oauth_provider: null as string | null,
  oauth_provider_id: null as string | null,
};

const mockOAuthUser = {
  id: 'oauth-user-456',
  email: 'oauth@example.com',
  full_name: 'OAuth User',
  profile_image_url: 'https://google.com/avatar.jpg',
  oauth_provider: 'google',
  oauth_provider_id: 'google-123',
};

const mockCustomerRole = { id: 'role-customer', name: 'customer' };

const mockUserRoles = [{ roles: { name: 'customer' } }];

const mockGoogleTokenResponse = {
  access_token: 'google-access-token',
  expires_in: 3600,
  token_type: 'Bearer',
  scope: 'email profile',
  id_token: 'google-id-token',
};

const mockGoogleUserInfo = {
  id: 'google-user-123',
  email: 'googleuser@gmail.com',
  verified_email: true,
  name: 'Google User',
  given_name: 'Google',
  family_name: 'User',
  picture: 'https://lh3.googleusercontent.com/photo.jpg',
};

const mockFacebookTokenResponse = {
  access_token: 'facebook-access-token',
  token_type: 'bearer',
  expires_in: 5183944,
};

const mockFacebookUserInfo = {
  id: 'facebook-user-456',
  email: 'fbuser@facebook.com',
  name: 'Facebook User',
  picture: { data: { url: 'https://graph.facebook.com/photo.jpg' } },
};

// Mock Apple ID token payload (base64url encoded)
function createMockAppleIdToken(payload: object): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'apple-test-kid' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mockSignature = 'mock-signature';
  return `${encodedHeader}.${encodedPayload}.${mockSignature}`;
}

// =============================================================================
// Mocks
// =============================================================================

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: () => mockSupabase,
}));

vi.mock('../../../../src/modules/auth/auth.utils', () => ({
  generateTokens: vi.fn().mockReturnValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  }),
}));

vi.mock('../../../../src/config/index', () => ({
  config: {
    oauth: {
      google: {
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        callbackUrl: 'http://localhost:3000/auth/google/callback',
      },
      facebook: {
        clientId: 'facebook-client-id',
        clientSecret: 'facebook-client-secret',
        callbackUrl: 'http://localhost:3000/auth/facebook/callback',
      },
      apple: {
        clientId: 'com.example.app',
        teamId: 'TEAM123',
        keyId: 'KEY123',
        privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        callbackUrl: 'http://localhost:3000/auth/apple/callback',
      },
    },
  },
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../src/utils/activityLogger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock crypto for generateOAuthState
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue({
      toString: vi.fn().mockReturnValue('a'.repeat(64)), // 32 bytes as hex = 64 chars
    }),
    createSign: vi.fn().mockReturnValue({
      update: vi.fn(),
      end: vi.fn(),
      sign: vi.fn().mockReturnValue(Buffer.from([0x30, 0x44, 0x02, 0x20, ...Array(32).fill(0x01), 0x02, 0x20, ...Array(32).fill(0x02)])),
    }),
    createPublicKey: vi.fn().mockReturnValue('mock-public-key'),
  },
  randomBytes: vi.fn().mockReturnValue({
    toString: vi.fn().mockReturnValue('a'.repeat(64)),
  }),
}));

// Mock jsonwebtoken for Apple JWKS verification
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn().mockImplementation((token: string, _key: any, options: any) => {
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (options?.issuer && payload.iss !== options.issuer) {
        throw new Error('Invalid Apple ID token issuer');
      }
      if (options?.audience && payload.aud !== options.audience) {
        throw new Error('Invalid Apple ID token audience');
      }
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Apple ID token expired');
      }
      return payload;
    }),
    sign: vi.fn().mockReturnValue('mock-client-secret'),
  },
}));

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  generateOAuthState,
  handleGoogleCallback,
  handleFacebookCallback,
  handleAppleCallback,
} from '../../../../src/modules/auth/oauth.service';
import { generateTokens } from '../../../../src/modules/auth/auth.utils';
import { logActivity } from '../../../../src/utils/activityLogger';
import { logger } from '../../../../src/utils/logger';

// =============================================================================
// Tests
// =============================================================================

describe('OAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  // ===========================================================================
  // generateOAuthState
  // ===========================================================================

  describe('generateOAuthState', () => {
    it('should generate a random hex string', () => {
      const state = generateOAuthState();
      expect(state).toBe('a'.repeat(64));
    });

    it('should return a string', () => {
      const state = generateOAuthState();
      expect(typeof state).toBe('string');
    });

    it('should generate a 64-character hex string (32 bytes)', () => {
      const state = generateOAuthState();
      expect(state.length).toBe(64);
    });
  });

  // ===========================================================================
  // handleGoogleCallback
  // ===========================================================================

  describe('handleGoogleCallback', () => {
    function setupGoogleMocks(options: {
      tokenOk?: boolean;
      userInfoOk?: boolean;
      existingOAuthUser?: boolean;
      existingEmailUser?: boolean;
      hasOAuthProvider?: boolean;
    } = {}) {
      const {
        tokenOk = true,
        userInfoOk = true,
        existingOAuthUser = false,
        existingEmailUser = false,
        hasOAuthProvider = false,
      } = options;

      // Mock fetch for Google token exchange and user info
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth2.googleapis.com/token')) {
          return Promise.resolve({
            ok: tokenOk,
            json: () => Promise.resolve(mockGoogleTokenResponse),
            text: () => Promise.resolve('Token error'),
          });
        }
        if (url.includes('googleapis.com/oauth2/v2/userinfo')) {
          return Promise.resolve({
            ok: userInfoOk,
            json: () => Promise.resolve(mockGoogleUserInfo),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      // Setup query mocks for each table
      let oauthQueryCall = 0;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          oauthQueryCall++;
          // First call: find by OAuth provider ID
          if (oauthQueryCall === 1) {
            if (existingOAuthUser) {
              return createQueryMock(() => [mockOAuthUser]);
            }
            return createQueryMock(() => []);
          }
          // Second call: find by email
          if (oauthQueryCall === 2) {
            if (existingEmailUser) {
              const user = { ...mockExistingUser, oauth_provider: hasOAuthProvider ? 'facebook' : null };
              return createQueryMock(() => [user]);
            }
            return createQueryMock(() => []);
          }
          // Third call: insert new user or update existing
          return createQueryMock(() => [{
            id: 'new-user-789',
            email: mockGoogleUserInfo.email,
            full_name: mockGoogleUserInfo.name,
            profile_image_url: mockGoogleUserInfo.picture,
          }]);
        }
        if (table === 'roles') {
          return createQueryMock(() => [mockCustomerRole]);
        }
        if (table === 'user_roles') {
          return createQueryMock(() => mockUserRoles);
        }
        return createQueryMock(() => []);
      });
    }

    it('should exchange Google code for tokens and get user info', async () => {
      setupGoogleMocks();
      await handleGoogleCallback('google-auth-code');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer google-access-token' },
        })
      );
    });

    it('should create a new user when no existing user found', async () => {
      setupGoogleMocks();
      const result = await handleGoogleCallback('google-auth-code');

      expect(result.isNewUser).toBe(true);
      expect(result.user.email).toBe(mockGoogleUserInfo.email);
      expect(result.user.fullName).toBe(mockGoogleUserInfo.name);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
    });

    it('should return existing user when found by OAuth provider ID', async () => {
      setupGoogleMocks({ existingOAuthUser: true });
      const result = await handleGoogleCallback('google-auth-code');

      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe(mockOAuthUser.id);
    });

    it('should link OAuth to existing email user without OAuth provider', async () => {
      setupGoogleMocks({ existingEmailUser: true, hasOAuthProvider: false });
      const result = await handleGoogleCallback('google-auth-code');

      expect(result.isNewUser).toBe(false);
      expect(mockFrom).toHaveBeenCalledWith('users');
    });

    it('should login existing user with different OAuth provider', async () => {
      setupGoogleMocks({ existingEmailUser: true, hasOAuthProvider: true });
      const result = await handleGoogleCallback('google-auth-code');

      expect(result.isNewUser).toBe(false);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when Google token exchange fails', async () => {
      setupGoogleMocks({ tokenOk: false });

      await expect(handleGoogleCallback('invalid-code')).rejects.toThrow(
        'Failed to authenticate with Google'
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to exchange Google code for token:',
        expect.any(String)
      );
    });

    it('should throw error when getting Google user info fails', async () => {
      setupGoogleMocks({ userInfoOk: false });

      await expect(handleGoogleCallback('google-auth-code')).rejects.toThrow(
        'Failed to get Google user info'
      );
    });

    it('should generate tokens for the user', async () => {
      setupGoogleMocks();
      await handleGoogleCallback('google-auth-code');

      expect(generateTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(String),
          email: expect.any(String),
          roles: expect.any(Array),
        })
      );
    });

    it('should log activity on successful OAuth', async () => {
      setupGoogleMocks();
      await handleGoogleCallback('google-auth-code');

      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.stringMatching(/OAUTH_REGISTER|OAUTH_LOGIN/),
          resource: 'auth',
          new_value: { provider: 'google' },
        })
      );
    });

    it('should create new users with customer scope (no legacy roles/user_roles)', async () => {
      setupGoogleMocks();
      await handleGoogleCallback('google-auth-code');

      // scope is the authorization source of truth — the frozen roles/user_roles
      // tables are no longer written or read on the OAuth path.
      expect(mockFrom).not.toHaveBeenCalledWith('roles');
      expect(mockFrom).not.toHaveBeenCalledWith('user_roles');
      expect(generateTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'customer',
          roles: ['customer'],
        })
      );
    });
  });

  // ===========================================================================
  // handleFacebookCallback
  // ===========================================================================

  describe('handleFacebookCallback', () => {
    function setupFacebookMocks(options: {
      tokenOk?: boolean;
      userInfoOk?: boolean;
      hasEmail?: boolean;
      existingUser?: boolean;
    } = {}) {
      const { tokenOk = true, userInfoOk = true, hasEmail = true, existingUser = false } = options;

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('graph.facebook.com') && url.includes('oauth/access_token')) {
          return Promise.resolve({
            ok: tokenOk,
            json: () => Promise.resolve(mockFacebookTokenResponse),
            text: () => Promise.resolve('Facebook token error'),
          });
        }
        if (url.includes('graph.facebook.com') && url.includes('/me')) {
          const userInfo = hasEmail
            ? mockFacebookUserInfo
            : { ...mockFacebookUserInfo, email: undefined };
          return Promise.resolve({
            ok: userInfoOk,
            json: () => Promise.resolve(userInfo),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      let queryCall = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          queryCall++;
          // Call 1: find by OAuth provider ID
          if (queryCall === 1) {
            if (existingUser) {
              return createQueryMock(() => [{
                ...mockOAuthUser,
                oauth_provider: 'facebook',
                oauth_provider_id: 'facebook-user-456',
                profile_image_url: mockFacebookUserInfo.picture?.data?.url,
              }]);
            }
            return createQueryMock(() => []);
          }
          // Call 2: find by email (when no OAuth user found)
          if (queryCall === 2) {
            return createQueryMock(() => []);
          }
          // Call 3+: insert new user
          return createQueryMock(() => [{
            id: 'new-fb-user',
            email: mockFacebookUserInfo.email,
            full_name: mockFacebookUserInfo.name,
            profile_image_url: mockFacebookUserInfo.picture?.data?.url,
          }]);
        }
        if (table === 'roles') {
          return createQueryMock(() => [mockCustomerRole]);
        }
        if (table === 'user_roles') {
          return createQueryMock(() => mockUserRoles);
        }
        return createQueryMock(() => []);
      });
    }

    it('should exchange Facebook code for tokens and get user info', async () => {
      setupFacebookMocks();
      await handleFacebookCallback('facebook-auth-code');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com/v18.0/oauth/access_token')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com/v18.0/me')
      );
    });

    it('should create a new user when no existing user found', async () => {
      setupFacebookMocks();
      const result = await handleFacebookCallback('facebook-auth-code');

      expect(result.isNewUser).toBe(true);
      expect(result.user.email).toBe(mockFacebookUserInfo.email);
      expect(result.accessToken).toBeDefined();
    });

    it('should return existing user when found', async () => {
      setupFacebookMocks({ existingUser: true });
      const result = await handleFacebookCallback('facebook-auth-code');

      expect(result.isNewUser).toBe(false);
    });

    it('should throw error when Facebook token exchange fails', async () => {
      setupFacebookMocks({ tokenOk: false });

      await expect(handleFacebookCallback('invalid-code')).rejects.toThrow(
        'Failed to authenticate with Facebook'
      );
    });

    it('should throw error when getting Facebook user info fails', async () => {
      setupFacebookMocks({ userInfoOk: false });

      await expect(handleFacebookCallback('facebook-auth-code')).rejects.toThrow(
        'Failed to get Facebook user info'
      );
    });

    it('should throw error when email is not provided by Facebook', async () => {
      setupFacebookMocks({ hasEmail: false });

      await expect(handleFacebookCallback('facebook-auth-code')).rejects.toThrow(
        'Email not provided by Facebook'
      );
    });

    it('should include profile picture URL from Facebook', async () => {
      setupFacebookMocks();
      const result = await handleFacebookCallback('facebook-auth-code');

      expect(result.user.profileImageUrl).toBeDefined();
    });

    it('should log activity on successful Facebook OAuth', async () => {
      setupFacebookMocks();
      await handleFacebookCallback('facebook-auth-code');

      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          new_value: { provider: 'facebook' },
        })
      );
    });
  });

  // ===========================================================================
  // handleAppleCallback
  // ===========================================================================

  describe('handleAppleCallback', () => {
    const mockApplePayload = {
      iss: 'https://appleid.apple.com',
      aud: 'com.example.app',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000),
      sub: 'apple-user-789',
      email: 'appleuser@privaterelay.appleid.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      nonce_supported: true,
    };

    function setupAppleMocks(options: {
      existingUser?: boolean;
      hasEmail?: boolean;
    } = {}) {
      const { existingUser = false, hasEmail = true } = options;

      // Mock fetch for Apple JWKS endpoint
      mockFetch.mockImplementation((url: string) => {
        if (url === 'https://appleid.apple.com/auth/keys') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keys: [{
                kty: 'RSA',
                kid: 'apple-test-kid',
                alg: 'RS256',
                n: 'test-n-value',
                e: 'AQAB',
              }],
            }),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      let queryCall = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          queryCall++;
          // Call 1: find by OAuth provider ID
          if (queryCall === 1) {
            if (existingUser) {
              return createQueryMock(() => [{
                ...mockOAuthUser,
                oauth_provider: 'apple',
                oauth_provider_id: 'apple-user-789',
                email: mockApplePayload.email,
              }]);
            }
            return createQueryMock(() => []);
          }
          // Call 2: find by email (when no OAuth user found)
          if (queryCall === 2) {
            return createQueryMock(() => []);
          }
          // Call 3+: insert new user
          const newUserEmail = hasEmail ? mockApplePayload.email : `${mockApplePayload.sub}@privaterelay.appleid.com`;
          return createQueryMock(() => [{
            id: 'new-apple-user',
            email: newUserEmail,
            full_name: 'Apple User',
            profile_image_url: null,
          }]);
        }
        if (table === 'roles') {
          return createQueryMock(() => [mockCustomerRole]);
        }
        if (table === 'user_roles') {
          return createQueryMock(() => mockUserRoles);
        }
        return createQueryMock(() => []);
      });
    }

    it('should decode Apple ID token and create user', async () => {
      setupAppleMocks();
      const idToken = createMockAppleIdToken(mockApplePayload);

      const result = await handleAppleCallback('apple-auth-code', idToken);

      expect(result.user.email).toBe(mockApplePayload.email);
      expect(result.isNewUser).toBe(true);
    });

    it('should use provided user name on first sign-in', async () => {
      setupAppleMocks();
      const idToken = createMockAppleIdToken(mockApplePayload);
      const userName = { firstName: 'John', lastName: 'Appleseed' };

      const result = await handleAppleCallback('apple-auth-code', idToken, userName);

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBe('mock-access-token');
    });

    it('should return existing user when found', async () => {
      setupAppleMocks({ existingUser: true });
      const idToken = createMockAppleIdToken(mockApplePayload);

      const result = await handleAppleCallback('apple-auth-code', idToken);

      expect(result.isNewUser).toBe(false);
    });

    it('should throw error for invalid Apple ID token format', async () => {
      setupAppleMocks();

      await expect(handleAppleCallback('apple-auth-code', 'invalid-token')).rejects.toThrow(
        'Invalid Apple ID token'
      );
    });

    it('should throw error for invalid issuer', async () => {
      setupAppleMocks();
      const invalidPayload = { ...mockApplePayload, iss: 'https://evil.com' };
      const idToken = createMockAppleIdToken(invalidPayload);

      await expect(handleAppleCallback('apple-auth-code', idToken)).rejects.toThrow(
        'Invalid Apple ID token issuer'
      );
    });

    it('should throw error for invalid audience', async () => {
      setupAppleMocks();
      const invalidPayload = { ...mockApplePayload, aud: 'wrong-client-id' };
      const idToken = createMockAppleIdToken(invalidPayload);

      await expect(handleAppleCallback('apple-auth-code', idToken)).rejects.toThrow(
        'Invalid Apple ID token audience'
      );
    });

    it('should throw error for expired token', async () => {
      setupAppleMocks();
      const expiredPayload = { ...mockApplePayload, exp: Math.floor(Date.now() / 1000) - 3600 };
      const idToken = createMockAppleIdToken(expiredPayload);

      await expect(handleAppleCallback('apple-auth-code', idToken)).rejects.toThrow(
        'Apple ID token expired'
      );
    });

    it('should use private relay email when email not provided', async () => {
      setupAppleMocks({ hasEmail: false });
      const payloadWithoutEmail = { ...mockApplePayload, email: undefined };
      const idToken = createMockAppleIdToken(payloadWithoutEmail);

      const result = await handleAppleCallback('apple-auth-code', idToken);

      expect(result.user.email).toContain('privaterelay.appleid.com');
    });

    it('should handle partial user name (first name only)', async () => {
      setupAppleMocks();
      const idToken = createMockAppleIdToken(mockApplePayload);
      const userName = { firstName: 'John' };

      const result = await handleAppleCallback('apple-auth-code', idToken, userName);

      expect(result.user).toBeDefined();
    });

    it('should handle partial user name (last name only)', async () => {
      setupAppleMocks();
      const idToken = createMockAppleIdToken(mockApplePayload);
      const userName = { lastName: 'Appleseed' };

      const result = await handleAppleCallback('apple-auth-code', idToken, userName);

      expect(result.user).toBeDefined();
    });

    it('should use default name when no user name provided', async () => {
      setupAppleMocks();
      const idToken = createMockAppleIdToken(mockApplePayload);

      const result = await handleAppleCallback('apple-auth-code', idToken);

      expect(result.user).toBeDefined();
    });

    it('should log activity on successful Apple OAuth', async () => {
      setupAppleMocks();
      const idToken = createMockAppleIdToken(mockApplePayload);

      await handleAppleCallback('apple-auth-code', idToken);

      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          new_value: { provider: 'apple' },
        })
      );
    });
  });

  // ===========================================================================
  // Edge Cases and Error Handling
  // ===========================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle network errors during OAuth', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(handleGoogleCallback('code')).rejects.toThrow();
    });

    it('should handle database errors during user lookup', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth2.googleapis.com/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGoogleTokenResponse),
          });
        }
        if (url.includes('googleapis.com/oauth2/v2/userinfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGoogleUserInfo),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      mockFrom.mockImplementation(() => {
        const mock = createQueryMock(() => []);
        mock.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
        return mock;
      });

      // Should still work since the error is handled internally
      const result = await handleGoogleCallback('code');
      expect(result).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth2.googleapis.com/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGoogleTokenResponse),
          });
        }
        if (url.includes('googleapis.com/oauth2/v2/userinfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...mockGoogleUserInfo, email: 'TEST@EXAMPLE.COM' }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      let insertedData: Record<string, unknown> | null = null;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          const mock = createQueryMock(() => []);
          mock.insert = vi.fn().mockImplementation((data: Record<string, unknown>) => {
            insertedData = data;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'new-1', ...data },
                  error: null,
                }),
              }),
            };
          });
          return mock;
        }
        if (table === 'roles') {
          return createQueryMock(() => [mockCustomerRole]);
        }
        if (table === 'user_roles') {
          return createQueryMock(() => mockUserRoles);
        }
        return createQueryMock(() => []);
      });

      await handleGoogleCallback('code');

      expect(insertedData).toBeDefined();
      expect(insertedData?.email).toBe('test@example.com');
    });
  });
});
