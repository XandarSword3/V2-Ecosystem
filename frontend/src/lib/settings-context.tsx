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

  // Module Specific Settings
  moduleSettings?: Record<string, Record<string, string | number | boolean | undefined>>;

  animationsEnabled: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  
  // Weather Widget
  showWeatherWidget?: boolean;
  weatherLocation?: string;
  weatherEffect?: 'auto' | 'waves' | 'snow' | 'rain' | 'leaves' | 'stars' | 'fireflies' | 'none';

  // CMS
  footer?: FooterConfig | null;
  navbar?: NavbarConfig | null;
  homepage?: HomepageConfig | null;
}

// Homepage CMS
export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string;
  enabled: boolean;
}

export interface HomepageSection {
  id: string;
  type: 'services' | 'features' | 'stats' | 'testimonials' | 'map' | 'cta';
  title: string;
  enabled: boolean;
  order: number;
}

export interface HomepageConfig {
  heroSlides?: HeroSlide[];
  sections?: HomepageSection[];
  ctaTitle?: string;
  ctaSubtitle?: string;
  ctaButtonText?: string;
  ctaButtonLink?: string;
}

export interface FooterLogo {
  text: string;
  showIcon: boolean;
}

export interface FooterContact {
  showAddress?: boolean;
  showPhone?: boolean;
  showEmail?: boolean;
}

export interface FooterSocial {
  platform: string;
  url: string;
}

export interface FooterConfig {
  sections?: FooterSection[];
  socialLinks?: SocialLink[];
  copyright?: string;
  showNewsletter?: boolean;
  logo?: string | FooterLogo;
  description?: string;
  columns?: FooterColumn[];
  socials?: FooterSocial[];
  contact?: FooterContact;
}

export interface FooterColumn {
  title?: string;
  titleKey?: string;
  links?: FooterLink[];
}

export interface FooterLink {
  label?: string;
  labelKey?: string;
  href: string;
  moduleSlug?: string;
}

export interface FooterSection {
  title: string;
  links: { label: string; href: string }[];
}

export interface SocialLink {
  platform: string;
  url: string;
  icon?: string;
}

export interface NavbarConfig {
  links?: NavbarLink[];
  config?: {
    showLanguageSwitcher?: boolean;
    showThemeToggle?: boolean;
    showCurrencySwitcher?: boolean;
    showUserPreferences?: boolean;
    showCart?: boolean;
    sticky?: boolean;
  };
}

export interface NavbarLink {
  type?: 'module' | 'custom';
  moduleSlug?: string;
  label: string;
  href: string;
  icon?: string;
}

const defaultSettings: SiteSettings = {
  resortName: 'V2 Resort',
  restaurantName: 'V2 Restaurant',
  snackBarName: 'V2 Snack Bar',
  poolName: 'V2 Pool',
  tagline: '',
  description: '',
  currency: 'USD',
  taxRate: 0.10,
  timezone: 'UTC',
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
  weatherLocation: 'New York, USA',
  footer: null,
  navbar: null,
};

export interface ModuleSettings {
  header_color?: string;
  accent_color?: string;
  show_in_nav?: boolean;
  icon?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface Module {
  id: string;
  template_type: 'menu_service' | 'multi_day_booking' | 'session_access';
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  show_in_main?: boolean;
  settings?: ModuleSettings;
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
      // Handle both { success, data } format and direct data format
      const data = settingsData.data || settingsData;
      if (data && (settingsData.success !== false)) {
        setSettings({ ...defaultSettings, ...data });
        settingsLogger.debug('Updated settings state with theme:', data.theme);
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
