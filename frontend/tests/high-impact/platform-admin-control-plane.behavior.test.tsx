import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPatchMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/platform-admin',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
    patch: apiPatchMock,
  },
}));

import PlatformAdminPage from '../../src/app/platform-admin/page';

const mockStats = {
  total_tenants: 3,
  active_tenants: 2,
  trialing_tenants: 0,
  suspended_tenants: 1,
  total_mrr: 49800,
  mrr_growth_percent: 12.5,
  revenue_history: [
    { date: '2026-05', mrr: 39900 },
    { date: '2026-06', mrr: 49800 },
  ],
};

const mockTenants = [
  {
    id: 't-1',
    subdomain: 'azure-cove',
    email: 'admin@azurecove.test',
    subscription_tier: 'growth',
    billing_status: 'active',
    mrr: 29900,
    property_count: 2,
    module_count: 5,
    last_activity: '2026-07-01T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 't-2',
    subdomain: 'emerald-bay',
    email: 'admin@emeraldbay.test',
    subscription_tier: 'starter',
    billing_status: 'suspended',
    mrr: 19900,
    property_count: 1,
    module_count: 2,
    last_activity: '2026-06-15T10:00:00Z',
    created_at: '2026-02-01T00:00:00Z',
  },
];

describe('Platform Admin Control Plane (Engine E)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/platform/stats') {
        return Promise.resolve({ data: { success: true, data: mockStats } });
      }
      if (url === '/platform/tenants') {
        return Promise.resolve({ data: { success: true, data: mockTenants } });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
    apiPatchMock.mockResolvedValue({ data: { success: true } });
  });

  it('renders platform stats overview and tenant list', async () => {
    render(<PlatformAdminPage />);

    expect(await screen.findByText('Platform Control Plane')).toBeInTheDocument();
    expect(screen.getByText('azure-cove')).toBeInTheDocument();
    expect(screen.getByText('emerald-bay')).toBeInTheDocument();

    // Verify stats cards
    expect(screen.getByText('Total Tenants')).toBeInTheDocument();
    expect(screen.getByText('Trialing')).toBeInTheDocument();
    expect(screen.getAllByText('Suspended').length).toBeGreaterThan(0);
    expect(screen.getByText('Total MRR')).toBeInTheDocument();
  });

  it('filters tenant list via search input', async () => {
    const user = userEvent.setup();
    render(<PlatformAdminPage />);

    await screen.findByText('azure-cove');

    const searchInput = screen.getByPlaceholderText(/search subdomain/i);
    await user.type(searchInput, 'emerald');

    expect(screen.getByText('emerald-bay')).toBeInTheDocument();
    expect(screen.queryByText('azure-cove')).not.toBeInTheDocument();
  });

  it('allows suspending an active tenant', async () => {
    const user = userEvent.setup();
    render(<PlatformAdminPage />);

    await screen.findByText('azure-cove');

    const suspendBtn = screen.getByRole('button', { name: /suspend/i });
    await user.click(suspendBtn);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/platform/tenants/t-1/suspend');
    });
  });

  it('allows restoring a suspended tenant', async () => {
    const user = userEvent.setup();
    render(<PlatformAdminPage />);

    await screen.findByText('emerald-bay');

    const restoreBtn = screen.getByRole('button', { name: /restore/i });
    await user.click(restoreBtn);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/platform/tenants/t-2/unsuspend');
    });
  });

  it('allows changing tenant subscription tier via select', async () => {
    const user = userEvent.setup();
    render(<PlatformAdminPage />);

    await screen.findByText('azure-cove');

    // Index 0 is the status filter dropdown, index 1 is azure-cove's tier select
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[1], 'enterprise');

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith('/platform/tenants/t-1/tier', {
        tier: 'enterprise',
      });
    });
  });
});
