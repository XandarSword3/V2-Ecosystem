import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const socketBundle = vi.hoisted(() => {
  const handlers: Record<string, (payload: any) => void> = {};

  return {
    handlers,
    socket: {
      connected: true,
      on: vi.fn((event: string, cb: (payload: any) => void) => {
        handlers[event] = cb;
      }),
      off: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
    },
  };
});

const siteSettingsMock = vi.hoisted(() => ({
  settings: {
    resortName: 'Azure Bay Resort',
  },
  modules: [
    {
      id: 'module-1',
      name: 'Lagoon',
      slug: 'lagoon',
      template_type: 'menu_service',
      is_active: true,
      sort_order: 1,
    },
    {
      id: 'module-2',
      name: 'Chalets',
      slug: 'chalets',
      template_type: 'multi_day_booking',
      is_active: true,
      sort_order: 2,
    },
  ],
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');

  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string | symbol) => {
        if (typeof tag !== 'string' || tag === 'then' || tag === 'catch' || tag === 'finally') {
          return undefined;
        }

        const MotionComponent = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);

        return MotionComponent;
      },
    }
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      fullName: 'Alex Manager',
    },
  }),
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => siteSettingsMock,
}));

vi.mock('@/lib/socket', () => ({
  useSocket: () => ({
    socket: socketBundle.socket,
  }),
}));

vi.mock('@/lib/module-utils', () => ({
  getModuleIcon: () => {
    return ({ className }: { className?: string }) => <span className={className}>Icon</span>;
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import AdminDashboard from '../../src/app/admin/page';

const dashboardSeed = {
  todayOrders: 22,
  todayRevenue: 1780,
  todayBookings: 9,
  todayTickets: 0,
  recentOrders: [
    {
      id: 'ord-1',
      orderNumber: 'A-1001',
      customerName: 'Morgan White',
      itemCount: 3,
      totalAmount: 48,
      status: 'pending',
    },
  ],
  revenueByUnit: {
    lagoon: 980,
    chalets: 800,
  },
  trends: {
    orders: 12,
    revenue: 7,
    bookings: -4,
    tickets: 0,
  },
};

describe('Admin dashboard route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    socketBundle.socket.connected = true;
    socketBundle.socket.on.mockClear();
    socketBundle.socket.off.mockClear();
    socketBundle.socket.emit.mockClear();
    socketBundle.socket.once.mockClear();

    for (const key of Object.keys(socketBundle.handlers)) {
      delete socketBundle.handlers[key];
    }

    apiGetMock.mockResolvedValue({ data: { data: dashboardSeed } });
  });

  it('loads dashboard data, reacts to socket updates, and refreshes stats', async () => {
    const user = userEvent.setup();

    render(<AdminDashboard />);

    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByText(/Azure Bay Resort/i)).toBeInTheDocument();
    expect(screen.getByText('Morgan White')).toBeInTheDocument();

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/admin/dashboard');
    });

    expect(socketBundle.socket.emit).toHaveBeenCalledWith('request:online_users');

    await act(async () => {
      socketBundle.handlers['stats:online_users']?.({ count: 14 });
    });

    expect(screen.getByText('14')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(2);
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Dashboard refreshed');
  });

  it('shows an error toast when dashboard fetch fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('dashboard failed'));

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to load dashboard data');
    });

    expect(screen.getByText('No orders yet today')).toBeInTheDocument();
  });
});
