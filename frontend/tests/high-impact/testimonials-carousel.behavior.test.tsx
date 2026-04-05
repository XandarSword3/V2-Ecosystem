import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null as { id: string } | null,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
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

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', () => ({
  API_BASE_URL: 'https://example.test',
  api: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import TestimonialsCarousel from '../../src/components/TestimonialsCarousel';

const reviewsPayload = {
  status: 200,
  data: {
    data: {
      reviews: [
        {
          id: 'r1',
          rating: 5,
          text: 'Amazing food and service',
          service_type: 'restaurant',
          created_at: '2026-01-01T10:00:00.000Z',
          users: {
            full_name: 'Maya Reed',
            profile_image_url: '',
          },
        },
      ],
      stats: {
        averageRating: 4.8,
        totalReviews: 120,
      },
    },
  },
};

describe('TestimonialsCarousel behavior', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    authState.isAuthenticated = false;
    authState.user = null;

    apiGetMock.mockResolvedValue({
      status: 200,
      data: {
        data: {
          reviews: [],
          stats: {
            averageRating: 0,
            totalReviews: 0,
          },
        },
      },
    });
  });

  it('shows no-reviews state and login CTA when unauthenticated', async () => {
    render(<TestimonialsCarousel />);

    expect(await screen.findByText('noReviewsYet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /loginToReview/i })).toHaveAttribute('href', '/login');
  });

  it('renders fetched testimonials and stats from API data', async () => {
    apiGetMock.mockResolvedValue(reviewsPayload);

    render(<TestimonialsCarousel />);

    expect(await screen.findByText(/Amazing food and service/i)).toBeInTheDocument();
    expect(screen.getByText('Maya Reed')).toBeInTheDocument();
    expect(screen.getByText('Restaurant Guest')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('120+')).toBeInTheDocument();
  });

  it('validates empty review text and submits a review successfully for authenticated users', async () => {
    const user = userEvent.setup();

    authState.isAuthenticated = true;
    authState.user = { id: 'user-1' };

    apiGetMock
      .mockResolvedValueOnce(reviewsPayload)
      .mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            reviews: [
              ...reviewsPayload.data.data.reviews,
              {
                id: 'r2',
                rating: 4,
                text: 'Great ambiance',
                service_type: 'general',
                created_at: '2026-01-02T12:00:00.000Z',
                users: {
                  full_name: 'Liam Ford',
                },
              },
            ],
            stats: {
              average_rating: 4.7,
              total_reviews: 121,
            },
          },
        },
      });

    apiPostMock.mockResolvedValue({ status: 201, data: { success: true } });

    render(<TestimonialsCarousel />);

    expect(await screen.findByText(/Amazing food and service/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /leaveReview/i }));
    await user.click(screen.getByRole('button', { name: /submitReview/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('pleaseWriteReview');

    fireEvent.change(screen.getByPlaceholderText('reviewPlaceholder'), {
      target: { value: 'A very relaxing stay.' },
    });
    await user.click(screen.getByRole('button', { name: /submitReview/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/reviews', {
        rating: 5,
        text: 'A very relaxing stay.',
        service_type: 'general',
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('reviewSubmitted');
    expect(apiGetMock).toHaveBeenCalledTimes(2);
  });
});
