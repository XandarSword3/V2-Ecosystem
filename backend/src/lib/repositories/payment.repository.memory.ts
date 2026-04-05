/**
 * In-Memory Payment Repository
 * Test double for PaymentRepository using in-memory data structures.
 */

import type {
  PaymentRepository,
  Payment,
  PaymentFilters,
  PaymentMethod,
  PaymentStatus,
  ReferenceType,
} from '../container/types.js';

export class InMemoryPaymentRepository implements PaymentRepository {
  private payments = new Map<string, Payment>();

  /** Test helper: directly insert a payment */
  addPayment(payment: Payment): void {
    this.payments.set(payment.id, payment);
  }

  reset() {
    this.payments.clear();
  }

  /** Test helper: alias for reset */
  clear() {
    this.payments.clear();
  }

  async create(data: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    const id = crypto.randomUUID();
    const payment: Payment = { ...data, id, created_at: new Date().toISOString() } as Payment;
    this.payments.set(id, payment);
    return payment;
  }

  async getById(id: string): Promise<Payment | null> {
    return this.payments.get(id) ?? null;
  }

  async getByReferenceId(referenceType: ReferenceType, referenceId: string): Promise<Payment[]> {
    return [...this.payments.values()].filter(
      p => p.reference_type === referenceType && p.reference_id === referenceId
    );
  }

  async getAll(filters?: PaymentFilters, pagination?: { limit: number; offset: number }): Promise<{ payments: Payment[]; total: number }> {
    let result = [...this.payments.values()];
    if (filters?.referenceType) result = result.filter(p => p.reference_type === filters.referenceType);
    if (filters?.referenceId) result = result.filter(p => p.reference_id === filters.referenceId);
    if (filters?.method) result = result.filter(p => p.method === filters.method);
    if (filters?.status) result = result.filter(p => p.status === filters.status);
    if (filters?.startDate) result = result.filter(p => p.created_at >= filters.startDate!);
    if (filters?.endDate) result = result.filter(p => p.created_at <= filters.endDate!);
    const total = result.length;
    if (pagination) result = result.slice(pagination.offset, pagination.offset + pagination.limit);
    return { payments: result, total };
  }

  async updateStatus(id: string, status: PaymentStatus, notes?: string): Promise<Payment> {
    const existing = this.payments.get(id);
    if (!existing) throw new Error(`Payment ${id} not found`);
    const updated = { ...existing, status, notes: notes ?? existing.notes, updated_at: new Date().toISOString() };
    this.payments.set(id, updated);
    return updated;
  }

  async getPaymentStats(startDate?: string, endDate?: string) {
    let result = [...this.payments.values()];
    if (startDate) result = result.filter(p => p.created_at >= startDate);
    if (endDate) result = result.filter(p => p.created_at <= endDate);
    const totalAmount = result.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const byMethod = {} as Record<PaymentMethod, number>;
    const byStatus = {} as Record<PaymentStatus, number>;
    for (const p of result) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + parseFloat(p.amount);
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    }
    return { totalAmount, totalCount: result.length, byMethod, byStatus };
  }
}
