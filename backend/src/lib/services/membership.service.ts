/**
 * Membership Service
 * 
 * Manages membership plans, subscriptions, renewals, and benefits.
 */

import type { 
  Container, 
  MembershipPlan, 
  Membership, 
  MembershipPayment,
  MembershipTier,
  MembershipStatus,
} from '../container/types.js';

// ============================================
// INPUT TYPES
// ============================================

export interface CreatePlanInput {
  name: string;
  tier: MembershipTier;
  description: string;
  price: number;
  currency?: string;
  durationMonths?: number;
  benefits?: string[];
  discountPercentage?: number;
  guestPasses?: number;
  maxFamilyMembers?: number;
}

export interface UpdatePlanInput {
  name?: string;
  description?: string;
  price?: number;
  benefits?: string[];
  discountPercentage?: number;
  guestPasses?: number;
  maxFamilyMembers?: number;
  isActive?: boolean;
}

export interface EnrollMemberInput {
  memberId: string;
  planId: string;
  autoRenew?: boolean;
  familyMembers?: string[];
  notes?: string;
}

export interface RenewMembershipInput {
  membershipId: string;
  extendMonths?: number;
}

export interface UseGuestPassInput {
  membershipId: string;
  guestName: string;
}

export interface AddFamilyMemberInput {
  membershipId: string;
  familyMemberId: string;
}

export interface RecordPaymentInput {
  membershipId: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  transactionId?: string;
}

// ============================================
// RESULT TYPES
// ============================================

export interface MembershipServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// CONSTANTS
// ============================================

const VALID_TIERS: MembershipTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
const VALID_STATUSES: MembershipStatus[] = ['active', 'expired', 'suspended', 'cancelled', 'pending'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIER_HIERARCHY: Record<MembershipTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
};

// ============================================
// SERVICE FACTORY
// ============================================

