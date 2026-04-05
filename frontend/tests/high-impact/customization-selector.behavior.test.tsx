import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
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

import { CustomizationSelector } from '../../src/components/customization/CustomizationSelector';

const groups = [
  {
    groupId: 'required-group',
    groupName: 'Choose Base',
    selectionMode: 'single',
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    sortOrder: 1,
    options: [
      {
        id: 'base-cheese',
        name: 'Cheese Base',
        customizationType: 'add',
        priceAdjustment: 2,
        priceType: 'fixed',
        maxQuantity: 1,
        isDefault: false,
        isPopular: true,
        isAvailable: true,
        quantityPerSelection: 1,
        sortOrder: 1,
      },
      {
        id: 'base-classic',
        name: 'Classic Base',
        customizationType: 'add',
        priceAdjustment: 0,
        priceType: 'fixed',
        maxQuantity: 1,
        isDefault: false,
        isPopular: false,
        isAvailable: true,
        quantityPerSelection: 1,
        sortOrder: 2,
      },
    ],
  },
  {
    groupId: 'quantity-group',
    groupName: 'Extras',
    selectionMode: 'quantity',
    minSelections: 0,
    maxSelections: 3,
    isRequired: false,
    sortOrder: 2,
    options: [
      {
        id: 'extra-bacon',
        name: 'Bacon',
        customizationType: 'add',
        priceAdjustment: 3,
        priceType: 'fixed',
        maxQuantity: 2,
        isDefault: false,
        isPopular: false,
        isAvailable: true,
        quantityPerSelection: 1,
        sortOrder: 1,
      },
    ],
  },
];

const optionIndex = new Map(
  groups.flatMap((group) =>
    group.options.map((option) => [option.id, { groupName: group.groupName, option, groupId: group.groupId }])
  )
);

describe('CustomizationSelector behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();

    apiGetMock.mockResolvedValue({ data: groups });
    apiPostMock.mockImplementation((url: string, payload?: { selections?: Array<{ groupId: string; optionId: string; quantity: number }> }) => {
      if (url !== '/customizations/validate') {
        return Promise.resolve({ data: { isValid: true } });
      }

      const selections = payload?.selections || [];
      if (selections.length === 0) {
        return Promise.resolve({
          data: {
            isValid: false,
            totalPriceAdjustment: 0,
            validatedSelections: [],
            validationErrors: ['Select at least one option'],
          },
        });
      }

      const validatedSelections = selections.map((selection) => {
        const optionMeta = optionIndex.get(selection.optionId);
        const option = optionMeta?.option;

        return {
          groupId: selection.groupId,
          groupName: optionMeta?.groupName || 'Unknown',
          optionId: selection.optionId,
          optionName: option?.name || selection.optionId,
          customizationType: option?.customizationType || 'add',
          unitPrice: option?.priceAdjustment || 0,
          totalPrice: (option?.priceAdjustment || 0) * selection.quantity,
          quantity: selection.quantity,
          quantityPerSelection: 1,
        };
      });

      const total = validatedSelections.reduce((sum, item) => sum + item.totalPrice, 0);

      return Promise.resolve({
        data: {
          isValid: true,
          totalPriceAdjustment: total,
          validatedSelections,
          validationErrors: [],
        },
      });
    });
  });

  it('loads customization groups when opened', async () => {
    render(
      <CustomizationSelector
        isOpen={true}
        entityType="menu_item"
        entityId="menu-1"
        entity={{ name: 'Burger', basePrice: 10 }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    await screen.findByText('Choose Base');
    expect(apiGetMock).toHaveBeenCalledWith('/customizations/for-entity/menu_item/menu-1');
    expect(screen.getByText('Extras')).toBeInTheDocument();
  });

  it('confirms selected options with computed line total', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <CustomizationSelector
        isOpen={true}
        entityType="menu_item"
        entityId="menu-1"
        entity={{ name: 'Burger', basePrice: 10 }}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    await screen.findByText('Choose Base');
  await user.click(await screen.findByText('Cheese Base'));
    await user.click(screen.getByRole('button', { name: /confirmselection/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 1,
          totalPriceAdjustment: 2,
          lineTotal: 12,
          selections: expect.arrayContaining([
            expect.objectContaining({ optionId: 'base-cheese' }),
          ]),
        })
      );
    });
  });

  it('supports quantity mode controls for optional extras', async () => {
    const user = userEvent.setup();

    render(
      <CustomizationSelector
        isOpen={true}
        entityType="menu_item"
        entityId="menu-1"
        entity={{ name: 'Burger', basePrice: 10 }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    await screen.findByText('Choose Base');

    const extrasToggle = screen.getByRole('button', { name: /extras/i });
    if (!screen.queryByText('Bacon')) {
      await user.click(extrasToggle);
    }

    await screen.findByText('Bacon');

    const baconRow = screen.getByText('Bacon').closest('div.relative') as HTMLDivElement;
    const quantityButtons = within(baconRow).getAllByRole('button');

    await user.click(quantityButtons[1]);
    expect(within(baconRow).getByText('1')).toBeInTheDocument();

    await user.click(quantityButtons[1]);
    expect(within(baconRow).getByText('2')).toBeInTheDocument();
  });

  it('shows error UI and retries after fetch failure', async () => {
    const user = userEvent.setup();

    apiGetMock
      .mockRejectedValueOnce(new Error('initial load failed'))
      .mockResolvedValueOnce({ data: groups });

    render(
      <CustomizationSelector
        isOpen={true}
        entityType="menu_item"
        entityId="menu-1"
        entity={{ name: 'Burger', basePrice: 10 }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    await screen.findByText('initial load failed');
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByText('Choose Base');
  });

  it('shows empty-state UI when there are no customization groups', async () => {
    apiGetMock.mockResolvedValueOnce({ data: [] });

    render(
      <CustomizationSelector
        isOpen={true}
        entityType="menu_item"
        entityId="menu-2"
        entity={{ name: 'Plain Burger', basePrice: 9 }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    await screen.findByText('noCustomizationsAvailable');
  });
});
