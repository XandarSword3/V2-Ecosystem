import { Invoice, InvoiceStatus, InvoicePayment, InvoiceRepository } from '../container/types';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private invoices: Map<string, Invoice> = new Map();
  private payments: Map<string, InvoicePayment[]> = new Map();

  async getById(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) || null;
  }

  async getByInvoiceNumber(number: string): Promise<Invoice | null> {
    for (const invoice of this.invoices.values()) {
      if (invoice.invoiceNumber === number) {
        return invoice;
      }
    }
    return null;
  }

  async getAll(): Promise<Invoice[]> {
    return Array.from(this.invoices.values());
  }

  async getByGuestId(guestId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(i => i.guestId === guestId);
  }

  async getByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(i => i.status === status);
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(i => {
      return i.issueDate >= startDate && i.issueDate <= endDate;
    });
  }

  async getOverdue(): Promise<Invoice[]> {
    const now = new Date().toISOString();
    return Array.from(this.invoices.values()).filter(i => {
      return i.dueDate < now && i.balanceDue > 0 && !['paid', 'cancelled', 'refunded'].includes(i.status);
    });
  }

  async create(data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
    const id = crypto.randomUUID();
    const invoice: Invoice = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: null
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async update(id: string, data: Partial<Invoice>): Promise<Invoice> {
    const existing = this.invoices.get(id);
    if (!existing) {
      throw new Error('Invoice not found');
    }
    const updated: Invoice = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };
    this.invoices.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.invoices.delete(id);
  }

  async addPayment(data: Omit<InvoicePayment, 'id' | 'processedAt'>): Promise<InvoicePayment> {
    const id = crypto.randomUUID();
    const payment: InvoicePayment = {
      ...data,
      id,
      processedAt: new Date().toISOString()
    };
    
    const existing = this.payments.get(data.invoiceId) || [];
    existing.push(payment);
    this.payments.set(data.invoiceId, existing);
    
    return payment;
  }

  async getPayments(invoiceId: string): Promise<InvoicePayment[]> {
    return this.payments.get(invoiceId) || [];
  }
}
