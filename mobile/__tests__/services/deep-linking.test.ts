/**
 * Deep Linking Service Tests
 */
import { parseDeepLink, handleDeepLink, linkingConfig, URL_SCHEME, UNIVERSAL_LINK_DOMAIN } from '../../src/services/deep-linking';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

// Mock expo-linking
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path) => `v2ecosystem://${path}`),
  parse: jest.fn(),
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

const mockLinking = Linking as jest.Mocked<typeof Linking>;
const mockRouter = router as jest.Mocked<typeof router>;

describe('Deep Linking Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constants', () => {
    it('should have correct URL scheme', () => {
      expect(URL_SCHEME).toBe('v2ecosystem');
    });

    it('should have correct universal link domain', () => {
      expect(UNIVERSAL_LINK_DOMAIN).toBe('v2ecosystem.com');
    });
  });

  describe('linkingConfig', () => {
    it('should have correct prefixes', () => {
      expect(linkingConfig.prefixes).toContain('v2ecosystem://');
      expect(linkingConfig.prefixes.some(p => p.includes('v2ecosystem.com'))).toBe(true);
    });
  });

  describe('parseDeepLink', () => {
    it('should return null for empty path', () => {
      mockLinking.parse.mockReturnValue({
        path: null,
        queryParams: {},
        hostname: null,
        scheme: 'v2ecosystem',
      });

      const result = parseDeepLink('v2ecosystem://');

      expect(result).toBeNull();
    });

    it('should parse home route', () => {
      mockLinking.parse.mockReturnValue({
        path: '',
        queryParams: {},
        hostname: null,
        scheme: 'v2ecosystem',
      });

      const result = parseDeepLink('v2ecosystem://');

      expect(result).toBeDefined();
    });

    it('should parse login route', () => {
      mockLinking.parse.mockReturnValue({
        path: 'login',
        queryParams: {},
        hostname: null,
        scheme: 'v2ecosystem',
      });

      const result = parseDeepLink('v2ecosystem://login');

      expect(result?.route).toBeDefined();
    });

    it('should parse restaurant route', () => {
      mockLinking.parse.mockReturnValue({
        path: 'restaurant',
        queryParams: {},
        hostname: null,
        scheme: 'v2ecosystem',
      });

      const result = parseDeepLink('v2ecosystem://restaurant');

      expect(result?.route).toBeDefined();
    });

    it('should pass query params', () => {
      mockLinking.parse.mockReturnValue({
        path: 'order',
        queryParams: { id: '123' },
        hostname: null,
        scheme: 'v2ecosystem',
      });

      const result = parseDeepLink('v2ecosystem://order?id=123');

      expect(result?.params.id).toBe('123');
    });

    it('should handle invalid URLs gracefully', () => {
      mockLinking.parse.mockImplementation(() => {
        throw new Error('Invalid URL');
      });

      const result = parseDeepLink('invalid://url');

      expect(result).toBeNull();
    });
  });

  describe('handleDeepLink', () => {
    it('should navigate to parsed route', async () => {
      mockLinking.parse.mockReturnValue({
        path: 'restaurant',
        queryParams: {},
        hostname: null,
        scheme: 'v2ecosystem',
      });

      await handleDeepLink('v2ecosystem://restaurant');

      expect(mockRouter.push).toHaveBeenCalled();
    });

    it('should not navigate for invalid URL', async () => {
      mockLinking.parse.mockReturnValue({
        path: null,
        queryParams: {},
        hostname: null,
        scheme: 'v2ecosystem',
      });

      await handleDeepLink('v2ecosystem://');

      // Should not crash
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });
});
