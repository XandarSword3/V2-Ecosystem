import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const propertyId = '00000000-0000-0000-0000-000000000001';

const channelConnectionsSeed = [
  {
    id: 'conn-1',
    channel_code: 'BOOKING_COM',
    channel_name: 'Booking.com',
    status: 'active',
    last_sync_at: '2026-07-10T10:00:00.000Z',
    error_count: 0,
    hotel_code: 'H100',
    api_key: 'secret-1',
  },
  {
    id: 'conn-2',
    channel_code: 'AGODA',
    channel_name: 'Agoda',
    status: 'disconnected',
    last_sync_at: null,
    error_count: 0,
    hotel_code: '',
    api_key: '',
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

import ChannelManagerPage from '../../src/app/admin/channels/page';

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
      <ChannelManagerPage />
    </QueryClientProvider>
  );
}

describe('Admin channels route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    apiGetMock.mockImplementation((url: string) => {
      if (url === `/channels/properties/${propertyId}/connections`) {
        return Promise.resolve({ data: { connections: channelConnectionsSeed } });
      }

      return Promise.reject(new Error(`Unexpected GET URL: ${url}`));
    });

    apiPostMock.mockImplementation((url: string) => {
      if (url === '/channels/connections/conn-1/sync/availability') {
        return Promise.resolve({ data: { success: true } });
      }

      if (url === `/channels/properties/${propertyId}/connections`) {
        return Promise.resolve({ data: { success: true } });
      }

      return Promise.reject(new Error(`Unexpected POST URL: ${url}`));
    });

    apiDeleteMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads channels, syncs, disconnects, and connects a channel', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Channel Manager')).toBeInTheDocument();
    expect(await screen.findByText(/Booking/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Sync All/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/channels/connections/conn-1/sync/availability');
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Sync started');

    await user.click(screen.getByRole('button', { name: /Disconnect/i }));

    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith('/channels/connections/conn-1');
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Channel disconnected');

    await user.click(screen.getByRole('button', { name: /Connect Channel/i }));

    const hotelIdInput = await screen.findByPlaceholderText('e.g., 123456');
    await user.type(hotelIdInput, 'HTL-99');

    const apiKeyInput = screen.getByPlaceholderText('••••••••••••');
    await user.type(apiKeyInput, 'my-secret-key');

    const modal = screen.getByText('Connect Channel', { selector: 'h2' }).parentElement!;
    const submitButton = within(modal).getByRole('button', { name: /^Connect$/ });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        `/channels/properties/${propertyId}/connections`,
        expect.objectContaining({
          channel_code: 'BOOKING', // page.tsx maps booking_com to BOOKING
          hotel_code: 'HTL-99',
          api_key: 'my-secret-key',
        })
      );
    }, { timeout: 3000 });

    expect(toastSuccessMock).toHaveBeenCalledWith('Channel connected');
  });

  it('shows an error toast when sync fails', async () => {
    const user = userEvent.setup();

    apiPostMock.mockImplementation((url: string) => {
      if (url === '/channels/connections/conn-1/sync/availability') {
        return Promise.reject(new Error('sync failed'));
      }

      if (url === `/channels/properties/${propertyId}/connections`) {
        return Promise.resolve({ data: { success: true } });
      }

      return Promise.reject(new Error(`Unexpected POST URL: ${url}`));
    });

    renderPage();

    await screen.findByText('Channel Manager');

    await user.click(screen.getByRole('button', { name: /Sync All/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to start sync');
    });
  });
});
