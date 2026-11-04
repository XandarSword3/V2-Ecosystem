import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createChainableMock } from '../utils';

// Hoist mock Stripe Client methods
const {
  mockStripeCustomers,
  mockStripeSubscriptions,
  mockStripeProducts,
  mockStripePrices,
} = vi.hoisted(() => ({
  mockStripeCustomers: { create: vi.fn() },
  mockStripeSubscriptions: { create: vi.fn(), update: vi.fn(), cancel: vi.fn() },
  mockStripeProducts: { create: vi.fn() },
  mockStripePrices: { create: vi.fn() },
}));

vi.mock('../../../src/config/stripe.js', () => ({
  stripeClient: {
    customers: mockStripeCustomers,
    subscriptions: mockStripeSubscriptions,
    products: mockStripeProducts,
    prices: mockStripePrices,
  },
}));

// Mock Database Connection
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

// Mock Email Service
vi.mock('../../../src/services/email.service.js', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue(true),
  },
}));

// Mock Logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getSupabase } from '../../../src/database/connection.js';
import { emailService } from '../../../src/services/email.service.js';
import {
  MembershipType,
  MembershipStatus,
  BillingCycle,
  getMembershipPricing,
  getAllMembershipPlans,
  createMembership,
  cancelMembership,
  validateMembershipAccess,
  useGuestPass,
  processRenewal,
  handleFailedPayment,
} from '../../../src/services/pool-membership.service.js';

