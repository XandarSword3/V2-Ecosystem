import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
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
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
  },
}));

import AdminAuditPage from '../../src/app/admin/audit/page';

const logSeed = [
  {
    id: 'log-1',
    action: 'CREATE',
    resource: 'user',
    resource_id: 'user-1',
    old_value: null,
    new_value: JSON.stringify({ email: 'new.user@example.com', role: 'admin' }),
    ip_address: '10.0.0.1',
    created_at: '2025-01-02T10:00:00.000Z',
    users: {
      full_name: 'System Admin',
      email: 'admin@example.com',
    },
  },
  {
    id: 'log-2',
    action: 'PROFILE_UPDATE',
    resource: 'users',
    resource_id: 'user-2',
    old_value: JSON.stringify({ full_name: 'Old Name' }),
    new_value: JSON.stringify({ full_name: 'New Name' }),
    ip_address: '10.0.0.2',
    created_at: '2025-01-02T11:00:00.000Z',
    users: {
      full_name: 'Editor User',
      email: 'editor@example.com',
    },
  },
];

describe('Admin audit route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    toastErrorMock.mockReset();
    apiGetMock.mockResolvedValue({ data: { data: logSeed } });
  });

  it('renders logs, filters by action, and opens log details modal', async () => {
    const user = userEvent.setup();

    render(<AdminAuditPage />);

    expect(await screen.findByText('Audit Logs')).toBeInTheDocument();
    expect(screen.getByText('Track all system activities and changes')).toBeInTheDocument();

    expect(screen.getByText('System Admin')).toBeInTheDocument();
    expect(screen.getByText('Editor User')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search logs...'), 'editor');
    expect(screen.getByText('Editor User')).toBeInTheDocument();

    const [actionFilter] = screen.getAllByRole('combobox');
    await user.selectOptions(actionFilter, 'PROFILE_UPDATE');

    expect(screen.getByText('Editor User')).toBeInTheDocument();

    await user.click(screen.getByText('Editor User'));

    expect(await screen.findByText('Audit Log Details')).toBeInTheDocument();
    expect(screen.getByText('Previous Values')).toBeInTheDocument();
    expect(screen.getByText('New Values')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '×' }));
    await waitFor(() => {
      expect(screen.queryByText('Audit Log Details')).not.toBeInTheDocument();
    });
  });

  it('shows empty state and toast error when logs fetch fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('network issue'));

    render(<AdminAuditPage />);

    expect(await screen.findByText('Audit Logs')).toBeInTheDocument();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to fetch audit logs');
    });

    expect(screen.getByText('No audit logs found')).toBeInTheDocument();
  });
});
