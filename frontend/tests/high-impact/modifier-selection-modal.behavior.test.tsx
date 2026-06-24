import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
  },
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

vi.mock('@/lib/translate', () => ({
  useContentTranslation: () => ({
    translateContent: (item: Record<string, string | undefined>, field: 'name' | 'description') =>
      item?.[field] || item?.[`${field}_ar`] || '',
  }),
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({}),
}));

import { ModifierSelectionModal } from '../../src/components/modules/ModifierSelectionModal';

const menuItem = {
  id: 'menu-1',
  name: 'Burger Deluxe',
  description: 'Loaded burger',
  price: 12,
  image_url: 'https://example.com/burger.png',
  category: { name: 'Burgers' },
};

const modifierGroups = [
  {
    id: 'group-required',
    name: 'Choose Sauce',
    description: 'Pick one sauce',
    min_selections: 1,
    max_selections: 1,
    is_required: true,
    allow_multiple_same: false,
    options: [
      {
        id: 'sauce-spicy',
        name: 'Spicy Sauce',
        price_adjustment: 2,
        is_available: true,
        display_order: 1,
        modifier_type: 'add',
      },
      {
        id: 'sauce-garlic',
        name: 'Garlic Sauce',
        price_adjustment: 1,
        is_available: true,
        display_order: 2,
        modifier_type: 'add',
      },
    ],
  },
  {
    id: 'group-optional',
    name: 'Extras',
    description: 'Optional extras',
    min_selections: 0,
    max_selections: 3,
    is_required: false,
    allow_multiple_same: true,
    options: [
      {
        id: 'extra-cheese',
        name: 'Extra Cheese',
        price_adjustment: 1,
        is_available: true,
        display_order: 1,
        modifier_type: 'add',
        is_default: true,
        max_quantity: 3,
      },
    ],
  },
];

describe('ModifierSelectionModal behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it('loads modifier groups when opened', async () => {
    apiGetMock.mockResolvedValueOnce({ data: { data: modifierGroups } });

    render(
      <ModifierSelectionModal
        isOpen={true}
        onClose={vi.fn()}
        menuItem={menuItem}
        onAddToCart={vi.fn()}
      />
    );

    await screen.findByText('Choose Sauce');
    expect(apiGetMock).toHaveBeenCalledWith('/catalog/items/menu-1/modifiers');
    expect(screen.getByText('Extras')).toBeInTheDocument();
  });

  it('shows validation errors when required selections are missing', async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn();

    apiGetMock.mockResolvedValueOnce({ data: { data: modifierGroups } });

    render(
      <ModifierSelectionModal
        isOpen={true}
        onClose={vi.fn()}
        menuItem={menuItem}
        onAddToCart={onAddToCart}
      />
    );

    await screen.findByText('Choose Sauce');
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(onAddToCart).not.toHaveBeenCalled();
    expect(screen.getByText('Please fix the following:')).toBeInTheDocument();
  });

  it('adds item with selected modifiers and closes modal', async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn();
    const onClose = vi.fn();

    apiGetMock.mockResolvedValueOnce({ data: { data: modifierGroups } });

    render(
      <ModifierSelectionModal
        isOpen={true}
        onClose={onClose}
        menuItem={menuItem}
        onAddToCart={onAddToCart}
      />
    );

    await screen.findByText('Choose Sauce');
    await user.click(await screen.findByText('Spicy Sauce'));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    await waitFor(() => {
      expect(onAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'menu-1',
          name: 'Burger Deluxe',
          modifierTotal: 3,
          selectedModifiers: expect.arrayContaining([
            expect.objectContaining({ optionId: 'sauce-spicy' }),
            expect.objectContaining({ optionId: 'extra-cheese' }),
          ]),
        })
      );
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('updates quantity for options that allow multiple selections', async () => {
    const user = userEvent.setup();

    apiGetMock.mockResolvedValueOnce({ data: { data: modifierGroups } });

    render(
      <ModifierSelectionModal
        isOpen={true}
        onClose={vi.fn()}
        menuItem={menuItem}
        onAddToCart={vi.fn()}
      />
    );

    await screen.findByText('Extra Cheese');

    const optionRow = screen
      .getByText('Extra Cheese')
      .closest('div.flex.items-center.justify-between') as HTMLDivElement;

    const quantityButtons = within(optionRow).getAllByRole('button');
    await user.click(quantityButtons[1]);

    expect(within(optionRow).getByText('2')).toBeInTheDocument();
  });

  it('handles failed modifier fetch by showing empty state', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('network failure'));

    render(
      <ModifierSelectionModal
        isOpen={true}
        onClose={vi.fn()}
        menuItem={menuItem}
        onAddToCart={vi.fn()}
      />
    );

    await screen.findByText('No customization options available');
  });
});
