'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface SiteSettings {
  // General
  resortName: string;
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
}

const defaultSettings: SiteSettings = {
  resortName: 'V2 Resort',
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
};

interface SettingsContextValue {
  settings: SiteSettings;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  loading: true,
  error: null,
  refetch: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      // Ensure we have the correct API URL with /api prefix
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const apiUrl = baseUrl.replace(/\/api\/?$/, ''); // Remove trailing /api if present
      const response = await fetch(`${apiUrl}/api/settings`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setSettings({ ...defaultSettings, ...data.data });
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load site settings:', err);
      setError('Failed to load settings');
      // Keep default settings on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, error, refetch: fetchSettings }}>
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
