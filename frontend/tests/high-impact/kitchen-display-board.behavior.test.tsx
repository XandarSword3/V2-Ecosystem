import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastInfoMock = vi.hoisted(() => vi.fn());

const audioPlayMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
class AudioMockClass {
  volume = 0;
  currentTime = 0;
  play = audioPlayMock;

  constructor(_src?: string) {}
}

const socketHandlers = vi.hoisted(() => ({} as Record<string, ((payload: any) => void) | undefined>));
const socketMock = vi.hoisted(() => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ socket: socketMock }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    info: toastInfoMock,
  },
}));

import { KitchenDisplayBoard } from '../../src/components/KitchenDisplayBoard';

function buildOrders() {
  const createdAt = new Date('2026-01-10T10:00:00.000Z').toISOString();

  return [
    {
      id: 'order-pending',
      orderNumber: '101',
      tableNumber: 1,
      tableName: 'A1',
      serverName: 'Nina',
      items: [
        {
          id: 'item-1',
          name: 'Burger',
          quantity: 1,
          modifications: ['No onion'],
          status: 'PENDING',
        },
      ],
      priority: 'NORMAL',
      status: 'PENDING',
      createdAt,
      estimatedTime: 20,
    },
    {
      id: 'order-inprogress',
      orderNumber: '102',
      tableNumber: 2,
      tableName: 'A2',
      serverName: 'Omar',
      items: [
        {
          id: 'item-2',
          name: 'Pasta',
          quantity: 1,
          modifications: [],
          status: 'READY',
        },
      ],
      priority: 'RUSH',
      status: 'IN_PROGRESS',
      createdAt,
      estimatedTime: 15,
      notes: 'No peanuts',
    },
    {
      id: 'order-ready',
      orderNumber: '103',
      tableNumber: 3,
      tableName: 'A3',
      serverName: 'Lara',
      items: [
        {
          id: 'item-3',
          name: 'Soup',
          quantity: 1,
          modifications: [],
          status: 'READY',
        },
      ],
      priority: 'VIP',
      status: 'READY',
      createdAt,
      estimatedTime: 10,
    },
  ];
}

describe('KitchenDisplayBoard behavior', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'Audio', {
      writable: true,
      value: AudioMockClass,
    });

    for (const key of Object.keys(socketHandlers)) {
      delete socketHandlers[key];
    }

    socketMock.emit.mockReset();
    socketMock.on.mockReset();
    socketMock.off.mockReset();

    socketMock.on.mockImplementation((event: string, handler: (payload: any) => void) => {
      socketHandlers[event] = handler;
    });

    socketMock.off.mockImplementation((event: string) => {
      delete socketHandlers[event];
    });

    apiGetMock.mockReset();
    apiPostMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    toastInfoMock.mockReset();
    audioPlayMock.mockClear();
    audioPlayMock.mockResolvedValue(undefined);

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/orders/kitchen') {
        return Promise.resolve({ data: { data: buildOrders() } });
      }

      if (url === '/orders/kitchen/stats') {
        return Promise.resolve({
          data: {
            data: {
              pendingOrders: 1,
              inProgressOrders: 1,
              averageWaitTime: 12,
              completedToday: 7,
              rushOrders: 1,
            },
          },
        });
      }

      return Promise.resolve({ data: { data: null } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads orders/stats, joins kitchen socket room, and supports control actions', async () => {
    const user = userEvent.setup();

    render(<KitchenDisplayBoard />);

    expect(await screen.findByText('Kitchen Display')).toBeInTheDocument();

    expect(socketMock.emit).toHaveBeenCalledWith('join:kitchen');
    expect(screen.getByText('Avg Wait: 12 min')).toBeInTheDocument();
    expect(screen.getByText('Today: 7')).toBeInTheDocument();
    expect(screen.getByText('1 Rush')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mute sound' }));
    expect(screen.getByRole('button', { name: 'Enable sound' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Refresh orders' }));

    await waitFor(() => {
      const orderFetchCalls = apiGetMock.mock.calls.filter((call) => call[0] === '/orders/kitchen');
      expect(orderFetchCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('starts pending orders and confirms bump for completed in-progress orders', async () => {
    const user = userEvent.setup();

    render(<KitchenDisplayBoard />);

    expect(await screen.findByText('Kitchen Display')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Start Cooking/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/orders/kitchen/order-pending/start');
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Order started');

    await user.click(screen.getByText(/^Bump$/i));
    expect(await screen.findByText('Bump Order #102')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Optional notes for server...'), 'Ready at pass');
    await user.click(screen.getByRole('button', { name: /Bump Order/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/orders/kitchen/order-inprogress/ready', {
        notes: 'Ready at pass',
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Order ready for pickup!');
  });

  it('handles incoming socket orders and unregisters listeners on unmount', async () => {
    const { unmount } = render(<KitchenDisplayBoard />);

    expect(await screen.findByText('Kitchen Display')).toBeInTheDocument();

    await waitFor(() => {
      expect(typeof socketHandlers['kitchen:new-order']).toBe('function');
    });

    const newOrder = {
      id: 'order-socket',
      orderNumber: '201',
      tableNumber: 9,
      tableName: 'B9',
      serverName: 'Tala',
      items: [
        {
          id: 'item-new',
          name: 'Steak',
          quantity: 1,
          modifications: [],
          status: 'PENDING',
        },
      ],
      priority: 'RUSH',
      status: 'PENDING',
      createdAt: new Date('2026-01-10T11:00:00.000Z').toISOString(),
      estimatedTime: 20,
    };

    await act(async () => {
      socketHandlers['kitchen:new-order']?.(newOrder);
    });

    expect(screen.getByText('Table 9')).toBeInTheDocument();
    expect(toastInfoMock).toHaveBeenCalledWith('New order from Table 9', { duration: 5000 });
    expect(audioPlayMock).toHaveBeenCalled();

    unmount();

    expect(socketMock.off).toHaveBeenCalledWith('kitchen:new-order', expect.any(Function));
    expect(socketMock.off).toHaveBeenCalledWith('kitchen:order-updated', expect.any(Function));
    expect(socketMock.off).toHaveBeenCalledWith('kitchen:order-cancelled', expect.any(Function));
  });
});
