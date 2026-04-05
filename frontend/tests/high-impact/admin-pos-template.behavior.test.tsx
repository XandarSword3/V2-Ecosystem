import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiPatchMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastInfoMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
    put: apiPutMock,
    patch: apiPatchMock,
    delete: apiDeleteMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    info: toastInfoMock,
  },
}));

import AdminPOSTemplate from '../../src/components/pos-templates/AdminPOSTemplate';

const MODULE_ID = 'mod-pos-1';
const MODULE_SLUG = 'restaurant';

const baseCategories = [
  { id: 'cat-1', name: 'Main Dishes', sort_order: 1, is_active: true },
  { id: 'cat-2', name: 'Drinks', sort_order: 2, is_active: true },
];

const baseMenuItems = [
  {
    id: 'item-1',
    name: 'Margherita Pizza',
    description: 'Classic pizza',
    price: 15,
    cost: 6,
    category_id: 'cat-1',
    is_active: true,
    prep_time_minutes: 12,
    bom: [],
  },
  {
    id: 'item-2',
    name: 'Sparkling Water',
    description: 'Still cold',
    price: 4,
    cost: 1,
    category_id: 'cat-2',
    is_active: true,
    prep_time_minutes: 1,
    bom: [],
  },
];

const basePolicies = {
  tabBehavior: {
    autoCloseOnCheckout: false,
    idleTimeoutMinutes: 45,
    maxOpenTabsPerTable: 2,
    creditLimitPerTable: 150,
  },
  orderStacking: {
    enabled: true,
    maxStackHours: 4,
    forceChargeEnabled: false,
  },
  splitPayment: {
    enabled: true,
    maxSplits: 3,
    allowUnevenSplits: true,
  },
  tipping: {
    enabled: true,
    presets: [10, 15, 20],
    allowCustom: true,
    defaultPercent: 10,
  },
};

interface ReportSnapshot {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  grossMargin: number;
  topItems: Array<{ name: string; quantity: number }>;
  byPaymentMethod: Array<{ method: string; total: number }>;
}

