import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const propertyId = '00000000-0000-0000-0000-000000000001';

const kioskSeed = [
  {
    id: 'kiosk-1',
    property_id: propertyId,
    location: 'Main Lobby',
    name: 'Lobby Kiosk',
    status: 'online',
    capabilities: ['id_scanner', 'card_reader'],
    last_heartbeat: '2026-07-10T14:10:00.000Z',
    key_stock: 5,
    is_active: true,
    config: {
      timeout_seconds: 90,
      language: 'en',
      features_enabled: ['checkin'],
    },
  },
];

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: apiGetMock,
    post: apiPostMock,
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
    activePropertyId: propertyId,
    activeProperty: { id: propertyId, name: 'Test Property' },
    setActiveProperty: vi.fn(),
    properties: [],
    loading: false,
    refreshProperties: vi.fn(),
  }),
}));

import KioskAdminPage from '../../src/app/admin/kiosk/page';

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
      <KioskAdminPage />
    </QueryClientProvider>
  );
}

describe('Admin kiosk route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    apiGetMock.mockResolvedValue({ data: { data: kioskSeed } });

    apiPostMock.mockImplementation((url: string) => {
      if (url === `/kiosk/devices/${propertyId}`) {
        return Promise.resolve({ data: { success: true } });
      }

      if (url === '/kiosk/devices/kiosk-1/maintenance') {
        return Promise.resolve({ data: { success: true } });
      }

      if (url === '/kiosk/key-stock/kiosk-1/refill') {
        return Promise.resolve({ data: { success: true } });
      }

      return Promise.reject(new Error(`Unexpected POST URL: ${url}`));
    });

    apiDeleteMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads kiosks and handles refill, maintenance, deactivate, and register flows', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Kiosk Management')).toBeInTheDocument();
    expect(screen.getByText('Lobby Kiosk')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Refill/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/kiosk/key-stock/kiosk-1/refill', { quantity: 50 });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Key stock refilled');

    await user.click(screen.getByTitle('Enter Maintenance'));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/kiosk/devices/kiosk-1/maintenance', { enabled: true });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Maintenance mode updated');

    await user.click(screen.getByTitle('Deactivate'));

    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith('/kiosk/devices/kiosk-1');
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Kiosk deactivated');

    await user.click(screen.getByRole('button', { name: /Add Kiosk/i }));

    const nameInput = await screen.findByPlaceholderText('Lobby Kiosk 1');
    await user.type(nameInput, 'Poolside Kiosk');

    const locationInput = screen.getByPlaceholderText('Main Lobby');
    await user.clear(locationInput);
    await user.type(locationInput, 'Pool Entrance');

    await user.click(screen.getByLabelText(/id scanner/i));

    await user.click(screen.getByRole('button', { name: /^Register$/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        `/kiosk/devices/${propertyId}`,
        expect.objectContaining({
          deviceName: 'Poolside Kiosk',
          location: 'Pool Entrance',
          capabilities: expect.objectContaining({
            hasIdScanner: true,
          }),
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Kiosk registered successfully');
  });

  it('shows an error toast when kiosk registration fails', async () => {
    const user = userEvent.setup();

    apiPostMock.mockImplementation((url: string) => {
      if (url === `/kiosk/devices/${propertyId}`) {
        return Promise.reject({ response: { data: { error: 'Registration failed' } } });
      }

      if (url === '/kiosk/devices/kiosk-1/maintenance') {
        return Promise.resolve({ data: { success: true } });
      }

      if (url === '/kiosk/key-stock/kiosk-1/refill') {
        return Promise.resolve({ data: { success: true } });
      }

      return Promise.reject(new Error(`Unexpected POST URL: ${url}`));
    });

    renderPage();

    await screen.findByText('Kiosk Management');

    await user.click(screen.getByRole('button', { name: /Add Kiosk/i }));
    await user.type(screen.getByPlaceholderText('Lobby Kiosk 1'), 'Desk Kiosk');
    await user.click(screen.getByRole('button', { name: /^Register$/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Registration failed');
    });
  });
});
