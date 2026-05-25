import type { Invoice, InvoicePayment } from '../container/types';

export class InMemoryInvoiceRepository {
  private invoices: Map<string, Invoice> = new Map();
  private payments: Map<string, InvoicePayment[]> = new Map();

  async findById(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) ?? null;
  }

  async findByNumber(invoiceNumber: string): Promise<Invoice | null> {
    for (const inv of this.invoices.values()) {
      if (inv.invoiceNumber === invoiceNumber) return inv;
    }
    return null;
  }

  async findAll(): Promise<Invoice[]> {
    return Array.from(this.invoices.values());
  }

  async findByGuestId(guestId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(i => i.guestId === guestId);
  }

  async findByStatus(status: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(i => i.status === status);
  }

  async save(invoice: Invoice): Promise<Invoice> {
    this.invoices.set(invoice.id, { ...invoice });
    return invoice;
  }

  async delete(id: string): Promise<void> {
    this.invoices.delete(id);
  }

  async savePayment(payment: InvoicePayment): Promise<InvoicePayment> {
    const list = this.payments.get(payment.invoiceId) ?? [];
    list.push({ ...payment });
    this.payments.set(payment.invoiceId, list);
    return payment;
  }

  async findPayments(invoiceId: string): Promise<InvoicePayment[]> {
    return this.payments.get(invoiceId) ?? [];
  }
}
