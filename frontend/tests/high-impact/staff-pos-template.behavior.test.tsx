import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPatchMock = vi.hoisted(() => vi.fn());

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
    id: 'staff-1',
    fullName: 'Alex Staff',
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
    patch: apiPatchMock,
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

import StaffPOSTemplate from '../../src/components/pos-templates/StaffPOSTemplate';

const MODULE_ID = 'mod-pos-1';
const MODULE_SLUG = 'menu_service';

const buildTables = () => [
  {
    id: 'table-1',
    number: 'T1',
    capacity: 4,
    status: 'occupied',
    currentOrder: {
      id: 'order-ready',
      orderNumber: '1001',
      tableNumber: 'T1',
      status: 'ready',
      items: [
        {
          id: 'item-1',
          name: 'Burger',
          quantity: 2,
          unitPrice: 12,
          status: 'ready',
        },
      ],
      totalAmount: 55,
      createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
      orderType: 'dine_in',
    },
  },
  {
    id: 'table-2',
    number: 'T2',
    capacity: 2,
    status: 'available',
  },
];

const buildOrders = () => [
  {
    id: 'order-pending',
    orderNumber: '1002',
    tableNumber: 'T2',
    status: 'pending',
    items: [
      {
        id: 'item-2',
        name: 'Pasta',
        quantity: 1,
        unitPrice: 25,
        status: 'pending',
      },
    ],
    totalAmount: 25,
    createdAt: new Date(Date.now() - 6 * 60000).toISOString(),
    orderType: 'dine_in',
  },
  {
    id: 'order-ready',
    orderNumber: '1001',
    tableNumber: 'T1',
    status: 'ready',
    items: [
      {
        id: 'item-1',
        name: 'Burger',
        quantity: 2,
        unitPrice: 12,
        status: 'ready',
      },
    ],
    totalAmount: 55,
    createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    orderType: 'dine_in',
  },
  {
    id: 'order-confirmed',
    orderNumber: '1003',
    tableNumber: 'T3',
    status: 'confirmed',
    items: [
      {
        id: 'item-3',
        name: 'Salad',
        quantity: 1,
        unitPrice: 15,
        status: 'confirmed',
      },
    ],
    totalAmount: 15,
    createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
    orderType: 'takeaway',
  },
];

const activeShift = {
  id: 'shift-1',
  startTime: new Date(Date.now() - 90 * 60000).toISOString(),
  openingCash: 120,
  status: 'active',
};

const buildKitchenHeavyOrders = () => [
  {
    id: 'order-pending',
    orderNumber: '1002',
    tableNumber: 'T2',
    status: 'pending',
    items: [{ id: 'item-2', name: 'Pasta', quantity: 1, unitPrice: 25, status: 'pending' }],
    totalAmount: 25,
    createdAt: new Date(Date.now() - 6 * 60000).toISOString(),
    orderType: 'dine_in',
  },
  {
    id: 'order-confirmed',
    orderNumber: '1003',
    tableNumber: 'T3',
    status: 'confirmed',
    items: [{ id: 'item-3', name: 'Salad', quantity: 1, unitPrice: 15, status: 'confirmed' }],
    totalAmount: 15,
    createdAt: new Date(Date.now() - 17 * 60000).toISOString(),
    orderType: 'takeaway',
  },
  {
    id: 'order-preparing',
    orderNumber: '1004',
    tableNumber: 'T4',
    status: 'preparing',
    items: [{ id: 'item-4', name: 'Soup', quantity: 1, unitPrice: 10, status: 'preparing' }],
    totalAmount: 10,
    createdAt: new Date(Date.now() - 22 * 60000).toISOString(),
    orderType: 'dine_in',
  },
  {
    id: 'order-ready',
    orderNumber: '1001',
    tableNumber: 'T1',
    status: 'ready',
    items: [{ id: 'item-1', name: 'Burger', quantity: 2, unitPrice: 12, status: 'ready' }],
    totalAmount: 55,
    createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    orderType: 'dine_in',
  },
  {
    id: 'order-served',
    orderNumber: '1005',
    tableNumber: 'T5',
    status: 'served',
    items: [{ id: 'item-5', name: 'Steak', quantity: 1, unitPrice: 30, status: 'served' }],
    totalAmount: 30,
    createdAt: new Date(Date.now() - 14 * 60000).toISOString(),
    orderType: 'dine_in',
  },
  {
    id: 'order-completed',
    orderNumber: '1006',
    tableNumber: 'T6',
    status: 'completed',
    items: [{ id: 'item-6', name: 'Tea', quantity: 1, unitPrice: 5, status: 'completed' }],
    totalAmount: 5,
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    orderType: 'takeaway',
  },
];

