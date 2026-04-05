import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const toastInfoMock = vi.hoisted(() => vi.fn());
const socketOnMock = vi.hoisted(() => vi.fn());
const socketOffMock = vi.hoisted(() => vi.fn());
const socketHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => void>());

const authState = vi.hoisted(() => ({
  user: {
    fullName: 'Alex Staff',
    roles: ['restaurant_staff'],
  },
  isAuthenticated: true,
  isLoading: false,
}));

const siteSettingsState = vi.hoisted(() => ({
  modules: [
    { id: 'm-1', name: 'Spa Services', slug: 'spa', is_active: true, template_type: 'session_access' },
  ],
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

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) => {
    if (typeof values?.count === 'number') {
      return `${key}:${values.count}`;
    }
    return key;
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => siteSettingsState,
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
  },
}));

vi.mock('@/lib/socket', () => {
  const socket = {
    on: socketOnMock.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      socketHandlers.set(event, handler);
      return socket;
    }),
    off: socketOffMock,
  };

  return {
    useSocket: () => ({ socket }),
  };
});

vi.mock('sonner', () => ({
  toast: {
    info: toastInfoMock,
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import StaffDashboard from '../../src/app/staff/page';

describe('Staff dashboard route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    routerPushMock.mockReset();
    toastInfoMock.mockReset();
    socketOnMock.mockClear();
    socketOffMock.mockClear();
    socketHandlers.clear();

    authState.user = {
      fullName: 'Alex Staff',
      roles: ['restaurant_staff'],
    };
    authState.isAuthenticated = true;
    authState.isLoading = false;

    siteSettingsState.modules = [
      { id: 'm-1', name: 'Spa Services', slug: 'spa', is_active: true, template_type: 'session_access' },
    ];

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/restaurant/staff/orders/live') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'ord-1',
                order_number: 'R100',
                status: 'pending',
                updated_at: '2025-01-03T10:00:00.000Z',
                created_at: '2025-01-03T09:50:00.000Z',
              },
            ],
          },
        });
      }

      if (url === '/snack/staff/orders/live') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'ord-2',
                order_number: 'S200',
                status: 'completed',
                updated_at: new Date().toISOString(),
                created_at: '2025-01-03T09:00:00.000Z',
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('loads stats, shows quick actions, and responds to socket updates', async () => {
    render(<StaffDashboard />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(2);
    });

    await screen.findByText('Spa Services');
    await screen.findByText(/Order #R100 - pending/i);

    act(() => {
      socketHandlers.get('order:new')?.({
        id: 'ord-3',
        order_number: 'R300',
        status: 'pending',
      });
    });

    expect(toastInfoMock).toHaveBeenCalledWith('newOrderReceived');

    act(() => {
      socketHandlers.get('order:statusChanged')?.({ orderId: 'ord-3', status: 'completed' });
    });

    await screen.findByText(/Order #ord-3 completed/i);
  });

  it('redirects unauthenticated users to staff login', async () => {
    authState.isAuthenticated = false;

    render(<StaffDashboard />);

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith('/login?redirect=/staff');
    });
  });
});
