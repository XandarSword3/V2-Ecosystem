/**
 * Critical Path Tests
 * 
 * These tests verify that the app can actually start and run.
 * Unlike unit tests that mock dependencies, these tests verify
 * that critical modules can be imported without crashing.
 * 
 * IMPORTANT: These tests catch issues that would crash the app at startup,
 * like missing native modules or broken imports that unit tests miss
 * because they mock everything.
 */

describe('Critical Path - App Startup', () => {
  describe('Core Module Imports', () => {
    it('should import biometric service without crashing', () => {
      // This should NOT crash even if native module is missing
      expect(() => {
        require('../src/services/biometric');
      }).not.toThrow();
    });

    it('should import auth store without crashing', () => {
      expect(() => {
        require('../src/store/auth');
      }).not.toThrow();
    });

    it('should import cart store without crashing', () => {
      expect(() => {
        require('../src/store/cart');
      }).not.toThrow();
    });

    it('should import settings store without crashing', () => {
      expect(() => {
        require('../src/store/settings');
      }).not.toThrow();
    });

    it('should import API client without crashing', () => {
      expect(() => {
        require('../src/api/client');
      }).not.toThrow();
    });

    it('should import push notifications service without crashing', () => {
      expect(() => {
        require('../src/services/push-notifications');
      }).not.toThrow();
    });

    it('should import deep linking service without crashing', () => {
      expect(() => {
        require('../src/services/deep-linking');
      }).not.toThrow();
    });

    it('should import settings service without crashing', () => {
      expect(() => {
        require('../src/services/settings');
      }).not.toThrow();
    });
  });

  describe('UI Component Imports', () => {
    it('should import Button component without crashing', () => {
      expect(() => {
        require('../src/components/ui/Button');
      }).not.toThrow();
    });

    it('should import Card component without crashing', () => {
      expect(() => {
        require('../src/components/ui/Card');
      }).not.toThrow();
    });

    it('should import Input component without crashing', () => {
      expect(() => {
        require('../src/components/ui/Input');
      }).not.toThrow();
    });

    it('should import Badge component without crashing', () => {
      expect(() => {
        require('../src/components/ui/Badge');
      }).not.toThrow();
    });

    it('should import MenuItem component without crashing', () => {
      expect(() => {
        require('../src/components/ui/MenuItem');
      }).not.toThrow();
    });

    it('should import CartSummary component without crashing', () => {
      expect(() => {
        require('../src/components/ui/CartSummary');
      }).not.toThrow();
    });

    it('should import BookingCard component without crashing', () => {
      expect(() => {
        require('../src/components/ui/BookingCard');
      }).not.toThrow();
    });
  });

  describe('Configuration Imports', () => {
    it('should import env config without crashing', () => {
      expect(() => {
        require('../src/config/env');
      }).not.toThrow();
    });
  });

  describe('Biometric Service Graceful Degradation', () => {
    it('biometric service should have all expected methods', () => {
      const { biometricService } = require('../src/services/biometric');
      
      // Verify the service exports all expected methods
      expect(typeof biometricService.checkCapabilities).toBe('function');
      expect(typeof biometricService.getBiometricName).toBe('function');
      expect(typeof biometricService.isBiometricLoginEnabled).toBe('function');
      expect(typeof biometricService.authenticate).toBe('function');
      expect(typeof biometricService.enableBiometricLogin).toBe('function');
      expect(typeof biometricService.disableBiometricLogin).toBe('function');
    });

    it('biometric checkCapabilities should return valid structure when native module unavailable', async () => {
      const { biometricService } = require('../src/services/biometric');
      
      // This should work even if native module is missing
      const capabilities = await biometricService.checkCapabilities();
      
      expect(capabilities).toHaveProperty('isAvailable');
      expect(capabilities).toHaveProperty('biometricTypes');
      expect(capabilities).toHaveProperty('isEnrolled');
      expect(capabilities).toHaveProperty('securityLevel');
      expect(Array.isArray(capabilities.biometricTypes)).toBe(true);
    });
  });

  describe('Store Initialization', () => {
    it('auth store should initialize with valid default state', () => {
      const { useAuthStore } = require('../src/store/auth');
      const state = useAuthStore.getState();
      
      expect(state).toHaveProperty('user');
      expect(state).toHaveProperty('isAuthenticated');
      expect(state).toHaveProperty('isLoading');
      expect(state).toHaveProperty('error');
      expect(typeof state.login).toBe('function');
      expect(typeof state.logout).toBe('function');
      expect(typeof state.register).toBe('function');
    });

    it('cart store should initialize with valid default state', () => {
      const { useCartStore } = require('../src/store/cart');
      const state = useCartStore.getState();
      
      expect(state).toHaveProperty('items');
      expect(Array.isArray(state.items)).toBe(true);
      expect(typeof state.addItem).toBe('function');
      expect(typeof state.removeItem).toBe('function');
      expect(typeof state.clearCart).toBe('function');
    });

    it('settings store should initialize with valid default state', () => {
      const { useSettingsStore } = require('../src/store/settings');
      const state = useSettingsStore.getState();
      
      expect(state).toHaveProperty('themeMode');
      expect(state).toHaveProperty('notifications');
      expect(typeof state.setThemeMode).toBe('function');
    });
  });

  describe('API Client Initialization', () => {
    it('API client should export required methods', () => {
      const api = require('../src/api/client');
      
      expect(api.authApi).toBeDefined();
      expect(api.restaurantApi).toBeDefined();
      expect(api.poolApi).toBeDefined();
      expect(api.STORAGE_KEYS).toBeDefined();
    });

    it('auth API should have required methods', () => {
      const { authApi } = require('../src/api/client');
      
      expect(typeof authApi.login).toBe('function');
      expect(typeof authApi.register).toBe('function');
      expect(typeof authApi.logout).toBe('function');
      expect(typeof authApi.getMe).toBe('function');
    });
  });
});

describe('Critical Path - Native Module Handling', () => {
  it('should handle missing expo-local-authentication gracefully', async () => {
    // The biometric service should NOT throw when the native module is missing
    // Instead it should return a "not available" state
    const { biometricService } = require('../src/services/biometric');
    
    // This call should NEVER throw, even if native modules are missing
    let error: Error | null = null;
    try {
      await biometricService.checkCapabilities();
    } catch (e) {
      error = e as Error;
    }
    
    expect(error).toBeNull();
  });

  it('should handle missing expo-secure-store gracefully', async () => {
    // Even if SecureStore is mocked/unavailable, auth operations should not crash
    const { useAuthStore } = require('../src/store/auth');
    
    // Getting state should never crash
    expect(() => useAuthStore.getState()).not.toThrow();
  });
});

describe('Critical Path - Configuration Validation', () => {
  it('should have valid API_BASE_URL', () => {
    const { API_BASE_URL } = require('../src/config/env');
    
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe('string');
    expect(API_BASE_URL.length).toBeGreaterThan(0);
  });

  it('should have valid STORAGE_KEYS', () => {
    const { STORAGE_KEYS } = require('../src/api/client');
    
    expect(STORAGE_KEYS.ACCESS_TOKEN).toBeDefined();
    expect(STORAGE_KEYS.REFRESH_TOKEN).toBeDefined();
    expect(STORAGE_KEYS.USER_DATA).toBeDefined();
  });
});
