import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

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

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/context/PropertyContext', () => ({
  useProperty: () => ({
    activePropertyId: 'prop-1',
    activeProperty: { id: 'prop-1', name: 'Test Property', type: 'resort' },
    properties: [],
    setActiveProperty: vi.fn(),
    loading: false,
    refreshProperties: vi.fn(),
  }),
  PropertyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import GiftCardsAdminPage from '../../src/app/admin/giftcards/page';

const giftCardsSeed = [
  {
    id: 'gift-1',
    code: 'GC-2026-0001',
    initial_value: 120,
    current_balance: 120,
    status: 'active',
    recipient_name: 'Lina Guest',
    recipient_email: 'lina@example.com',
    created_at: '2026-06-01T10:00:00.000Z',
  },
];

const templatesSeed = [
  {
    id: 'tpl-1',
    name: 'Birthday Gift',
    amount: 100,
    discount_percent: 0,
    is_active: true,
  },
];

const statsSeed = {
  summary: {
    total_cards: 1,
    active_cards: 1,
    total_sold: 120,
    total_redeemed: 0,
    outstanding_balance: 120,
  },
};

describe('Admin gift cards route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/giftcards/admin') {
        return Promise.resolve({ data: { success: true, data: giftCardsSeed } });
      }
      if (url === '/giftcards/templates') {
        return Promise.resolve({ data: { success: true, data: templatesSeed } });
      }
      if (url === '/giftcards/admin/stats') {
        return Promise.resolve({ data: { success: true, data: statsSeed } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true, data: { code: 'GC-NEW-0001' } } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(),
      },
      configurable: true,
    });
  });

  it('loads data and creates a new gift card', async () => {
    const user = userEvent.setup();

    render(<GiftCardsAdminPage />);

    expect(await screen.findByRole('heading', { name: 'Gift Cards' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Create Gift Card/i }));
    expect(await screen.findByRole('heading', { name: 'Create Gift Card' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Enter gift card value'), '75');
    await user.click(screen.getAllByRole('button', { name: /Create Gift Card/i })[1]);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/giftcards/admin',
        expect.objectContaining({
          initialValue: expect.any(Number),
        }),
        expect.any(Object)
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith(expect.stringContaining('Gift card created:'));
  });

  it('shows validation error when trying to create gift card without value', async () => {
    const user = userEvent.setup();

    render(<GiftCardsAdminPage />);

    await screen.findByRole('heading', { name: 'Gift Cards' });

    await user.click(screen.getByRole('button', { name: /Create Gift Card/i }));
    await user.click(screen.getAllByRole('button', { name: /Create Gift Card/i })[1]);

    expect(toastErrorMock).toHaveBeenCalledWith('Please enter a value');
  });
});
