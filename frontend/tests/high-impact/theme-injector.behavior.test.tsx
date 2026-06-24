import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const themeState = vi.hoisted(() => ({ resolvedTheme: 'light' as 'light' | 'dark' }));
const settingsState = vi.hoisted(() => ({
  settings: {
    theme: 'beach',
    themeColors: undefined as Record<string, string> | undefined,
  },
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: themeState.resolvedTheme }),
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({ settings: settingsState.settings }),
}));

vi.mock('@/lib/theme-config', () => ({
  siteThemes: {
    beach: {
      colors: {
        primary: '#2563eb',
        secondary: '#0891b2',
        accent: '#f59e0b',
        background: '#f8fafc',
        surface: '#ffffff',
        surfaceSecondary: '#f1f5f9',
        surfaceElevated: '#ffffff',
        text: '#0f172a',
        textMuted: '#475569',
        border: '#cbd5e1',
        borderMuted: '#e2e8f0',
        backgroundDark: '#020617',
        surfaceDark: '#0f172a',
        surfaceSecondaryDark: '#1e293b',
        surfaceElevatedDark: '#1e293b',
        textDark: '#f8fafc',
        textMutedDark: '#94a3b8',
        borderDark: '#334155',
        borderMutedDark: '#1e293b',
        textOnPrimary: '#ffffff',
        textOnSecondary: '#ffffff',
        textOnAccent: '#111827',
        focusRing: '#38bdf8',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      gradients: {
        hero: 'linear-gradient(1deg, #111111, #222222)',
        card: 'linear-gradient(1deg, #333333, #444444)',
        button: 'linear-gradient(1deg, #555555, #666666)',
        heroDark: 'linear-gradient(1deg, #000000, #111111)',
        cardDark: 'linear-gradient(1deg, #121212, #232323)',
      },
      pattern: '/img/pattern.svg',
      weatherEffect: 'waves',
    },
  },
}));

import { ThemeInjector } from '../../src/components/ThemeInjector';

function resetRootStyles() {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.removeAttribute('data-color-mode');
  root.style.cssText = '';
}

describe('ThemeInjector behavior', () => {
  beforeEach(() => {
    resetRootStyles();
  });

  afterEach(() => {
    resetRootStyles();
  });

  it('applies light-mode custom theme variables and persists selected theme', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    themeState.resolvedTheme = 'light';
    settingsState.settings = {
      theme: 'beach',
      themeColors: {
        primary: '#112233',
        secondary: '#223344',
        accent: '#334455',
        background: '#f5f7fa',
        surface: '#ffffff',
        surfaceSecondary: '#eef2f7',
        surfaceElevated: '#ffffff',
        text: '#0b1220',
        textMuted: '#4b5563',
        border: '#d1d5db',
        borderMuted: '#e5e7eb',
        backgroundDark: '#111827',
        surfaceDark: '#1f2937',
        surfaceSecondaryDark: '#374151',
        surfaceElevatedDark: '#374151',
        textDark: '#f9fafb',
        textMutedDark: '#9ca3af',
        borderDark: '#4b5563',
        borderMutedDark: '#374151',
      },
    };

    render(<ThemeInjector />);

    await waitFor(() => {
      const root = document.documentElement;
      expect(root.style.getPropertyValue('--color-primary')).toBe('#112233');
      expect(root.style.getPropertyValue('--color-background')).toBe('#f5f7fa');
      expect(root.style.getPropertyValue('--color-surface-secondary')).toBe('#eef2f7');
      expect(root.style.getPropertyValue('--color-primary-rgb')).toBe('17 34 51');
      expect(root.style.getPropertyValue('--gradient-hero')).toContain('#111111');
      expect(root.style.getPropertyValue('--glass-primary')).toBe('#11223315');
      expect(root.getAttribute('data-theme')).toBe('beach');
      expect(root.getAttribute('data-color-mode')).toBe('light');
    });

    expect(setItemSpy).toHaveBeenCalledWith('v2-ecosystem-theme', 'beach');
  });

  it('uses dark-mode preset colors and dark gradients when custom colors are absent', async () => {
    themeState.resolvedTheme = 'dark';
    settingsState.settings = {
      theme: 'beach',
      themeColors: undefined,
    };

    render(<ThemeInjector />);

    await waitFor(() => {
      const root = document.documentElement;
      expect(root.style.getPropertyValue('--color-background')).toBe('#020617');
      expect(root.style.getPropertyValue('--color-surface')).toBe('#0f172a');
      expect(root.style.getPropertyValue('--color-text')).toBe('#f8fafc');
      expect(root.style.getPropertyValue('--gradient-hero')).toContain('#000000');
      expect(root.style.getPropertyValue('--gradient-card')).toContain('#121212');
      expect(root.style.getPropertyValue('--glass-primary')).toBe('#2563eb20');
      expect(root.style.getPropertyValue('--theme-pattern')).toContain('/img/pattern.svg');
      expect(root.style.getPropertyValue('--weather-effect')).toBe('waves');
      expect(root.getAttribute('data-color-mode')).toBe('dark');
    });
  });
});
