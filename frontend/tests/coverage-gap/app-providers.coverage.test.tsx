import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const localeState = vi.hoisted(() => ({ value: 'en' }));
const getLocaleFromCookieMock = vi.hoisted(() =>
  vi.fn(() => localeState.value as 'en' | 'ar' | 'fr' | 'de' | 'it')
);

vi.mock('@tanstack/react-query', async () => {
  const React = await import('react');

  class QueryClient {
    constructor() {}
  }

  return {
    QueryClient,
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('next-intl', async () => {
  const React = await import('react');

  return {
    NextIntlClientProvider: ({
      locale,
      children,
    }: {
      locale: string;
      children: React.ReactNode;
    }) => (
      <div data-testid="intl-provider" data-locale={locale}>
        {children}
      </div>
    ),
  };
});

vi.mock('@/i18n', () => ({
  defaultLocale: 'en',
  getLocaleFromCookie: getLocaleFromCookieMock,
}));

vi.mock('@/lib/auth-context', async () => {
  const React = await import('react');

  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@/components/ThemeProvider', async () => {
  const React = await import('react');

  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@/lib/settings-context', async () => {
  const React = await import('react');

  return {
    SettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@/components/effects/LoadingScreen', async () => {
  const React = await import('react');

  return {
    LoadingScreenWrapper: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="loading-wrapper">{children}</div>
    ),
  };
});

vi.mock('@/lib/hydrate-settings', () => ({
  HydrateSettingsFromBackend: () => <div data-testid="hydrate-settings" />,
}));

vi.mock('@/components/DirectionSync', () => ({
  DirectionSync: () => <div data-testid="direction-sync" />,
}));

vi.mock('@/components/ThemeInjector', () => ({
  ThemeInjector: () => <div data-testid="theme-injector" />,
}));

vi.mock('@/components/effects/WeatherEffects', () => ({
  WeatherEffects: () => <div data-testid="weather-effects" />,
}));

vi.mock('@/components/PageTracker', () => ({
  PageTracker: () => <div data-testid="page-tracker" />,
}));

vi.mock('@/components/pwa', () => ({
  PWAPrompt: () => <div data-testid="pwa-prompt" />,
}));

import { Providers } from '../../src/app/providers';

describe('App providers coverage', () => {
  beforeEach(() => {
    localeState.value = 'ar';
    getLocaleFromCookieMock.mockClear();
  });

  it('initializes locale from cookie and reacts to locale change events', async () => {
    render(
      <Providers>
        <div>App Child Content</div>
      </Providers>
    );

    expect(screen.getByText('App Child Content')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('intl-provider')).toHaveAttribute('data-locale', 'ar');
    });

    localeState.value = 'fr';
    window.dispatchEvent(new CustomEvent('localeChange'));

    await waitFor(() => {
      expect(screen.getByTestId('intl-provider')).toHaveAttribute('data-locale', 'fr');
    });

    expect(screen.getByTestId('hydrate-settings')).toBeInTheDocument();
    expect(screen.getByTestId('theme-injector')).toBeInTheDocument();
    expect(screen.getByTestId('weather-effects')).toBeInTheDocument();
    expect(screen.getByTestId('direction-sync')).toBeInTheDocument();
    expect(screen.getByTestId('page-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('pwa-prompt')).toBeInTheDocument();
    expect(getLocaleFromCookieMock).toHaveBeenCalledTimes(2);
  });

  it('removes locale change listener on unmount', () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <Providers>
        <div>Unmount Check</div>
      </Providers>
    );

    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith('localeChange', expect.any(Function));
    removeListenerSpy.mockRestore();
  });
});
