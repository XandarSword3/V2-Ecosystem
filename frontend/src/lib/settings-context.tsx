'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSocket } from './socket';
import { ResortTheme } from './theme-config';
import { settingsLogger } from './logger';

export interface SiteSettings {
  // General
  resortName: string;
  restaurantName: string;
  snackBarName: string;
  poolName: string;
  tagline: string;
  description: string;
  currency: string;
  taxRate: number;
  timezone: string;

  // Contact
  phone: string;
  email: string;
  address: string;

  // Hours
  poolHours: string;
  restaurantHours: string;
  receptionHours: string;

  // Chalets
  checkIn: string;
  checkOut: string;
  depositPercent: number;
  cancellationPolicy: string;

  // Pool
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  capacity: number;

  // Legal
  privacyPolicy: string;
  termsOfService: string;
  refundPolicy: string;

  // Appearance
  theme: ResortTheme;
  themeColors?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    // Dark mode variants (optional)
    backgroundDark?: string;
    surfaceDark?: string;
    textDark?: string;
    textMutedDark?: string;
  };
  animationsEnabled: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  
  // Weather Widget
  showWeatherWidget?: boolean;
  weatherLocation?: string;
  weatherEffect?: 'auto' | 'waves' | 'snow' | 'rain' | 'leaves' | 'stars' | 'fireflies' | 'none';

  // CMS
  footer?: any;
  navbar?: any;
}

const defaultSettings: SiteSettings = {
  resortName: 'V2 Resort',
  restaurantName: 'V2 Restaurant',
  snackBarName: 'V2 Snack Bar',
  poolName: 'V2 Pool',
  tagline: '',
  description: '',
  currency: 'USD',
  taxRate: 0.11,
  timezone: 'Asia/Beirut',
  phone: '',
  email: '',
  address: '',
  poolHours: '',
  restaurantHours: '',
  receptionHours: '',
  checkIn: '3:00 PM',
  checkOut: '12:00 PM',
  depositPercent: 50,
  cancellationPolicy: '',
  adultPrice: 15,
  childPrice: 10,
  infantPrice: 0,
  capacity: 100,
  privacyPolicy: '',
  termsOfService: '',
  refundPolicy: '',

  // Appearance defaults
  theme: 'beach',
  animationsEnabled: true,
  reducedMotion: false,
  soundEnabled: true,
  showWeatherWidget: true,
  weatherLocation: 'Beirut, Lebanon',
  footer: null,
  navbar: null,
};

export interface Module {
  id: string;
  template_type: 'menu_service' | 'multi_day_booking' | 'session_access';
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  show_in_main?: boolean;
  settings?: any;
  sort_order: number;
}

interface SettingsContextValue {
  settings: SiteSettings;
  modules: Module[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  modules: [],
  loading: true,
  error: null,
  refetch: async () => { },
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocket();

  // Broadcast settings update to all tabs using localStorage
  const broadcastSettingsUpdate = () => {
    try {
      localStorage.setItem('v2-settings-updated', Date.now().toString());
    } catch {}
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const apiUrl = baseUrl.replace(/\/api\/?$/, '');
      settingsLogger.debug('Fetching settings from', `${apiUrl}/api/settings`);
      const [settingsRes, modulesRes] = await Promise.all([
        fetch(`${apiUrl}/api/settings`),
        fetch(`${apiUrl}/api/modules?activeOnly=true`)
      ]);
      if (!settingsRes.ok) {
        throw new Error('Failed to fetch settings');
      }
      const settingsData = await settingsRes.json();
      settingsLogger.debug('Received settings data', settingsData);
      if (settingsData.success && settingsData.data) {
        setSettings({ ...defaultSettings, ...settingsData.data });
        settingsLogger.debug('Updated settings state');
      }
      if (modulesRes.ok) {
        const modulesData = await modulesRes.json();
        if (modulesData.success && modulesData.data) {
          setModules(modulesData.data);
          settingsLogger.debug('Updated modules state', modulesData.data);
        }
      }
      setError(null);
    } catch (err) {
      settingsLogger.error('Failed to load site settings', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    // Listen for cross-tab settings update
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'v2-settings-updated') {
        fetchSettings();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleSettingsUpdate = async (newSettings: Partial<SiteSettings>) => {
      settingsLogger.debug('Socket event: settings.updated', newSettings);
      broadcastSettingsUpdate();
      await fetchSettings();
    };

    const handleModulesUpdate = () => {
      settingsLogger.debug('Socket event: modules.updated');
      fetchSettings();
    };

    socket.on('settings.updated', handleSettingsUpdate);
    socket.on('modules.updated', handleModulesUpdate);

    return () => {
      socket.off('settings.updated', handleSettingsUpdate);
      socket.off('modules.updated', handleModulesUpdate);
    };
  }, [socket]);

  return (
    <SettingsContext.Provider value={{ settings, modules, loading, error, refetch: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSiteSettings must be used within a SettingsProvider');
  }
  return context;
}
