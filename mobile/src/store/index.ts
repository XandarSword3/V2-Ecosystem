/**
 * Store Exports
 * 
 * Central export point for all Zustand stores.
 */

// Auth Store
export { useAuthStore, isTwoFactorRequired } from './auth';
export type { AuthState } from './auth';

// Cart Store
export { useCartStore, TAX_RATE, SERVICE_FEE_RATE, LOYALTY_POINTS_TO_DOLLAR } from './cart';
export type {
  CartItem,
  CartItemAddon,
  CartItemVariant,
  CartModuleType,
  CartTotals,
  AppliedGiftCard,
  CartState,
} from './cart';

// Settings Store
export {
  useSettingsStore,
  useLanguage,
  useCurrency,
  useThemeMode,
  useNotificationSettings,
  usePaymentSettings,
  currencySymbols,
  currencyNames,
  languageNames,
  exchangeRates,
} from './settings';
export type {
  Currency,
  Language,
  ThemeMode,
  NotificationPreferences,
  PaymentPreferences,
  SettingsState,
} from './settings';

// API Types (re-exported for convenience)
export type { 
  User, 
  AuthTokens, 
  TwoFactorRequired, 
  TwoFactorSetup, 
  TwoFactorStatus,
  LoginResult,
} from '../api/client';
