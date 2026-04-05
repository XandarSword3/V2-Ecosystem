import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastLoadingMock = vi.hoisted(() => vi.fn());
const translateMock = vi.hoisted(() => (key: string) => key);

vi.mock('next-intl', () => ({
  useTranslations: () => translateMock,
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

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    loading: toastLoadingMock,
  },
}));

import BackupsPage from '../../src/app/admin/settings/backups/page';

const backupsSeed = [
  {
    id: 'backup-1',
    filename: 'backup-2026-06-10.json',
    size_bytes: 4096,
    status: 'completed',
    type: 'manual',
    created_at: '2026-06-10T08:00:00.000Z',
    users: { full_name: 'Admin User' },
  },
];

describe('Admin backups route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    toastLoadingMock.mockReset();

    apiGetMock.mockResolvedValue({ data: { success: true, data: backupsSeed } });
    apiPostMock.mockImplementation((url: string) => {
      if (url === '/admin/backups') {
        return Promise.resolve({
          data: {
            success: true,
            data: { filename: 'backup-2026-06-11.json' },
          },
        });
      }
      return Promise.resolve({ data: { success: true } });
    });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('loads backups and creates a manual snapshot', async () => {
    const user = userEvent.setup();

    render(<BackupsPage />);

    expect(await screen.findByText('backups.title')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /createBackup/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/admin/backups');
    });

    expect(toastSuccessMock).toHaveBeenCalledWith(
      expect.stringContaining('Backup created: backup-2026-06-11.json'),
      expect.any(Object)
    );
  });

  it('shows validation error when non-json restore file is selected', async () => {
    const { container } = render(<BackupsPage />);

    await screen.findByText('backups.title');

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const invalidFile = new File(['not-json'], 'backup.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(toastErrorMock).toHaveBeenCalledWith('Invalid file type. Please upload a JSON backup file.');
  });
});
