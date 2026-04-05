import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn());
const addToSnackMock = vi.hoisted(() => vi.fn());
const removeFromSnackMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

const snackState = vi.hoisted(() => ({
  items: [] as Array<{ id: string; quantity: number; price: number }>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}));

vi.mock('@/lib/api', () => ({
  snackApi: {
    getItems: vi.fn(),
  },
}));

vi.mock('@/stores/cartStore', () => ({
  useCartStore: (
    selector: (state: {
      snackItems: Array<{ id: string; quantity: number; price: number }>;
      addToSnack: typeof addToSnackMock;
      removeFromSnack: typeof removeFromSnackMock;
      getSnackTotal: () => number;
      getSnackCount: () => number;
    }) => unknown
  ) =>
    selector({
      snackItems: snackState.items,
      addToSnack: addToSnackMock,
      removeFromSnack: removeFromSnackMock,
      getSnackTotal: () => snackState.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      getSnackCount: () => snackState.items.reduce((sum, item) => sum + item.quantity, 0),
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

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    settings: {
      snackBarName: 'Snack Bar Deluxe',
    },
  }),
}));

vi.mock('@/lib/translate', () => ({
  useContentTranslation: () => ({
    translateContent: (item: Record<string, string | undefined>, field: 'name' | 'description') =>
      item?.[field] || item?.[`${field}_ar`] || '',
  }),
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

vi.mock('@/components/effects/Card3D', () => ({
  FloatingCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/effects/GlowingBorder', () => ({
  SpotlightCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/effects/TextEffects', () => ({
  GradientText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/effects/AnimatedCounter', () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));

import SnackBarPage from '../../src/app/snack-bar/page';

const snackResponse = {
  data: {
    data: [
      {
        id: 'snack-1',
        name: 'Fries',
        description: 'Crispy fries',
        price: 6,
        category: 'snack',
        is_available: true,
      },
      {
        id: 'snack-2',
        name: 'Cola',
        description: 'Cold drink',
        price: 4,
        category: 'drink',
        is_available: true,
      },
      {
        id: 'snack-3',
        name: 'Vanilla Scoop',
        description: 'Ice cream cup',
        price: 5,
        category: 'ice_cream',
        is_available: false,
      },
    ],
  },
};

describe('SnackBarPage behavior', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    addToSnackMock.mockReset();
    removeFromSnackMock.mockReset();
    pushMock.mockReset();
    toastSuccessMock.mockReset();
    snackState.items = [];
  });

  it('renders loading and error states', () => {
    useQueryMock.mockReturnValueOnce({ data: null, isLoading: true, error: null });

    const { unmount } = render(<SnackBarPage />);
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();

    unmount();

    useQueryMock.mockReturnValueOnce({ data: null, isLoading: false, error: new Error('snack failed') });
    render(<SnackBarPage />);

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('tryAgainLater')).toBeInTheDocument();
  });

  it('adds snack items to cart and uses translated success message', async () => {
    const user = userEvent.setup();

    useQueryMock.mockReturnValue({ data: snackResponse, isLoading: false, error: null });

    render(<SnackBarPage />);

    await user.click(screen.getAllByRole('button', { name: /order.addToCart/i })[0]);

    expect(addToSnackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'snack-1',
        name: 'Fries',
        price: 6,
        category: 'snack',
      })
    );
    expect(toastSuccessMock).toHaveBeenCalledWith('addedToCart');
  });

  it('filters by category and navigates from floating cart bar', async () => {
    const user = userEvent.setup();

    snackState.items = [{ id: 'snack-1', quantity: 2, price: 6 }];
    useQueryMock.mockReturnValue({ data: snackResponse, isLoading: false, error: null });

    render(<SnackBarPage />);

    expect(screen.getByText('Fries')).toBeInTheDocument();
    expect(screen.getByText('Cola')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /categories.drinks/i }));

    expect(screen.getByText('Cola')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Fries')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /placeOrder/i }));
    expect(pushMock).toHaveBeenCalledWith('/snack-bar/cart');
  });

  it('shows empty-state card when there are no snack items', () => {
    useQueryMock.mockReturnValue({ data: { data: { data: [] } }, isLoading: false, error: null });

    render(<SnackBarPage />);

    expect(screen.getByText('noItemsFound')).toBeInTheDocument();
    expect(screen.getByText('tryDifferentCategory')).toBeInTheDocument();
  });
});
