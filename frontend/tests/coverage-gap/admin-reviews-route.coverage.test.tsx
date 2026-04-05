import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const reviewsSeed = [
  {
    id: 'rev-1',
    rating: 5,
    text: 'Amazing stay and excellent service.',
    service_type: 'restaurant',
    is_approved: false,
    created_at: '2026-07-01T12:00:00.000Z',
    users: {
      id: 'u-1',
      full_name: 'Maria Rossi',
      email: 'maria@example.com',
    },
  },
  {
    id: 'rev-2',
    rating: 4,
    text: 'Very clean chalets and friendly staff.',
    service_type: 'chalets',
    is_approved: true,
    created_at: '2026-07-02T12:00:00.000Z',
    users: {
      id: 'u-2',
      full_name: 'Luca Bianchi',
      email: 'luca@example.com',
    },
  },
];

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');

  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string | symbol) => {
        if (typeof tag !== 'string' || tag === 'then' || tag === 'catch' || tag === 'finally') {
          return undefined;
        }

        const MotionComponent = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);

        return MotionComponent;
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

import AdminReviewsPage from '../../src/app/admin/reviews/page';

describe('Admin reviews route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockResolvedValue({ data: { data: reviewsSeed } });
    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads reviews and handles approve/revoke actions', async () => {
    const user = userEvent.setup();

    render(<AdminReviewsPage />);

    expect(await screen.findByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Amazing stay and excellent service.')).toBeInTheDocument();
    expect(screen.getByText('Very clean chalets and friendly staff.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Approve/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/reviews/rev-1/approve');
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Review approved');

    await user.click(screen.getAllByRole('button', { name: /Revoke/i })[1]);

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/reviews/rev-2/reject');
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Review rejected');
  });

  it('shows an error toast when review fetch fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('fetch failed'));

    render(<AdminReviewsPage />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to fetch reviews');
    });

    expect(await screen.findByText('No reviews found')).toBeInTheDocument();
  });
});
