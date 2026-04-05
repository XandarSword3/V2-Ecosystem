import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const propertiesSeed = [
  {
    id: 'prop-1',
    name: 'Azure Bay Resort',
    code: 'AZR-001',
    type: 'resort',
    status: 'active',
    city: 'Naples',
    country: 'Italy',
    total_rooms: 120,
    available_rooms: 30,
    occupancy_rate: 75,
    revenue_today: 9200,
    revenue_mtd: 132000,
    reservations_today: 15,
    staff_count: 46,
  },
  {
    id: 'prop-2',
    name: 'Harbor View Hotel',
    code: 'HVH-002',
    type: 'hotel',
    status: 'maintenance',
    city: 'Genoa',
    country: 'Italy',
    total_rooms: 60,
    available_rooms: 0,
    occupancy_rate: 0,
    revenue_today: 0,
    revenue_mtd: 12000,
    reservations_today: 0,
    staff_count: 18,
  },
];

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import MultiPropertyPage from '../../src/app/admin/properties/page';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MultiPropertyPage />
    </QueryClientProvider>
  );
}

describe('Admin properties route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockResolvedValue({ data: { properties: propertiesSeed } });

    apiPostMock.mockImplementation((url: string, payload: Record<string, unknown>) => {
      if (url === '/multi-property/switch-property') {
        return Promise.resolve({ data: { success: true, propertyId: payload.property_id } });
      }

      if (url === '/multi-property/properties') {
        return Promise.resolve({ data: { success: true } });
      }

      return Promise.reject(new Error(`Unexpected endpoint: ${url}`));
    });
  });

  it('loads properties, switches property context, and creates a new property', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Multi-Property Management')).toBeInTheDocument();
    expect(await screen.findByText('Azure Bay Resort')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Switch to Property/i })[0]);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/multi-property/switch-property', { property_id: 'prop-1' });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Switched to Azure Bay Resort');

    await user.click(screen.getByRole('button', { name: /Add Property/i }));

    const nameInput = await screen.findByPlaceholderText('e.g., Iron Paradise Gym Downtown');
    await user.type(nameInput, 'Sunset Cliff Villas');

    const codeInput = screen.getByPlaceholderText('e.g., V2-DTN');
    await user.type(codeInput, 'SCV-003');

    await user.click(screen.getAllByRole('button', { name: /Add Property/i })[1]);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/multi-property/properties',
        expect.objectContaining({
          name: 'Sunset Cliff Villas',
          property_code: 'SCV-003',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Property created');
  });

  it('shows a validation error when creating a property without a name', async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText('Multi-Property Management');

    await user.click(screen.getByRole('button', { name: /Add Property/i }));
    await user.click(screen.getAllByRole('button', { name: /Add Property/i })[1]);

    expect(toastErrorMock).toHaveBeenCalledWith('Property name is required');
  });
});
