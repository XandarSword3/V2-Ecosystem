import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SiteTheme, defaultTheme } from '../lib/theme-config';

export type Currency = 'USD' | 'EUR' | 'LBP';
export type TransitionStyle = 'fade' | 'slideRight' | 'slideUp' | 'scale' | 'reveal';

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

// STATIC FALLBACK rates for display conversion — NOT a source of truth.
// The authoritative rates live in the backend exchange_rates table
// (immutable facts, see backend ExchangeRateService.getFact). These
// hardcoded values are only the initial/offline fallback until the app
// hydrates from the backend (TODO: fetch rates via ExchangeRateService and
// replace this map); the backend prices and stores amounts in the module's
// own currency, so a stale rate here can mis-display. Do not treat this as
// authoritative.
export const exchangeRates: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  LBP: 89500,
};

interface SettingsState {
  // Visual settings
  siteTheme: SiteTheme;
  animationsEnabled: boolean;
  reducedMotion: boolean;
  
  // Transition settings
  enableTransitions: boolean;
  transitionStyle: TransitionStyle;
  enableLoadingAnimation: boolean;
  
  // Sound settings
  soundEnabled: boolean;
  notificationSound: boolean;

  // Currency settings
  currency: Currency;
  
  // Actions
  setSiteTheme: (theme: SiteTheme) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setNotificationSound: (enabled: boolean) => void;
  setCurrency: (currency: Currency) => void;
  setEnableTransitions: (enabled: boolean) => void;
  setTransitionStyle: (style: TransitionStyle) => void;
  setEnableLoadingAnimation: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      siteTheme: defaultTheme,
      animationsEnabled: true,
      reducedMotion: false,
      soundEnabled: true,
      notificationSound: true,
      currency: 'USD',
      enableTransitions: true,
      transitionStyle: 'reveal' as TransitionStyle,
      enableLoadingAnimation: true,
      
      // Actions
      setSiteTheme: (theme) => set({ siteTheme: theme }),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
      setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setNotificationSound: (enabled) => set({ notificationSound: enabled }),
      setCurrency: (currency) => set({ currency }),
      setEnableTransitions: (enabled) => set({ enableTransitions: enabled }),
      setTransitionStyle: (style) => set({ transitionStyle: style }),
      setEnableLoadingAnimation: (enabled) => set({ enableLoadingAnimation: enabled }),
    }),
    {
      name: 'v2-ecosystem-settings',
    }
  )
);
