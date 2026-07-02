import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const refetchSettingsMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    put: apiPutMock,
  },
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    modules: [
      { id: 'm-1', slug: 'spa', name: 'Spa Module' },
      { id: 'm-2', slug: 'menu_service', name: 'MenuService Module' },
    ],
    refetch: refetchSettingsMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/context/PropertyContext', () => ({
  useProperty: () => ({
    activePropertyId: 'prop-1',
    activeProperty: { id: 'prop-1', name: 'Test Property', type: 'property' },
    properties: [],
    setActiveProperty: vi.fn(),
    loading: false,
    refreshProperties: vi.fn(),
  }),
  PropertyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import NavbarSettingsPage from '../../src/app/[property]/admin/settings/navbar/page';

describe('Admin navbar settings route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPutMock.mockReset();
    refetchSettingsMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockResolvedValue({
      data: {
        data: {
          navbar: {
            links: [{ type: 'internal', label: 'Home', href: '/', icon: 'Home' }],
            config: {
              sticky: true,
              showCart: true,
              showLanguageSwitcher: true,
              showThemeToggle: true,
              showCurrencySwitcher: true,
              showUserPreferences: true,
            },
          },
        },
      },
    });

    apiPutMock.mockResolvedValue({ data: { success: true } });
    refetchSettingsMock.mockResolvedValue(undefined);
  });

  it('loads navbar settings, updates links, and saves', async () => {
    const user = userEvent.setup();

    render(<NavbarSettingsPage />);

    expect(await screen.findByText('Navigation Bar CMS')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add Link/i }));

    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalled();
    });

    expect(apiPutMock.mock.calls[0]?.[0]).toBe('/admin/settings');
    expect(apiPutMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        navbar: expect.objectContaining({
          links: expect.any(Array),
          config: expect.any(Object),
        }),
      })
    );

    const savedNavbar = apiPutMock.mock.calls[0]?.[1]?.navbar;
    expect(savedNavbar.links.length).toBeGreaterThanOrEqual(2);

    expect(refetchSettingsMock).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith('Navbar configuration saved successfully');
  });

  it('shows an error toast when settings load fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('load failed'));

    render(<NavbarSettingsPage />);

    expect(await screen.findByText('Navigation Bar CMS')).toBeInTheDocument();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to load settings');
    });
  });
});
