import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const socketOnMock = vi.hoisted(() => vi.fn());
const socketOffMock = vi.hoisted(() => vi.fn());

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
    post: apiPostMock,
    put: apiPutMock,
    delete: apiDeleteMock,
  },
}));

vi.mock('@/lib/socket', () => ({
  useSocket: () => ({
    socket: {
      on: socketOnMock,
      off: socketOffMock,
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import AdminNotificationsPage from '../../src/app/[property]/admin/settings/notifications/page';

const notificationSeed = [
  {
    id: 'notif-1',
    title: 'System Update',
    message: 'Kitchen display was updated.',
    type: 'info',
    priority: 'normal',
    target_type: 'all',
    is_read: false,
    actions: [],
    created_at: '2026-06-02T10:00:00.000Z',
  },
];

const broadcastSeed = [
  {
    id: 'br-1',
    title: 'Pool Closed',
    message: 'Pool area closes at 8PM today.',
    type: 'warning',
    priority: 'high',
    target_type: 'customer',
    is_read: true,
    actions: [],
    scheduled_for: '2026-06-03T09:00:00.000Z',
    created_at: '2026-06-02T11:00:00.000Z',
  },
];

const templateSeed = [
  {
    id: 'tpl-1',
    name: 'Welcome Campaign',
    title: 'Welcome back',
    message: 'Your next booking gets 10% off.',
    type: 'success',
    target_type: 'customer',
    priority: 'normal',
    actions: [{ label: 'Book now', url: '/book', style: 'primary' }],
    variables: ['name'],
    is_active: true,
    created_at: '2026-06-01T08:00:00.000Z',
    updated_at: '2026-06-01T08:00:00.000Z',
  },
];

describe('Admin notifications route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    socketOnMock.mockReset();
    socketOffMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/admin/notifications') {
        return Promise.resolve({ data: { data: notificationSeed } });
      }
      if (url === '/admin/notifications/broadcasts') {
        return Promise.resolve({ data: { data: broadcastSeed } });
      }
      if (url === '/admin/notifications/templates') {
        return Promise.resolve({ data: { data: templateSeed } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads data, applies template to composer, and sends a broadcast', async () => {
    const user = userEvent.setup();

    render(<AdminNotificationsPage />);

    expect(await screen.findByText('Manage notifications, templates, and broadcasts')).toBeInTheDocument();
    expect(screen.getByText('System Update')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /templates \(1\)/i }));
    await user.click(screen.getByRole('button', { name: /Use$/i }));

    expect(await screen.findByDisplayValue('Welcome back')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Your next booking gets 10% off.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /send now/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/admin/notifications/broadcast',
        expect.objectContaining({
          title: 'Welcome back',
          message: 'Your next booking gets 10% off.',
          target_type: 'customer',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('notifications.sent');
  });

  it('shows validation error when required send fields are missing', async () => {
    const user = userEvent.setup();

    render(<AdminNotificationsPage />);

    await screen.findByText('Manage notifications, templates, and broadcasts');

    await user.click(screen.getByRole('button', { name: /notifications\.sendNotification/i }));
    await user.click(screen.getByRole('button', { name: /send now/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('errors.required');
  });
});
