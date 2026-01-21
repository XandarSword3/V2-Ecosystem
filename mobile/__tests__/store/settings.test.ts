/**
 * Settings Store Tests
 * 
 * Comprehensive test coverage for the settings store including:
 * - Language settings
 * - Currency settings with conversion
 * - Theme settings
 * - Animation preferences
 * - Notification preferences
 * - Payment preferences
 * - Biometric settings
 * - Onboarding state
 * - Price formatting
 */

import { act, renderHook } from '@testing-library/react-native';
import { 
  useSettingsStore, 
  Currency, 
  Language, 
  ThemeMode,
  currencySymbols,
  exchangeRates,
} from '../../src/store/settings';

describe('Settings Store', () => {
  // Reset store before each test
  beforeEach(() => {
    const store = useSettingsStore.getState();
    store.resetToDefaults();
  });

  // =========================================================================
  // Language Settings Tests
  // =========================================================================

  describe('Language Settings', () => {
    it('should have default language as English', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.language).toBe('en');
    });

    it('should change language to Arabic', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setLanguage('ar');
      });

      expect(result.current.language).toBe('ar');
    });

    it('should change language to French', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setLanguage('fr');
      });

      expect(result.current.language).toBe('fr');
    });
  });

  // =========================================================================
  // Currency Settings Tests
  // =========================================================================

  describe('Currency Settings', () => {
    it('should have default currency as USD', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.currency).toBe('USD');
    });

    it('should change currency to EUR', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrency('EUR');
      });

      expect(result.current.currency).toBe('EUR');
    });

    it('should change currency to LBP', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrency('LBP');
      });

      expect(result.current.currency).toBe('LBP');
    });
  });

  // =========================================================================
  // Theme Settings Tests
  // =========================================================================

  describe('Theme Settings', () => {
    it('should have default theme mode as system', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.themeMode).toBe('system');
    });

    it('should change theme to light', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setThemeMode('light');
      });

      expect(result.current.themeMode).toBe('light');
    });

    it('should change theme to dark', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setThemeMode('dark');
      });

      expect(result.current.themeMode).toBe('dark');
    });
  });

  // =========================================================================
  // Animation Settings Tests
  // =========================================================================

  describe('Animation Settings', () => {
    it('should have animations enabled by default', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.animationsEnabled).toBe(true);
    });

    it('should disable animations', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setAnimationsEnabled(false);
      });

      expect(result.current.animationsEnabled).toBe(false);
    });

    it('should have reduced motion disabled by default', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.reducedMotion).toBe(false);
    });

    it('should enable reduced motion', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setReducedMotion(true);
      });

      expect(result.current.reducedMotion).toBe(true);
    });

    it('should have haptic feedback enabled by default', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.hapticFeedbackEnabled).toBe(true);
    });

    it('should disable haptic feedback', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setHapticFeedbackEnabled(false);
      });

      expect(result.current.hapticFeedbackEnabled).toBe(false);
    });
  });

  // =========================================================================
  // Notification Settings Tests
  // =========================================================================

  describe('Notification Settings', () => {
    it('should have all notifications enabled by default', () => {
      const { result } = renderHook(() => useSettingsStore());
      
      expect(result.current.notifications.pushEnabled).toBe(true);
      expect(result.current.notifications.orderUpdates).toBe(true);
      expect(result.current.notifications.promotions).toBe(true);
      expect(result.current.notifications.loyaltyUpdates).toBe(true);
      expect(result.current.notifications.bookingReminders).toBe(true);
      expect(result.current.notifications.soundEnabled).toBe(true);
      expect(result.current.notifications.vibrationEnabled).toBe(true);
    });

    it('should update individual notification preference', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setNotificationPreference('promotions', false);
      });

      expect(result.current.notifications.promotions).toBe(false);
      expect(result.current.notifications.orderUpdates).toBe(true); // Others unchanged
    });

    it('should disable all notifications', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setAllNotificationsEnabled(false);
      });

      expect(result.current.notifications.pushEnabled).toBe(false);
      expect(result.current.notifications.orderUpdates).toBe(false);
      expect(result.current.notifications.promotions).toBe(false);
      expect(result.current.notifications.loyaltyUpdates).toBe(false);
      expect(result.current.notifications.bookingReminders).toBe(false);
      // Sound and vibration remain unchanged
      expect(result.current.notifications.soundEnabled).toBe(true);
    });

    it('should enable all notifications', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setAllNotificationsEnabled(false);
        result.current.setAllNotificationsEnabled(true);
      });

      expect(result.current.notifications.pushEnabled).toBe(true);
      expect(result.current.notifications.orderUpdates).toBe(true);
      expect(result.current.notifications.promotions).toBe(true);
    });

    it('should toggle notification sound', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setNotificationPreference('soundEnabled', false);
      });

      expect(result.current.notifications.soundEnabled).toBe(false);
    });

    it('should toggle notification vibration', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setNotificationPreference('vibrationEnabled', false);
      });

      expect(result.current.notifications.vibrationEnabled).toBe(false);
    });
  });

  // =========================================================================
  // Payment Settings Tests
  // =========================================================================

  describe('Payment Settings', () => {
    it('should have no default payment method', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.payment.defaultPaymentMethodId).toBeNull();
    });

    it('should set default payment method', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setPaymentPreference('defaultPaymentMethodId', 'pm_123');
      });

      expect(result.current.payment.defaultPaymentMethodId).toBe('pm_123');
    });

    it('should have save payment methods enabled by default', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.payment.savePaymentMethods).toBe(true);
    });

    it('should disable saving payment methods', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setPaymentPreference('savePaymentMethods', false);
      });

      expect(result.current.payment.savePaymentMethods).toBe(false);
    });

    it('should have auto-apply loyalty points disabled by default', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.payment.autoApplyLoyaltyPoints).toBe(false);
    });

    it('should enable auto-apply loyalty points', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setPaymentPreference('autoApplyLoyaltyPoints', true);
      });

      expect(result.current.payment.autoApplyLoyaltyPoints).toBe(true);
    });
  });

  // =========================================================================
  // Biometric Settings Tests
  // =========================================================================

  describe('Biometric Settings', () => {
    it('should have biometric disabled by default', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.biometricEnabled).toBe(false);
    });

    it('should enable biometric authentication', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setBiometricEnabled(true);
      });

      expect(result.current.biometricEnabled).toBe(true);
    });

    it('should have biometric for payments disabled by default', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.biometricForPayments).toBe(false);
    });

    it('should enable biometric for payments', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setBiometricForPayments(true);
      });

      expect(result.current.biometricForPayments).toBe(true);
    });
  });

  // =========================================================================
  // Onboarding Tests
  // =========================================================================

  describe('Onboarding', () => {
    it('should have onboarding not completed by default', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.hasCompletedOnboarding).toBe(false);
    });

    it('should mark onboarding as completed', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.completeOnboarding();
      });

      expect(result.current.hasCompletedOnboarding).toBe(true);
    });

    it('should have no last viewed version by default', () => {
      const { result } = renderHook(() => useSettingsStore());
      expect(result.current.lastViewedVersion).toBeNull();
    });

    it('should set last viewed version', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setLastViewedVersion('1.2.0');
      });

      expect(result.current.lastViewedVersion).toBe('1.2.0');
    });
  });

  // =========================================================================
  // Reset to Defaults Tests
  // =========================================================================

  describe('resetToDefaults()', () => {
    it('should reset all settings to defaults', () => {
      const { result } = renderHook(() => useSettingsStore());

      // Change various settings
      act(() => {
        result.current.setLanguage('ar');
        result.current.setCurrency('EUR');
        result.current.setThemeMode('dark');
        result.current.setAnimationsEnabled(false);
        result.current.setBiometricEnabled(true);
        result.current.completeOnboarding();
      });

      // Reset
      act(() => {
        result.current.resetToDefaults();
      });

      expect(result.current.language).toBe('en');
      expect(result.current.currency).toBe('USD');
      expect(result.current.themeMode).toBe('system');
      expect(result.current.animationsEnabled).toBe(true);
      expect(result.current.biometricEnabled).toBe(false);
      expect(result.current.hasCompletedOnboarding).toBe(false);
    });
  });

  // =========================================================================
  // Price Formatting Tests
  // =========================================================================

  describe('formatPrice()', () => {
    it('should format USD price correctly', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrency('USD');
      });

      expect(result.current.formatPrice(19.99)).toBe('$19.99');
    });

    it('should format EUR price correctly', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrency('EUR');
      });

      // €18.39 (19.99 * 0.92 rounded)
      const formatted = result.current.formatPrice(19.99);
      expect(formatted).toMatch(/^€\d+\.\d{2}$/);
    });

    it('should format LBP price without decimal places for amount', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrency('LBP');
      });

      const formatted = result.current.formatPrice(10);
      // LBP currency symbol contains a dot, but the number portion should not have decimal places
      expect(formatted).toMatch(/^ل\.ل \d{1,3}(,\d{3})*$/);
      // Verify no decimal point in the numeric part (after the currency symbol and space)
      const numericPart = formatted.replace('ل.ل ', '');
      expect(numericPart).not.toMatch(/\.\d+$/); // No decimal places like .00 or .99
    });
  });

  // =========================================================================
  // Price Conversion Tests
  // =========================================================================

  describe('convertPrice()', () => {
    it('should return same value when currency matches', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrency('USD');
      });

      expect(result.current.convertPrice(100, 'USD')).toBe(100);
    });

    it('should convert USD to EUR', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrency('EUR');
      });

      const converted = result.current.convertPrice(100, 'USD');
      expect(converted).toBeCloseTo(92); // 100 * 0.92
    });

    it('should convert USD to LBP', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrency('LBP');
      });

      const converted = result.current.convertPrice(100, 'USD');
      expect(converted).toBeCloseTo(8950000); // 100 * 89500
    });

    it('should convert EUR to USD', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrency('USD');
      });

      const converted = result.current.convertPrice(92, 'EUR');
      expect(converted).toBeCloseTo(100); // 92 / 0.92
    });

    it('should use USD as default source currency', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrency('EUR');
      });

      const converted = result.current.convertPrice(100);
      expect(converted).toBeCloseTo(92);
    });
  });

  // =========================================================================
  // Selector Hooks Tests
  // =========================================================================

  describe('Selector Hooks', () => {
    it('useLanguage should return current language', () => {
      const { useLanguage } = require('../../src/store/settings');
      const { result: languageResult } = renderHook(() => useLanguage());
      
      expect(languageResult.current).toBe('en');
    });

    it('useCurrency should return current currency', () => {
      const { useCurrency } = require('../../src/store/settings');
      const { result: currencyResult } = renderHook(() => useCurrency());
      
      expect(currencyResult.current).toBe('USD');
    });

    it('useThemeMode should return current theme mode', () => {
      const { useThemeMode } = require('../../src/store/settings');
      const { result: themeResult } = renderHook(() => useThemeMode());
      
      expect(themeResult.current).toBe('system');
    });
  });

  // =========================================================================
  // Constants Tests
  // =========================================================================

  describe('Constants', () => {
    it('should have correct currency symbols', () => {
      expect(currencySymbols.USD).toBe('$');
      expect(currencySymbols.EUR).toBe('€');
      expect(currencySymbols.LBP).toBe('ل.ل');
    });

    it('should have USD exchange rate as 1', () => {
      expect(exchangeRates.USD).toBe(1);
    });

    it('should have valid exchange rates for all currencies', () => {
      expect(exchangeRates.EUR).toBeGreaterThan(0);
      expect(exchangeRates.EUR).toBeLessThan(exchangeRates.USD);
      expect(exchangeRates.LBP).toBeGreaterThan(exchangeRates.USD);
    });
  });
});
