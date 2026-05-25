import { randomUUID } from 'crypto';
import type {
  Container, MembershipPlan, Membership, MembershipPayment,
  MembershipTier, MembershipStatus,
} from '../container/types';
import type { InMemoryMembershipRepository } from '../repositories/membership.repository.memory';

const TIERS: MembershipTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
const STATUSES: MembershipStatus[] = ['pending', 'active', 'suspended', 'expired', 'cancelled'];
const TIER_ORDER: Record<MembershipTier, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3, diamond: 4 };

function isUUID(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }

type Result<T> = { success: true; data: T } | { success: false; error: string };
const ok = <T>(data: T): Result<T> => ({ success: true, data });
const fail = <T>(error: string): Result<T> => ({ success: false, error });

export function createMembershipService(container: Container) {
  const repo = container.membershipRepository as InMemoryMembershipRepository;

  function calcEndDate(start: string, months: number): string {
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    return d.toISOString();
  }

  return {
    // ─── Plans ───────────────────────────────────────────────────────────────
    async createPlan(input: {
      name: string; tier: string; description: string; price: number;
      currency?: string; durationMonths?: number; benefits?: string[];
      discountPercentage?: number; guestPasses?: number; maxFamilyMembers?: number;
    }): Promise<Result<MembershipPlan>> {
      if (!input.name?.trim()) return fail('Plan name is required');
      if (!TIERS.includes(input.tier as MembershipTier)) return fail('Invalid membership tier');
      if (!input.description?.trim()) return fail('Description is required');
      if (!input.price || input.price <= 0) return fail('Price must be a positive number');
      if (input.durationMonths !== undefined && input.durationMonths <= 0) return fail('Duration must be positive');
      if (input.discountPercentage !== undefined && (input.discountPercentage < 0 || input.discountPercentage > 100)) return fail('Discount must be between 0 and 100');

      const plan: MembershipPlan = {
        id: randomUUID(),
        name: input.name.trim(),
        tier: input.tier as MembershipTier,
        description: input.description.trim(),
        price: input.price,
        currency: input.currency ?? 'USD',
        durationMonths: input.durationMonths ?? 12,
        benefits: input.benefits ?? [],
        discountPercentage: input.discountPercentage ?? 0,
        guestPasses: input.guestPasses ?? 0,
        maxFamilyMembers: input.maxFamilyMembers ?? 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      return ok(await repo.savePlan(plan));
    },

    async getPlan(id: string): Promise<Result<MembershipPlan>> {
      if (!isUUID(id)) return fail('Invalid plan ID');
      const p = await repo.findPlanById(id);
      if (!p) return fail('Plan not found');
      return ok(p);
    },

    async getPlans(): Promise<Result<MembershipPlan[]>> {
      return ok(await repo.findAllPlans());
    },

    async getActivePlans(): Promise<Result<MembershipPlan[]>> {
      const all = await repo.findAllPlans();
      return ok(all.filter(p => p.isActive));
    },

    async updatePlan(id: string, updates: Partial<{ name: string; price: number; discountPercentage: number; benefits: string[] }>): Promise<Result<MembershipPlan>> {
      if (!isUUID(id)) return fail('Invalid plan ID');
      const p = await repo.findPlanById(id);
      if (!p) return fail('Plan not found');
      if (updates.price !== undefined && updates.price <= 0) return fail('Price must be positive');
      if (updates.discountPercentage !== undefined && (updates.discountPercentage < 0 || updates.discountPercentage > 100)) return fail('Discount must be between 0 and 100');
      return ok(await repo.savePlan({ ...p, ...updates, updatedAt: new Date().toISOString() }));
    },

    async deactivatePlan(id: string): Promise<Result<MembershipPlan>> {
      if (!isUUID(id)) return fail('Invalid plan ID');
      const p = await repo.findPlanById(id);
      if (!p) return fail('Plan not found');
      if (!p.isActive) return fail('Plan is already inactive');
      return ok(await repo.savePlan({ ...p, isActive: false, updatedAt: new Date().toISOString() }));
    },

    async reactivatePlan(id: string): Promise<Result<MembershipPlan>> {
      if (!isUUID(id)) return fail('Invalid plan ID');
      const p = await repo.findPlanById(id);
      if (!p) return fail('Plan not found');
      if (p.isActive) return fail('Plan is already active');
      return ok(await repo.savePlan({ ...p, isActive: true, updatedAt: new Date().toISOString() }));
    },

    // ─── Memberships ─────────────────────────────────────────────────────────
    async enrollMember(input: {
      memberId: string; planId: string; autoRenew?: boolean;
      familyMembers?: string[]; notes?: string;
    }): Promise<Result<Membership>> {
      if (!isUUID(input.memberId)) return fail('Invalid member ID');
      if (!isUUID(input.planId)) return fail('Invalid plan ID');
      const plan = await repo.findPlanById(input.planId);
      if (!plan) return fail('Plan not found');
      if (!plan.isActive) return fail('Plan is not active');
      const family = input.familyMembers ?? [];
      if (plan.maxFamilyMembers > 0 && family.length > plan.maxFamilyMembers) return fail(`Maximum ${plan.maxFamilyMembers} family members allowed`);

      const now = new Date().toISOString();
      const membership: Membership = {
        id: randomUUID(),
        memberId: input.memberId,
        planId: input.planId,
        status: 'pending',
        startDate: now,
        endDate: calcEndDate(now, plan.durationMonths),
        autoRenew: input.autoRenew ?? false,
        familyMembers: family,
        guestPassesRemaining: plan.guestPasses,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: null,
      };
      return ok(await repo.saveMembership(membership));
    },

    async getMembership(id: string): Promise<Result<Membership>> {
      if (!isUUID(id)) return fail('Invalid membership ID');
      const m = await repo.findMembershipById(id);
      if (!m) return fail('Membership not found');
      return ok(m);
    },

    async getMembershipByMember(memberId: string): Promise<Result<Membership>> {
      const m = await repo.findMembershipByMember(memberId);
      if (!m) return fail('No membership found for this member');
      return ok(m);
    },

    async activateMembership(id: string): Promise<Result<Membership>> {
      if (!isUUID(id)) return fail('Invalid membership ID');
      const m = await repo.findMembershipById(id);
      if (!m) return fail('Membership not found');
      if (m.status !== 'pending') return fail('Only pending memberships can be activated');
      return ok(await repo.saveMembership({ ...m, status: 'active', updatedAt: new Date().toISOString() }));
    },

    async suspendMembership(id: string): Promise<Result<Membership>> {
      if (!isUUID(id)) return fail('Invalid membership ID');
      const m = await repo.findMembershipById(id);
      if (!m) return fail('Membership not found');
      if (m.status !== 'active') return fail('Only active memberships can be suspended');
      return ok(await repo.saveMembership({ ...m, status: 'suspended', updatedAt: new Date().toISOString() }));
    },

    async cancelMembership(id: string): Promise<Result<Membership>> {
      if (!isUUID(id)) return fail('Invalid membership ID');
      const m = await repo.findMembershipById(id);
      if (!m) return fail('Membership not found');
      if (m.status === 'cancelled') return fail('Membership is already cancelled');
      return ok(await repo.saveMembership({ ...m, status: 'cancelled', autoRenew: false, updatedAt: new Date().toISOString() }));
    },

    async renewMembership(input: { membershipId: string }): Promise<Result<Membership>> {
      if (!isUUID(input.membershipId)) return fail('Invalid membership ID');
      const m = await repo.findMembershipById(input.membershipId);
      if (!m) return fail('Membership not found');
      if (m.status === 'cancelled') return fail('Cannot renew cancelled membership');
      const plan = await repo.findPlanById(m.planId);
      if (!plan) return fail('Plan not found');
      const newEnd = calcEndDate(new Date().toISOString(), plan.durationMonths);
      return ok(await repo.saveMembership({
        ...m, status: 'active',
        endDate: newEnd,
        guestPassesRemaining: plan.guestPasses,
        updatedAt: new Date().toISOString(),
      }));
    },

    // ─── Guest passes ─────────────────────────────────────────────────────────
    async useGuestPass(input: { membershipId: string; guestName: string }): Promise<Result<Membership>> {
      if (!isUUID(input.membershipId)) return fail('Invalid membership ID');
      const m = await repo.findMembershipById(input.membershipId);
      if (!m) return fail('Membership not found');
      if (!input.guestName?.trim()) return fail('Guest name is required');
      if (m.guestPassesRemaining <= 0) return fail('No guest passes remaining');
      return ok(await repo.saveMembership({ ...m, guestPassesRemaining: m.guestPassesRemaining - 1, updatedAt: new Date().toISOString() }));
    },

    async addGuestPasses(id: string, count: number): Promise<Result<Membership>> {
      if (!isUUID(id)) return fail('Invalid membership ID');
      if (count <= 0) return fail('Count must be positive');
      const m = await repo.findMembershipById(id);
      if (!m) return fail('Membership not found');
      return ok(await repo.saveMembership({ ...m, guestPassesRemaining: m.guestPassesRemaining + count, updatedAt: new Date().toISOString() }));
    },

    // ─── Family ───────────────────────────────────────────────────────────────
    async addFamilyMember(input: { membershipId: string; familyMemberId: string }): Promise<Result<Membership>> {
      if (!isUUID(input.membershipId)) return fail('Invalid membership ID');
      const m = await repo.findMembershipById(input.membershipId);
      if (!m) return fail('Membership not found');
      const plan = await repo.findPlanById(m.planId);
      if (!plan) return fail('Plan not found');
      if (m.familyMembers.includes(input.familyMemberId)) return fail('Family member already added');
      if (plan.maxFamilyMembers > 0 && m.familyMembers.length >= plan.maxFamilyMembers) return fail('Maximum family members reached');
      return ok(await repo.saveMembership({ ...m, familyMembers: [...m.familyMembers, input.familyMemberId], updatedAt: new Date().toISOString() }));
    },

    async removeFamilyMember(id: string, familyMemberId: string): Promise<Result<Membership>> {
      if (!isUUID(id)) return fail('Invalid membership ID');
      const m = await repo.findMembershipById(id);
      if (!m) return fail('Membership not found');
      if (!m.familyMembers.includes(familyMemberId)) return fail('Family member not found');
      return ok(await repo.saveMembership({ ...m, familyMembers: m.familyMembers.filter(x => x !== familyMemberId), updatedAt: new Date().toISOString() }));
    },

    // ─── Payments ─────────────────────────────────────────────────────────────
    async recordPayment(input: { membershipId: string; amount: number; paymentMethod: string; transactionId?: string }): Promise<Result<MembershipPayment>> {
      if (!isUUID(input.membershipId)) return fail('Invalid membership ID');
      const m = await repo.findMembershipById(input.membershipId);
      if (!m) return fail('Membership not found');
      if (input.amount <= 0) return fail('Amount must be positive');
      const payment: MembershipPayment = {
        id: randomUUID(),
        membershipId: input.membershipId,
        amount: input.amount,
        currency: 'USD',
        paymentMethod: input.paymentMethod,
        transactionId: input.transactionId ?? null,
        paymentStatus: 'completed',
        paidAt: new Date().toISOString(),
      };
      await repo.savePayment(payment, input.membershipId);
      // Auto-activate pending membership
      if (m.status === 'pending') {
        await repo.saveMembership({ ...m, status: 'active', updatedAt: new Date().toISOString() });
      }
      return ok(payment);
    },

    async getPayments(membershipId: string): Promise<Result<MembershipPayment[]>> {
      if (!isUUID(membershipId)) return fail('Invalid membership ID');
      return ok(await repo.findPayments(membershipId));
    },

    // ─── Queries ──────────────────────────────────────────────────────────────
    async getExpiringMemberships(days: number): Promise<Result<Membership[]>> {
      if (days <= 0) return fail('Days must be positive');
      const threshold = new Date(Date.now() + days * 86400000).toISOString();
      const all = await repo.findAllMemberships();
      return ok(all.filter(m => m.status === 'active' && m.endDate <= threshold));
    },

    async getMembershipsByStatus(status: string): Promise<Result<Membership[]>> {
      if (!STATUSES.includes(status as MembershipStatus)) return fail('Invalid status');
      const all = await repo.findAllMemberships();
      return ok(all.filter(m => m.status === status));
    },

    // ─── Utilities ────────────────────────────────────────────────────────────
    isExpired(m: Membership): boolean { return new Date(m.endDate) < new Date(); },
    isActive(m: Membership): boolean { return m.status === 'active' && new Date(m.endDate) >= new Date(); },
    getDaysRemaining(m: Membership): number {
      return Math.max(0, Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000));
    },
    compareTiers(a: MembershipTier, b: MembershipTier): number { return TIER_ORDER[a] - TIER_ORDER[b]; },
    isHigherTier(a: MembershipTier, b: MembershipTier): boolean { return TIER_ORDER[a] > TIER_ORDER[b]; },
    getTierName(tier: MembershipTier): string { return tier.charAt(0).toUpperCase() + tier.slice(1); },
    getTiers(): MembershipTier[] { return [...TIERS]; },
    getStatuses(): MembershipStatus[] { return [...STATUSES]; },
  };
}