describe('PoolMembershipService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
    process.env.FRONTEND_URL = 'https://resort.com';
  });

  describe('Pricing & Plans catalog', () => {
    it('returns all defined membership plans with valid pricing structures', () => {
      const plans = getAllMembershipPlans();
      expect(plans.length).toBeGreaterThanOrEqual(6);
      for (const p of plans) {
        expect(p.basePrice).toBeGreaterThan(0);
        expect(p.maxMembers).toBeGreaterThan(0);
      }
    });

    it('returns null for an invalid type/billingCycle combination', () => {
      const p = getMembershipPricing('NON_EXISTENT' as any, BillingCycle.MONTHLY);
      expect(p).toBeNull();
    });

    it('retrieves distinct pricing for individual, family, corporate, and VIP plans', () => {
      const indMonthly = getMembershipPricing(MembershipType.INDIVIDUAL, BillingCycle.MONTHLY);
      expect(indMonthly?.basePrice).toBe(49.99);

      const indAnnually = getMembershipPricing(MembershipType.INDIVIDUAL, BillingCycle.ANNUALLY);
      expect(indAnnually?.guestPasses).toBe(24);

      const famMonthly = getMembershipPricing(MembershipType.FAMILY, BillingCycle.MONTHLY);
      expect(famMonthly?.maxMembers).toBe(5);

      const corp = getMembershipPricing(MembershipType.CORPORATE, BillingCycle.ANNUALLY);
      expect(corp?.maxMembers).toBe(20);

      const vip = getMembershipPricing(MembershipType.VIP, BillingCycle.ANNUALLY);
      expect(vip?.guestPasses).toBe(0); // Unlimited
    });
  });

  describe('createMembership', () => {
    it('returns BILLING_UNAVAILABLE if Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const res = await createMembership({
        userId: 'user-1',
        type: MembershipType.INDIVIDUAL,
        billingCycle: BillingCycle.MONTHLY,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('BILLING_UNAVAILABLE');
    });

    it('rejects if pricing combination is not found', async () => {
      const res = await createMembership({
        userId: 'user-1',
        type: 'INVALID' as any,
        billingCycle: BillingCycle.MONTHLY,
      });

      expect(res.success).toBe(false);
      expect(res.message).toBe('Invalid membership type or billing cycle');
    });

    it('rejects if user already has an active membership', async () => {
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'pool_memberships') {
            return createChainableMock({ id: 'existing-mem-1' });
          }
          return createChainableMock(null);
        }),
      })) as any);

      const res = await createMembership({
        userId: 'user-1',
        type: MembershipType.INDIVIDUAL,
        billingCycle: BillingCycle.MONTHLY,
      });

      expect(res.success).toBe(false);
      expect(res.message).toBe('User already has an active membership');
    });

    it('rejects if member emails exceed the maximum allowed for plan', async () => {
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'pool_memberships') {
            return createChainableMock(null);
          }
          return createChainableMock(null);
        }),
      })) as any);

      // INDIVIDUAL has maxMembers: 1, so memberEmails length > 0 is rejected
      const res = await createMembership({
        userId: 'user-1',
        type: MembershipType.INDIVIDUAL,
        billingCycle: BillingCycle.MONTHLY,
        memberEmails: ['extra@example.com'],
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('Maximum 1 members allowed');
    });

    it('creates new Stripe customer and price when none exists, inserts membership and sends invitations', async () => {
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'pool_memberships') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'mem-created-123', type: MembershipType.FAMILY },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'users') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'user-1', email: 'owner@resort.com', full_name: 'John Doe', firstName: 'John', lastName: 'Doe', stripe_customer_id: null },
                error: null,
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'system_settings') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // No pre-cached price
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'membership_members') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return createChainableMock(null);
        }),
      })) as any);

      mockStripeCustomers.create.mockResolvedValueOnce({ id: 'cus_new_123' });
      mockStripeProducts.create.mockResolvedValueOnce({ id: 'prod_family_123' });
      mockStripePrices.create.mockResolvedValueOnce({ id: 'price_family_123' });
      mockStripeSubscriptions.create.mockResolvedValueOnce({
        id: 'sub_family_123',
        latest_invoice: {
          payment_intent: { client_secret: 'pi_secret_999' },
        },
      });

      const res = await createMembership({
        userId: 'user-1',
        type: MembershipType.FAMILY,
        billingCycle: BillingCycle.MONTHLY,
        memberEmails: ['spouse@resort.com'],
        corporateName: 'Doe Family',
        paymentMethodId: 'pm_card_visa',
      });

      expect(res.success).toBe(true);
      expect(res.subscriptionId).toBe('sub_family_123');
      expect(res.clientSecret).toBe('pi_secret_999');
      expect(mockStripeCustomers.create).toHaveBeenCalled();
      expect(mockStripeProducts.create).toHaveBeenCalled();
      expect(mockStripePrices.create).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'spouse@resort.com',
          subject: 'Pool Membership Invitation',
        })
      );
    });

    it('catches StripeAuthenticationError and returns friendly BILLING_UNAVAILABLE', async () => {
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'pool_memberships') return createChainableMock(null);
          if (table === 'users') return createChainableMock({ id: 'u1', email: 'u@test.com' });
          return createChainableMock(null);
        }),
      })) as any);

      mockStripeCustomers.create.mockRejectedValueOnce({
        type: 'StripeAuthenticationError',
        message: 'Invalid API Key',
      });

      const res = await createMembership({
        userId: 'u1',
        type: MembershipType.INDIVIDUAL,
        billingCycle: BillingCycle.MONTHLY,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('BILLING_UNAVAILABLE');
    });
  });

  describe('cancelMembership', () => {
    it('returns not found if membership does not exist', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null)),
      } as any);

      const res = await cancelMembership('mem-none', 'user-1');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Membership not found');
    });

    it('returns unauthorized if membership belongs to another user', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ id: 'mem-1', user_id: 'other-user' })),
      } as any);

      const res = await cancelMembership('mem-1', 'user-1');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Unauthorized');
    });

    it('returns error if membership is not active', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ id: 'mem-1', user_id: 'user-1', status: MembershipStatus.EXPIRED })),
      } as any);

      const res = await cancelMembership('mem-1', 'user-1');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Membership is not active');
    });

    it('cancels Stripe subscription immediately or at period end and updates DB', async () => {
      const mockUpdateDb = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'mem-1', user_id: 'user-1', status: MembershipStatus.ACTIVE, stripe_subscription_id: 'sub_123' },
            error: null,
          }),
          update: mockUpdateDb,
        })),
      } as any);

      // Cancel at period end
      const resPeriodEnd = await cancelMembership('mem-1', 'user-1', 'Moving away', false);
      expect(resPeriodEnd.success).toBe(true);
      expect(resPeriodEnd.message).toContain('at the end of the billing period');
      expect(mockStripeSubscriptions.update).toHaveBeenCalledWith('sub_123', { cancel_at_period_end: true });

      // Immediate cancel
      const resImmediate = await cancelMembership('mem-1', 'user-1', 'Dissatisfied', true);
      expect(resImmediate.success).toBe(true);
      expect(resImmediate.message).toBe('Membership cancelled immediately');
      expect(mockStripeSubscriptions.cancel).toHaveBeenCalledWith('sub_123');
    });

    it('handles Stripe auth failure gracefully on cancellation', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'mem-1', user_id: 'user-1', status: MembershipStatus.ACTIVE, stripe_subscription_id: 'sub_123' },
            error: null,
          }),
        }),
      } as any);

      mockStripeSubscriptions.update.mockRejectedValueOnce({
        type: 'StripeAuthenticationError',
        message: 'Invalid API Key',
      });

      const res = await cancelMembership('mem-1', 'user-1');
      expect(res.success).toBe(false);
      expect(res.code).toBe('BILLING_UNAVAILABLE');
    });
  });

  describe('validateMembershipAccess', () => {
    it('returns direct active membership when valid and not expired', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'pool_memberships') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'mem-1',
                  status: MembershipStatus.ACTIVE,
                  remaining_guest_passes: 5,
                  discount_percentage: 15,
                },
                error: null,
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      const access = await validateMembershipAccess('user-1');
      expect(access.hasAccess).toBe(true);
      expect(access.remainingGuestPasses).toBe(5);
      expect(access.discountPercentage).toBe(15);
    });

    it('falls back to secondary membership member record if direct not found', async () => {
      let poolCallCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'pool_memberships') {
            poolCallCount++;
            if (poolCallCount === 1) {
              // Direct query returns null
              const mock = createChainableMock(null);
              return mock;
            } else {
              // Parent query returns membership
              const mock = createChainableMock({
                id: 'parent-mem-1',
                remaining_guest_passes: 2,
                discount_percentage: 10,
              });
              return mock;
            }
          }
          if (table === 'membership_members') {
            return createChainableMock({ membership_id: 'parent-mem-1' });
          }
          return createChainableMock(null);
        }),
      } as any);

      const access = await validateMembershipAccess('dependent-user');
      expect(access.hasAccess).toBe(true);
      expect(access.membership.id).toBe('parent-mem-1');
    });

    it('returns hasAccess: false when no membership found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null)),
      } as any);

      const access = await validateMembershipAccess('no-membership-user');
      expect(access.hasAccess).toBe(false);
    });
  });

  describe('useGuestPass', () => {
    it('returns false if membership not found or not active', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null)),
      } as any);

      const resNotFound = await useGuestPass('mem-missing', 'Guest Bob');
      expect(resNotFound.success).toBe(false);
      expect(resNotFound.message).toBe('Membership not found');

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ id: 'm1', status: MembershipStatus.SUSPENDED })),
      } as any);

      const resSuspended = await useGuestPass('m1', 'Guest Bob');
      expect(resSuspended.success).toBe(false);
      expect(resSuspended.message).toBe('Membership is not active');
    });

    it('rejects if no passes remain for non-VIP plans', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({
          id: 'm1',
          status: MembershipStatus.ACTIVE,
          type: MembershipType.INDIVIDUAL,
          remaining_guest_passes: 0,
        })),
      } as any);

      const res = await useGuestPass('m1', 'Guest Bob');
      expect(res.success).toBe(false);
      expect(res.message).toBe('No guest passes remaining');
    });

    it('records guest pass and decrements count for regular memberships', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'pool_memberships') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'm1', status: MembershipStatus.ACTIVE, type: MembershipType.FAMILY, remaining_guest_passes: 3 },
                error: null,
              }),
              update: mockUpdate,
            };
          }
          if (table === 'guest_pass_usage') {
            return { insert: mockInsert };
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await useGuestPass('m1', 'Guest Bob', 'bob@guest.com');
      expect(res.success).toBe(true);
      expect(res.remainingPasses).toBe(2);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          membership_id: 'm1',
          guest_name: 'Guest Bob',
          guest_email: 'bob@guest.com',
        })
      );
      expect(mockUpdate).toHaveBeenCalledWith({ remaining_guest_passes: 2 });
    });

    it('allows unlimited passes for VIP type without decrementing database passes', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'pool_memberships') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'm-vip', status: MembershipStatus.ACTIVE, type: MembershipType.VIP, remaining_guest_passes: 0 },
                error: null,
              }),
              update: mockUpdate,
            };
          }
          if (table === 'guest_pass_usage') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await useGuestPass('m-vip', 'VIP Friend');
      expect(res.success).toBe(true);
      expect(res.remainingPasses).toBe(-1); // Unlimited
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Webhook handlers: processRenewal & handleFailedPayment', () => {
    it('processRenewal updates end_date and resets guest passes, sending confirmation email', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'mem-renew',
              type: MembershipType.INDIVIDUAL,
              billing_cycle: BillingCycle.MONTHLY,
              end_date: '2026-11-01T00:00:00Z',
              user: { email: 'member@resort.com' },
            },
            error: null,
          }),
          update: mockUpdate,
        })),
      } as any);

      await processRenewal('sub_renew_1');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          remaining_guest_passes: 2,
          renewed_at: expect.any(String),
        })
      );
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'member@resort.com',
          subject: 'Pool Membership Renewed',
        })
      );
    });

    it('handleFailedPayment suspends membership and sends warning email', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'mem-fail',
              user: { email: 'failed@resort.com' },
            },
            error: null,
          }),
          update: mockUpdate,
        })),
      } as any);

      await handleFailedPayment('sub_failed_1');

      expect(mockUpdate).toHaveBeenCalledWith({ status: MembershipStatus.SUSPENDED });
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'failed@resort.com',
          subject: 'Pool Membership Payment Failed',
        })
      );
    });
  });
});