export function createMembershipService(container: Container) {
  const { membershipRepository } = container;

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  function isValidUUID(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  function isValidTier(tier: string): tier is MembershipTier {
    return VALID_TIERS.includes(tier as MembershipTier);
  }

  // ============================================
  // PLAN MANAGEMENT
  // ============================================

  async function createPlan(input: CreatePlanInput): Promise<MembershipServiceResult<MembershipPlan>> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      return { success: false, error: 'Plan name is required' };
    }

    // Validate tier
    if (!isValidTier(input.tier)) {
      return { success: false, error: 'Invalid membership tier' };
    }

    // Validate description
    if (!input.description || input.description.trim().length === 0) {
      return { success: false, error: 'Description is required' };
    }

    // Validate price
    if (typeof input.price !== 'number' || input.price <= 0) {
      return { success: false, error: 'Price must be a positive number' };
    }

    // Validate duration
    const durationMonths = input.durationMonths || 12;
    if (durationMonths <= 0) {
      return { success: false, error: 'Duration must be positive' };
    }

    // Validate discount
    const discountPercentage = input.discountPercentage || 0;
    if (discountPercentage < 0 || discountPercentage > 100) {
      return { success: false, error: 'Discount must be between 0 and 100' };
    }

    const plan = await membershipRepository.createPlan({
      name: input.name.trim(),
      tier: input.tier,
      description: input.description.trim(),
      price: input.price,
      currency: input.currency || 'USD',
      durationMonths,
      benefits: input.benefits || [],
      discountPercentage,
      guestPasses: input.guestPasses || 0,
      maxFamilyMembers: input.maxFamilyMembers || 0,
      isActive: true,
    });

    return { success: true, data: plan };
  }

  async function getPlan(id: string): Promise<MembershipServiceResult<MembershipPlan>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid plan ID' };
    }

    const plan = await membershipRepository.getPlan(id);
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    return { success: true, data: plan };
  }

  async function getPlans(): Promise<MembershipServiceResult<MembershipPlan[]>> {
    const plans = await membershipRepository.getPlans();
    return { success: true, data: plans };
  }

  async function getActivePlans(): Promise<MembershipServiceResult<MembershipPlan[]>> {
    const plans = await membershipRepository.getActivePlans();
    return { success: true, data: plans };
  }

  async function updatePlan(id: string, input: UpdatePlanInput): Promise<MembershipServiceResult<MembershipPlan>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid plan ID' };
    }

    const existing = await membershipRepository.getPlan(id);
    if (!existing) {
      return { success: false, error: 'Plan not found' };
    }

    // Validate discount if provided
    if (input.discountPercentage !== undefined) {
      if (input.discountPercentage < 0 || input.discountPercentage > 100) {
        return { success: false, error: 'Discount must be between 0 and 100' };
      }
    }

    // Validate price if provided
    if (input.price !== undefined && input.price <= 0) {
      return { success: false, error: 'Price must be positive' };
    }

    const updated = await membershipRepository.updatePlan(id, input);
    return { success: true, data: updated };
  }

  async function deactivatePlan(id: string): Promise<MembershipServiceResult<MembershipPlan>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid plan ID' };
    }

    const existing = await membershipRepository.getPlan(id);
    if (!existing) {
      return { success: false, error: 'Plan not found' };
    }

    if (!existing.isActive) {
      return { success: false, error: 'Plan is already inactive' };
    }

    const updated = await membershipRepository.updatePlan(id, { isActive: false });
    return { success: true, data: updated };
  }

  async function reactivatePlan(id: string): Promise<MembershipServiceResult<MembershipPlan>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid plan ID' };
    }

    const existing = await membershipRepository.getPlan(id);
    if (!existing) {
      return { success: false, error: 'Plan not found' };
    }

    if (existing.isActive) {
      return { success: false, error: 'Plan is already active' };
    }

    const updated = await membershipRepository.updatePlan(id, { isActive: true });
    return { success: true, data: updated };
  }

  // ============================================
  // MEMBERSHIP MANAGEMENT
  // ============================================

  async function enrollMember(input: EnrollMemberInput): Promise<MembershipServiceResult<Membership>> {
    // Validate member ID
    if (!isValidUUID(input.memberId)) {
      return { success: false, error: 'Invalid member ID' };
    }

    // Validate plan ID
    if (!isValidUUID(input.planId)) {
      return { success: false, error: 'Invalid plan ID' };
    }

    // Check if member already has active membership
    const existing = await membershipRepository.getMembershipByMember(input.memberId);
    if (existing && existing.status === 'active') {
      return { success: false, error: 'Member already has an active membership' };
    }

    // Get plan
    const plan = await membershipRepository.getPlan(input.planId);
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    if (!plan.isActive) {
      return { success: false, error: 'Plan is not active' };
    }

    // Validate family members
    const familyMembers = input.familyMembers || [];
    if (familyMembers.length > plan.maxFamilyMembers) {
      return { success: false, error: `Maximum ${plan.maxFamilyMembers} family members allowed` };
    }

    // Validate all family member IDs
    for (const id of familyMembers) {
      if (!isValidUUID(id)) {
        return { success: false, error: 'Invalid family member ID' };
      }
    }

    // Calculate dates
    const startDate = new Date().toISOString();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);

    const membership = await membershipRepository.createMembership({
      memberId: input.memberId,
      planId: input.planId,
      tier: plan.tier,
      status: 'pending', // Pending until payment confirmed
      startDate,
      endDate: endDate.toISOString(),
      autoRenew: input.autoRenew ?? false,
      guestPassesRemaining: plan.guestPasses,
      familyMembers,
      notes: input.notes,
    });

    return { success: true, data: membership };
  }

  async function getMembership(id: string): Promise<MembershipServiceResult<Membership>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    const membership = await membershipRepository.getMembership(id);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    return { success: true, data: membership };
  }

  async function getMembershipByMember(memberId: string): Promise<MembershipServiceResult<Membership>> {
    if (!isValidUUID(memberId)) {
      return { success: false, error: 'Invalid member ID' };
    }

    const membership = await membershipRepository.getMembershipByMember(memberId);
    if (!membership) {
      return { success: false, error: 'No membership found for this member' };
    }

    return { success: true, data: membership };
  }

  async function activateMembership(id: string): Promise<MembershipServiceResult<Membership>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    const membership = await membershipRepository.getMembership(id);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    if (membership.status !== 'pending') {
      return { success: false, error: 'Only pending memberships can be activated' };
    }

    const updated = await membershipRepository.updateMembership(id, { status: 'active' });
    return { success: true, data: updated };
  }

  async function suspendMembership(id: string): Promise<MembershipServiceResult<Membership>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    const membership = await membershipRepository.getMembership(id);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    if (membership.status !== 'active') {
      return { success: false, error: 'Only active memberships can be suspended' };
    }

    const updated = await membershipRepository.updateMembership(id, { status: 'suspended' });
    return { success: true, data: updated };
  }

  async function cancelMembership(id: string): Promise<MembershipServiceResult<Membership>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    const membership = await membershipRepository.getMembership(id);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    if (membership.status === 'cancelled') {
      return { success: false, error: 'Membership is already cancelled' };
    }

    const updated = await membershipRepository.updateMembership(id, { 
      status: 'cancelled', 
      autoRenew: false,
    });
    return { success: true, data: updated };
  }

  async function renewMembership(input: RenewMembershipInput): Promise<MembershipServiceResult<Membership>> {
    if (!isValidUUID(input.membershipId)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    const membership = await membershipRepository.getMembership(input.membershipId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    if (membership.status === 'cancelled') {
      return { success: false, error: 'Cannot renew cancelled membership' };
    }

    const plan = await membershipRepository.getPlan(membership.planId);
    if (!plan) {
      return { success: false, error: 'Plan no longer exists' };
    }

    // Calculate new end date
    const currentEnd = new Date(membership.endDate);
    const extendMonths = input.extendMonths || plan.durationMonths;
    currentEnd.setMonth(currentEnd.getMonth() + extendMonths);

    // Reset guest passes
    const updated = await membershipRepository.updateMembership(input.membershipId, {
      endDate: currentEnd.toISOString(),
      status: 'active',
      guestPassesRemaining: plan.guestPasses,
    });

    return { success: true, data: updated };
  }

  // ============================================
  // GUEST PASS MANAGEMENT
  // ============================================

  async function useGuestPass(input: UseGuestPassInput): Promise<MembershipServiceResult<Membership>> {
    if (!isValidUUID(input.membershipId)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    if (!input.guestName || input.guestName.trim().length === 0) {
      return { success: false, error: 'Guest name is required' };
    }

    const membership = await membershipRepository.getMembership(input.membershipId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    if (membership.status !== 'active') {
      return { success: false, error: 'Membership is not active' };
    }

    if (membership.guestPassesRemaining <= 0) {
      return { success: false, error: 'No guest passes remaining' };
    }

    const updated = await membershipRepository.updateMembership(input.membershipId, {
      guestPassesRemaining: membership.guestPassesRemaining - 1,
    });

    return { success: true, data: updated };
  }

  async function addGuestPasses(membershipId: string, count: number): Promise<MembershipServiceResult<Membership>> {
    if (!isValidUUID(membershipId)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    if (count <= 0) {
      return { success: false, error: 'Count must be positive' };
    }

    const membership = await membershipRepository.getMembership(membershipId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    const updated = await membershipRepository.updateMembership(membershipId, {
      guestPassesRemaining: membership.guestPassesRemaining + count,
    });

    return { success: true, data: updated };
  }

  // ============================================
  // FAMILY MEMBER MANAGEMENT
  // ============================================

  async function addFamilyMember(input: AddFamilyMemberInput): Promise<MembershipServiceResult<Membership>> {
    if (!isValidUUID(input.membershipId)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    if (!isValidUUID(input.familyMemberId)) {
      return { success: false, error: 'Invalid family member ID' };
    }

    const membership = await membershipRepository.getMembership(input.membershipId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    const plan = await membershipRepository.getPlan(membership.planId);
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    if (membership.familyMembers.includes(input.familyMemberId)) {
      return { success: false, error: 'Family member already added' };
    }

    if (membership.familyMembers.length >= plan.maxFamilyMembers) {
      return { success: false, error: 'Maximum family members reached' };
    }

    const updated = await membershipRepository.updateMembership(input.membershipId, {
      familyMembers: [...membership.familyMembers, input.familyMemberId],
    });

    return { success: true, data: updated };
  }

  async function removeFamilyMember(membershipId: string, familyMemberId: string): Promise<MembershipServiceResult<Membership>> {
    if (!isValidUUID(membershipId)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    if (!isValidUUID(familyMemberId)) {
      return { success: false, error: 'Invalid family member ID' };
    }

    const membership = await membershipRepository.getMembership(membershipId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    if (!membership.familyMembers.includes(familyMemberId)) {
      return { success: false, error: 'Family member not found' };
    }

    const updated = await membershipRepository.updateMembership(membershipId, {
      familyMembers: membership.familyMembers.filter(id => id !== familyMemberId),
    });

    return { success: true, data: updated };
  }

  // ============================================
  // PAYMENT MANAGEMENT
  // ============================================

  async function recordPayment(input: RecordPaymentInput): Promise<MembershipServiceResult<MembershipPayment>> {
    if (!isValidUUID(input.membershipId)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    if (input.amount <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }

    if (!input.paymentMethod || input.paymentMethod.trim().length === 0) {
      return { success: false, error: 'Payment method is required' };
    }

    const membership = await membershipRepository.getMembership(input.membershipId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    const payment = await membershipRepository.logPayment({
      membershipId: input.membershipId,
      amount: input.amount,
      currency: input.currency || 'USD',
      paymentMethod: input.paymentMethod.trim(),
      paymentStatus: 'completed',
      transactionId: input.transactionId,
      paidAt: new Date().toISOString(),
    });

    // Activate pending membership after payment
    if (membership.status === 'pending') {
      await membershipRepository.updateMembership(input.membershipId, { status: 'active' });
    }

    return { success: true, data: payment };
  }

  async function getPayments(membershipId: string): Promise<MembershipServiceResult<MembershipPayment[]>> {
    if (!isValidUUID(membershipId)) {
      return { success: false, error: 'Invalid membership ID' };
    }

    const membership = await membershipRepository.getMembership(membershipId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    const payments = await membershipRepository.getPayments(membershipId);
    return { success: true, data: payments };
  }

  // ============================================
  // QUERIES
  // ============================================

  async function getExpiringMemberships(withinDays: number): Promise<MembershipServiceResult<Membership[]>> {
    if (withinDays <= 0) {
      return { success: false, error: 'Days must be positive' };
    }

    const beforeDate = new Date();
    beforeDate.setDate(beforeDate.getDate() + withinDays);

    const memberships = await membershipRepository.getExpiring(beforeDate.toISOString());
    return { success: true, data: memberships };
  }

  async function getMembershipsByStatus(status: MembershipStatus): Promise<MembershipServiceResult<Membership[]>> {
    if (!VALID_STATUSES.includes(status)) {
      return { success: false, error: 'Invalid status' };
    }

    const memberships = await membershipRepository.getByStatus(status);
    return { success: true, data: memberships };
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function isExpired(membership: Membership): boolean {
    return new Date(membership.endDate) < new Date();
  }

  function isActive(membership: Membership): boolean {
    return membership.status === 'active' && !isExpired(membership);
  }

  function getDaysRemaining(membership: Membership): number {
    const endDate = new Date(membership.endDate);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function compareTiers(tier1: MembershipTier, tier2: MembershipTier): number {
    return TIER_HIERARCHY[tier1] - TIER_HIERARCHY[tier2];
  }

  function isHigherTier(tier1: MembershipTier, tier2: MembershipTier): boolean {
    return compareTiers(tier1, tier2) > 0;
  }

  function getTierName(tier: MembershipTier): string {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  }

  function getTiers(): MembershipTier[] {
    return [...VALID_TIERS];
  }

  function getStatuses(): MembershipStatus[] {
    return [...VALID_STATUSES];
  }

  return {
    // Plan management
    createPlan,
    getPlan,
    getPlans,
    getActivePlans,
    updatePlan,
    deactivatePlan,
    reactivatePlan,
    
    // Membership management
    enrollMember,
    getMembership,
    getMembershipByMember,
    activateMembership,
    suspendMembership,
    cancelMembership,
    renewMembership,
    
    // Guest pass management
    useGuestPass,
    addGuestPasses,
    
    // Family member management
    addFamilyMember,
    removeFamilyMember,
    
    // Payment management
    recordPayment,
    getPayments,
    
    // Queries
    getExpiringMemberships,
    getMembershipsByStatus,
    
    // Utility functions
    isExpired,
    isActive,
    getDaysRemaining,
    compareTiers,
    isHigherTier,
    getTierName,
    getTiers,
    getStatuses,
  };
}
