import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const socketOnMock = vi.hoisted(() => vi.fn());
const socketOffMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

const socketEventHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => void>());

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

vi.mock('@/lib/socket', () => {
  const socket = {
    on: socketOnMock.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      socketEventHandlers.set(event, handler);
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
    success: toastSuccessMock,
    error: vi.fn(),
  },
}));

vi.mock('@/context/PropertyContext', () => ({
  useProperty: () => ({
    activePropertyId: 'prop-1',
    activeProperty: { id: 'prop-1', name: 'Test Property', type: 'resort' },
    properties: [],
    setActiveProperty: vi.fn(),
    loading: false,
    refreshProperties: vi.fn(),
  }),
  PropertyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import AdminOrdersPage from '../../src/app/admin/orders/page';

describe('Admin orders route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPutMock.mockReset();
    socketOnMock.mockClear();
    socketOffMock.mockClear();
    toastSuccessMock.mockReset();
    socketEventHandlers.clear();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/admin/modules') {
        return Promise.resolve({
          data: {
            data: [
              { id: 'mod-1', slug: 'lagoon', name: 'Lagoon', template_type: 'menu_service', is_active: true },
              { id: 'mod-2', slug: 'kiosk', name: 'Kiosk', template_type: 'menu_service', is_active: true },
            ],
          },
        });
      }

      if (url === '/staff/modules/lagoon/orders') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'rest-1',
                order_number: 'R-001',
                status: 'pending',
                total_amount: 28,
                items: [
                  { id: 'i1', name: 'Burger', quantity: 2, unit_price: 10 },
                  { id: 'i2', name: 'Fries', quantity: 1, unit_price: 8 },
                ],
                table_number: 'T5',
                customer_name: 'Alice',
                customer_notes: 'No onions',
                created_at: '2025-01-01T10:00:00.000Z',
                updated_at: '2025-01-01T10:00:00.000Z',
              },
            ],
          },
        });
      }

      if (url === '/staff/modules/kiosk/orders') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'kiosk-1',
                order_number: 'S-010',
                status: 'ready',
                total_amount: 12,
                items: [{ id: 'i3', name: 'Cookie Box', quantity: 1, unit_price: 12 }],
                customer_name: 'Bob',
                created_at: '2025-01-01T09:00:00.000Z',
                updated_at: '2025-01-01T09:00:00.000Z',
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { data: [] } });
    });

    apiPutMock.mockResolvedValue({ data: { success: true } });
  });

  it('renders orders, filters, updates status, and opens detail modal', async () => {
    const user = userEvent.setup();

    render(<AdminOrdersPage />);

    expect(await screen.findByText('Orders')).toBeInTheDocument();
    expect(await screen.findByText('#R-001')).toBeInTheDocument();
    expect(screen.getByText('#S-010')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/staff/modules/lagoon/orders/rest-1/status', {
        status: 'confirmed',
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Order status updated');

    await user.type(screen.getByPlaceholderText(/Search by order ID/i), 'bob');
    expect(screen.getByText('#S-010')).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'kiosk');
    await user.selectOptions(selects[1], 'ready');

    expect(screen.getByText('#S-010')).toBeInTheDocument();

    const viewButtons = screen.getAllByRole('button', { name: /Eye/i });
    expect(viewButtons.length).toBeGreaterThan(0);
    await user.click(viewButtons[0]);

    expect(await screen.findByText('Order #S-010')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '×' }));

    await waitFor(() => {
      expect(screen.queryByText('Order #S-010')).not.toBeInTheDocument();
    });
  });

  it('applies socket updates for new and changed orders', async () => {
    render(<AdminOrdersPage />);

    expect(await screen.findByText('#R-001')).toBeInTheDocument();

    act(() => {
      socketEventHandlers.get('order:new')?.({
        id: 'rest-2',
        order_number: 'R-002',
        source: 'menu_service',
        status: 'pending',
        total_amount: 20,
        items: [{ id: 'i4', name: 'Pasta', quantity: 1, unit_price: 20 }],
        created_at: '2025-01-01T11:00:00.000Z',
        updated_at: '2025-01-01T11:00:00.000Z',
      });
    });

    expect(await screen.findByText('#R-002')).toBeInTheDocument();

    act(() => {
      socketEventHandlers.get('order:statusChanged')?.({ orderId: 'kiosk-1', status: 'completed' });
    });

    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });
});
