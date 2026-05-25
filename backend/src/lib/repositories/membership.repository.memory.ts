import type { MembershipPlan, Membership, MembershipPayment } from '../container/types';

export class InMemoryMembershipRepository {
  private plans: Map<string, MembershipPlan> = new Map();
  private memberships: Map<string, Membership> = new Map();
  private payments: Map<string, MembershipPayment[]> = new Map();

  async savePlan(p: MembershipPlan): Promise<MembershipPlan> { this.plans.set(p.id, { ...p }); return p; }
  async findPlanById(id: string): Promise<MembershipPlan | null> { return this.plans.get(id) ?? null; }
  async findAllPlans(): Promise<MembershipPlan[]> { return Array.from(this.plans.values()); }

  async saveMembership(m: Membership): Promise<Membership> { this.memberships.set(m.id, { ...m }); return m; }
  async findMembershipById(id: string): Promise<Membership | null> { return this.memberships.get(id) ?? null; }
  async findAllMemberships(): Promise<Membership[]> { return Array.from(this.memberships.values()); }
  async findMembershipByMember(memberId: string): Promise<Membership | null> {
    for (const m of this.memberships.values()) {
      if (m.memberId === memberId) return m;
    }
    return null;
  }

  async savePayment(p: MembershipPayment, membershipId: string): Promise<MembershipPayment> {
    const list = this.payments.get(membershipId) ?? [];
    list.push({ ...p });
    this.payments.set(membershipId, list);
    return p;
  }
  async findPayments(membershipId: string): Promise<MembershipPayment[]> {
    return this.payments.get(membershipId) ?? [];
  }
}
