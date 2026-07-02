import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/utils/performance', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    modules: [
      {
        id: 'mod-menu service',
        template_type: 'menu_service',
        name: 'MenuService',
        slug: 'menu_service',
        is_active: true,
        sort_order: 1,
      },
    ],
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import AdminCustomizationsPage from '../../src/app/[property]/admin/customizations/page';

const groupsSeed = [
  {
    id: 'group-1',
    name: 'Sizes',
    description: 'Pick a serving size',
    selectionMode: 'single',
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    applicableEntityTypes: ['menu_item'],
    isGlobal: false,
    isAvailable: true,
    sortOrder: 1,
    options: [
      {
        id: 'opt-1',
        groupId: 'group-1',
        name: 'Large',
        customizationType: 'add',
        priceAdjustment: 3,
        priceType: 'fixed',
        quantityPerSelection: 1,
        maxQuantity: 1,
        isDefault: false,
        isPopular: true,
        isAvailable: true,
        sortOrder: 1,
      },
    ],
  },
];

const metricsSeed = [
  {
    metricName: 'validation_latency_ms',
    sampleCount: 20,
    avgValue: 12.1,
    minValue: 8,
    maxValue: 20,
    p50: 11,
    p95: 18,
    p99: 20,
    hour: '2026-06-04T10:00:00.000Z',
  },
  {
    metricName: 'inventory_processing_ms',
    sampleCount: 20,
    avgValue: 15.2,
    minValue: 10,
    maxValue: 22,
    p50: 14,
    p95: 19,
    p99: 22,
    hour: '2026-06-04T10:00:00.000Z',
  },
];

const dualWriteSeed = {
  total: 42,
  matches: 40,
  mismatches: 2,
  matchRate: 95.2,
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
      <AdminCustomizationsPage />
    </QueryClientProvider>
  );
}

describe('Admin customizations route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/customizations/groups') {
        return Promise.resolve({ data: groupsSeed });
      }
      if (url === '/customizations/metrics') {
        return Promise.resolve({ data: metricsSeed });
      }
      if (url === '/customizations/dual-write/stats') {
        return Promise.resolve({ data: dualWriteSeed });
      }
      return Promise.resolve({ data: [] });
    });

    apiPostMock.mockImplementation((url: string) => {
      if (url === '/customizations/migrate') {
        return Promise.resolve({ data: { groups: 2, options: 5, links: 8 } });
      }
      return Promise.resolve({ data: { success: true } });
    });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('loads groups, opens metrics and migration tabs, then runs migration', async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText('Customization Manager');
    await screen.findByText('Sizes');

    await user.click(screen.getByRole('button', { name: /Performance Metrics/i }));
    expect(await screen.findByText('Validation Latency')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Migration & Dual-Write/i }));
    expect(await screen.findByText('Dual-Write Monitoring')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Run Migration/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/customizations/migrate');
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Migration completed: 2 groups, 5 options, 8 links');
  });

  it('shows mutation error when migration fails', async () => {
    apiPostMock.mockImplementation((url: string) => {
      if (url === '/customizations/migrate') {
        return Promise.reject({ response: { data: { error: 'Cannot migrate now' } } });
      }
      return Promise.resolve({ data: { success: true } });
    });

    renderPage();

    await screen.findByText('Customization Manager');

    fireEvent.click(screen.getByRole('button', { name: /Migration & Dual-Write/i }));
    await waitFor(() => {
      expect(screen.getByText('Dual-Write Monitoring')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Run Migration/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Cannot migrate now');
    });
  });
});
