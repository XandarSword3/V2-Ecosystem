import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastInfoMock = vi.hoisted(() => vi.fn());

const refetchMock = vi.hoisted(() => vi.fn());
const siteSettingsMock = vi.hoisted(() => ({
  settings: {
    theme: 'beach',
    themeColors: null,
    showWeatherWidget: true,
    weatherLocation: 'New York, USA',
    weatherEffect: 'auto',
    animationsEnabled: true,
    reducedMotion: false,
    soundEnabled: true,
  },
  refetch: refetchMock,
  loading: false,
}));

const translateMock = vi.hoisted(() => (key: string) => key);

vi.mock('next-intl', () => ({
  useTranslations: () => translateMock,
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
  };
});

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
    put: apiPutMock,
    delete: apiDeleteMock,
  },
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => siteSettingsMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    info: toastInfoMock,
  },
}));

import AppearanceSettingsPage from '../../src/app/admin/settings/appearance/page';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('Admin appearance settings route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    toastInfoMock.mockReset();
    refetchMock.mockReset();

    apiPutMock.mockResolvedValue({ data: { success: true } });
    refetchMock.mockResolvedValue(undefined);

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('resets values and saves updated appearance settings', async () => {
    const user = userEvent.setup();

    render(<AppearanceSettingsPage />);

    expect(await screen.findByText('appearance.title')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Reset/i }));
    await user.click(screen.getByRole('button', { name: /saveChanges/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/admin/settings', expect.any(Object));
    });

    expect(refetchMock).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith('appearance.saved');
  });

  it('shows error toast when saving appearance settings fails', async () => {
    const user = userEvent.setup();

    apiPutMock.mockRejectedValueOnce(new Error('save failed'));

    render(<AppearanceSettingsPage />);

    await screen.findByText('appearance.title');

    await user.click(screen.getByRole('button', { name: /Reset/i }));
    await user.click(screen.getByRole('button', { name: /saveChanges/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('errors.failedToSave');
    });
  });
});
