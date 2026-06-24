import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());

const socketOnMock = vi.hoisted(() => vi.fn());
const socketOffMock = vi.hoisted(() => vi.fn());

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
  },
}));

vi.mock('@/lib/socket', () => ({
  useSocket: () => ({
    socket: {
      on: socketOnMock,
      off: socketOffMock,
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import AdminPaymentsPage from '../../src/app/admin/settings/payments/page';

const payments = [
  {
    id: 'pay-1',
    amount: 125,
    payment_method: 'card',
    status: 'completed',
    reference_type: 'booking',
    reference_id: 'bk-001',
    created_at: '2026-08-10T12:00:00Z',
    users: {
      full_name: 'Lina Guest',
      email: 'lina@example.com',
    },
  },
  {
    id: 'pay-2',
    amount: 80,
    payment_method: 'cash',
    status: 'pending',
    reference_type: 'capacity_ticket',
    reference_id: 'pt-001',
    created_at: '2026-08-10T13:00:00Z',
    users: {
      full_name: 'Marc Guest',
      email: 'marc@example.com',
    },
  },
];

let paymentsState: typeof payments = [];
let paymentSettingsState = {
  stripePublicKey: 'pk_test_123',
  stripeSecretKey: 'sk_test_123',
  stripeWebhookSecret: 'whsec_123',
  stripeMode: 'test',
  currency: 'USD',
};

describe('Admin payments route behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();

    socketOnMock.mockReset();
    socketOffMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    paymentsState = payments.map((payment) => ({
      ...payment,
      users: { ...payment.users },
    }));
    paymentSettingsState = {
      stripePublicKey: 'pk_test_123',
      stripeSecretKey: 'sk_test_123',
      stripeWebhookSecret: 'whsec_123',
      stripeMode: 'test',
      currency: 'USD',
    };

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/payments/transactions') {
        return Promise.resolve({ data: { data: paymentsState } });
      }
      if (url === '/admin/settings') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              payments: paymentSettingsState,
            },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
    apiPutMock.mockImplementation((_url: string, payload: { key: string; value: typeof paymentSettingsState }) => {
      if (payload.key === 'payments') {
        paymentSettingsState = { ...payload.value };
      }
      return Promise.resolve({ data: { success: true } });
    });

    vi.stubGlobal('prompt', vi.fn().mockReturnValue('duplicate payment'));
  });

  it('loads transactions, switches to provider settings, and saves configuration', async () => {
    const user = userEvent.setup();

    render(<AdminPaymentsPage />);

    expect(await screen.findByText('Lina Guest')).toBeInTheDocument();
    expect(screen.getByText('booking')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Provider Config' }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'EUR' } });

    await user.click(screen.getByRole('button', { name: /Save Configuration/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/admin/settings', {
        key: 'payments',
        value: expect.objectContaining({
          currency: 'EUR',
          stripeMode: 'test',
        }),
      });
    });

    const currencySelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    expect(currencySelect.value).toBe('EUR');
    expect(screen.getByText('General Payment Settings')).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledWith('Payment settings saved successfully');
  });

  it('prompts for a reason and submits a refund for completed transactions', async () => {
    const user = userEvent.setup();

    render(<AdminPaymentsPage />);

    expect(await screen.findByText('Lina Guest')).toBeInTheDocument();

    apiPostMock.mockImplementation(async () => {
      paymentsState = paymentsState.map((payment) =>
        payment.id === 'pay-1'
          ? { ...payment, status: 'refunded' }
          : payment
      );
      return { data: { success: true } };
    });

    await user.click(screen.getByRole('button', { name: 'Refund' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/payments/transactions/pay-1/refund', {
        reason: 'duplicate payment',
      });
    });

    await waitFor(() => {
      const linaRow = screen.getByText('Lina Guest').closest('tr');
      expect(linaRow).not.toBeNull();
      expect(within(linaRow as HTMLTableRowElement).getByText('refunded')).toBeInTheDocument();
      expect(within(linaRow as HTMLTableRowElement).queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Refund processed successfully');
  });
});
