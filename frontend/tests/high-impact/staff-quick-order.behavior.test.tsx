import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffPOSTemplate from '../../src/components/pos-templates/StaffPOSTemplate';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPatchMock = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'staff-1', fullName: 'Sarah Staff', role: 'staff' },
  }),
}));

vi.mock('@/lib/authorization', () => ({
  useAuthorization: () => ({
    hasPermission: () => true,
    propertyId: 'prop-1',
  }),
  Perm: {
    ORDER_UPDATE: 'order:update',
    PAYMENT_SETTLE: 'payment:settle',
  },
}));

vi.mock('@/lib/socket', () => ({
  useSocket: () => ({
    socket: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

const mockPricingResult = {
  currency: 'USD',
  subtotal: 35.0,
  taxAmount: 3.5,
  totalDiscount: 5.0,
  totalAmount: 33.5,
  lineItems: [],
};

let mockPricingLoading = false;

vi.mock('@/hooks/usePricingPreview', () => ({
  usePricingPreview: vi.fn((options: any) => ({
    pricing: options.enabled && options.items?.length > 0 ? mockPricingResult : null,
    isLoading: mockPricingLoading,
    isStale: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

const MODULE_ID = 'mod-quick-1';
const MODULE_SLUG = 'bistro';

const sampleCategories = [
  { id: 'cat-1', name: 'Burgers' },
  { id: 'cat-2', name: 'Drinks' },
];

const sampleMenuItems = [
  {
    id: 'item-burger',
    categoryId: 'cat-1',
    name: 'Artisan Burger',
    price: 15.0,
    customizations: [
      {
        groupId: 'grp-cheese',
        displayName: 'Cheese Choice',
        selectionMode: 'single',
        isRequired: true,
        options: [
          { id: 'opt-cheddar', name: 'Aged Cheddar', priceAdjustment: 2.0 },
          { id: 'opt-swiss', name: 'Swiss Cheese', priceAdjustment: 2.5 },
        ],
      },
    ],
  },
  {
    id: 'item-fries',
    categoryId: 'cat-1',
    name: 'Truffle Fries',
    price: 8.0,
  },
  {
    id: 'item-shake',
    categoryId: 'cat-2',
    name: 'Vanilla Milkshake',
    price: 6.0,
  },
];

const sampleCustomers = [
  {
    id: 'cust-101',
    fullName: 'Alice Walker',
    email: 'alice@example.com',
    phone: '+1555123456',
    loyaltyPoints: 120,
    tierName: 'Gold Member',
  },
];

const activeShift = {
  id: 'shift-1',
  startTime: new Date().toISOString(),
  openingCash: 200,
  status: 'active',
};

function setupMocks() {
  apiGetMock.mockImplementation((url: string, config?: any) => {
    if (url === `/staff/modules/${MODULE_SLUG}/tables`) {
      return Promise.resolve({
        data: {
          data: [
            { id: 'tbl-1', name: 'Table 1', capacity: 4, isOccupied: false },
            { id: 'tbl-2', name: 'Table 2', capacity: 2, isOccupied: false },
          ],
        },
      });
    }
    if (url === `/staff/modules/${MODULE_SLUG}/orders`) {
      return Promise.resolve({ data: { data: [] } });
    }
    if (url === '/staff/shifts/me/current') {
      return Promise.resolve({ data: { data: activeShift } });
    }
    if (url === `/staff/shifts/${activeShift.id}/cash`) {
      return Promise.resolve({ data: { success: true, totals: { cashIn: 0, cashOut: 0, net: 0 } } });
    }
    if (url === `/staff/modules/${MODULE_SLUG}/menu`) {
      return Promise.resolve({
        data: {
          data: {
            categories: sampleCategories,
            items: sampleMenuItems,
          },
        },
      });
    }
    if (url === '/staff/customers/search') {
      return Promise.resolve({ data: { success: true, data: sampleCustomers } });
    }
    return Promise.reject(new Error(`Unhandled GET: ${url}`));
  });

  apiPostMock.mockImplementation((url: string, body?: any) => {
    if (url === `/staff/modules/${MODULE_SLUG}/orders`) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            id: 'ord-new-77',
            orderNumber: 'ORD-7788',
            status: 'confirmed',
            fulfillmentStatus: 'queued',
            totalAmount: 33.5,
            customerName: body?.customerName || 'Walk-in',
            createdAt: new Date().toISOString(),
          },
        },
      });
    }
    if (url.includes('/pay')) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            id: 'ord-new-77',
            status: 'completed',
            paymentStatus: 'paid',
          },
        },
      });
    }
    if (url.includes('/print')) {
      return Promise.resolve({ data: { success: true } });
    }
    return Promise.resolve({ data: { success: true } });
  });
}

describe('Phase F9 — Staff Quick Order / Assisted Commerce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders Quick Order menu categories and items', async () => {
    const user = userEvent.setup();
    render(
      <StaffPOSTemplate
        moduleId={MODULE_ID}
        moduleSlug={MODULE_SLUG}
        moduleName="Bistro POS"
      />
    );

    await screen.findByText('Bistro POS');

    // Switch to Quick Order view
    await user.click(screen.getByRole('button', { name: /quick order/i }));

    // Verify categories & menu items appear
    await screen.findByText('Burgers');
    expect(screen.getByText('Drinks')).toBeInTheDocument();
    expect(screen.getByText('Artisan Burger')).toBeInTheDocument();
    expect(screen.getByText('Truffle Fries')).toBeInTheDocument();
    expect(screen.getByText('Vanilla Milkshake')).toBeInTheDocument();
  });

  it('configures modifiers before adding customizable item to cart', async () => {
    const user = userEvent.setup();
    render(
      <StaffPOSTemplate
        moduleId={MODULE_ID}
        moduleSlug={MODULE_SLUG}
        moduleName="Bistro POS"
      />
    );

    await screen.findByText('Bistro POS');
    await user.click(screen.getByRole('button', { name: /quick order/i }));

    // Click Artisan Burger which has required customizations
    await user.click(screen.getByText('Artisan Burger'));

    // Modal opens
    await screen.findByText('Cheese Choice');
    expect(screen.getByText('Aged Cheddar')).toBeInTheDocument();

    // Select Cheddar
    await user.click(screen.getByText('Aged Cheddar'));

    // Confirm and add to order
    await user.click(screen.getByRole('button', { name: /add to order/i }));

    // Verify item is now in the Quick Order cart with modifier badge
    await screen.findByText('Current Order');
    const burgerMatches = screen.getAllByText('Artisan Burger');
    expect(burgerMatches.length).toBeGreaterThanOrEqual(2); // In menu and in cart
    expect(screen.getByText(/Cheese Choice: Aged Cheddar/i)).toBeInTheDocument();
  });

  it('searches for known customer, associates profile and displays loyalty points', async () => {
    const user = userEvent.setup();
    render(
      <StaffPOSTemplate
        moduleId={MODULE_ID}
        moduleSlug={MODULE_SLUG}
        moduleName="Bistro POS"
      />
    );

    await screen.findByText('Bistro POS');
    await user.click(screen.getByRole('button', { name: /quick order/i }));

    // Search for customer
    const searchInput = screen.getByPlaceholderText(/search customer/i);
    await user.type(searchInput, 'Alice');

    // Dropdown shows Alice Walker
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/staff/customers/search', {
        params: { q: 'Alice', query: 'Alice', type: 'all' },
      });
    });

    const customerOption = await screen.findByText('Alice Walker');
    await user.click(customerOption);

    // Profile card displays Alice Walker, email and loyalty points
    await screen.findByText('Gold Member');
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText(/120 points available/i)).toBeInTheDocument();

    // Loyalty points redemption slider appears
    expect(screen.getByText(/Redeem Points/i)).toBeInTheDocument();
  });

  it('integrates canonical server-authoritative pricing and settles payment with cash change calculation', async () => {
    const user = userEvent.setup();
    render(
      <StaffPOSTemplate
        moduleId={MODULE_ID}
        moduleSlug={MODULE_SLUG}
        moduleName="Bistro POS"
      />
    );

    await screen.findByText('Bistro POS');
    await user.click(screen.getByRole('button', { name: /quick order/i }));

    // Add plain Truffle Fries to cart
    await user.click(screen.getByText('Truffle Fries'));

    // Verify server-calculated breakdown is displayed
    await screen.findByText('Subtotal');
    expect(screen.getByText('Taxes')).toBeInTheDocument();
    expect(screen.getByText('Discount')).toBeInTheDocument();

    // Checkout & Settle
    const checkoutBtn = screen.getByRole('button', { name: /checkout & settle/i });
    await user.click(checkoutBtn);

    // Verify order was created with backend
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        `/staff/modules/${MODULE_SLUG}/orders`,
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ catalogItemId: 'item-fries', quantity: 1 }),
          ]),
        })
      );
    });

    // Payment modal opens
    await screen.findByText('Process Payment');

    // Select Cash method inside the payment modal
    const cashBtn = screen.getByText('Cash').closest('button')!;
    await user.click(cashBtn);

    // Enter cash tendered: $50
    const cashInput = screen.getByPlaceholderText('0.00');
    await user.type(cashInput, '50');

    // Change Due should be calculated: $50 - $33.50 = $16.50
    await screen.findByText('Change Due:');
    expect(screen.getByText('$16.50')).toBeInTheDocument();

    // Confirm Settle
    await user.click(screen.getByRole('button', { name: /confirm settle/i }));

    // Verify payment API call
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        expect.stringContaining('/pay'),
        expect.objectContaining({
          paymentMethod: 'cash',
          amount: 33.5,
        })
      );
    });

    // Itemized Receipt Modal appears
    await screen.findByText('Payment Successful');
    expect(screen.getByText(/Order #ORD-7788/i)).toBeInTheDocument();
    expect(screen.getByText(/Amount Paid/i)).toBeInTheDocument();
    expect(screen.getByText('Change: $16.50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print receipt/i })).toBeInTheDocument();

    // Close receipt modal
    await user.click(screen.getByRole('button', { name: /new order/i }));
    expect(screen.queryByText('Payment Successful')).not.toBeInTheDocument();
  });
});
