import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPatchMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => {
  const api = {
    get: apiGetMock,
    post: apiPostMock,
    patch: apiPatchMock,
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

import QuickBooksIntegrationPage from '../../src/app/admin/integrations/quickbooks/page';

describe('QuickBooks integration route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPatchMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/integrations/quickbooks/status') {
        return Promise.resolve({
          data: {
            connected: true,
            connectionId: 'qb-1',
            companyId: '12345',
            companyName: 'Acme Property LLC',
            syncEnabled: true,
            lastSync: '2025-01-05T10:00:00.000Z',
            lastSyncStatus: 'completed_with_errors',
          },
        });
      }

      if (url === '/integrations/quickbooks/qb-1/sync/history') {
        return Promise.resolve({
          data: {
            history: [
              {
                id: 'hist-1',
                syncType: 'sales',
                status: 'completed',
                recordsProcessed: 12,
                recordsSynced: 10,
                recordsFailed: 2,
                startedAt: '2025-01-05T10:00:00.000Z',
                completedAt: '2025-01-05T10:01:00.000Z',
              },
            ],
          },
        });
      }

      if (url === '/integrations/quickbooks/qb-1/mappings') {
        return Promise.resolve({
          data: {
            categories: [
              {
                key: 'restaurant_sales',
                name: 'MenuService Sales',
                defaultType: 'Income',
                mapped: null,
              },
            ],
          },
        });
      }

      if (url === '/integrations/quickbooks/qb-1/accounts') {
        return Promise.resolve({
          data: {
            accounts: [
              {
                id: 'acc-income',
                name: 'Food Revenue',
                accountType: 'Income',
                classification: 'Income',
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: {} });
    });

    apiPostMock.mockImplementation((url: string) => {
      if (url === '/integrations/quickbooks/qb-1/sync') {
        return Promise.resolve({
          data: {
            success: true,
            recordsSynced: 8,
            recordsFailed: 1,
          },
        });
      }

      return Promise.resolve({ data: { success: true } });
    });

    apiPatchMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads connected state and supports sync, mapping, toggle, and disconnect actions', async () => {
    const user = userEvent.setup();

    render(<QuickBooksIntegrationPage />);

    expect(await screen.findByText('QuickBooks Integration')).toBeInTheDocument();
    expect(await screen.findByText('Acme Property LLC')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Sync Now/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/integrations/quickbooks/qb-1/sync', {
        syncType: 'sales',
      });
    });

    await user.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith('/integrations/quickbooks/qb-1/settings', {
        syncEnabled: false,
      });
    });

    await user.click(screen.getByRole('tab', { name: /Account Mappings/i }));
    expect(await screen.findByText('MenuService Sales')).toBeInTheDocument();

    const mappingSelect = screen.getByDisplayValue('Select account...');
    await user.selectOptions(mappingSelect, 'acc-income');

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/integrations/quickbooks/qb-1/mappings', {
        v2Category: 'restaurant_sales',
        qbAccountId: 'acc-income',
        qbAccountName: 'Food Revenue',
        qbAccountType: 'Income',
      });
    });

    await user.click(screen.getByRole('tab', { name: /Sync History/i }));
    expect(await screen.findByText('sales Sync')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Disconnect/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/integrations/quickbooks/qb-1/disconnect');
    });
  });

  it('renders disconnected state when no QuickBooks connection exists', async () => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValueOnce({ data: { connected: false } });

    render(<QuickBooksIntegrationPage />);

    expect(await screen.findByText('Connection Status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect QuickBooks/i })).toBeInTheDocument();
  });
});
