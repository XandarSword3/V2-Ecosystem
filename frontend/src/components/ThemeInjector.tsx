'use client';

import React, { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useSiteSettings } from '@/lib/settings-context';
import { resortThemes } from '@/lib/theme-config';

// Color manipulation utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Generate color shades from base color
function generateColorShades(baseHex: string): Record<string, string> {
  const rgb = hexToRgb(baseHex);
  if (!rgb) return {};
  
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  
  return {
    '50': hslToHex(hsl.h, Math.min(hsl.s * 0.3, 100), 97),
    '100': hslToHex(hsl.h, Math.min(hsl.s * 0.4, 100), 94),
    '200': hslToHex(hsl.h, Math.min(hsl.s * 0.5, 100), 86),
    '300': hslToHex(hsl.h, Math.min(hsl.s * 0.7, 100), 74),
    '400': hslToHex(hsl.h, Math.min(hsl.s * 0.9, 100), 60),
    '500': baseHex,
    '600': hslToHex(hsl.h, Math.min(hsl.s * 1.1, 100), Math.max(hsl.l * 0.85, 20)),
    '700': hslToHex(hsl.h, Math.min(hsl.s * 1.2, 100), Math.max(hsl.l * 0.7, 15)),
    '800': hslToHex(hsl.h, Math.min(hsl.s * 1.3, 100), Math.max(hsl.l * 0.55, 12)),
    '900': hslToHex(hsl.h, Math.min(hsl.s * 1.4, 100), Math.max(hsl.l * 0.4, 10)),
    '950': hslToHex(hsl.h, Math.min(hsl.s * 1.5, 100), Math.max(hsl.l * 0.25, 5)),
  };
}

export function ThemeInjector() {
  const { settings } = useSiteSettings();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    // Get the resort theme
    const theme = settings.theme && resortThemes[settings.theme as keyof typeof resortThemes] 
      ? resortThemes[settings.theme as keyof typeof resortThemes] 
      : resortThemes.beach;

    // Get colors - use custom colors if available, otherwise use theme preset
    const baseColors = settings.themeColors || theme.colors;

    // Apply CSS custom properties to :root
    const root = document.documentElement;
    
    // Primary colors (same in both modes)
    root.style.setProperty('--color-primary', baseColors.primary);
    root.style.setProperty('--color-secondary', baseColors.secondary);
    root.style.setProperty('--color-accent', baseColors.accent);
    
    // Mode-specific colors
    if (isDark && theme.colors.backgroundDark) {
      root.style.setProperty('--color-background', theme.colors.backgroundDark);
      root.style.setProperty('--color-surface', theme.colors.surfaceDark);
      root.style.setProperty('--color-text', theme.colors.textDark);
      root.style.setProperty('--color-text-muted', theme.colors.textMutedDark);
    } else {
      root.style.setProperty('--color-background', baseColors.background);
      root.style.setProperty('--color-surface', baseColors.surface);
      root.style.setProperty('--color-text', baseColors.text);
      root.style.setProperty('--color-text-muted', baseColors.textMuted);
    }

    // Convert hex to RGB for Tailwind opacity support
    const toRgbString = (hex: string) => {
      const rgb = hexToRgb(hex);
      return rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : '0 0 0';
    };

    root.style.setProperty('--color-primary-rgb', toRgbString(baseColors.primary));
    root.style.setProperty('--color-secondary-rgb', toRgbString(baseColors.secondary));
    root.style.setProperty('--color-accent-rgb', toRgbString(baseColors.accent));
    
    const bgColor = isDark && theme.colors.backgroundDark ? theme.colors.backgroundDark : baseColors.background;
    const surfaceColor = isDark && theme.colors.surfaceDark ? theme.colors.surfaceDark : baseColors.surface;
    root.style.setProperty('--color-background-rgb', toRgbString(bgColor));
    root.style.setProperty('--color-surface-rgb', toRgbString(surfaceColor));

    // Generate and apply color shades
    const primaryShades = generateColorShades(baseColors.primary);
    const secondaryShades = generateColorShades(baseColors.secondary);
    const accentShades = generateColorShades(baseColors.accent);

    Object.entries(primaryShades).forEach(([shade, color]) => {
      root.style.setProperty(`--color-primary-${shade}`, color);
    });
    Object.entries(secondaryShades).forEach(([shade, color]) => {
      root.style.setProperty(`--color-secondary-${shade}`, color);
    });
    Object.entries(accentShades).forEach(([shade, color]) => {
      root.style.setProperty(`--color-accent-${shade}`, color);
    });

    // Theme gradients - use dark variants when in dark mode
    if (theme.gradients) {
      if (isDark && theme.gradients.heroDark) {
        root.style.setProperty('--gradient-hero', theme.gradients.heroDark);
        root.style.setProperty('--gradient-card', theme.gradients.cardDark);
      } else {
        root.style.setProperty('--gradient-hero', theme.gradients.hero);
        root.style.setProperty('--gradient-card', theme.gradients.card);
      }
      root.style.setProperty('--gradient-button', theme.gradients.button);
    }

    // Aurora/mesh gradient based on theme colors and mode
    const auroraOpacity = isDark ? '30' : '40';
    root.style.setProperty('--gradient-aurora', 
      `radial-gradient(ellipse 80% 80% at 50% -20%, ${baseColors.primary}${auroraOpacity}, transparent),
       radial-gradient(ellipse 60% 60% at 80% 50%, ${baseColors.secondary}${isDark ? '25' : '30'}, transparent),
       radial-gradient(ellipse 50% 50% at 20% 80%, ${baseColors.accent}${isDark ? '15' : '20'}, transparent)`
    );
    
    const meshOpacity = isDark ? '10' : '15';
    root.style.setProperty('--gradient-mesh',
      `radial-gradient(at 40% 20%, ${baseColors.primary}${meshOpacity} 0px, transparent 50%),
       radial-gradient(at 80% 0%, ${baseColors.secondary}${meshOpacity} 0px, transparent 50%),
       radial-gradient(at 0% 50%, ${baseColors.accent}${isDark ? '08' : '10'} 0px, transparent 50%),
       radial-gradient(at 80% 80%, ${baseColors.primary}${isDark ? '08' : '10'} 0px, transparent 50%)`
    );

    // Glass colors derived from theme - adjust for dark mode
    const glassOpacity = isDark ? '20' : '15';
    root.style.setProperty('--glass-primary', `${baseColors.primary}${glassOpacity}`);
    root.style.setProperty('--glass-secondary', `${baseColors.secondary}${glassOpacity}`);
    root.style.setProperty('--glass-accent', `${baseColors.accent}${glassOpacity}`);

    // Theme pattern
    if (theme.pattern) {
      root.style.setProperty('--theme-pattern', `url("${theme.pattern}")`);
    }

    // Weather effect for this theme
    if (theme.weatherEffect) {
      root.style.setProperty('--weather-effect', theme.weatherEffect);
    }

    // Set theme identifier for conditional styling
    root.setAttribute('data-theme', settings.theme || 'beach');
    root.setAttribute('data-color-mode', isDark ? 'dark' : 'light');

  }, [settings.theme, settings.themeColors, isDark]);

  return null;
}
