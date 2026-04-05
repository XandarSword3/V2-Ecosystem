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
      id: 'module-restaurant',
      template_type: 'menu_service',
      name: 'Restaurant',
      slug: 'restaurant',
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

import DynamicModifiersPage from '../../src/app/admin/[slug]/modifiers/page';

const groupsSeed = [
  {
    id: 'group-1',
    name: 'Toppings',
    description: 'Extra topping choices',
    min_selections: 0,
    max_selections: 3,
    is_required: false,
    allow_multiple_same: false,
    options: [
      {
        id: 'opt-1',
        name: 'Cheese',
        price_adjustment: 1.5,
        is_available: true,
        display_order: 1,
        modifier_type: 'add',
        max_quantity: 2,
      },
    ],
  },
];

describe('Admin module modifiers route coverage', () => {
  beforeEach(() => {
    useParamsMock.mockReturnValue({ slug: 'restaurant' });

    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/restaurant/modifiers') {
        return Promise.resolve({ data: { data: groupsSeed } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('renders modifier groups and creates a new option inside a group', async () => {
    const user = userEvent.setup();

    render(<DynamicModifiersPage />);

    expect(await screen.findByText('Restaurant Modifiers')).toBeInTheDocument();
    expect(await screen.findByText('Toppings')).toBeInTheDocument();

    await user.click(screen.getByText('Toppings'));
    await user.click(screen.getByRole('button', { name: /Add Option/i }));
    expect(await screen.findByText('New Modifier Option')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g., Extra Cheese'), 'Bacon Bits');
    await user.click(screen.getByRole('button', { name: /Create$/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/restaurant/modifiers/group-1/options',
        expect.objectContaining({
          name: expect.any(String),
          modifierType: 'add',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Modifier option created');
  });

  it('shows an error when trying to save a group without a name', async () => {
    const user = userEvent.setup();

    render(<DynamicModifiersPage />);

    await screen.findByText('Restaurant Modifiers');

    await user.click(screen.getByRole('button', { name: /New Group/i }));
    expect(await screen.findByText('New Modifier Group')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Create$/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('Group name is required');
  });
});
