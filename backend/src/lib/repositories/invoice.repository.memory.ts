/**
 * In-Memory Invoice Repository
 * Test double for InvoiceRepository using in-memory data structures.
 */

import type {
  InvoiceRepository,
  Invoice,
  InvoicePayment,
  InvoiceStatus,
} from '../container/types.js';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private invoices = new Map<string, Invoice>();
  private payments: InvoicePayment[] = [];

  reset() {
    this.invoices.clear();
    this.payments = [];
  }

  async getById(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) ?? null;
  }

  async getByInvoiceNumber(number: string): Promise<Invoice | null> {
    for (const inv of this.invoices.values()) {
      if (inv.invoiceNumber === number) return inv;
    }
    return null;
  }

  async getAll(): Promise<Invoice[]> {
    return [...this.invoices.values()];
  }

  async getByGuestId(guestId: string): Promise<Invoice[]> {
    return [...this.invoices.values()].filter(i => i.guestId === guestId);
  }

  async getByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    return [...this.invoices.values()].filter(i => i.status === status);
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Invoice[]> {
    return [...this.invoices.values()].filter(
      i => i.issueDate >= startDate && i.issueDate <= endDate
    );
  }

  async getOverdue(): Promise<Invoice[]> {
    const now = new Date().toISOString();
    return [...this.invoices.values()].filter(
      i => i.dueDate < now && i.balanceDue > 0 && i.status !== 'cancelled' && i.status !== 'paid'
    );
  }

  async create(data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
    const id = crypto.randomUUID();
    const invoice: Invoice = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async update(id: string, data: Partial<Invoice>): Promise<Invoice> {
    const existing = this.invoices.get(id);
    if (!existing) throw new Error(`Invoice ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.invoices.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.invoices.delete(id);
  }

  async addPayment(data: Omit<InvoicePayment, 'id' | 'processedAt'>): Promise<InvoicePayment> {
    const payment: InvoicePayment = { ...data, id: crypto.randomUUID(), processedAt: new Date().toISOString() };
    this.payments.push(payment);
    return payment;
  }

  async getPayments(invoiceId: string): Promise<InvoicePayment[]> {
    return this.payments.filter(p => p.invoiceId === invoiceId);
  }
}
