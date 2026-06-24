import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useParamsMock = vi.hoisted(() => vi.fn());

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const siteSettingsMock = vi.hoisted(() => ({
  modules: [
    {
      id: 'module-menu service',
      template_type: 'menu_service',
      name: 'MenuService',
      slug: 'menu_service',
      is_active: true,
      sort_order: 1,
    },
  ],
}));

vi.mock('next/navigation', () => ({
  useParams: useParamsMock,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

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
  },
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => siteSettingsMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import DynamicMenuPage from '../../src/app/admin/[slug]/menu/page';

const categoriesSeed = [
  {
    id: 'cat-main',
    name: 'Main Course',
    display_order: 1,
  },
];

const itemsSeed = [
  {
    id: 'item-1',
    name: 'Burger Deluxe',
    description: 'Beef burger with premium toppings',
    price: 14,
    category_id: 'cat-main',
    is_available: true,
    is_featured: true,
    is_vegetarian: false,
    is_spicy: false,
    customization_group_ids: [],
  },
];

const ingredientsSeed = [
  {
    id: 'ing-1',
    name: 'Beef Patty',
    unit: 'piece',
    stock_quantity: 42,
    cost_per_unit: 2.5,
  },
];

const customizationGroupsSeed = [
  {
    id: 'group-1',
    name: 'Add-ons',
    description: 'Optional extras',
    is_required: false,
    min_selections: 0,
    max_selections: 3,
    options: [
      { id: 'opt-1', name: 'Cheese', price_modifier: 1.5 },
    ],
  },
];

describe('Admin module menu route coverage', () => {
  beforeEach(() => {
    useParamsMock.mockReturnValue({ slug: 'menu_service' });

    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/menu_service/items') {
        return Promise.resolve({ data: { data: itemsSeed } });
      }
      if (url === '/menu_service/categories') {
        return Promise.resolve({ data: { data: categoriesSeed } });
      }
      if (url === '/inventory/items') {
        return Promise.resolve({ data: { data: ingredientsSeed } });
      }
      if (url === '/menu_service/modifiers') {
        return Promise.resolve({ data: { data: customizationGroupsSeed } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('renders module menu data and toggles item availability', async () => {
    const user = userEvent.setup();

    render(<DynamicMenuPage />);

    expect(await screen.findByText('Burger Deluxe')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Hide$/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/menu_service/admin/items/item-1', {
        is_available: false,
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Item hidden');
  });

  it('shows form validation error when creating without required fields', async () => {
    const user = userEvent.setup();

    render(<DynamicMenuPage />);

    await screen.findByText('MenuService Menu');

  await user.click(screen.getByRole('button', { name: /Add Item/i }));
  expect(await screen.findByText('Add New Menu Item')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Create Item$/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('Please fill in all required fields');
  });
});
