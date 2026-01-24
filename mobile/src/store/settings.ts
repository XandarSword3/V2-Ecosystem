/**
 * Settings Store (Zustand)
 * 
 * Manages user preferences and app settings.
 * Features:
 * - Language/locale preferences
 * - Currency settings
 * - Notification preferences
 * - Theme settings
 * - Animation preferences
 * - Payment method defaults
 * - Persistence via AsyncStorage
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

export type Currency = 'USD' | 'EUR' | 'LBP';
export type Language = 'en' | 'ar' | 'fr';
export type ThemeMode = 'light' | 'dark' | 'system';

export const currencySymbols: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  LBP: 'ل.ل',
};

export const currencyNames: Record<Currency, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  LBP: 'Lebanese Pound',
};

export const languageNames: Record<Language, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
};

/**
 * Approximate exchange rates (for display purposes)
 * Base currency: USD
 */
export const exchangeRates: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  LBP: 89500,
};

export interface NotificationPreferences {
  /** Push notifications enabled */
  pushEnabled: boolean;
  /** Order status updates */
  orderUpdates: boolean;
  /** Promotional notifications */
  promotions: boolean;
  /** Loyalty program updates */
  loyaltyUpdates: boolean;
  /** Booking reminders */
  bookingReminders: boolean;
  /** Sound enabled for notifications */
  soundEnabled: boolean;
  /** Vibration enabled for notifications */
  vibrationEnabled: boolean;
}

export interface PaymentPreferences {
  /** Default payment method ID */
  defaultPaymentMethodId: string | null;
  /** Remember payment methods */
  savePaymentMethods: boolean;
  /** Auto-apply loyalty points */
  autoApplyLoyaltyPoints: boolean;
}

export interface SettingsState {
  // Locale settings
  language: Language;
  currency: Currency;
  
  // Theme settings
  themeMode: ThemeMode;
  
  // Animation settings
  animationsEnabled: boolean;
  reducedMotion: boolean;
  hapticFeedbackEnabled: boolean;
  
  // Notification settings
  notifications: NotificationPreferences;
  
  // Payment settings
  payment: PaymentPreferences;
  
  // Biometric settings
  biometricEnabled: boolean;
  biometricForPayments: boolean;
  
  // Onboarding
  hasCompletedOnboarding: boolean;
  lastViewedVersion: string | null;
  
  // Actions - Locale
  setLanguage: (language: Language) => void;
  setCurrency: (currency: Currency) => void;
  
  // Actions - Theme
  setThemeMode: (mode: ThemeMode) => void;
  
