import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

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
    defaults: {
      baseURL: 'http://localhost:3005/api/v1',
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import InventoryAdminPage from '../../src/app/admin/inventory/page';

const itemsSeed = [
  {
    id: 'item-1',
    name: 'Tomatoes',
    sku: 'ING-TOM',
    category_id: 'cat-veg',
    category_name: 'Vegetables',
    category_color: '#0ea5e9',
    unit: 'kg',
    current_stock: 20,
    min_stock_level: 8,
    reorder_point: 10,
    stock_status: 'normal',
    is_active: true,
    cost_per_unit: 3,
  },
];

const categoriesSeed = [
  {
    id: 'cat-veg',
    name: 'Vegetables',
    color: '#0ea5e9',
    item_count: 1,
    total_stock: 20,
  },
];

const statsSeed = {
  total_items: 1,
  out_of_stock: 0,
  low_stock: 0,
  overstock: 0,
  total_value: 60,
  unresolvedAlerts: 1,
};

const alertsSeed = [
  {
    id: 'alert-1',
    item_id: 'item-1',
    item_name: 'Tomatoes',
    sku: 'ING-TOM',
    alert_type: 'low_stock',
    message: 'Stock is below reorder point',
    priority: 'high',
    current_stock: 6,
    is_resolved: false,
    created_at: '2026-06-03T10:00:00.000Z',
  },
];

const transactionsSeed = [
  {
    id: 'txn-1',
    item_id: 'item-1',
    item_name: 'Tomatoes',
    sku: 'ING-TOM',
    type: 'in',
    quantity: 4,
    previous_stock: 16,
    new_stock: 20,
    reference_type: 'manual',
    performed_by_name: 'Admin',
    created_at: '2026-06-03T11:00:00.000Z',
  },
];

describe('Admin inventory route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/inventory/items') {
        return Promise.resolve({ data: { success: true, data: itemsSeed } });
      }
      if (url === '/inventory/categories') {
        return Promise.resolve({ data: { success: true, data: categoriesSeed } });
      }
      if (url === '/inventory/stats') {
        return Promise.resolve({ data: { success: true, data: { summary: statsSeed } } });
      }
      if (url === '/inventory/alerts') {
        return Promise.resolve({ data: { success: true, data: alertsSeed } });
      }
      if (url === '/inventory/transactions') {
        return Promise.resolve({ data: { success: true, data: transactionsSeed } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads inventory, records a transaction, and resolves an alert', async () => {
    const user = userEvent.setup();

    render(<InventoryAdminPage />);

    expect(await screen.findByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Tomatoes')).toBeInTheDocument();

    await user.click(screen.getByTitle('Record Transaction'));
    await user.type(await screen.findByPlaceholderText('Enter quantity'), '5');
    await user.click(screen.getByRole('button', { name: /^Record Transaction$/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/inventory/transactions',
        expect.objectContaining({
          itemId: 'item-1',
          type: 'in',
          quantity: 5,
          referenceType: 'manual',
        })
      );
    });

    await user.click(screen.getByRole('tab', { name: /alerts/i }));
    await user.click(await screen.findByRole('button', { name: /Resolve$/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/inventory/alerts/alert-1/resolve');
    });
  });

  it('shows an error when creating an item without required fields', async () => {
    const user = userEvent.setup();

    render(<InventoryAdminPage />);

    await screen.findByText('Inventory');

    await user.click(screen.getAllByRole('button', { name: /Add Item/i })[0]);
    expect(await screen.findByText('Add Inventory Item')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Add Item/i })[1]);

    expect(toastErrorMock).toHaveBeenCalledWith('Please fill in required fields');
  });
});