function setupActiveShiftApiWithData(
  ordersData: Array<Record<string, unknown>>,
  tablesData: Array<Record<string, unknown>> = buildTables() as Array<Record<string, unknown>>
) {
  apiGetMock.mockImplementation((url: string) => {
    if (url === `/staff/modules/${MODULE_SLUG}/tables`) {
      return Promise.resolve({ data: { data: tablesData } });
    }

    if (url === `/staff/modules/${MODULE_SLUG}/orders`) {
      return Promise.resolve({ data: { data: ordersData } });
    }

    if (url === '/staff/shifts/me/current') {
      return Promise.resolve({ data: { data: activeShift } });
    }

    return Promise.reject(new Error(`Unexpected GET: ${url}`));
  });

  apiPostMock.mockResolvedValue({ data: { success: true } });
  apiPatchMock.mockResolvedValue({ data: { success: true } });
}

function setupActiveShiftApi() {
  apiGetMock.mockImplementation((url: string) => {
    if (url === `/staff/modules/${MODULE_SLUG}/tables`) {
      return Promise.resolve({ data: { data: buildTables() } });
    }

    if (url === `/staff/modules/${MODULE_SLUG}/orders`) {
      return Promise.resolve({ data: { data: buildOrders() } });
    }

    if (url === '/staff/shifts/me/current') {
      return Promise.resolve({ data: { data: activeShift } });
    }

    return Promise.reject(new Error(`Unexpected GET: ${url}`));
  });

  apiPostMock.mockResolvedValue({ data: { success: true } });
  apiPatchMock.mockResolvedValue({ data: { success: true } });
}

function setupNoShiftApi() {
  apiGetMock.mockImplementation((url: string) => {
    if (url === `/staff/modules/${MODULE_SLUG}/tables`) {
      return Promise.resolve({ data: { data: [] } });
    }

    if (url === `/staff/modules/${MODULE_SLUG}/orders`) {
      return Promise.resolve({ data: { data: [] } });
    }

    if (url === '/staff/shifts/me/current') {
      return Promise.resolve({ data: { data: null } });
    }

    return Promise.reject(new Error(`Unexpected GET: ${url}`));
  });

  apiPostMock.mockImplementation((url: string) => {
    if (url === '/staff/shifts') {
      return Promise.resolve({ data: { data: activeShift } });
    }

    return Promise.resolve({ data: { success: true } });
  });

  apiPatchMock.mockResolvedValue({ data: { success: true } });
}

