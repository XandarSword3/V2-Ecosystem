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
    name: 'Azure Bay Property',
    code: 'AZR-001',
    type: 'property',
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
  api: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

vi.mock('@/context/PropertyContext', () => ({
  useProperty: () => ({
    activePropertyId: 'prop-1',
    activeProperty: { id: 'prop-1', name: 'Azure Bay Property' },
    setActiveProperty: vi.fn(),
    properties: [],
    loading: false,
    refreshProperties: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import MultiPropertyPage from '../../src/app/[property]/admin/properties/page';

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

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/multi-property/my-properties') {
        return Promise.resolve({ data: { properties: propertiesSeed } });
      }
      // Economics and module queries — return empty so PropertyCard renders '—' safely
      return Promise.resolve({ data: { data: null } });
    });

    apiPostMock.mockImplementation((url: string) => {
      if (url === '/multi-property/properties') {
        return Promise.resolve({ data: { success: true } });
      }

      return Promise.reject(new Error(`Unexpected endpoint: ${url}`));
    });
  });

  it('loads properties and creates a new property', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Property Management')).toBeInTheDocument();
    expect(await screen.findByText('Azure Bay Property')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add Property/i }));

    const nameInput = await screen.findByPlaceholderText('My Property Name');
    await user.type(nameInput, 'Sunset Cliff Villas');

    const cityInput = screen.getByPlaceholderText('City');
    await user.type(cityInput, 'Naples');

    const countryInput = screen.getByPlaceholderText('Country');
    await user.type(countryInput, 'Italy');

    await user.click(screen.getByRole('button', { name: /Deploy Property/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/multi-property/properties',
        expect.objectContaining({
          name: 'Sunset Cliff Villas',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Property created successfully');
  });

  it('shows a validation error when creating a property without a name', async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText('Property Management');

    await user.click(screen.getByRole('button', { name: /Add Property/i }));
    await screen.findByText('Deploy New Property');
    await user.click(screen.getByRole('button', { name: /Deploy Property/i }));

    // HTML5 required validation prevents submission — form stays open
    expect(await screen.findByText('Deploy New Property')).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});
