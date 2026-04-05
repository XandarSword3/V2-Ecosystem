import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const translateMock = vi.hoisted(() => (key: string) => key);

vi.mock('next-intl', () => ({
  useTranslations: () => translateMock,
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: any; href: string }) => <a href={href}>{children}</a>,
}));

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

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import ScheduledReportsPage from '../../src/app/admin/reports/scheduled/page';

const scheduledReportsSeed = [
  {
    id: 'report-1',
    name: 'Daily Revenue',
    type: 'daily',
    report_type: 'revenue',
    recipients: ['ops@example.com'],
    enabled: true,
    last_sent_at: null,
    next_run_at: '2026-06-10T07:00:00.000Z',
    created_at: '2026-06-01T10:00:00.000Z',
  },
];

describe('Admin scheduled reports route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockResolvedValue({ data: { data: scheduledReportsSeed } });
    apiPostMock.mockResolvedValue({ data: { success: true } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('loads reports and sends a scheduled report immediately', async () => {
    const user = userEvent.setup();

    render(<ScheduledReportsPage />);

    expect(await screen.findByText('Scheduled Reports')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Send Now/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/admin/reports/scheduled/report-1/send');
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Report sent successfully');
  });

  it('shows validation error when creating report without a name', async () => {
    const user = userEvent.setup();

    apiGetMock.mockResolvedValueOnce({ data: { data: [] } });

    render(<ScheduledReportsPage />);

    await screen.findByText('Scheduled Reports');

    await user.click(screen.getByRole('button', { name: /New Report/i }));
    expect(await screen.findByText('New Scheduled Report')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Create Report/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('Please enter a report name');
  });
});
