import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

const authState = vi.hoisted(() => ({
  user: {
    fullName: 'Sam Staff',
    roles: ['menu_service_staff'],
  },
  isAuthenticated: true,
  isLoading: false,
  logout: logoutMock,
}));

const pathnameState = vi.hoisted(() => ({ value: '/staff/manager' }));

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

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({}),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dictionary: Record<string, string> = {
      portal: 'Staff Portal',
      systemOnline: 'System Online',
      'nav.ticketScanner': 'Ticket Scanner',
    };

    return dictionary[key] || key;
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
}));

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

import StaffLayout from '../../src/app/[property]/staff/layout';

describe('Staff layout route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPutMock.mockReset();
    logoutMock.mockReset();
    routerPushMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();

    pathnameState.value = '/staff/manager';

    authState.user = {
      fullName: 'Sam Staff',
      roles: ['menu_service_staff'],
    };
    authState.isAuthenticated = true;
    authState.isLoading = false;

    logoutMock.mockResolvedValue(undefined);

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/admin/modules') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { id: 'm-1', name: 'MenuService', slug: 'menu_service', is_active: true },
              { id: 'm-2', name: 'Spa', slug: 'spa', is_active: true },
            ],
          },
        });
      }

      if (url === '/admin/notifications') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'n-1',
                title: 'New booking',
                message: 'A new booking was created.',
                is_read: false,
                created_at: '2025-01-04T10:00:00.000Z',
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: [] } });
    });

    apiPutMock.mockResolvedValue({ data: { success: true } });
  });

  it('renders staff shell, handles notifications, and logs out', async () => {
    const user = userEvent.setup();

    render(
      <StaffLayout>
        <div>Staff Child Content</div>
      </StaffLayout>
    );

    expect(await screen.findByText('Staff Portal')).toBeInTheDocument();
    expect(screen.getByText('Staff Child Content')).toBeInTheDocument();

    await user.click(screen.getByTestId('notifications-bell'));
    expect(await screen.findByText('Notifications')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Mark all as read/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/admin/notifications/read-all');
    });

    const logoutButtons = screen.getAllByTitle('Logout');
    await user.click(logoutButtons[0]);

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(routerPushMock).toHaveBeenCalledWith('/');
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Logged out successfully');
  });

  it('redirects users without staff roles', async () => {
    authState.user = {
      fullName: 'Customer User',
      roles: ['customer'],
    };

    render(
      <StaffLayout>
        <div>Not allowed</div>
      </StaffLayout>
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Access denied. Staff privileges required.');
      expect(routerPushMock).toHaveBeenCalledWith('/');
    });
  });
});
