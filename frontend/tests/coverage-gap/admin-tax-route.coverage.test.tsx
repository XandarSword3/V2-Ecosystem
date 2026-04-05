import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => {
  const api = {
    get: apiGetMock,
    post: apiPostMock,
    put: apiPutMock,
    delete: apiDeleteMock,
  };

  return {
    __esModule: true,
    default: api,
    api,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import TaxConfigurationPage from '../../src/app/admin/settings/tax/page';

const taxConfigSeed = {
  default_rate: 11,
  tax_included_in_price: false,
  show_tax_breakdown: true,
  rounding_method: 'round',
  decimal_places: 2,
  tax_number: 'VAT-123',
  tax_name_display: 'VAT',
  rates: [
    {
      id: 'rate-1',
      name: 'Standard VAT',
      rate: 11,
      type: 'vat',
      applies_to: ['all'],
      is_default: true,
      is_compound: false,
      created_at: '2026-06-01T00:00:00.000Z',
    },
  ],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <TaxConfigurationPage />
    </QueryClientProvider>
  );
}

describe('Admin tax route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockResolvedValue({ data: { data: taxConfigSeed } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiPostMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('loads tax configuration and saves settings', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Tax Configuration')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Save Changes/i })[0]);

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/admin/settings/tax', expect.any(Object));
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Tax configuration saved');
  });

  it('shows validation error when adding a rate without required fields', async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText('Tax Configuration');

    await user.click(screen.getAllByRole('button', { name: /Add Rate/i })[0]);
    expect(await screen.findByText('Add Tax Rate')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Add Rate/i })[1]);

    expect(toastErrorMock).toHaveBeenCalledWith('Please fill in required fields');
  });
});
