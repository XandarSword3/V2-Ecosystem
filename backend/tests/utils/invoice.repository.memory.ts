import type { Invoice, InvoicePayment, InvoiceRepository, InvoiceStatus } from '../../src/services/invoice.service';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private invoices = new Map<string, Invoice>();
  private payments: InvoicePayment[] = [];

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
    return [...this.invoices.values()];
  }

  async findByGuestId(guestId: string): Promise<Invoice[]> {
    return [...this.invoices.values()].filter(i => i.guestId === guestId);
  }

  async findByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    return [...this.invoices.values()].filter(i => i.status === status);
  }

  async save(invoice: Invoice): Promise<Invoice> {
    this.invoices.set(invoice.id, { ...invoice });
    return invoice;
  }

  async delete(id: string): Promise<void> {
    this.invoices.delete(id);
  }

  async savePayment(payment: InvoicePayment): Promise<InvoicePayment> {
    this.payments.push({ ...payment });
    return payment;
  }

  async findPayments(invoiceId: string): Promise<InvoicePayment[]> {
    return this.payments.filter(p => p.invoiceId === invoiceId);
  }
}
