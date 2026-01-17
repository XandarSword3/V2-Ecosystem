/**
 * In-Memory Membership Repository
 * 
 * Test double for membership operations.
 */

import type { MembershipRepository, MembershipPlan, Membership, MembershipPayment } from '../container/types.js';

export class InMemoryMembershipRepository implements MembershipRepository {
  private plans: Map<string, MembershipPlan> = new Map();
  private memberships: Map<string, Membership> = new Map();
  private payments: Map<string, MembershipPayment[]> = new Map();

  async getPlan(id: string): Promise<MembershipPlan | null> {
    return this.plans.get(id) || null;
  }

  async getPlans(): Promise<MembershipPlan[]> {
    return Array.from(this.plans.values());
  }

  async getActivePlans(): Promise<MembershipPlan[]> {
    return Array.from(this.plans.values()).filter(p => p.isActive);
  }

  async createPlan(data: Omit<MembershipPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MembershipPlan> {
    const plan: MembershipPlan = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.plans.set(plan.id, plan);
    return plan;
  }

  async updatePlan(id: string, data: Partial<MembershipPlan>): Promise<MembershipPlan> {
    const existing = this.plans.get(id);
    if (!existing) throw new Error('Plan not found');
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.plans.set(id, updated);
    return updated;
  }

  async deletePlan(id: string): Promise<void> {
    this.plans.delete(id);
  }

  async getMembership(id: string): Promise<Membership | null> {
    return this.memberships.get(id) || null;
  }

  async getMembershipByMember(memberId: string): Promise<Membership | null> {
    return Array.from(this.memberships.values()).find(m => m.memberId === memberId) || null;
  }

  async createMembership(data: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'>): Promise<Membership> {
    const membership: Membership = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.memberships.set(membership.id, membership);
    this.payments.set(membership.id, []);
    return membership;
  }

  async updateMembership(id: string, data: Partial<Membership>): Promise<Membership> {
    const existing = this.memberships.get(id);
    if (!existing) throw new Error('Membership not found');
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.memberships.set(id, updated);
    return updated;
  }

  async getExpiring(beforeDate: string): Promise<Membership[]> {
    return Array.from(this.memberships.values())
      .filter(m => m.status === 'active' && m.endDate <= beforeDate);
  }

  async getByStatus(status: string): Promise<Membership[]> {
    return Array.from(this.memberships.values()).filter(m => m.status === status);
  }

  async logPayment(data: Omit<MembershipPayment, 'id' | 'createdAt'>): Promise<MembershipPayment> {
    const payment: MembershipPayment = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const list = this.payments.get(data.membershipId) || [];
    list.push(payment);
    this.payments.set(data.membershipId, list);
    return payment;
  }

  async getPayments(membershipId: string): Promise<MembershipPayment[]> {
    return this.payments.get(membershipId) || [];
  }
}
