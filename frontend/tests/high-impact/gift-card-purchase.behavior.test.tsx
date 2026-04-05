import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

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
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('@/lib/utils', () => ({
  formatCurrency: (value: number) => `$${value.toFixed(2)}`,
}));

vi.mock('@/stores/settingsStore', () => ({
  currencySymbols: {
    USD: '$',
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { GiftCardPurchase } from '../../src/components/customer/GiftCardPurchase';

const templatesResponse = {
  data: {
    success: true,
    data: [
      {
        id: 'tpl-50',
        name: 'Classic',
        amount: 50,
        design: {
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
        },
        isActive: true,
      },
      {
        id: 'tpl-100-inactive',
        name: 'Hidden',
        amount: 100,
        design: {
          background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
        },
        isActive: false,
      },
    ],
  },
};

describe('GiftCardPurchase behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockResolvedValue(templatesResponse);
    apiPostMock.mockResolvedValue({
      data: {
        success: true,
        data: { id: 'gift-1', code: 'GC-001' },
      },
    });
  });

  it('loads and displays active templates only', async () => {
    render(<GiftCardPurchase />);

    expect(await screen.findByText('Send a Gift Card')).toBeInTheDocument();
    expect(screen.getByText('Classic')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('validates required recipient details and completes template purchase', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<GiftCardPurchase onSuccess={onSuccess} />);

    await user.click(await screen.findByRole('button', { name: /Classic/i }));

    const purchaseButton = screen.getByRole('button', { name: /Purchase \$50\.00/i });
    expect(purchaseButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Your name (will appear on card)'), {
      target: { value: 'Maya' },
    });
    fireEvent.change(screen.getByPlaceholderText('Where should we send the gift card?'), {
      target: { value: 'maya@example.com' },
    });

    expect(screen.getByRole('button', { name: /Purchase \$50\.00/i })).not.toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Purchase \$50\.00/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/giftcards/purchase',
        expect.objectContaining({
          templateId: 'tpl-50',
          recipientEmail: 'maya@example.com',
          senderName: 'Maya',
          customAmount: undefined,
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Gift card purchased successfully!');
    expect(onSuccess).toHaveBeenCalledWith({ id: 'gift-1', code: 'GC-001' });
    expect(screen.getByText('Send a Gift Card')).toBeInTheDocument();
  });

  it('navigates back to amount selection from details step', async () => {
    const user = userEvent.setup();

    render(<GiftCardPurchase />);

    await user.click(await screen.findByRole('button', { name: /Classic/i }));
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back/i }));

    expect(screen.getByText('Send a Gift Card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
  });
});
