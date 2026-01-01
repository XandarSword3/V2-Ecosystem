import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ResortTheme, WeatherEffect, defaultTheme, defaultWeather } from '../theme-config';

export type Currency = 'USD' | 'EUR' | 'LBP';

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

// Approximate exchange rates (for display purposes)
export const exchangeRates: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  LBP: 89500,
};

interface SettingsState {
  // Visual settings
  resortTheme: ResortTheme;
  weatherEffect: WeatherEffect;
  animationsEnabled: boolean;
  reducedMotion: boolean;
  
  // Sound settings
  soundEnabled: boolean;
  notificationSound: boolean;

  // Currency settings
  currency: Currency;
  
  // Actions
  setResortTheme: (theme: ResortTheme) => void;
  setWeatherEffect: (effect: WeatherEffect) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setNotificationSound: (enabled: boolean) => void;
  setCurrency: (currency: Currency) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      resortTheme: defaultTheme,
      weatherEffect: defaultWeather,
      animationsEnabled: true,
      reducedMotion: false,
      soundEnabled: true,
      notificationSound: true,
      currency: 'USD',
      
      // Actions
      setResortTheme: (theme) => set({ resortTheme: theme }),
      setWeatherEffect: (effect) => set({ weatherEffect: effect }),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
      setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setNotificationSound: (enabled) => set({ notificationSound: enabled }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'v2-resort-settings',
    }
  )
);
