import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing
vi.mock('../../../src/config/database', () => ({
  prisma: {
    poolMembership: {
      create: vi.fn().mockResolvedValue({ id: 'mem-1' }),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'mem-1' }),
    },
    users: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user-1' }),
    },
  },
}));

// Mock Stripe
vi.mock('stripe', () => ({
  default: class MockStripe {
    customers = {
      create: vi.fn().mockResolvedValue({ id: 'cus_test' }),
    };
    subscriptions = {
      create: vi.fn().mockResolvedValue({
        id: 'sub_test',
        status: 'active',
        client_secret: 'secret_test',
      }),
      update: vi.fn().mockResolvedValue({ id: 'sub_test' }),
      cancel: vi.fn().mockResolvedValue({ id: 'sub_test', status: 'canceled' }),
    };
    paymentIntents = {
      create: vi.fn().mockResolvedValue({
        id: 'pi_test',
        client_secret: 'secret_test',
      }),
    };
  },
}));

vi.mock('../../../src/config/stripe', () => ({
  stripeClient: {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test' }),
    },
    subscriptions: {
      create: vi.fn().mockResolvedValue({ id: 'sub_test', status: 'active' }),
    },
  },
}));

vi.mock('../../../src/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
    sendMembershipConfirmation: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  MembershipType,
  MembershipStatus,
  BillingCycle,
  getMembershipPricing,
  getAllMembershipPlans,
} from '../../../src/services/pool-membership.service';

describe('PoolMembershipService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MembershipType enum', () => {
    it('should have individual type', () => {
      expect(MembershipType.INDIVIDUAL).toBeDefined();
    });

    it('should have family type', () => {
      expect(MembershipType.FAMILY).toBeDefined();
    });

    it('should have corporate type', () => {
      expect(MembershipType.CORPORATE).toBeDefined();
    });

    it('should have VIP type', () => {
      expect(MembershipType.VIP).toBeDefined();
    });
  });

  describe('MembershipStatus enum', () => {
    it('should have active status', () => {
      expect(MembershipStatus.ACTIVE).toBeDefined();
    });

    it('should have cancelled status', () => {
      expect(MembershipStatus.CANCELLED).toBeDefined();
    });

    it('should have expired status', () => {
      expect(MembershipStatus.EXPIRED).toBeDefined();
    });

    it('should have suspended status', () => {
      expect(MembershipStatus.SUSPENDED).toBeDefined();
    });

    it('should have pending payment status', () => {
      expect(MembershipStatus.PENDING_PAYMENT).toBeDefined();
    });
  });

  describe('BillingCycle enum', () => {
    it('should have monthly cycle', () => {
      expect(BillingCycle.MONTHLY).toBeDefined();
    });

    it('should have quarterly cycle', () => {
      expect(BillingCycle.QUARTERLY).toBeDefined();
    });

    it('should have annually cycle', () => {
      expect(BillingCycle.ANNUALLY).toBeDefined();
    });
  });

  describe('getMembershipPricing', () => {
    it('should return pricing for individual monthly', () => {
      const pricing = getMembershipPricing(MembershipType.INDIVIDUAL, BillingCycle.MONTHLY);

      expect(pricing).not.toBeNull();
      expect(pricing?.type).toBe(MembershipType.INDIVIDUAL);
      expect(pricing?.billingCycle).toBe(BillingCycle.MONTHLY);
      expect(pricing?.basePrice).toBeGreaterThan(0);
    });

    it('should return pricing for family annually', () => {
      const pricing = getMembershipPricing(MembershipType.FAMILY, BillingCycle.ANNUALLY);

      expect(pricing).not.toBeNull();
      expect(pricing?.type).toBe(MembershipType.FAMILY);
      expect(pricing?.billingCycle).toBe(BillingCycle.ANNUALLY);
    });

    it('should return null for invalid combination', () => {
      // Cast to bypass TypeScript check for testing invalid input
      const pricing = getMembershipPricing('invalid' as MembershipType, BillingCycle.MONTHLY);

      expect(pricing).toBeNull();
    });
  });

  describe('getAllMembershipPlans', () => {
    it('should return all membership plans', () => {
      const plans = getAllMembershipPlans();

      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBeGreaterThan(0);
    });

    it('should include membership types', () => {
      const plans = getAllMembershipPlans();
      const types = plans.map(p => p.type);

      expect(types).toContain(MembershipType.INDIVIDUAL);
    });

    it('should include billing cycles', () => {
      const plans = getAllMembershipPlans();
      const cycles = plans.map(p => p.billingCycle);

      expect(cycles).toContain(BillingCycle.MONTHLY);
    });

    it('should have pricing information', () => {
      const plans = getAllMembershipPlans();

      plans.forEach(plan => {
        expect(plan.basePrice).toBeGreaterThan(0);
      });
    });
  });
});
