'use client';

import React, { useEffect } from 'react';
import { useThemeSettings } from '@/hooks/useThemeSettings';

export function ThemeStyling() {
  const { data: themeSettings, isLoading, isError } = useThemeSettings();

  useEffect(() => {
    if (themeSettings) {
      document.documentElement.style.setProperty('--primary-color', themeSettings.primary_color);
      document.documentElement.style.setProperty('--secondary-color', themeSettings.secondary_color);
      document.documentElement.style.setProperty('--font-family', themeSettings.font_family);
      // Potentially other styles for weather widget if needed globally
    }
  }, [themeSettings]);

  if (isLoading || isError) {
    // Optionally render a loading state or error state, or nothing
    return null;
  }

  return null; // This component doesn't render anything visible directly
}