import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.hoisted(() => vi.fn());
const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

const authState = vi.hoisted(() => ({
  user: null as { id: string; fullName: string } | null,
  isAuthenticated: false,
  isLoading: false,
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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ property: 'test-property' }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

import CustomerLoyaltyPage from '../../src/app/[property]/account/loyalty/page';

describe('Customer loyalty route behavior', () => {
  beforeEach(() => {
    pushMock.mockReset();
    apiGetMock.mockReset();
    apiPostMock.mockReset();
  });

  it('presents guest-mode affordances to unauthenticated users', async () => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isLoading = false;

    render(<CustomerLoyaltyPage />);

    // Current contract (Phase F3/F10): account routes no longer hard-redirect
    // guests to /login. AccountShell shows a guest-mode banner and LoyaltyHub
    // renders its own sign-in prompt; both link out to /login.
    expect(await screen.findByText('Viewing in Guest Mode')).toBeInTheDocument();
    const signInLinks = await screen.findAllByRole('link', { name: /sign in/i });
    expect(signInLinks.length).toBeGreaterThan(0);
    for (const link of signInLinks) {
      expect(link.getAttribute('href')).toBe('/login');
    }
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('loads and renders loyalty account, tier progress, and recent activity', async () => {
    authState.user = { id: 'user-1', fullName: 'Lana Member' };
    authState.isAuthenticated = true;
    authState.isLoading = false;

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/loyalty/me') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: 'acc-1',
              currentPoints: 420,
              totalPointsEarned: 900,
              totalPointsRedeemed: 480,
              lifetimeValue: 3200,
              tier: {
                id: 'tier-silver',
                name: 'Silver',
                pointsMultiplier: 1.5,
                benefits: ['Late checkout', 'Priority support'],
                color: '#64748b',
                minPoints: 500,
              },
              nextTier: {
                name: 'Gold',
                pointsRequired: 1500,
                pointsNeeded: 600,
                color: '#eab308',
              },
            },
          },
        });
      }

      if (url === '/loyalty/me/transactions') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'txn-1',
                type: 'earned',
                points: 120,
                description: 'AccommodationUnit booking bonus',
                createdAt: '2026-08-02T10:00:00Z',
              },
            ],
          },
        });
      }

      if (url === '/loyalty/tiers') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { id: 'tier-bronze', name: 'Bronze', minPoints: 0, pointsMultiplier: 1, benefits: [], color: '#a16207' },
              { id: 'tier-silver', name: 'Silver', minPoints: 500, pointsMultiplier: 1.5, benefits: [], color: '#64748b' },
              { id: 'tier-gold', name: 'Gold', minPoints: 1500, pointsMultiplier: 2, benefits: [], color: '#eab308' },
            ],
          },
        });
      }

      return Promise.resolve({ data: { success: false } });
    });

    render(<CustomerLoyaltyPage />);

    // Current contract: balance banner is "Available Loyalty Balance" with a
    // tier badge (e.g. "Silver Tier"), and the history card is titled
    // "Loyalty Transaction Ledger".
    expect(await screen.findByText('Available Loyalty Balance')).toBeInTheDocument();
    expect(screen.getByText('Silver Tier')).toBeInTheDocument();
    expect(screen.getByText('Progress to Gold')).toBeInTheDocument();
    expect(screen.getByText('AccommodationUnit booking bonus')).toBeInTheDocument();
    expect(screen.getByText('Loyalty Transaction Ledger')).toBeInTheDocument();

    expect(apiGetMock).toHaveBeenCalledWith('/loyalty/me', expect.any(Object));
    expect(apiGetMock).toHaveBeenCalledWith('/loyalty/me/transactions', expect.any(Object));
    expect(apiGetMock).toHaveBeenCalledWith('/loyalty/tiers', expect.any(Object));
  });

  it('shows an explicit error message when loyalty API requests fail', async () => {
    authState.user = { id: 'user-1', fullName: 'Lana Member' };
    authState.isAuthenticated = true;
    authState.isLoading = false;

    apiGetMock.mockRejectedValue(new Error('network down'));

    render(<CustomerLoyaltyPage />);

    expect(await screen.findByText('Unable to load loyalty account information.')).toBeInTheDocument();
    expect(screen.getByText('Please check your connection and try again.')).toBeInTheDocument();
  });
});
