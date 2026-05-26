/**
 * Membership Service Tests
 * Unit tests for membership plans, subscriptions, renewals, and benefits.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMembershipService } from '../../src/lib/services/membership.service';
import { InMemoryMembershipRepository } from '../../src/lib/repositories/membership.repository.memory';
import type { Container } from '../../src/lib/container/types';

describe('MembershipService', () => {
  let service: ReturnType<typeof createMembershipService>;
  let membershipRepository: InMemoryMembershipRepository;

  const validUserId = '11111111-1111-1111-1111-111111111111';
  const validUserId2 = '22222222-2222-2222-2222-222222222222';
  const validUserId3 = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    membershipRepository = new InMemoryMembershipRepository();
    service = createMembershipService({ membershipRepository } as unknown as Container);
  });

  // ─── Plans ────────────────────────────────────────────────────────────────
  describe('createPlan', () => {
    it('should create plan with required fields', async () => {
      const result = await service.createPlan({ name: 'Gold Membership', tier: 'gold', description: 'Premium access to all facilities', price: 299 });
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Gold Membership');
      expect(result.data!.tier).toBe('gold');
      expect(result.data!.price).toBe(299);
      expect(result.data!.isActive).toBe(true);
    });
    it('should set optional fields', async () => {
      const result = await service.createPlan({ name: 'Platinum Membership', tier: 'platinum', description: 'VIP access', price: 599, currency: 'EUR', durationMonths: 6, benefits: ['Pool access', 'Gym access', 'Spa access'], discountPercentage: 20, guestPasses: 5, maxFamilyMembers: 4 });
      expect(result.data!.currency).toBe('EUR');
      expect(result.data!.durationMonths).toBe(6);
      expect(result.data!.benefits).toHaveLength(3);
      expect(result.data!.discountPercentage).toBe(20);
      expect(result.data!.guestPasses).toBe(5);
      expect(result.data!.maxFamilyMembers).toBe(4);
    });
    it('should reject empty name', async () => { expect((await service.createPlan({ name: '', tier: 'gold', description: 'Test', price: 100 })).error).toBe('Plan name is required'); });
    it('should reject invalid tier', async () => { expect((await service.createPlan({ name: 'Test', tier: 'invalid' as any, description: 'Test', price: 100 })).error).toBe('Invalid membership tier'); });
    it('should reject empty description', async () => { expect((await service.createPlan({ name: 'Test', tier: 'gold', description: '', price: 100 })).error).toBe('Description is required'); });
    it('should reject non-positive price', async () => { expect((await service.createPlan({ name: 'Test', tier: 'gold', description: 'Test', price: 0 })).error).toBe('Price must be a positive number'); });
    it('should reject negative duration', async () => { expect((await service.createPlan({ name: 'Test', tier: 'gold', description: 'Test', price: 100, durationMonths: -1 })).error).toBe('Duration must be positive'); });
    it('should reject invalid discount', async () => { expect((await service.createPlan({ name: 'Test', tier: 'gold', description: 'Test', price: 100, discountPercentage: 150 })).error).toBe('Discount must be between 0 and 100'); });
  });

  describe('getPlan', () => {
    it('should get plan by ID', async () => {
      const created = await service.createPlan({ name: 'Silver', tier: 'silver', description: 'Standard access', price: 199 });
      expect((await service.getPlan(created.data!.id)).data!.id).toBe(created.data!.id);
    });
    it('should reject invalid ID', async () => { expect((await service.getPlan('invalid')).error).toBe('Invalid plan ID'); });
    it('should return error for non-existent', async () => { expect((await service.getPlan('00000000-0000-0000-0000-000000000000')).error).toBe('Plan not found'); });
  });

  describe('getPlans', () => {
    it('should get all plans', async () => {
      await service.createPlan({ name: 'Bronze', tier: 'bronze', description: 'Basic', price: 99 });
      await service.createPlan({ name: 'Silver', tier: 'silver', description: 'Standard', price: 199 });
      expect((await service.getPlans()).data).toHaveLength(2);
    });
  });

  describe('getActivePlans', () => {
    it('should get only active plans', async () => {
      const plan1 = await service.createPlan({ name: 'Bronze', tier: 'bronze', description: 'Basic', price: 99 });
      await service.createPlan({ name: 'Silver', tier: 'silver', description: 'Standard', price: 199 });
      await service.deactivatePlan(plan1.data!.id);
      expect((await service.getActivePlans()).data).toHaveLength(1);
    });
  });

  describe('updatePlan', () => {
    it('should update plan fields', async () => {
      const created = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const result = await service.updatePlan(created.data!.id, { name: 'Gold Plus', price: 349 });
      expect(result.data!.name).toBe('Gold Plus');
      expect(result.data!.price).toBe(349);
    });
    it('should reject invalid discount', async () => {
      const created = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      expect((await service.updatePlan(created.data!.id, { discountPercentage: 110 })).error).toBe('Discount must be between 0 and 100');
    });
    it('should reject non-positive price', async () => {
      const created = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      expect((await service.updatePlan(created.data!.id, { price: 0 })).error).toBe('Price must be positive');
    });
  });

  describe('deactivatePlan', () => {
    it('should deactivate plan', async () => {
      const created = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      expect((await service.deactivatePlan(created.data!.id)).data!.isActive).toBe(false);
    });
    it('should reject already inactive', async () => {
      const created = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      await service.deactivatePlan(created.data!.id);
      expect((await service.deactivatePlan(created.data!.id)).error).toBe('Plan is already inactive');
    });
  });

  describe('reactivatePlan', () => {
    it('should reactivate plan', async () => {
      const created = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      await service.deactivatePlan(created.data!.id);
      expect((await service.reactivatePlan(created.data!.id)).data!.isActive).toBe(true);
    });
    it('should reject already active', async () => {
      const created = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      expect((await service.reactivatePlan(created.data!.id)).error).toBe('Plan is already active');
    });
  });

  // ─── Memberships ──────────────────────────────────────────────────────────
  describe('enrollMember', () => {
    it('should enroll member', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, guestPasses: 5 });
      const result = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect(result.data!.memberId).toBe(validUserId);
      expect(result.data!.status).toBe('pending');
      expect(result.data!.guestPassesRemaining).toBe(5);
    });
    it('should set auto-renew and family members', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, maxFamilyMembers: 3 });
      const result = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id, autoRenew: true, familyMembers: [validUserId2] });
      expect(result.data!.autoRenew).toBe(true);
      expect(result.data!.familyMembers).toContain(validUserId2);
    });
    it('should reject invalid member ID', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      expect((await service.enrollMember({ memberId: 'invalid', planId: plan.data!.id })).error).toBe('Invalid member ID');
    });
    it('should reject invalid plan ID', async () => { expect((await service.enrollMember({ memberId: validUserId, planId: 'invalid' })).error).toBe('Invalid plan ID'); });
    it('should reject inactive plan', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      await service.deactivatePlan(plan.data!.id);
      expect((await service.enrollMember({ memberId: validUserId, planId: plan.data!.id })).error).toBe('Plan is not active');
    });
    it('should reject too many family members', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, maxFamilyMembers: 1 });
      expect((await service.enrollMember({ memberId: validUserId, planId: plan.data!.id, familyMembers: [validUserId2, validUserId3] })).error).toContain('Maximum 1 family members allowed');
    });
  });

  describe('getMembership', () => {
    it('should get membership by ID', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.getMembership(enrolled.data!.id)).data!.id).toBe(enrolled.data!.id);
    });
    it('should reject invalid ID', async () => { expect((await service.getMembership('invalid')).error).toBe('Invalid membership ID'); });
  });

  describe('getMembershipByMember', () => {
    it('should get membership by member ID', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.getMembershipByMember(validUserId)).data!.memberId).toBe(validUserId);
    });
    it('should return error when not found', async () => { expect((await service.getMembershipByMember(validUserId)).error).toBe('No membership found for this member'); });
  });

  describe('activateMembership', () => {
    it('should activate pending membership', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.activateMembership(enrolled.data!.id)).data!.status).toBe('active');
    });
    it('should reject non-pending', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.activateMembership(enrolled.data!.id);
      expect((await service.activateMembership(enrolled.data!.id)).error).toBe('Only pending memberships can be activated');
    });
  });

  describe('suspendMembership', () => {
    it('should suspend active membership', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.activateMembership(enrolled.data!.id);
      expect((await service.suspendMembership(enrolled.data!.id)).data!.status).toBe('suspended');
    });
    it('should reject non-active', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.suspendMembership(enrolled.data!.id)).error).toBe('Only active memberships can be suspended');
    });
  });

  describe('cancelMembership', () => {
    it('should cancel membership', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id, autoRenew: true });
      const result = await service.cancelMembership(enrolled.data!.id);
      expect(result.data!.status).toBe('cancelled');
      expect(result.data!.autoRenew).toBe(false);
    });
    it('should reject already cancelled', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.cancelMembership(enrolled.data!.id);
      expect((await service.cancelMembership(enrolled.data!.id)).error).toBe('Membership is already cancelled');
    });
  });

  describe('renewMembership', () => {
    it('should renew membership', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, durationMonths: 12, guestPasses: 5 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.activateMembership(enrolled.data!.id);
      const result = await service.renewMembership({ membershipId: enrolled.data!.id });
      expect(result.data!.status).toBe('active');
      expect(result.data!.guestPassesRemaining).toBe(5);
    });
    it('should reject cancelled membership', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.cancelMembership(enrolled.data!.id);
      expect((await service.renewMembership({ membershipId: enrolled.data!.id })).error).toBe('Cannot renew cancelled membership');
    });
  });

  describe('useGuestPass', () => {
    it('should use guest pass', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, guestPasses: 5 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.activateMembership(enrolled.data!.id);
      expect((await service.useGuestPass({ membershipId: enrolled.data!.id, guestName: 'John Guest' })).data!.guestPassesRemaining).toBe(4);
    });
    it('should reject empty guest name', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, guestPasses: 5 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.activateMembership(enrolled.data!.id);
      expect((await service.useGuestPass({ membershipId: enrolled.data!.id, guestName: '' })).error).toBe('Guest name is required');
    });
    it('should reject when no passes remaining', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, guestPasses: 0 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.activateMembership(enrolled.data!.id);
      expect((await service.useGuestPass({ membershipId: enrolled.data!.id, guestName: 'John Guest' })).error).toBe('No guest passes remaining');
    });
  });

  describe('addGuestPasses', () => {
    it('should add guest passes', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, guestPasses: 5 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.addGuestPasses(enrolled.data!.id, 3)).data!.guestPassesRemaining).toBe(8);
    });
    it('should reject non-positive count', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.addGuestPasses(enrolled.data!.id, 0)).error).toBe('Count must be positive');
    });
  });

  describe('addFamilyMember', () => {
    it('should add family member', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, maxFamilyMembers: 4 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.addFamilyMember({ membershipId: enrolled.data!.id, familyMemberId: validUserId2 })).data!.familyMembers).toContain(validUserId2);
    });
    it('should reject duplicate', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, maxFamilyMembers: 4 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id, familyMembers: [validUserId2] });
      expect((await service.addFamilyMember({ membershipId: enrolled.data!.id, familyMemberId: validUserId2 })).error).toBe('Family member already added');
    });
    it('should reject when max reached', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, maxFamilyMembers: 1 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id, familyMembers: [validUserId2] });
      expect((await service.addFamilyMember({ membershipId: enrolled.data!.id, familyMemberId: validUserId3 })).error).toBe('Maximum family members reached');
    });
  });

  describe('removeFamilyMember', () => {
    it('should remove family member', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, maxFamilyMembers: 4 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id, familyMembers: [validUserId2] });
      expect((await service.removeFamilyMember(enrolled.data!.id, validUserId2)).data!.familyMembers).not.toContain(validUserId2);
    });
    it('should reject if not found', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, maxFamilyMembers: 4 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.removeFamilyMember(enrolled.data!.id, validUserId2)).error).toBe('Family member not found');
    });
  });

  describe('recordPayment', () => {
    it('should record payment', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      const result = await service.recordPayment({ membershipId: enrolled.data!.id, amount: 299, paymentMethod: 'credit_card', transactionId: 'txn_123' });
      expect(result.data!.amount).toBe(299);
      expect(result.data!.paymentStatus).toBe('completed');
    });
    it('should activate pending membership after payment', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.recordPayment({ membershipId: enrolled.data!.id, amount: 299, paymentMethod: 'credit_card' });
      expect((await service.getMembership(enrolled.data!.id)).data!.status).toBe('active');
    });
    it('should reject non-positive amount', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.recordPayment({ membershipId: enrolled.data!.id, amount: 0, paymentMethod: 'credit_card' })).error).toBe('Amount must be positive');
    });
  });

  describe('getPayments', () => {
    it('should get payments', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.recordPayment({ membershipId: enrolled.data!.id, amount: 299, paymentMethod: 'credit_card' });
      expect((await service.getPayments(enrolled.data!.id)).data).toHaveLength(1);
    });
  });

  describe('getExpiringMemberships', () => {
    it('should get expiring memberships', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299, durationMonths: 1 });
      await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.getExpiringMemberships(60)).success).toBe(true);
    });
    it('should reject non-positive days', async () => { expect((await service.getExpiringMemberships(0)).error).toBe('Days must be positive'); });
  });

  describe('getMembershipsByStatus', () => {
    it('should get memberships by status', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect((await service.getMembershipsByStatus('pending')).data).toHaveLength(1);
    });
    it('should reject invalid status', async () => { expect((await service.getMembershipsByStatus('invalid' as any)).error).toBe('Invalid status'); });
  });

  describe('utilities', () => {
    it('isExpired returns false for future expiry', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect(service.isExpired(enrolled.data!)).toBe(false);
    });
    it('isActive returns true for active membership', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      await service.activateMembership(enrolled.data!.id);
      const active = await service.getMembership(enrolled.data!.id);
      expect(service.isActive(active.data!)).toBe(true);
    });
    it('getDaysRemaining returns positive for future expiry', async () => {
      const plan = await service.createPlan({ name: 'Gold', tier: 'gold', description: 'Premium', price: 299 });
      const enrolled = await service.enrollMember({ memberId: validUserId, planId: plan.data!.id });
      expect(service.getDaysRemaining(enrolled.data!)).toBeGreaterThan(0);
    });
    it('compareTiers returns negative for lower tier', () => { expect(service.compareTiers('bronze', 'gold')).toBeLessThan(0); });
    it('compareTiers returns positive for higher tier', () => { expect(service.compareTiers('platinum', 'silver')).toBeGreaterThan(0); });
    it('compareTiers returns zero for same tier', () => { expect(service.compareTiers('gold', 'gold')).toBe(0); });
    it('isHigherTier returns true for higher tier', () => { expect(service.isHigherTier('diamond', 'bronze')).toBe(true); });
    it('isHigherTier returns false for lower tier', () => { expect(service.isHigherTier('bronze', 'gold')).toBe(false); });
    it('getTierName capitalizes tier name', () => { expect(service.getTierName('gold')).toBe('Gold'); expect(service.getTierName('platinum')).toBe('Platinum'); });
    it('getTiers returns all tiers', () => { const tiers = service.getTiers(); expect(tiers).toContain('bronze'); expect(tiers).toContain('silver'); expect(tiers).toContain('gold'); expect(tiers).toContain('platinum'); expect(tiers).toContain('diamond'); });
    it('getStatuses returns all statuses', () => { const s = service.getStatuses(); expect(s).toContain('active'); expect(s).toContain('expired'); expect(s).toContain('suspended'); expect(s).toContain('cancelled'); expect(s).toContain('pending'); });
  });
});
