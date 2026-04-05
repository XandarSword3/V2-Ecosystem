import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastInfoMock = vi.hoisted(() => vi.fn());

const socketMock = vi.hoisted(() => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: {
    id: 'customer-1',
    fullName: 'Casey Customer',
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    info: toastInfoMock,
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock('@/lib/socket', () => ({
  useSocket: () => ({ socket: socketMock }),
}));

import CustomerPOSTemplate from '../../src/components/pos-templates/CustomerPOSTemplate';

const MODULE_ID = 'mod-pos-1';
const MODULE_SLUG = 'restaurant';

const categories = [
  { id: 'cat-food', name: 'Food' },
  { id: 'cat-drink', name: 'Drinks' },
];

const menuItems = [
  {
    id: 'item-burger',
    name: 'Burger',
    description: 'Beef burger',
    price: 12,
    category_id: 'cat-food',
    is_available: true,
    prep_time_minutes: 10,
    modifiers: [
      {
        id: 'mod-cheese',
        name: 'Extra Cheese',
        price_adjustment: 1,
        is_required: false,
      },
    ],
    variants: [
      {
        id: 'var-large',
        name: 'Large',
        price: 14,
      },
    ],
  },
  {
    id: 'item-cola',
    name: 'Cola',
    description: 'Sparkling drink',
    price: 3,
    category_id: 'cat-drink',
    is_available: true,
    prep_time_minutes: 1,
    modifiers: [],
    variants: [],
  },
  {
    id: 'item-soup-unavailable',
    name: 'Soup of the Day',
    description: 'Seasonal soup',
    price: 7,
    category_id: 'cat-food',
    is_available: false,
    prep_time_minutes: 6,
    modifiers: [],
    variants: [],
  },
];

interface OrderRequestPayload {
  items: Array<{
    unitPrice: number;
    quantity: number;
  }>;
}

function setupCustomerApi(options?: { activeOrders?: Array<Record<string, unknown>> }) {
  apiGetMock.mockImplementation((url: string) => {
    if (url === `/modules/${MODULE_SLUG}/categories`) {
      return Promise.resolve({ data: { data: categories } });
    }

    if (url === `/modules/${MODULE_SLUG}/menu`) {
      return Promise.resolve({ data: { data: menuItems } });
    }

    if (url === `/modules/${MODULE_SLUG}/orders/my`) {
      return Promise.resolve({ data: { data: options?.activeOrders || [] } });
    }

    if (url === '/loyalty/me') {
      return Promise.resolve({ data: { data: { points_balance: 250 } } });
    }

    return Promise.reject(new Error(`Unexpected GET: ${url}`));
  });

  apiPostMock.mockImplementation((url: string, payload?: unknown) => {
    if (url === '/coupons/validate') {
      return Promise.resolve({
        data: {
          success: true,
          valid: true,
          data: {
            discountAmount: 2,
          },
        },
      });
    }

    if (url === `/modules/${MODULE_SLUG}/orders`) {
      const orderPayload = payload as OrderRequestPayload;
      return Promise.resolve({
        data: {
          success: true,
          data: {
            id: 'order-new-1',
            order_number: 'R1001',
            status: 'pending',
            items: orderPayload.items,
            total_amount: orderPayload.items.reduce(
              (sum: number, item) => sum + item.unitPrice * item.quantity,
              0
            ),
            created_at: new Date().toISOString(),
          },
        },
      });
    }

    if (url === `/modules/${MODULE_SLUG}/assistance`) {
      return Promise.resolve({ data: { success: true } });
    }

    return Promise.resolve({ data: { success: true } });
  });
}

function openCartButton() {
  const cartIcon = screen.getByTestId('icon-shoppingcart');
  return cartIcon.closest('button') as HTMLButtonElement;
}

describe('CustomerPOSTemplate behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    toastInfoMock.mockReset();

    socketMock.emit.mockReset();
    socketMock.on.mockReset();
    socketMock.off.mockReset();

    authState.user = {
      id: 'customer-1',
      fullName: 'Casey Customer',
    };

    setupCustomerApi();
  });

  it('loads menu data, filters by category, and joins customer socket room', async () => {
    const user = userEvent.setup();

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Burger');
    expect(screen.getByText('Cola')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Drinks' }));

    expect(screen.queryByText('Burger')).not.toBeInTheDocument();
    expect(screen.getByText('Cola')).toBeInTheDocument();

    expect(socketMock.emit).toHaveBeenCalledWith('join:customer', 'customer-1');
    expect(socketMock.on).toHaveBeenCalledWith('order:status', expect.any(Function));
  });

  it('adds an item to cart and applies a coupon discount', async () => {
    const user = userEvent.setup();

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Burger');

    await user.click(screen.getByText('Burger'));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    await user.click(openCartButton());
    await screen.findByText('Your Cart');

    await user.type(screen.getByPlaceholderText('Coupon code'), 'SAVE2');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/coupons/validate', {
        code: 'SAVE2',
        subtotal: 12,
        moduleId: MODULE_ID,
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Coupon applied: $2.00 off');
    expect(screen.getByText('-$2.00')).toBeInTheDocument();
  });

  it('blocks tab checkout for dine-in when table number is missing', async () => {
    const user = userEvent.setup();

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Burger');

    await user.click(screen.getByText('Burger'));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    await user.click(openCartButton());
    await screen.findByText('Your Cart');

    await user.click(screen.getByRole('button', { name: /add to tab/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('Please enter your table number');
    expect(apiPostMock).not.toHaveBeenCalledWith(`/modules/${MODULE_SLUG}/orders`, expect.anything());
  });

  it('submits an order through the payment modal and shows it in active orders', async () => {
    const user = userEvent.setup();

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Burger');

    await user.type(screen.getByPlaceholderText('Table #'), '12');

    await user.click(screen.getByText('Burger'));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    await user.click(openCartButton());
    await screen.findByText('Your Cart');

    await user.click(screen.getByRole('button', { name: /pay now/i }));
    await user.click(screen.getByText('Credit/Debit Card'));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        `/modules/${MODULE_SLUG}/orders`,
        expect.objectContaining({
          moduleId: MODULE_ID,
          orderType: 'dine_in',
          tableNumber: '12',
          paymentMethod: 'card',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Order #R1001 placed successfully!');
    expect(screen.getByText('Active Orders (1)')).toBeInTheDocument();
    expect(screen.getByText('#R1001')).toBeInTheDocument();
  });

  it('supports item detail modal, search empty state, and unavailable item display', async () => {
    const user = userEvent.setup();

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Burger');
    expect(screen.getByText('Out of stock')).toBeInTheDocument();

    await user.click(screen.getByText('Burger'));
    const detailDialog = await screen.findByRole('dialog', { name: /burger details/i });
    expect(within(detailDialog).getByText('Size/Variant')).toBeInTheDocument();
    expect(within(detailDialog).getByText('Add-ons')).toBeInTheDocument();
    await user.click(within(detailDialog).getByRole('button', { name: /cancel/i }));

    await user.type(screen.getByPlaceholderText('Search menu...'), 'zzz-not-found');
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('handles invalid and failed coupon responses', async () => {
    const user = userEvent.setup();

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Burger');
    await user.click(screen.getByText('Burger'));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await user.click(openCartButton());

    apiPostMock.mockImplementationOnce((url: string) => {
      if (url === '/coupons/validate') {
        return Promise.resolve({
          data: {
            success: false,
            valid: false,
            error: 'Bad code',
          },
        });
      }
      return Promise.resolve({ data: { success: true } });
    });

    await user.type(screen.getByPlaceholderText('Coupon code'), 'BAD');
    await user.click(screen.getByRole('button', { name: /apply/i }));
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Bad code');
    });

    apiPostMock.mockImplementationOnce((url: string) => {
      if (url === '/coupons/validate') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({ data: { success: true } });
    });

    await user.clear(screen.getByPlaceholderText('Coupon code'));
    await user.type(screen.getByPlaceholderText('Coupon code'), 'FAIL');
    await user.click(screen.getByRole('button', { name: /apply/i }));
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to apply coupon');
    });
  });

  it('updates cart quantities and removes line items when quantity reaches zero', async () => {
    const user = userEvent.setup();

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Burger');
    await user.click(screen.getByText('Burger'));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await user.click(openCartButton());

    const cartDialog = await screen.findByRole('dialog', { name: /shopping cart/i });

    await user.click((within(cartDialog).getAllByTestId('icon-plus')[0].closest('button')) as HTMLButtonElement);
    expect(within(cartDialog).getByText('2')).toBeInTheDocument();

    await user.click((within(cartDialog).getAllByTestId('icon-minus')[0].closest('button')) as HTMLButtonElement);
    expect(within(cartDialog).getByText('1')).toBeInTheDocument();

    await user.click((within(cartDialog).getAllByTestId('icon-minus')[0].closest('button')) as HTMLButtonElement);
    expect(within(cartDialog).getByText('Your cart is empty')).toBeInTheDocument();
  });

  it('submits tab order for takeaway without requiring table number', async () => {
    const user = userEvent.setup();

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Burger');
    await user.click(screen.getByRole('button', { name: /takeaway/i }));

    await user.click(screen.getByText('Burger'));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await user.click(openCartButton());
    await user.click(screen.getByRole('button', { name: /add to tab/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        `/modules/${MODULE_SLUG}/orders`,
        expect.objectContaining({
          orderType: 'takeaway',
          tableNumber: undefined,
          paymentMethod: 'tab',
        })
      );
    });
  });

  it('requests staff assistance and reports API failures', async () => {
    const user = userEvent.setup();

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Burger');
    await user.click((screen.getByTestId('icon-helpcircle').closest('button')) as HTMLButtonElement);
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        `/modules/${MODULE_SLUG}/assistance`,
        expect.objectContaining({
          type: 'help',
        })
      );
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Staff has been notified');

    apiPostMock.mockImplementationOnce((url: string) => {
      if (url === `/modules/${MODULE_SLUG}/assistance`) {
        return Promise.reject(new Error('help failed'));
      }
      return Promise.resolve({ data: { success: true } });
    });

    await user.click((screen.getByTestId('icon-helpcircle').closest('button')) as HTMLButtonElement);
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to request assistance');
    });
  });

  it('supports loyalty payment and reports order placement failures', async () => {
    const user = userEvent.setup();

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Burger');
    await user.type(screen.getByPlaceholderText('Table #'), '8');

    await user.click(screen.getByText('Burger'));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await user.click(openCartButton());
    await user.click(screen.getByRole('button', { name: /pay now/i }));
    await user.click(screen.getByRole('button', { name: /use 120 points/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        `/modules/${MODULE_SLUG}/orders`,
        expect.objectContaining({
          paymentMethod: 'loyalty',
          useLoyaltyPoints: 250,
        })
      );
    });

    apiPostMock.mockImplementationOnce((url: string) => {
      if (url === `/modules/${MODULE_SLUG}/orders`) {
        return Promise.reject({ response: { data: { error: 'Gateway down' } } });
      }
      return Promise.resolve({ data: { success: true } });
    });

    await user.click(screen.getByText('Burger'));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await user.click(openCartButton());
    await user.click(screen.getByRole('button', { name: /pay now/i }));
    await user.click(screen.getByText('Credit/Debit Card'));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Gateway down');
    });
  });

  it('reacts to socket order status updates and unsubscribes on unmount', async () => {
    setupCustomerApi({
      activeOrders: [
        {
          id: 'active-order-1',
          order_number: 'R500',
          status: 'preparing',
          items: [],
          total_amount: 33,
          created_at: new Date().toISOString(),
        },
      ],
    });

    const { unmount } = render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Active Orders (1)');
    expect(screen.getByText('#R500')).toBeInTheDocument();

    const orderStatusHandler = socketMock.on.mock.calls.find(call => call[0] === 'order:status')?.[1] as
      | ((update: { orderId: string; status: string }) => void)
      | undefined;

    expect(orderStatusHandler).toBeDefined();

    act(() => {
      orderStatusHandler?.({ orderId: 'active-order-1', status: 'ready' });
    });

    await waitFor(() => {
      expect(toastInfoMock).toHaveBeenCalledWith('Order status: ready');
      expect(screen.getByText('ready')).toBeInTheDocument();
    });

    unmount();
    expect(socketMock.off).toHaveBeenCalledWith('order:status', expect.any(Function));
  });

  it('shows menu load error when initial fetch fails', async () => {
    const originalGet = apiGetMock.getMockImplementation();
    apiGetMock.mockImplementation((url: string, config?: unknown) => {
      if (url === `/modules/${MODULE_SLUG}/categories`) {
        return Promise.reject(new Error('categories failed'));
      }
      if (!originalGet) {
        return Promise.reject(new Error('missing get implementation'));
      }
      return originalGet(url, config as never);
    });

    render(
      <CustomerPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant Menu" />
    );

    await screen.findByText('Restaurant Menu');
    expect(toastErrorMock).toHaveBeenCalledWith('Failed to load menu');
  });
});
