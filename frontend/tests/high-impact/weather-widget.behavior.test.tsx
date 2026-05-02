import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsState = vi.hoisted(() => ({
  settings: {
    showWeatherWidget: true,
    weatherLocation: 'Byblos',
  },
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);
        return Component;
      },
    }
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => settingsState,
}));

import WeatherWidget from '../../src/components/WeatherWidget';

describe('WeatherWidget behavior', () => {
  beforeEach(() => {
    settingsState.settings.showWeatherWidget = true;
    settingsState.settings.weatherLocation = 'Byblos';
    vi.restoreAllMocks();
  });

  it('does not render when weather widget is disabled', () => {
    settingsState.settings.showWeatherWidget = false;

    const { container } = render(<WeatherWidget variant="compact" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders compact weather data on successful fetch', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          temperature: 28,
          feels_like: 30,
          humidity: 55,
          wind_speed: 11,
          visibility: 9,
          condition: 'Sunny',
          description: 'Clear sky',
          icon: 'sun',
          location: 'Byblos',
        },
      }),
    } as Response);

    render(<WeatherWidget variant="compact" />);

    expect(await screen.findByText('28°C')).toBeInTheDocument();
    expect(screen.getByText('Sunny')).toBeInTheDocument();
    expect(screen.getByText('Byblos')).toBeInTheDocument();
  });

  it('falls back to demo weather when API is unavailable', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);

    render(<WeatherWidget variant="header" />);

    await waitFor(() => {
      expect(screen.getByText('24°C')).toBeInTheDocument();
    });
  });
});