describe('StaffPOSTemplate behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPatchMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    toastInfoMock.mockReset();

    socketMock.emit.mockReset();
    socketMock.on.mockReset();
    socketMock.off.mockReset();

    authState.user = {
      id: 'staff-1',
      fullName: 'Alex Staff',
    };

    function AudioMock(this: { play: ReturnType<typeof vi.fn> }) {
      this.play = vi.fn().mockResolvedValue(undefined);
    }
    vi.stubGlobal('Audio', AudioMock as unknown as typeof Audio);
  });

  it('shows start-shift view when no shift is active and starts a shift', async () => {
    const user = userEvent.setup();
    setupNoShiftApi();

    const firstRender = render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('Start Your Shift');

    const openingCashInput = screen.getByPlaceholderText('0.00');
    await user.type(openingCashInput, '150');
    await user.click(screen.getByRole('button', { name: /start shift/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/staff/shifts', {
        openingCash: 150,
        moduleId: MODULE_ID,
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Shift started');
    await screen.findByText('MenuService Floor');
  });

  it('subscribes to socket updates for staff order events', async () => {
    setupActiveShiftApi();

    const { unmount } = render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('MenuService Floor');

    expect(socketMock.emit).toHaveBeenCalledWith('join:unit', 'menu_service');
    expect(socketMock.on).toHaveBeenCalledWith('order:new', expect.any(Function));
    expect(socketMock.on).toHaveBeenCalledWith('order:updated', expect.any(Function));
    expect(socketMock.on).toHaveBeenCalledWith('table:update', expect.any(Function));

    unmount();

    expect(socketMock.off).toHaveBeenCalledWith('order:new', expect.any(Function));
    expect(socketMock.off).toHaveBeenCalledWith('order:updated', expect.any(Function));
    expect(socketMock.off).toHaveBeenCalledWith('table:update', expect.any(Function));
  });

  it('accepts a pending order from the Orders view', async () => {
    const user = userEvent.setup();
    setupActiveShiftApi();

    const firstRender = render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('MenuService Floor');

    await user.click(screen.getByRole('button', { name: /orders/i }));
    await screen.findByText('#1002');

    await user.click(screen.getByRole('button', { name: /accept/i }));

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith(
        `/staff/modules/${MODULE_SLUG}/orders/order-pending/status`,
        { status: 'confirmed' }
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Order updated to confirmed');
  });

  it('opens payment modal from floor plan and processes card payment', async () => {
    const user = userEvent.setup();
    setupActiveShiftApi();

    const firstRender = render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('MenuService Floor');

    await user.click(screen.getByText('T1'));
    await screen.findByText('Table T1');

    await user.click(screen.getByRole('button', { name: /pay/i }));

    const paymentDialog = screen.getByRole('dialog');
    const paymentButtons = paymentDialog.querySelectorAll('button');
    await user.click(paymentButtons[0] as HTMLButtonElement);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        `/staff/modules/${MODULE_SLUG}/orders/order-ready/pay`,
        {
          paymentMethod: 'card',
          amount: 55,
          tip: undefined,
        }
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Payment processed');
  });

  it('shows errors when shift start fails and when initial fetch fails', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    setupNoShiftApi();
    apiPostMock.mockImplementation((url: string) => {
      if (url === '/staff/shifts') {
        return Promise.reject(new Error('cannot open shift'));
      }
      return Promise.resolve({ data: { success: true } });
    });

    const firstRender = render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('Start Your Shift');
    await user.type(screen.getByPlaceholderText('0.00'), '99');
    await user.click(screen.getByRole('button', { name: /start shift/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to start shift');
    });

    firstRender.unmount();

    apiGetMock.mockRejectedValueOnce(new Error('load failed'));
    render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );
    await screen.findByText('Start Your Shift');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('drives order status actions in orders and kitchen views', async () => {
    const user = userEvent.setup();
    setupActiveShiftApiWithData(buildKitchenHeavyOrders());

    const firstRender = render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('MenuService Floor');

    await user.click(screen.getByRole('button', { name: /orders/i }));
    await screen.findByText('#1002');

    await user.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith(
        `/staff/modules/${MODULE_SLUG}/orders/order-pending/status`,
        { status: 'confirmed' }
      );
    });

    await user.click(screen.getAllByRole('button', { name: /start prep/i })[0]);
    await waitFor(() => {
      expect(
        apiPatchMock.mock.calls.some(
          ([, payload]) => (payload as { status?: string }).status === 'preparing'
        )
      ).toBe(true);
    });

    await user.click(screen.getAllByRole('button', { name: /mark ready/i })[0]);
    await waitFor(() => {
      expect(
        apiPatchMock.mock.calls.some(
          ([, payload]) => (payload as { status?: string }).status === 'ready'
        )
      ).toBe(true);
    });

    await user.click((screen.getAllByTestId('icon-printer')[0].closest('button')) as HTMLButtonElement);
    await waitFor(() => {
      expect(
        apiPostMock.mock.calls.some(([url]) =>
          typeof url === 'string' && url.includes(`/staff/modules/${MODULE_SLUG}/orders/`) && url.endsWith('/print')
        )
      ).toBe(true);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Receipt sent to printer');

    await user.click(screen.getAllByRole('button', { name: /pay/i })[0]);
    const paymentDialog = await screen.findByRole('dialog');
    await user.click(within(paymentDialog).getByRole('button', { name: /cash/i }));
    await waitFor(() => {
      expect(
        apiPostMock.mock.calls.some(
          ([url, payload]) =>
            typeof url === 'string' &&
            url.includes(`/staff/modules/${MODULE_SLUG}/orders/`) &&
            url.endsWith('/pay') &&
            (payload as { paymentMethod?: string }).paymentMethod === 'cash'
        )
      ).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: /kitchen/i }));
    await screen.findByText('#1003');
    await user.click(screen.getByRole('button', { name: /start/i }));
    await waitFor(() => {
      expect(
        apiPatchMock.mock.calls.some(
          ([, payload]) => (payload as { status?: string }).status === 'preparing'
        )
      ).toBe(true);
    });
  });

  it('shows payment and print errors for failed API calls', async () => {
    const user = userEvent.setup();
    setupActiveShiftApiWithData(buildKitchenHeavyOrders());

    apiPostMock.mockImplementation((url: string) => {
      if (url.includes('/print')) {
        return Promise.reject(new Error('printer offline'));
      }
      if (url.includes('/pay')) {
        return Promise.reject(new Error('declined'));
      }
      return Promise.resolve({ data: { success: true } });
    });

    render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('MenuService Floor');
    await user.click(screen.getByRole('button', { name: /orders/i }));
    await screen.findByText('#1001');

    await user.click((screen.getAllByTestId('icon-printer')[0].closest('button')) as HTMLButtonElement);
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to print');
    });

    await user.click(screen.getAllByRole('button', { name: /pay/i })[0]);
    const paymentDialog = await screen.findByRole('dialog');
    await user.click(within(paymentDialog).getAllByRole('button')[0]);
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Payment failed');
    });
  });

  it('handles cashier settle and end-shift success and failure', async () => {
    const user = userEvent.setup();
    setupActiveShiftApiWithData(buildKitchenHeavyOrders());

    const firstRender = render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('MenuService Floor');

    await user.click(screen.getByRole('button', { name: /cashier/i }));
    await screen.findAllByRole('button', { name: /settle/i });
    await user.click(screen.getAllByRole('button', { name: /settle/i })[0]);
    const paymentDialog = await screen.findByRole('dialog');
    await user.click(within(paymentDialog).getByRole('button', { name: /gift card/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        `/staff/modules/${MODULE_SLUG}/orders/order-ready/pay`,
        { paymentMethod: 'gift_card', amount: 55, tip: undefined }
      );
    });

    await user.click(screen.getByRole('button', { name: /end shift/i }));
    const firstShiftDialog = await screen.findByRole('dialog');
    await user.type(within(firstShiftDialog).getByPlaceholderText('0.00'), '175');
    await user.click(within(firstShiftDialog).getByRole('button', { name: /^end shift$/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/staff/shifts/shift-1/close', { closingCash: 175 });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Shift ended');
    await screen.findByText('Start Your Shift');

    firstRender.unmount();

    setupActiveShiftApiWithData(buildKitchenHeavyOrders());
    apiPostMock.mockImplementation((url: string) => {
      if (url.includes('/close')) {
        return Promise.reject(new Error('close failed'));
      }
      return Promise.resolve({ data: { success: true } });
    });

    render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('MenuService Floor');
    await user.click(screen.getByRole('button', { name: /end shift/i }));
    const secondShiftDialog = await screen.findByRole('dialog');
    await user.type(within(secondShiftDialog).getByPlaceholderText('0.00'), '180');
    await user.click(within(secondShiftDialog).getByRole('button', { name: /^end shift$/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to end shift');
    });
  });

  it('handles socket callbacks for new orders, updates, and table changes', async () => {
    const user = userEvent.setup();
    setupActiveShiftApiWithData(buildOrders() as Array<Record<string, unknown>>);

    render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('MenuService Floor');

    const newOrderHandler = socketMock.on.mock.calls.find(call => call[0] === 'order:new')?.[1] as
      | ((order: {
          id: string;
          orderNumber: string;
          status: string;
          totalAmount: number;
          createdAt: string;
          orderType: string;
          items: Array<{ id: string; name: string; quantity: number; unitPrice: number; status: string }>;
          customerName?: string;
        }) => void)
      | undefined;

    const orderUpdatedHandler = socketMock.on.mock.calls.find(call => call[0] === 'order:updated')?.[1] as
      | ((update: { orderId: string; status: string }) => void)
      | undefined;

    const tableUpdatedHandler = socketMock.on.mock.calls.find(call => call[0] === 'table:update')?.[1] as
      | ((table: {
          id: string;
          number: string;
          capacity: number;
          status: 'available' | 'occupied' | 'reserved' | 'dirty';
          currentOrder?: {
            id: string;
            orderNumber: string;
            status: string;
            items: Array<{ id: string; name: string; quantity: number; unitPrice: number; status: string }>;
            totalAmount: number;
            createdAt: string;
            orderType: string;
          };
        }) => void)
      | undefined;

    expect(newOrderHandler).toBeDefined();
    expect(orderUpdatedHandler).toBeDefined();
    expect(tableUpdatedHandler).toBeDefined();

    act(() => {
      newOrderHandler?.({
        id: 'order-200',
        orderNumber: '2000',
        status: 'confirmed',
        totalAmount: 44,
        createdAt: new Date().toISOString(),
        orderType: 'delivery',
        customerName: 'Chris',
        items: [{ id: 'it-200', name: 'Sushi', quantity: 2, unitPrice: 22, status: 'confirmed' }],
      });
    });

    expect(toastInfoMock).toHaveBeenCalledWith('New order #2000', { description: 'Chris' });

    await user.click(screen.getByRole('button', { name: /orders/i }));
    expect(screen.getByText('#2000')).toBeInTheDocument();

    act(() => {
      orderUpdatedHandler?.({ orderId: 'order-pending', status: 'preparing' });
    });

    await waitFor(() => {
      expect(screen.queryAllByText('preparing').length).toBeGreaterThan(0);
    });

    act(() => {
      tableUpdatedHandler?.({
        id: 'table-2',
        number: 'T2',
        capacity: 2,
        status: 'reserved',
      });
    });

    await user.click(screen.getByRole('button', { name: /floor/i }));
    await user.click(screen.getByText('T2'));
    await screen.findByText('Table T2');
  });

  it('renders no-active-orders state in kitchen view', async () => {
    const user = userEvent.setup();
    setupActiveShiftApiWithData([]);

    render(
      <StaffPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="MenuService Floor" />
    );

    await screen.findByText('MenuService Floor');
    await user.click(screen.getByRole('button', { name: /kitchen/i }));
    expect(screen.getByText('No active orders')).toBeInTheDocument();
  });
});
