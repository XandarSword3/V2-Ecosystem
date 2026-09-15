import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountShell } from '../../src/components/shells/AccountShell';
import { LoyaltyHub } from '../../src/components/customer/account/LoyaltyHub';
import { ReviewsHub } from '../../src/components/customer/account/ReviewsHub';
import { RecoveryHub } from '../../src/components/customer/account/RecoveryHub';
import { ReturnsHub } from '../../src/components/customer/account/ReturnsHub';
import { OrdersHub } from '../../src/components/customer/account/OrdersHub';

// ============================================
// MOCKS
// ============================================

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPatchMock = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
  },
}));

let mockUser: any = {
  id: 'usr-123',
  userId: 'usr-123',
  email: 'customer@v2resort.com',
  fullName: 'Alice Customer',
  roles: ['customer'],
};
let mockIsAuthenticated = true;
let mockIsLoading = false;

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsLoading,
    refreshUser: vi.fn(),
  }),
}));

const translations: Record<string, string> = {
  orders: 'Orders',
  orderTracking: 'Live Tracking',
  loyalty: 'Loyalty & Rewards',
  giftCards: 'Gift Cards',
  reviews: 'Reviews',
  recovery: 'Service Recovery',
  returns: 'Returns & Replacements',
  profile: 'Profile & Security',
  guestMode: 'Viewing in Guest Mode',
  signIn: 'Sign In',
  myAccount: 'My Account',
  manageOrdersAndRewards: 'Track your orders, view receipts, and manage your account.',
};

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => translations[key] || key,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className, onClick }: any) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Phase F10: Customer Account Lifecycle & Consolidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'usr-123',
      userId: 'usr-123',
      email: 'customer@v2resort.com',
      fullName: 'Alice Customer',
      roles: ['customer'],
    };
    mockIsAuthenticated = true;
    mockIsLoading = false;
  });

  // ----------------------------------------------------
  // 1. AccountShell Navigation & Guest State
  // ----------------------------------------------------
  describe('AccountShell Navigation & Shell Presentation', () => {
    it('renders all canonical customer lifecycle navigation tabs', () => {
      render(
        <AccountShell propertySlug="demo-resort" activeTab="orders">
          <div data-testid="test-content">Account Content</div>
        </AccountShell>
      );

      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Live Tracking')).toBeInTheDocument();
      expect(screen.getByText('Loyalty & Rewards')).toBeInTheDocument();
      expect(screen.getByText('Gift Cards')).toBeInTheDocument();
      expect(screen.getByText('Reviews')).toBeInTheDocument();
      expect(screen.getByText('Service Recovery')).toBeInTheDocument();
      expect(screen.getByText('Returns & Replacements')).toBeInTheDocument();
      expect(screen.getByText('Profile & Security')).toBeInTheDocument();
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('handles tab switching via onTabChange callback', async () => {
      const user = userEvent.setup();
      const onTabChange = vi.fn();

      render(
        <AccountShell propertySlug="demo-resort" activeTab="orders" onTabChange={onTabChange}>
          <div>Content</div>
        </AccountShell>
      );

      const loyaltyTab = screen.getByRole('button', { name: /Loyalty & Rewards/i });
      await user.click(loyaltyTab);

      expect(onTabChange).toHaveBeenCalledWith('loyalty');
    });

    it('renders guest mode banner when unauthenticated', () => {
      mockIsAuthenticated = false;
      render(
        <AccountShell propertySlug="demo-resort" activeTab="orders">
          <div>Content</div>
        </AccountShell>
      );

      expect(screen.getByText(/Viewing in Guest Mode/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Sign In/i })).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------
  // 2. LoyaltyHub: Balances, Multipliers & Reversals
  // ----------------------------------------------------
  describe('LoyaltyHub (Phase F10 Rules)', () => {
    it('renders points balance, tier progress, and earning multipliers', async () => {
      apiGetMock.mockImplementation((url: string) => {
        if (url === '/loyalty/me') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                id: 'loy-1',
                currentPoints: 1250,
                totalPointsEarned: 2500,
                totalPointsRedeemed: 1250,
                lifetimeValue: 250,
                tier: {
                  id: 'gold',
                  name: 'Gold',
                  pointsMultiplier: 1.5,
                  benefits: ['Earn 1.5x points', 'Priority seating'],
                  color: '#eab308',
                  minPoints: 1000,
                },
                nextTier: {
                  name: 'Platinum',
                  pointsRequired: 5000,
                  pointsNeeded: 2500,
                  color: '#6366f1',
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
                  id: 'tx-1',
                  type: 'earned',
                  points: 150,
                  description: 'Order #ORD-1001 earned points',
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          });
        }
        if (url === '/loyalty/tiers') {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });

      render(<LoyaltyHub propertySlug="demo-resort" />);

      await waitFor(() => {
        expect(screen.getByTestId('loyalty-current-points')).toHaveTextContent('1,250');
      });

      expect(screen.getByTestId('loyalty-tier-badge')).toHaveTextContent('Gold Tier');
      expect(screen.getByTestId('loyalty-multiplier')).toHaveTextContent('1.5x');
      expect(screen.getByTestId('loyalty-points-needed')).toHaveTextContent('2,500 points needed');
      expect(screen.getByText(/Order #ORD-1001 earned points/i)).toBeInTheDocument();
      expect(screen.getByTestId('loyalty-tx-points')).toHaveTextContent('+150 pts');
    });

    it('explicitly renders reversal explanation banner when point reversals exist in ledger', async () => {
      apiGetMock.mockImplementation((url: string) => {
        if (url === '/loyalty/me') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                id: 'loy-1',
                currentPoints: 800,
                totalPointsEarned: 1000,
                totalPointsRedeemed: 0,
                lifetimeValue: 100,
                tier: { id: 'silver', name: 'Silver', pointsMultiplier: 1.2, benefits: [], color: '#94a3b8', minPoints: 500 },
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
                  id: 'tx-rev',
                  type: 'reversal',
                  points: -120,
                  description: 'Reversal: Order ORD-999 cancelled/refunded',
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          });
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });

      render(<LoyaltyHub propertySlug="demo-resort" />);

      await waitFor(() => {
        expect(screen.getByTestId('loyalty-reversal-alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/Understanding Loyalty Point Reversals/i)).toBeInTheDocument();
      expect(screen.getByText(/When an order is cancelled or refunded, the points originally awarded for that purchase are reversed/i)).toBeInTheDocument();
      expect(screen.getByTestId('loyalty-tx-points')).toHaveTextContent('-120 pts');
    });

    it('handles instant loyalty enrollment when customer has no account yet', async () => {
      const user = userEvent.setup();
      apiGetMock.mockResolvedValueOnce({ data: { success: true, data: null } }); // not enrolled
      apiGetMock.mockResolvedValue({ data: { success: true, data: [] } });
      apiPostMock.mockResolvedValueOnce({ data: { success: true, message: 'Enrolled' } });

      render(<LoyaltyHub propertySlug="demo-resort" />);

      await waitFor(() => {
        expect(screen.getByTestId('loyalty-unregistered')).toBeInTheDocument();
      });

      const enrollBtn = screen.getByTestId('loyalty-enroll-btn');
      await user.click(enrollBtn);

      expect(apiPostMock).toHaveBeenCalledWith('/loyalty/enroll');
    });
  });

  // ----------------------------------------------------
  // 3. ReviewsHub: Backend Eligibility & Polymorphic Review
  // ----------------------------------------------------
  describe('ReviewsHub (Backend Eligibility & Submission)', () => {
    it('evaluates backend review eligibility and lists eligible targets', async () => {
      apiGetMock.mockImplementation((url: string) => {
        if (url === '/reviews/eligibility') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                isEligible: true,
                completedTransactionsCount: 2,
                eligibleTargets: [
                  {
                    targetType: 'module',
                    targetId: 'restaurant',
                    title: 'Restaurant Service',
                    subtitle: 'Based on your recent visit',
                    moduleId: 'restaurant',
                  },
                  {
                    targetType: 'item',
                    targetId: 'item-burger-uuid',
                    title: 'Wagyu Truffle Burger',
                    subtitle: 'Ordered Item',
                  },
                ],
              },
            },
          });
        }
        if (url === '/reviews/me') {
          return Promise.resolve({
            data: {
              success: true,
              data: [
                {
                  id: 'rev-prev',
                  rating: 5,
                  text: 'Exceptional service and quick delivery!',
                  service_type: 'restaurant',
                  status: 'approved',
                  created_at: new Date().toISOString(),
                },
              ],
            },
          });
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });

      render(<ReviewsHub propertySlug="demo-resort" />);

      await waitFor(() => {
        expect(screen.getByTestId('reviews-eligibility-card')).toBeInTheDocument();
      });

      expect(screen.getByText('Restaurant Service')).toBeInTheDocument();
      expect(screen.getByText('Wagyu Truffle Burger')).toBeInTheDocument();
      expect(screen.getByTestId('review-status-rev-prev')).toHaveTextContent('Approved');
    });

    it('submits a verified review with polymorphic target and rating', async () => {
      const user = userEvent.setup();
      apiGetMock.mockImplementation((url: string) => {
        if (url === '/reviews/eligibility') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                isEligible: true,
                completedTransactionsCount: 1,
                eligibleTargets: [
                  {
                    targetType: 'item',
                    targetId: 'item-burger-uuid',
                    title: 'Wagyu Truffle Burger',
                    subtitle: 'Ordered Item',
                    moduleId: 'restaurant',
                  },
                ],
              },
            },
          });
        }
        if (url === '/reviews/me') {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });
      apiPostMock.mockResolvedValueOnce({ data: { success: true, message: 'Review created' } });

      render(<ReviewsHub propertySlug="demo-resort" />);

      await waitFor(() => {
        expect(screen.getByTestId('review-btn-item-burger-uuid')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('review-btn-item-burger-uuid'));

      expect(screen.getByTestId('review-form-card')).toBeInTheDocument();

      const textarea = screen.getByTestId('review-textarea');
      await user.type(textarea, 'The truffle burger was absolutely phenomenal and served piping hot.');

      const submitBtn = screen.getByTestId('review-submit-btn');
      await user.click(submitBtn);

      expect(apiPostMock).toHaveBeenCalledWith(
        '/reviews',
        expect.objectContaining({
          rating: 5,
          text: 'The truffle burger was absolutely phenomenal and served piping hot.',
          target_type: 'item',
          target_id: 'item-burger-uuid',
        })
      );
    });
  });

  // ----------------------------------------------------
  // 4. RecoveryHub: Customer Service & Remedies
  // ----------------------------------------------------
  describe('RecoveryHub (Issues & Service Recovery Transparency)', () => {
    it('displays active inquiries and granted recovery resolutions', async () => {
      apiGetMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 'ticket-1',
              subject: 'Missing beverage in order #ORD-104',
              message: 'The iced latte was missing upon delivery.',
              status: 'resolved',
              priority: 'high',
              created_at: new Date().toISOString(),
              resolved_at: new Date().toISOString(),
              resolution: 'A refund of $4.50 has been processed to your credit card, and 200 courtesy points added.',
            },
            {
              id: 'ticket-2',
              subject: 'Question regarding pool booking',
              message: 'Can we modify cabana count?',
              status: 'in_progress',
              priority: 'normal',
              created_at: new Date().toISOString(),
            },
          ],
        },
      });

      render(<RecoveryHub propertySlug="demo-resort" />);

      await waitFor(() => {
        expect(screen.getByTestId('recovery-resolutions-card')).toBeInTheDocument();
      });

      expect(screen.getAllByText(/A refund of \$4.50 has been processed to your credit card/i).length).toBeGreaterThan(0);
      expect(screen.getByTestId('inquiry-status-ticket-1')).toHaveTextContent('resolved');
      expect(screen.getByTestId('inquiry-status-ticket-2')).toHaveTextContent('in progress');
    });

    it('submits a new customer support/recovery ticket', async () => {
      const user = userEvent.setup();
      apiGetMock.mockResolvedValue({ data: { success: true, data: [] } });
      apiPostMock.mockResolvedValueOnce({ data: { success: true, data: { id: 'tick-new-123' } } });

      render(<RecoveryHub propertySlug="demo-resort" />);

      await waitFor(() => {
        expect(screen.getByTestId('open-ticket-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('open-ticket-btn'));

      expect(screen.getByTestId('new-ticket-card')).toBeInTheDocument();

      await user.type(screen.getByTestId('ticket-subject-input'), 'Order delayed past delivery ETA');
      await user.type(screen.getByTestId('ticket-order-input'), 'ORD-555');
      await user.type(screen.getByTestId('ticket-message-textarea'), 'Our room delivery was 35 minutes late.');

      await user.click(screen.getByTestId('submit-ticket-btn'));

      expect(apiPostMock).toHaveBeenCalledWith(
        '/support/contact',
        expect.objectContaining({
          subject: '[Order #ORD-555] Order delayed past delivery ETA',
          message: 'Our room delivery was 35 minutes late.',
          priority: 'normal',
        })
      );
    });
  });

  // ----------------------------------------------------
  // 5. OrdersHub: Canonical Status & Quick Actions
  // ----------------------------------------------------
  describe('OrdersHub (Order History & Line Items)', () => {
    it('renders customer orders with canonical fulfillment badges and expandable items', async () => {
      const user = userEvent.setup();
      apiGetMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 'ord-101',
              order_number: 'ORD-101',
              module_name: 'Restaurant',
              status: 'confirmed',
              fulfillment_status: 'in_progress',
              total_amount: 45.5,
              currency: 'USD',
              payment_method: 'card',
              created_at: new Date().toISOString(),
              items: [
                { name: 'Caesar Salad', quantity: 1, price: 15.5 },
                { name: 'Grilled Salmon', quantity: 1, price: 30.0 },
              ],
            },
          ],
        },
      });

      render(<OrdersHub propertySlug="demo-resort" />);

      await waitFor(() => {
        expect(screen.getByTestId('order-num-ord-101')).toHaveTextContent('#ORD-101');
      });

      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
      expect(screen.getByTestId('order-amount-ord-101')).toHaveTextContent('$45.50');

      // Expand line items
      const toggleBtn = screen.getByTestId('toggle-items-ord-101');
      await user.click(toggleBtn);

      expect(screen.getByTestId('items-list-ord-101')).toBeInTheDocument();
      expect(screen.getByText(/1x Caesar Salad/i)).toBeInTheDocument();
      expect(screen.getByText(/1x Grilled Salmon/i)).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------
  // 6. ReturnsHub: Satisfaction & Return Requests
  // ----------------------------------------------------
  describe('ReturnsHub (Returns & Replacements)', () => {
    it('submits a return/replacement request with selected remedy', async () => {
      const user = userEvent.setup();
      apiPostMock.mockResolvedValueOnce({ data: { success: true } });

      render(<ReturnsHub propertySlug="demo-resort" />);

      await user.click(screen.getByTestId('start-return-btn'));

      expect(screen.getByTestId('return-form-card')).toBeInTheDocument();

      await user.type(screen.getByTestId('return-order-input'), 'ORD-202');
      await user.type(screen.getByTestId('return-item-input'), 'Beach Towel (Blue)');
      await user.type(screen.getByTestId('return-notes-textarea'), 'Towel stitching was torn upon unboxing.');

      await user.click(screen.getByTestId('submit-return-btn'));

      expect(apiPostMock).toHaveBeenCalledWith(
        '/support/contact',
        expect.objectContaining({
          priority: 'high',
          subject: expect.stringContaining('ORD-202'),
          message: expect.stringContaining('Beach Towel (Blue)'),
        })
      );

      await waitFor(() => {
        expect(screen.getByText(/Order #ORD-202 • Beach Towel \(Blue\)/i)).toBeInTheDocument();
      });
    });
  });
});
