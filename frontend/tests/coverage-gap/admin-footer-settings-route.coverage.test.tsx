import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
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

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import FooterSettingsPage from '../../src/app/admin/settings/footer/page';

describe('Admin footer settings route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPutMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockResolvedValue({ data: { data: { footer: {} } } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
  });

  it('renders footer CMS, updates builders, and saves configuration', async () => {
    const user = userEvent.setup();

    render(<FooterSettingsPage />);

    expect(await screen.findByText('Footer CMS')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add Social Profile/i }));
    await user.click(screen.getByRole('button', { name: /Add Column/i }));

    const addLinkButtons = screen.getAllByRole('button', { name: /Add Link/i });
    await user.click(addLinkButtons[0]);

    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalled();
    });

    expect(apiPutMock.mock.calls[0]?.[0]).toBe('/admin/settings');
    expect(apiPutMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        footer: expect.objectContaining({
          columns: expect.any(Array),
          socials: expect.any(Array),
          contact: expect.any(Object),
        }),
      })
    );

    expect(toastSuccessMock).toHaveBeenCalledWith('Footer configuration saved successfully');
  });

  it('shows an error toast when initial settings fetch fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('load failed'));

    render(<FooterSettingsPage />);

    expect(await screen.findByText('Footer CMS')).toBeInTheDocument();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to load settings');
    });
  });
});
