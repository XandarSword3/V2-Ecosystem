import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn());
const addItemMock = vi.hoisted(() => vi.fn());
const removeItemMock = vi.hoisted(() => vi.fn());
const supportSubmitMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

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
  poolApi: {
    getSessions: vi.fn(),
  },
  supportApi: {
    submitContact: supportSubmitMock,
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

vi.mock('@/lib/translate', () => ({
  useContentTranslation: () => ({
    translateContent: (item: Record<string, string | undefined>, field: 'name' | 'description') =>
      item?.[field] || item?.[`${field}_ar`] || '',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { DynamicModuleRenderer } from '../../src/components/module-builder/DynamicModuleRenderer';

const moduleData = {
  id: 'mod-1',
  slug: 'restaurant',
  name: 'Module One',
  description: 'Sample module',
  settings: {},
};

const menuQueryData = {
  data: {
    data: {
      categories: [
        { id: 'cat-1', name: 'Main' },
        { id: 'cat-2', name: 'Drinks' },
      ],
      items: [
        {
          id: 'item-1',
          name: 'Pizza',
          description: 'Stone-baked',
          price: 15,
          category_id: 'cat-1',
          is_available: true,
        },
        {
          id: 'item-2',
          name: 'Cola',
          description: 'Cold drink',
          price: 4,
          category_id: 'cat-2',
          is_available: true,
        },
      ],
    },
  },
};

const sessionsQueryData = {
  data: {
    data: [
      {
        id: 'session-1',
        name: 'Morning Swim',
        start_time: '08:00',
        end_time: '09:00',
        capacity: 20,
        available_spots: 6,
        adult_price: 18,
        gender: 'mixed',
      },
    ],
  },
};

describe('DynamicModuleRenderer behavior', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    addItemMock.mockReset();
    removeItemMock.mockReset();
    supportSubmitMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    cartState.items = [];

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'menu') {
        return { data: menuQueryData, isLoading: false, error: null };
      }
      if (queryKey[0] === 'sessions') {
        return { data: sessionsQueryData, isLoading: false, error: null };
      }
      return { data: null, isLoading: false, error: null };
    });
  });

  it('renders schema fallback and empty-layout fallback states', () => {
    const { rerender } = render(
      <DynamicModuleRenderer layout={[{ bad: 'schema' } as never]} module={moduleData as never} />
    );

    expect(screen.getByText('Module content format is incompatible.')).toBeInTheDocument();

    rerender(<DynamicModuleRenderer layout={[]} module={moduleData as never} />);
    expect(screen.getByText('No layout defined for this module.')).toBeInTheDocument();
  });

  it('renders core block types including hero, container, text, image, button, testimonials, and pricing table', () => {
    const layout = [
      {
        id: 'hero-1',
        type: 'hero',
        props: { title: 'Welcome Header', subtitle: 'Subheading text' },
      },
      {
        id: 'container-1',
        type: 'container',
        children: [
          { id: 'txt-1', type: 'text_block', props: { content: 'Body paragraph content' } },
          { id: 'img-1', type: 'image', props: { src: '/image.png', alt: 'Module Image Alt' } },
          { id: 'btn-1', type: 'button', props: { text: 'Explore', href: '/explore', variant: 'outline' } },
        ],
      },
      {
        id: 'testimonials-1',
        type: 'testimonials',
        props: { count: 2 },
      },
      {
        id: 'pricing-1',
        type: 'pricing_table',
        props: {
          title: 'Plans',
          plans: JSON.stringify([
            { name: 'Basic', price: '$10', popular: false, features: ['One', 'Two'] },
            { name: 'Pro', price: '$20', popular: true, features: ['All'] },
          ]),
        },
      },
      {
        id: 'unknown-1',
        type: 'unknown_block_type',
        props: {},
      },
    ];

    render(<DynamicModuleRenderer layout={layout as never} module={moduleData as never} />);

    expect(screen.getByText('Welcome Header')).toBeInTheDocument();
    expect(screen.getByText('Subheading text')).toBeInTheDocument();
    expect(screen.getByText('Body paragraph content')).toBeInTheDocument();
    expect(screen.getByAltText('Module Image Alt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/explore');
    expect(screen.getByText('Plans')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });

  it('handles menu list filters and cart add/remove interactions', async () => {
    const user = userEvent.setup();

    cartState.items = [
      {
        id: 'item-1',
        moduleId: 'mod-1',
        quantity: 1,
        price: 15,
      },
    ];

    render(
      <DynamicModuleRenderer
        layout={[{ id: 'menu-1', type: 'menu_list', props: {} }] as never}
        module={moduleData as never}
      />
    );

    await screen.findByText('Pizza');
    expect(screen.getByText('Cola')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Main' }));
    expect(screen.queryByText('Cola')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'all' }));
    expect(screen.getByText('Cola')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(addItemMock).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalled();

    await user.click((screen.getAllByTestId('icon-minus')[0].closest('button')) as HTMLButtonElement);
    expect(removeItemMock).toHaveBeenCalledWith('item-1');
  });

  it('renders session list and booking calendar interactions', async () => {
    const user = userEvent.setup();

    render(
      <DynamicModuleRenderer
        layout={[
          { id: 'session-1', type: 'session_list', props: {} },
          { id: 'booking-1', type: 'booking_calendar', props: { title: 'Reserve Dates' } },
        ] as never}
        module={moduleData as never}
      />
    );

    await screen.findByText('Morning Swim');
    expect(screen.getByText('Book Now')).toBeInTheDocument();
    expect(screen.getByText('Reserve Dates')).toBeInTheDocument();

    const checkInInput = screen
      .getByText('Check-in Date')
      .parentElement?.querySelector('input[type="date"]') as HTMLInputElement;
    const checkOutInput = screen
      .getByText('Check-out Date')
      .parentElement?.querySelector('input[type="date"]') as HTMLInputElement;

    fireEvent.change(checkInInput, { target: { value: '2099-01-10' } });
    fireEvent.change(checkOutInput, { target: { value: '2099-01-12' } });

    expect(checkInInput.value).toBe('2099-01-10');
    expect(checkOutInput.value).toBe('2099-01-12');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /search availability/i })).toBeEnabled();
    });
  });

  it('submits form container successfully and surfaces submit errors', async () => {
    const user = userEvent.setup();

    supportSubmitMock.mockResolvedValueOnce({ data: { success: true } });

    const layout = [
      {
        id: 'form-1',
        type: 'form_container',
        props: {
          formAction: 'contact',
          submitText: 'Send Form',
        },
      },
    ];

    const { rerender } = render(
      <DynamicModuleRenderer layout={layout as never} module={moduleData as never} />
    );

    await user.type(document.querySelector('input[name="name"]') as HTMLInputElement, 'Taylor');
    await user.type(document.querySelector('input[name="email"]') as HTMLInputElement, 'taylor@example.com');
    await user.type(document.querySelector('textarea[name="message"]') as HTMLTextAreaElement, 'Testing submission');
    await user.click(screen.getByRole('button', { name: /send form/i }));

    await waitFor(() => {
      expect(supportSubmitMock).toHaveBeenCalled();
      expect(toastSuccessMock).toHaveBeenCalledWith('Your request has been submitted successfully!');
    });

    supportSubmitMock.mockRejectedValueOnce({ response: { data: { error: 'Submit failed' } } });

    rerender(<DynamicModuleRenderer layout={layout as never} module={moduleData as never} />);

    await user.type(document.querySelector('input[name="name"]') as HTMLInputElement, 'Jordan');
    await user.type(document.querySelector('input[name="email"]') as HTMLInputElement, 'jordan@example.com');
    await user.type(document.querySelector('textarea[name="message"]') as HTMLTextAreaElement, 'Retry submission');
    await user.click(screen.getByRole('button', { name: /send form/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Submit failed');
    });
  });
});