  // Actions - Animations
  setAnimationsEnabled: (enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setHapticFeedbackEnabled: (enabled: boolean) => void;
  
  // Actions - Notifications
  setNotificationPreference: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => void;
  setAllNotificationsEnabled: (enabled: boolean) => void;
  
  // Actions - Payment
  setPaymentPreference: <K extends keyof PaymentPreferences>(
    key: K,
    value: PaymentPreferences[K]
  ) => void;
  
  // Actions - Biometric
  setBiometricEnabled: (enabled: boolean) => void;
  setBiometricForPayments: (enabled: boolean) => void;
  
  // Actions - Onboarding
  completeOnboarding: () => void;
  setLastViewedVersion: (version: string) => void;
  
  // Utility
  resetToDefaults: () => void;
  
  // Computed
  formatPrice: (amount: number) => string;
  convertPrice: (amount: number, fromCurrency?: Currency) => number;
}

// ============================================================================
// Default Values
// ============================================================================

const defaultNotifications: NotificationPreferences = {
  pushEnabled: true,
  orderUpdates: true,
  promotions: true,
  loyaltyUpdates: true,
  bookingReminders: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

const defaultPayment: PaymentPreferences = {
  defaultPaymentMethodId: null,
  savePaymentMethods: true,
  autoApplyLoyaltyPoints: false,
};

const defaultState = {
  language: 'en' as Language,
  currency: 'USD' as Currency,
  themeMode: 'system' as ThemeMode,
  animationsEnabled: true,
  reducedMotion: false,
  hapticFeedbackEnabled: true,
  notifications: defaultNotifications,
  payment: defaultPayment,
  biometricEnabled: false,
  biometricForPayments: false,
  hasCompletedOnboarding: false,
  lastViewedVersion: null,
};

// ============================================================================
// Store
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...defaultState,

      // ========================================
      // Locale Actions
      // ========================================

      setLanguage: (language) => {
        set({ language });
      },

      setCurrency: (currency) => {
        set({ currency });
      },

      // ========================================
      // Theme Actions
      // ========================================

      setThemeMode: (themeMode) => {
        set({ themeMode });
      },

      // ========================================
      // Animation Actions
      // ========================================

      setAnimationsEnabled: (animationsEnabled) => {
        set({ animationsEnabled });
      },

      setReducedMotion: (reducedMotion) => {
        set({ reducedMotion });
      },

      setHapticFeedbackEnabled: (hapticFeedbackEnabled) => {
        set({ hapticFeedbackEnabled });
      },

      // ========================================
      // Notification Actions
      // ========================================

      setNotificationPreference: (key, value) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            [key]: value,
          },
        }));
      },

      setAllNotificationsEnabled: (enabled) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            pushEnabled: enabled,
            orderUpdates: enabled,
            promotions: enabled,
            loyaltyUpdates: enabled,
            bookingReminders: enabled,
          },
        }));
      },

      // ========================================
      // Payment Actions
      // ========================================

      setPaymentPreference: (key, value) => {
        set((state) => ({
          payment: {
            ...state.payment,
            [key]: value,
          },
        }));
      },

      // ========================================
      // Biometric Actions
      // ========================================

      setBiometricEnabled: (biometricEnabled) => {
        set({ biometricEnabled });
      },

      setBiometricForPayments: (biometricForPayments) => {
        set({ biometricForPayments });
      },

      // ========================================
      // Onboarding Actions
      // ========================================

      completeOnboarding: () => {
        set({ hasCompletedOnboarding: true });
      },

      setLastViewedVersion: (lastViewedVersion) => {
        set({ lastViewedVersion });
      },

      // ========================================
      // Utility Actions
      // ========================================

      resetToDefaults: () => {
        set(defaultState);
      },

      // ========================================
      // Computed Methods
      // ========================================

      formatPrice: (amount) => {
        const { currency } = get();
        const symbol = currencySymbols[currency];
        const convertedAmount = get().convertPrice(amount);
        
        // Format based on currency
        if (currency === 'LBP') {
          // Lebanese Pound typically shown without decimals
          return `${symbol} ${Math.round(convertedAmount).toLocaleString()}`;
        }
        
        return `${symbol}${convertedAmount.toFixed(2)}`;
      },

      convertPrice: (amount, fromCurrency = 'USD') => {
        const { currency } = get();
        
        if (fromCurrency === currency) {
          return amount;
        }
        
        // Convert to USD first, then to target currency
        const amountInUSD = amount / exchangeRates[fromCurrency];
        return amountInUSD * exchangeRates[currency];
      },
    }),
    {
      name: 'v2-resort-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist all settings
      partialize: (state) => ({
        language: state.language,
        currency: state.currency,
        themeMode: state.themeMode,
        animationsEnabled: state.animationsEnabled,
        reducedMotion: state.reducedMotion,
        hapticFeedbackEnabled: state.hapticFeedbackEnabled,
        notifications: state.notifications,
        payment: state.payment,
        biometricEnabled: state.biometricEnabled,
        biometricForPayments: state.biometricForPayments,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        lastViewedVersion: state.lastViewedVersion,
      }),
    }
  )
);

// ============================================================================
// Selector Hooks (for optimized re-renders)
// ============================================================================

export const useLanguage = () => useSettingsStore((state) => state.language);
export const useCurrency = () => useSettingsStore((state) => state.currency);
export const useThemeMode = () => useSettingsStore((state) => state.themeMode);
export const useNotificationSettings = () => useSettingsStore((state) => state.notifications);
export const usePaymentSettings = () => useSettingsStore((state) => state.payment);