const reportsByPeriod: Record<string, ReportSnapshot> = {
  today: {
    totalRevenue: 1250,
    totalOrders: 20,
    avgOrderValue: 62.5,
    grossMargin: 38,
    topItems: [{ name: 'Margherita Pizza', quantity: 8 }],
    byPaymentMethod: [{ method: 'card', total: 900 }],
  },
  week: {
    totalRevenue: 6800,
    totalOrders: 105,
    avgOrderValue: 64.76,
    grossMargin: 41,
    topItems: [{ name: 'Margherita Pizza', quantity: 42 }],
    byPaymentMethod: [{ method: 'cash', total: 3100 }],
  },
  month: {
    totalRevenue: 28100,
    totalOrders: 422,
    avgOrderValue: 66.58,
    grossMargin: 43,
    topItems: [{ name: 'Sparkling Water', quantity: 120 }],
    byPaymentMethod: [{ method: 'card', total: 17000 }],
  },
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function setupAdminApiMocks() {
  apiGetMock.mockImplementation((url: string, config?: { params?: { period?: string } }) => {
    if (url === `/admin/modules/${MODULE_SLUG}/categories`) {
      return Promise.resolve({ data: { data: clone(baseCategories) } });
    }

    if (url === `/admin/modules/${MODULE_SLUG}/menu`) {
      return Promise.resolve({ data: { data: clone(baseMenuItems) } });
    }

    if (url === `/admin/modules/${MODULE_SLUG}/policies`) {
      return Promise.resolve({ data: { data: clone(basePolicies) } });
    }

    if (url === `/admin/modules/${MODULE_SLUG}/reports`) {
      const period = config?.params?.period || 'today';
      return Promise.resolve({ data: { data: clone(reportsByPeriod[period]) } });
    }

    if (url === `/admin/modules/${MODULE_SLUG}/menu/export`) {
      return Promise.resolve({ data: new Blob(['id,name']) });
    }

    return Promise.reject(new Error(`Unexpected GET: ${url}`));
  });

  apiPostMock.mockImplementation((
    url: string,
    payload?: {
      moduleId?: string;
      name?: string;
      description?: string;
      price?: number;
      cost?: number;
      category_id?: string;
      prep_time_minutes?: number;
    }
  ) => {
    if (url === `/admin/modules/${MODULE_SLUG}/menu`) {
      const menuPayload = payload || {};

      return Promise.resolve({
        data: {
          data: {
            id: 'item-new',
            name: menuPayload.name,
            description: menuPayload.description,
            price: menuPayload.price,
            cost: menuPayload.cost,
            category_id: menuPayload.category_id,
            is_active: true,
            prep_time_minutes: menuPayload.prep_time_minutes,
            bom: [],
          },
        },
      });
    }

    if (url === `/admin/modules/${MODULE_SLUG}/menu/bulk-price`) {
      return Promise.resolve({ data: { success: true } });
    }

    if (url === `/admin/modules/${MODULE_SLUG}/categories`) {
      return Promise.resolve({ data: { data: payload } });
    }

    return Promise.resolve({ data: { success: true } });
  });

  apiPutMock.mockResolvedValue({ data: { success: true } });
  apiPatchMock.mockResolvedValue({ data: { success: true } });
  apiDeleteMock.mockResolvedValue({ data: { success: true } });
}

describe('AdminPOSTemplate behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiPatchMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    toastInfoMock.mockReset();

    setupAdminApiMocks();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:test');
  });

  it('loads categories, menu items, and policies on first render', async () => {
    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    expect(apiGetMock).toHaveBeenCalledWith(`/admin/modules/${MODULE_SLUG}/categories`);
    expect(apiGetMock).toHaveBeenCalledWith(`/admin/modules/${MODULE_SLUG}/menu`);
    expect(apiGetMock).toHaveBeenCalledWith(`/admin/modules/${MODULE_SLUG}/policies`);

    expect(screen.getByText('Margherita Pizza')).toBeInTheDocument();
    expect(screen.getByText('Sparkling Water')).toBeInTheDocument();
  });

  it('creates a new menu item from the item editor modal', async () => {
    const user = userEvent.setup();

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    await user.click(screen.getByRole('button', { name: /add item/i }));

    const dialog = screen.getByRole('dialog');
    const nameInput = dialog.querySelector('input[name="name"]') as HTMLInputElement;
    const categorySelect = dialog.querySelector('select[name="category"]') as HTMLSelectElement;
    const priceInput = dialog.querySelector('input[name="price"]') as HTMLInputElement;

    await user.type(nameInput, 'Truffle Pasta');
    await user.selectOptions(categorySelect, 'cat-1');
    await user.type(priceInput, '24');

    const saveButton = dialog.querySelector('button[type="submit"]') as HTMLButtonElement;
    await user.click(saveButton);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        `/admin/modules/${MODULE_SLUG}/menu`,
        expect.objectContaining({
          moduleId: MODULE_ID,
          name: 'Truffle Pasta',
          category_id: 'cat-1',
          price: 24,
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Item saved');
    expect(screen.getByText('Truffle Pasta')).toBeInTheDocument();
  });

  it('closes item editor modal when cancel is clicked', async () => {
    const user = userEvent.setup();

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');
    await user.click(screen.getByRole('button', { name: /add item/i }));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('saves updated policy settings', async () => {
    const user = userEvent.setup();

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    await user.click(screen.getByRole('button', { name: /order policies/i }));
    await screen.findByText('Order & Tab Policies');

    const autoCloseRow = screen.getByText('Auto-close on checkout').parentElement;
    const autoCloseToggle = autoCloseRow?.querySelector('button') as HTMLButtonElement;
    await user.click(autoCloseToggle);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith(
        `/admin/modules/${MODULE_SLUG}/policies`,
        expect.objectContaining({
          tabBehavior: expect.objectContaining({
            autoCloseOnCheckout: true,
          }),
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Policies saved');
  });

  it('loads report data when opening reports and when changing period', async () => {
    const user = userEvent.setup();

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    await user.click(screen.getByRole('button', { name: /reports & analytics/i }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        `/admin/modules/${MODULE_SLUG}/reports`,
        { params: { period: 'today' } }
      );
    });

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'week' }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        `/admin/modules/${MODULE_SLUG}/reports`,
        { params: { period: 'week' } }
      );
    });

    expect(screen.getByText('105')).toBeInTheDocument();
  });

  it('navigates every admin section and renders section-specific content', async () => {
    const user = userEvent.setup();

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    await user.click(screen.getByRole('button', { name: /order policies/i }));
    expect(screen.getByRole('heading', { name: 'Order & Tab Policies' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /payments & hardware/i }));
    expect(screen.getByRole('heading', { name: 'Payments & Hardware' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /staff & security/i }));
    expect(screen.getByRole('heading', { name: 'Staff & Security' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /inventory & bom/i }));
    expect(screen.getByRole('heading', { name: 'Inventory & Bill of Materials' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reports & analytics/i }));
    expect(screen.getByRole('heading', { name: 'Reports & Analytics' })).toBeInTheDocument();
  });

  it('filters items by category and restores all items', async () => {
    const user = userEvent.setup();

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    await user.click(screen.getByRole('button', { name: /main dishes/i }));
    expect(screen.getByText('Margherita Pizza')).toBeInTheDocument();
    expect(screen.queryByText('Sparkling Water')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /all items/i }));
    expect(screen.getByText('Sparkling Water')).toBeInTheDocument();
  });

  it('edits an existing menu item and persists updates through API', async () => {
    const user = userEvent.setup();

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    await user.click((screen.getAllByTestId('icon-edit')[0].closest('button')) as HTMLButtonElement);

    const dialog = screen.getByRole('dialog');
    const nameInput = dialog.querySelector('input[name="name"]') as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, 'Margherita Deluxe');

    const submitButton = dialog.querySelector('button[type="submit"]') as HTMLButtonElement;
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith(
        `/admin/modules/${MODULE_SLUG}/menu/item-1`,
        expect.objectContaining({
          id: 'item-1',
          name: 'Margherita Deluxe',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Item saved');
    expect(screen.getByText('Margherita Deluxe')).toBeInTheDocument();
  });

  it('shows save error when creating a menu item fails', async () => {
    const user = userEvent.setup();
    apiPostMock.mockImplementationOnce((url: string) => {
      if (url === `/admin/modules/${MODULE_SLUG}/menu`) {
        return Promise.reject(new Error('create failed'));
      }
      return Promise.resolve({ data: { success: true } });
    });

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');
    await user.click(screen.getByRole('button', { name: /add item/i }));

    const dialog = screen.getByRole('dialog');
    await user.type(dialog.querySelector('input[name="name"]') as HTMLInputElement, 'Fail Item');
    await user.selectOptions(dialog.querySelector('select[name="category"]') as HTMLSelectElement, 'cat-1');
    await user.type(dialog.querySelector('input[name="price"]') as HTMLInputElement, '10');
    await user.click(dialog.querySelector('button[type="submit"]') as HTMLButtonElement);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to save item');
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('supports delete cancellation, failure, and success paths', async () => {
    const user = userEvent.setup();

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    const deleteButtons = () =>
      screen.getAllByTestId('icon-trash2').map((icon) => icon.closest('button') as HTMLButtonElement);

    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    await user.click(deleteButtons()[0]);
    expect(apiDeleteMock).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    apiDeleteMock.mockRejectedValueOnce(new Error('delete failed'));
    await user.click(deleteButtons()[0]);
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to delete item');
    });

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    apiDeleteMock.mockResolvedValueOnce({ data: { success: true } });
    await user.click(deleteButtons()[0]);

    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith(`/admin/modules/${MODULE_SLUG}/menu/item-1`);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Item deleted');
    expect(screen.queryByText('Margherita Pizza')).not.toBeInTheDocument();
  });

  it('toggles item active state and reports API failures', async () => {
    const user = userEvent.setup();

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    const toggleButtons = () =>
      screen.getAllByTestId('icon-toggleright').map((icon) => icon.closest('button') as HTMLButtonElement);

    await user.click(toggleButtons()[0]);
    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith(
        `/admin/modules/${MODULE_SLUG}/menu/item-1`,
        { is_active: false }
      );
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Item disabled');

    apiPatchMock.mockRejectedValueOnce(new Error('toggle failed'));
    await user.click((screen.getAllByTestId('icon-toggleleft')[0].closest('button')) as HTMLButtonElement);
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to update item');
    });
  });

  it('runs bulk price updates and handles bulk failures', async () => {
    const user = userEvent.setup();

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    await user.type(screen.getByPlaceholderText('%'), '10');
    await user.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(`/admin/modules/${MODULE_SLUG}/menu/bulk-price`, {
        percentage: 10,
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Prices updated by 10%');

    apiPostMock.mockImplementationOnce((url: string) => {
      if (url === `/admin/modules/${MODULE_SLUG}/menu/bulk-price`) {
        return Promise.reject(new Error('bulk failed'));
      }
      return Promise.resolve({ data: { success: true } });
    });

    await user.clear(screen.getByPlaceholderText('%'));
    await user.type(screen.getByPlaceholderText('%'), '5');
    await user.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to update prices');
    });
  });

  it('exports menu CSV and handles export failures', async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    await user.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        `/admin/modules/${MODULE_SLUG}/menu/export`,
        { responseType: 'blob' }
      );
    });
    expect(clickSpy).toHaveBeenCalled();

    const originalGet = apiGetMock.getMockImplementation();
    apiGetMock.mockImplementation((url: string, config?: { params?: { period?: string } }) => {
      if (url === `/admin/modules/${MODULE_SLUG}/menu/export`) {
        return Promise.reject(new Error('export failed'));
      }
      if (!originalGet) {
        return Promise.reject(new Error('missing get implementation'));
      }
      return originalGet(url, config);
    });

    await user.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to export');
    });
  });

  it('shows report fetch error and policy save error when endpoints fail', async () => {
    const user = userEvent.setup();
    const originalGet = apiGetMock.getMockImplementation();

    apiGetMock.mockImplementation((url: string, config?: { params?: { period?: string } }) => {
      if (url === `/admin/modules/${MODULE_SLUG}/reports`) {
        return Promise.reject(new Error('reports failed'));
      }
      if (!originalGet) {
        return Promise.reject(new Error('missing get implementation'));
      }
      return originalGet(url, config);
    });

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');

    await user.click(screen.getByRole('button', { name: /reports & analytics/i }));
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to fetch reports');
    });

    await user.click(screen.getByRole('button', { name: /order policies/i }));
    apiPutMock.mockRejectedValueOnce(new Error('policies failed'));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to save policies');
    });
  });

  it('recovers from initial fetch failure and exits loading state', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiGetMock.mockRejectedValueOnce(new Error('initial load failed'));

    render(
      <AdminPOSTemplate moduleId={MODULE_ID} moduleSlug={MODULE_SLUG} moduleName="Restaurant POS" />
    );

    await screen.findByText('Menu Management');
    expect(screen.queryByText('Margherita Pizza')).not.toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
