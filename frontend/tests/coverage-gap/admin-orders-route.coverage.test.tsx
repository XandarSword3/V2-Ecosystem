import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
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
    post: apiPostMock,
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
    activeProperty: { id: 'prop-1', name: 'Test Property', type: 'property' },
    properties: [],
    setActiveProperty: vi.fn(),
    loading: false,
    refreshProperties: vi.fn(),
  }),
  PropertyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Real useAuthorization consumes useAuth() — mock the auth source so the page
// resolves roles/permissions through the actual authorization layer.
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-tenant-admin',
      email: 'tenant.admin@v2ecosystem.test',
      scope: 'tenant_admin',
      roles: ['tenant_admin'],
      permissions: [],
    },
    isAuthenticated: true,
    isLoading: false,
    permissionsStatus: 'unavailable',
  }),
}));

import AdminOrdersPage from '../../src/app/[property]/admin/orders/page';

describe('Admin orders route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPutMock.mockReset();
    apiPostMock.mockReset();
    socketOnMock.mockClear();
    socketOffMock.mockClear();
    toastSuccessMock.mockReset();
    socketEventHandlers.clear();

    apiGetMock.mockImplementation((url: string) => {
      // Unified cross-engine endpoint (F11): the page no longer queries
      // /admin/modules or /staff/modules/{slug}/orders.
      if (url === '/admin/transactions') {
        return Promise.resolve({
          data: {
            data: {
              modules: [
                { slug: 'lagoon', name: 'Lagoon' },
                { slug: 'kiosk', name: 'Kiosk' },
              ],
              transactions: [
                {
                  id: 'rest-1',
                  engineType: 'menu_service',
                  module: { slug: 'lagoon', name: 'Lagoon' },
                  transactionState: 'pending',
                  fulfillmentStatus: null,
                  amount: 28,
                  customerName: 'Alice',
                  reference: 'R-001',
                  createdAt: '2025-01-01T10:00:00.000Z',
                  updatedAt: '2025-01-01T10:00:00.000Z',
                },
                {
                  id: 'kiosk-1',
                  engineType: 'menu_service',
                  module: { slug: 'kiosk', name: 'Kiosk' },
                  transactionState: 'ready',
                  fulfillmentStatus: null,
                  amount: 12,
                  customerName: 'Bob',
                  reference: 'S-010',
                  createdAt: '2025-01-01T09:00:00.000Z',
                  updatedAt: '2025-01-01T09:00:00.000Z',
                },
              ],
            },
          },
        });
      }

      return Promise.resolve({ data: { data: { transactions: [], modules: [] } } });
    });

    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiPostMock.mockResolvedValue({ data: { success: true } });
  });

  it('renders orders, filters, updates status, and opens detail modal', async () => {
    const user = userEvent.setup();

    render(<AdminOrdersPage />);

    expect(await screen.findByText('Orders')).toBeInTheDocument();
    expect(await screen.findByText('#R-001')).toBeInTheDocument();
    expect(screen.getByText('#S-010')).toBeInTheDocument();

    // Both seeded transactions are pending at the transaction layer, so each
    // card renders a Confirm action — click the first card's (rest-1).
    await user.click(screen.getAllByRole('button', { name: /Confirm/i })[0]);

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

    const viewButtons = screen.getAllByRole('button', { name: /view order/i });
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

  it('allows single-click void/cancel of active orders from card and modal', async () => {
    const user = userEvent.setup();

    render(<AdminOrdersPage />);

    expect(await screen.findByText('#R-001')).toBeInTheDocument();

    // Find and click the void button on the first card
    const voidButtons = screen.getAllByRole('button', { name: /void order/i });
    expect(voidButtons.length).toBeGreaterThan(0);
    await user.click(voidButtons[0]);

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/staff/modules/lagoon/orders/rest-1/status', {
        status: 'cancelled',
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Order voided / cancelled');

    // Open detail modal for second order and void from inside modal
    const viewButtons = screen.getAllByRole('button', { name: /view order/i });
    await user.click(viewButtons[1]);

    const modalVoidButton = await screen.findByRole('button', { name: /void \/ cancel order/i });
    expect(modalVoidButton).toBeInTheDocument();
    await user.click(modalVoidButton);

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/staff/modules/kiosk/orders/kiosk-1/status', {
        status: 'cancelled',
      });
    });
  });

  it('allows refunding an order payment from the detail modal', async () => {
    const user = userEvent.setup();

    render(<AdminOrdersPage />);

    expect(await screen.findByText('#R-001')).toBeInTheDocument();

    // First confirm order rest-1
    await user.click(screen.getAllByRole('button', { name: /Confirm/i })[0]);

    // Open detail modal for order rest-1 (now confirmed)
    const viewButtons = screen.getAllByRole('button', { name: /view order/i });
    await user.click(viewButtons[0]);

    const refundButton = await screen.findByRole('button', { name: /refund payment/i });
    expect(refundButton).toBeInTheDocument();
    await user.click(refundButton);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/payments/transactions/rest-1/refund', {
        reason: 'Admin refund from orders dashboard',
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Refund processed successfully');
  });
});
