'use client';

import { useSiteSettings } from '@/lib/settings-context';
import { resortThemes } from '@/lib/theme-config';
import { useEffect } from 'react';

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : null;
}

export function ThemeInjector() {
  const { settings } = useSiteSettings();
  const theme = resortThemes[settings.theme] || resortThemes.beach;

  useEffect(() => {
    const root = document.documentElement;
    const colors = theme.colors;

    // Helper to set color variable
    const set = (name: string, hex: string) => {
      const rgb = hexToRgb(hex);
      if (rgb) {
        root.style.setProperty(`--${name}`, rgb);
      }
    };

    if (colors.primary) {
      set('primary-500', colors.primary);
      set('primary-600', colors.primary); // Ideally calculate darker shade
      set('primary-DEFAULT', colors.primary);
    }

    if (colors.secondary) {
      set('secondary-500', colors.secondary);
      set('secondary-600', colors.secondary);
      set('secondary-DEFAULT', colors.secondary);
    }

    if (colors.accent) {
      set('accent-500', colors.accent);
      set('accent-600', colors.accent);
      set('accent-DEFAULT', colors.accent);
    }

    if (colors.background) {
      set('resort-background', colors.background); // For custom usage
    }

  }, [theme]);

  return null;
}
