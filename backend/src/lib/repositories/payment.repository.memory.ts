/**
 * In-memory Payment Repository for Testing
 * 
 * This is a test double for the payment repository that stores
 * payment records in memory for unit testing purposes.
 */

import { randomUUID } from 'crypto';
import type {
  Payment,
  PaymentFilters,
  PaymentMethod,
  PaymentRepository,
  PaymentStatus,
  ReferenceType,
} from '../container/types';

export class InMemoryPaymentRepository implements PaymentRepository {
  private payments: Map<string, Payment> = new Map();

  async create(data: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    const payment: Payment = {
      ...data,
      id: randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  async getById(id: string): Promise<Payment | null> {
    return this.payments.get(id) || null;
  }

  async getByReferenceId(
    referenceType: ReferenceType,
    referenceId: string
  ): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(
      (p) => p.reference_type === referenceType && p.reference_id === referenceId
    );
  }

  async getAll(
    filters?: PaymentFilters,
    pagination?: { limit: number; offset: number }
  ): Promise<{ payments: Payment[]; total: number }> {
    let result = Array.from(this.payments.values());

    if (filters) {
      if (filters.referenceType) {
        result = result.filter((p) => p.reference_type === filters.referenceType);
      }
      if (filters.referenceId) {
        result = result.filter((p) => p.reference_id === filters.referenceId);
      }
      if (filters.method) {
        result = result.filter((p) => p.method === filters.method);
      }
      if (filters.status) {
        result = result.filter((p) => p.status === filters.status);
      }
      if (filters.startDate) {
        result = result.filter((p) => p.created_at >= filters.startDate!);
      }
      if (filters.endDate) {
        result = result.filter((p) => p.created_at <= filters.endDate!);
      }
    }

    const total = result.length;

    // Sort by created_at descending
    result.sort((a, b) => b.created_at.localeCompare(a.created_at));

    if (pagination) {
      result = result.slice(pagination.offset, pagination.offset + pagination.limit);
    }

    return { payments: result, total };
  }

  async updateStatus(id: string, status: PaymentStatus, notes?: string): Promise<Payment> {
    const payment = this.payments.get(id);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const updated: Payment = {
      ...payment,
      status,
      notes: notes !== undefined ? notes : payment.notes,
      updated_at: new Date().toISOString(),
    };
    this.payments.set(id, updated);
    return updated;
  }

  async getPaymentStats(
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalAmount: number;
    totalCount: number;
    byMethod: Record<PaymentMethod, number>;
    byStatus: Record<PaymentStatus, number>;
  }> {
    let payments = Array.from(this.payments.values());

    if (startDate) {
      payments = payments.filter((p) => p.created_at >= startDate);
    }
    if (endDate) {
      payments = payments.filter((p) => p.created_at <= endDate);
    }

    const byMethod: Record<PaymentMethod, number> = {
      card: 0,
      cash: 0,
      bank_transfer: 0,
      other: 0,
    };

    const byStatus: Record<PaymentStatus, number> = {
      pending: 0,
      completed: 0,
      failed: 0,
      refunded: 0,
      cancelled: 0,
    };

    let totalAmount = 0;

    for (const payment of payments) {
      totalAmount += parseFloat(payment.amount);
      byMethod[payment.method]++;
      byStatus[payment.status]++;
    }

    return {
      totalAmount,
      totalCount: payments.length,
      byMethod,
      byStatus,
    };
  }

  // Test helper methods
  clear(): void {
    this.payments.clear();
  }

  addPayment(payment: Payment): void {
    this.payments.set(payment.id, payment);
  }

  getAllPayments(): Payment[] {
    return Array.from(this.payments.values());
  }
}
