import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ioMock = vi.hoisted(() => vi.fn());
const socketEmitMock = vi.hoisted(() => vi.fn());
const socketOnMock = vi.hoisted(() => vi.fn());
const socketOffMock = vi.hoisted(() => vi.fn());
const socketDisconnectMock = vi.hoisted(() => vi.fn());

const socketHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => void>());

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

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { fallback?: string }) => values?.fallback || key,
}));

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

import LiveUsersPage from '../../src/app/admin/users/live/page';

function createSocketMock() {
  const socket = {
    on: socketOnMock.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      socketHandlers.set(event, handler);
      return socket;
    }),
    off: socketOffMock,
    emit: socketEmitMock,
    disconnect: socketDisconnectMock,
  };

  return socket;
}

describe('Admin live users route coverage', () => {
  beforeEach(() => {
    ioMock.mockReset();
    socketOnMock.mockClear();
    socketOffMock.mockClear();
    socketEmitMock.mockClear();
    socketDisconnectMock.mockClear();
    socketHandlers.clear();

    localStorage.clear();
    localStorage.setItem('accessToken', 'token-123');

    ioMock.mockReturnValue(createSocketMock());
  });

  it('connects admin socket, renders user stats, and handles refresh controls', async () => {
    const user = userEvent.setup();

    render(<LiveUsersPage />);

    expect(await screen.findByText('Live Users Monitor')).toBeInTheDocument();

    await waitFor(() => {
      expect(ioMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin'),
        expect.objectContaining({ auth: { token: 'token-123' } })
      );
    });

    act(() => {
      socketHandlers.get('connect')?.();
    });

    await waitFor(() => {
      expect(socketEmitMock).toHaveBeenCalledWith('request:online_users_detailed');
    });

    act(() => {
      socketHandlers.get('stats:online_users_detailed')?.({
        users: [
          {
            socketId: 'sock-1',
            userId: 'user-1',
            email: 'admin@example.com',
            fullName: 'Admin User',
            roles: ['admin'],
            currentPage: '/admin/orders',
            connectedAt: '2025-01-03T09:00:00.000Z',
            lastActivity: new Date().toISOString(),
            userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36',
          },
          {
            socketId: 'sock-2',
            roles: [],
            currentPage: '/restaurant',
            connectedAt: '2025-01-03T09:10:00.000Z',
            lastActivity: new Date().toISOString(),
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile',
          },
        ],
        count: 2,
      });
    });

    expect(await screen.findByText('Active Connections')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getAllByText('Guest').length).toBeGreaterThan(0);
    expect(screen.getByText('Admin')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Auto-refresh ON/i }));
    expect(await screen.findByRole('button', { name: /Auto-refresh OFF/i })).toBeInTheDocument();

    const refreshButtons = screen.getAllByRole('button', { name: /refresh/i });
    await user.click(refreshButtons[refreshButtons.length - 1]);

    await waitFor(() => {
      expect(socketEmitMock).toHaveBeenCalledWith('request:online_users_detailed');
    });

    act(() => {
      socketHandlers.get('disconnect')?.();
    });

    await waitFor(() => {
      expect(screen.getByText(/Disconnected - trying to reconnect/i)).toBeInTheDocument();
    });
  });
});
