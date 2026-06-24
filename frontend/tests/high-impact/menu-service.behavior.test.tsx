import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn());
const apiGetMock = vi.hoisted(() => vi.fn());
const addItemMock = vi.hoisted(() => vi.fn());
const removeItemMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

const cartState = vi.hoisted(() => ({
  items: [] as Array<{ id: string; moduleId: string; quantity: number; price: number }>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}));

vi.mock('@/lib/api', () => ({
  restaurantApi: {
    getMenu: vi.fn(),
  },
  api: {
    get: apiGetMock,
  },
}));

vi.mock('@/stores/cartStore', () => ({
  useCartStore: (
    selector: (state: {
      items: Array<{ id: string; moduleId: string; quantity: number; price: number }>;
      addItem: typeof addItemMock;
      removeItem: typeof removeItemMock;
    }) => unknown
  ) =>
    selector({
      items: cartState.items,
      addItem: addItemMock,
      removeItem: removeItemMock,
    }),
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: { currency: string }) => unknown) =>
    selector({ currency: 'USD' }),
  exchangeRates: {
    USD: 1,
    LBP: 90000,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
  },
  currencySymbols: {
    USD: '$',
    LBP: 'L.L',
    EUR: 'EUR',
    GBP: 'GBP',
    AED: 'AED',
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: vi.fn(),
  },
}));

vi.mock('@/lib/translate', () => ({
  useContentTranslation: () => ({
    translateContent: (item: Record<string, string | undefined>, field: 'name' | 'description') =>
      item?.[field] || item?.[`${field}_ar`] || '',
  }),
}));

vi.mock('@/components/modules/ModifierSelectionModal', () => ({
  ModifierSelectionModal: ({ isOpen, onAddToCart, menuItem, onClose }: any) =>
    isOpen ? (
      <div data-testid="modifier-modal">
        <button
          onClick={() =>
            onAddToCart({
              id: menuItem.id,
              name: menuItem.name,
              price: menuItem.price,
            })
          }
        >
          legacy-add
        </button>
        <button onClick={onClose}>legacy-close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/customization/CustomizationSelector', () => ({
  CustomizationSelector: ({ isOpen, onConfirm, onClose }: any) =>
    isOpen ? (
      <div data-testid="customization-modal">
        <button
          onClick={() =>
            onConfirm({
              selections: [
                {
                  optionId: 'opt-cheese',
                  optionName: 'Cheese',
                  groupId: 'grp-1',
                  groupName: 'Extras',
                  customizationType: 'add',
                  priceAdjustment: 3,
                  quantity: 1,
                },
              ],
              totalPriceAdjustment: 3,
              lineTotal: 13,
              quantity: 2,
            })
          }
        >
          confirm-custom
        </button>
        <button onClick={onClose}>custom-close</button>
      </div>
    ) : null,
}));

import { MenuService } from '../../src/components/modules/MenuService';

const restaurantModule = {
  id: 'mod-1',
  slug: 'menu_service',
  name: 'MenuService',
  description: 'All-day menu',
  settings: {
    header_color: '#0ea5e9',
    accent_color: '#6366f1',
  },
};

const snackModule = {
  ...restaurantModule,
  slug: 'kiosk',
  name: 'KioskItem Bar',
};

const menuResponse = {
  data: {
    data: {
      categories: [
        { id: 'cat-food', name: 'Food' },
        { id: 'cat-drink', name: 'Drinks' },
      ],
      items: [
        {
          id: 'item-1',
          name: 'Fries',
          description: 'Crispy fries',
          price: 10,
          category_id: 'cat-food',
          is_featured: true,
          is_vegetarian: true,
          is_vegan: false,
          is_gluten_free: true,
          image_url: 'https://example.com/fries.jpg',
        },
        {
          id: 'item-2',
          name: 'Cola',
          description: 'Cold drink',
          price: 4,
          category_id: 'cat-drink',
          is_featured: false,
          is_vegetarian: true,
          is_vegan: true,
          is_gluten_free: true,
        },
      ],
    },
  },
};

describe('MenuService behavior', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    apiGetMock.mockReset();
    addItemMock.mockReset();
    removeItemMock.mockReset();
    pushMock.mockReset();
    toastSuccessMock.mockReset();
    cartState.items = [];
  });

  it('renders loading and error states', () => {
    useQueryMock.mockReturnValueOnce({ data: null, isLoading: true, error: null });

    const { unmount } = render(<MenuService module={restaurantModule as any} />);
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();

    unmount();

    useQueryMock.mockReturnValueOnce({ data: null, isLoading: false, error: new Error('menu failed') });
    render(<MenuService module={restaurantModule as any} />);

    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('opens customization flow and adds quantity items for kiosk modules', async () => {
    const user = userEvent.setup();

    useQueryMock.mockReturnValue({ data: menuResponse, isLoading: false, error: null });
    apiGetMock.mockResolvedValueOnce({ data: [{ groupId: 'grp-1' }] });

    render(<MenuService module={snackModule as any} />);

    await user.click(screen.getAllByRole('button', { name: /add to cart/i })[0]);

    expect(await screen.findByTestId('customization-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'confirm-custom' }));

    await waitFor(() => {
      expect(addItemMock).toHaveBeenCalledTimes(2);
    });

    const firstCall = addItemMock.mock.calls[0][0];
    expect(firstCall.moduleSlug).toBe('kiosk');
    expect(firstCall.selectedModifiers).toEqual(
      expect.arrayContaining([expect.objectContaining({ optionId: 'opt-cheese' })])
    );
    expect(toastSuccessMock).toHaveBeenCalledWith('Fries added to cart');
  });

  it('falls back to legacy modifier modal when no customizations are returned', async () => {
    const user = userEvent.setup();

    useQueryMock.mockReturnValue({ data: menuResponse, isLoading: false, error: null });
    apiGetMock.mockResolvedValueOnce({ data: [] });

    render(<MenuService module={restaurantModule as any} />);

    await user.click(screen.getAllByRole('button', { name: /add to cart/i })[0]);

    expect(await screen.findByTestId('modifier-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'legacy-add' }));

    expect(addItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        moduleSlug: 'menu_service',
        moduleId: 'mod-1',
      })
    );
  });

  it('supports category filtering and floating cart navigation', async () => {
    const user = userEvent.setup();

    cartState.items = [{ id: 'item-1', moduleId: 'mod-1', quantity: 2, price: 10 }];
    useQueryMock.mockReturnValue({ data: menuResponse, isLoading: false, error: null });

    render(<MenuService module={restaurantModule as any} />);

    expect(screen.getAllByText('Fries').length).toBeGreaterThan(0);
    expect(screen.getByText('Cola')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Drinks/i }));
    expect(screen.queryByText('Fries')).not.toBeInTheDocument();
    expect(screen.getByText('Cola')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /All/i }));
    expect(screen.getAllByText('Fries').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /\$\d+\.\d+/ }));
    expect(pushMock).toHaveBeenCalledWith('/menu_service/cart');
  });
});
