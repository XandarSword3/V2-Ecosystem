/**
 * In-Memory Membership Repository
 * Test double for MembershipRepository using in-memory data structures.
 */

import type {
  MembershipRepository,
  MembershipPlan,
  Membership,
  MembershipPayment,
  MembershipStatus,
} from '../container/types.js';

export class InMemoryMembershipRepository implements MembershipRepository {
  private plans = new Map<string, MembershipPlan>();
  private memberships = new Map<string, Membership>();
  private payments: MembershipPayment[] = [];

  reset() {
    this.plans.clear();
    this.memberships.clear();
    this.payments = [];
  }

  // Plan operations
  async getPlan(id: string): Promise<MembershipPlan | null> {
    return this.plans.get(id) ?? null;
  }

  async getPlans(): Promise<MembershipPlan[]> {
    return [...this.plans.values()];
  }

  async getActivePlans(): Promise<MembershipPlan[]> {
    return [...this.plans.values()].filter(p => p.isActive);
  }

  async createPlan(data: Omit<MembershipPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MembershipPlan> {
    const id = crypto.randomUUID();
    const plan: MembershipPlan = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.plans.set(id, plan);
    return plan;
  }

  async updatePlan(id: string, data: Partial<MembershipPlan>): Promise<MembershipPlan> {
    const existing = this.plans.get(id);
    if (!existing) throw new Error(`Plan ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.plans.set(id, updated);
    return updated;
  }

  async deletePlan(id: string): Promise<void> {
    this.plans.delete(id);
  }

  // Membership operations
  async getMembership(id: string): Promise<Membership | null> {
    return this.memberships.get(id) ?? null;
  }

  async getMembershipByMember(memberId: string): Promise<Membership | null> {
    for (const m of this.memberships.values()) {
      if (m.memberId === memberId) return m;
    }
    return null;
  }

  async createMembership(data: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'>): Promise<Membership> {
    const id = crypto.randomUUID();
    const membership: Membership = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.memberships.set(id, membership);
    return membership;
  }

  async updateMembership(id: string, data: Partial<Membership>): Promise<Membership> {
    const existing = this.memberships.get(id);
    if (!existing) throw new Error(`Membership ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.memberships.set(id, updated);
    return updated;
  }

  async getExpiring(beforeDate: string): Promise<Membership[]> {
    return [...this.memberships.values()].filter(
      m => m.status === 'active' && m.endDate <= beforeDate
    );
  }

  async getByStatus(status: MembershipStatus): Promise<Membership[]> {
    return [...this.memberships.values()].filter(m => m.status === status);
  }

  // Payment operations
  async logPayment(data: Omit<MembershipPayment, 'id' | 'createdAt'>): Promise<MembershipPayment> {
    const payment: MembershipPayment = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.payments.push(payment);
    return payment;
  }

  async getPayments(membershipId: string): Promise<MembershipPayment[]> {
    return this.payments.filter(p => p.membershipId === membershipId);
  }
}
