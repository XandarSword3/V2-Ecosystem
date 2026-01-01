import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ResortTheme, WeatherEffect, defaultTheme, defaultWeather } from '../theme-config';

interface SettingsState {
  // Visual settings
  resortTheme: ResortTheme;
  weatherEffect: WeatherEffect;
  animationsEnabled: boolean;
  reducedMotion: boolean;
  
  // Sound settings
  soundEnabled: boolean;
  notificationSound: boolean;
  
  // Actions
  setResortTheme: (theme: ResortTheme) => void;
  setWeatherEffect: (effect: WeatherEffect) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setNotificationSound: (enabled: boolean) => void;
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
      
      // Actions
      setResortTheme: (theme) => set({ resortTheme: theme }),
      setWeatherEffect: (effect) => set({ weatherEffect: effect }),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
      setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setNotificationSound: (enabled) => set({ notificationSound: enabled }),
    }),
    {
      name: 'v2-resort-settings',
    }
  )
);
