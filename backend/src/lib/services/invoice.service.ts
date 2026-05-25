import { randomUUID } from 'crypto';
import type { Container, Invoice, InvoiceLineItem, InvoicePayment, InvoiceStatus } from '../container/types';
import type { InMemoryInvoiceRepository } from '../repositories/invoice.repository.memory';

export interface InvoiceService {
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | null>;
  getInvoiceByNumber(num: string): Promise<Invoice | null>;
  getInvoices(): Promise<Invoice[]>;
  getInvoicesByGuest(guestId: string): Promise<Invoice[]>;
  getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]>;
  updateInvoice(id: string, updates: Partial<Pick<Invoice, 'notes' | 'dueDate'>>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;
  addLineItem(id: string, item: LineItemInput): Promise<Invoice>;
  removeLineItem(invoiceId: string, lineItemId: string): Promise<Invoice>;
  updateLineItem(invoiceId: string, lineItemId: string, updates: Partial<LineItemInput>): Promise<Invoice>;
  sendInvoice(id: string): Promise<Invoice>;
  markAsPaid(id: string): Promise<Invoice>;
  cancelInvoice(id: string): Promise<Invoice>;
  refundInvoice(id: string): Promise<Invoice>;
  recordPayment(input: RecordPaymentInput): Promise<Invoice>;
  getPayments(invoiceId: string): Promise<InvoicePayment[]>;
  getTotalPaid(invoiceId: string): Promise<number>;
  getUnpaidTotal(guestId: string): Promise<number>;
  generateInvoiceNumber(): string;
  calculateTotals(items: InvoiceLineItem[]): { subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number };
  isOverdue(invoice: Invoice): boolean;
  canEdit(invoice: Invoice): boolean;
  canCancel(invoice: Invoice): boolean;
  canRefund(invoice: Invoice): boolean;
  formatCurrency(amount: number, currency: string): string;
}

export interface CreateInvoiceInput {
  guestId: string;
  guestName: string;
  guestEmail: string;
  reservationId?: string;
  dueDate?: string;
  notes?: string;
  currency?: string;
  createdBy: string;
}

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  processedBy: string;
  transactionId?: string;
  notes?: string;
}

export function createInvoiceService(container: Container): InvoiceService {
  const repo = container.invoiceRepository as InMemoryInvoiceRepository;
  const logger = container.logger;

  function generateInvoiceNumber(): string {
    const date = new Date();
    const yymmdd = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0');
    return `INV-${yymmdd}-${rand}`;
  }

  function calculateTotals(items: InvoiceLineItem[]) {
    let subtotal = 0, discountAmount = 0, taxAmount = 0;
    for (const item of items) {
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineDiscount = lineSubtotal * (item.discount / 100);
      const lineAfterDiscount = lineSubtotal - lineDiscount;
      const lineTax = lineAfterDiscount * (item.taxRate / 100);
      subtotal += lineSubtotal;
      discountAmount += lineDiscount;
      taxAmount += lineTax;
    }
    const totalAmount = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100;
    return { subtotal: Math.round(subtotal * 100) / 100, discountAmount: Math.round(discountAmount * 100) / 100, taxAmount: Math.round(taxAmount * 100) / 100, totalAmount };
  }

  async function getInvoiceOrThrow(id: string): Promise<Invoice> {
    const inv = await repo.findById(id);
    if (!inv) throw new Error('Invoice not found');
    return inv;
  }

  return {
    generateInvoiceNumber,
    calculateTotals,

    async createInvoice(input) {
      const now = new Date().toISOString();
      const invoice: Invoice = {
        id: randomUUID(),
        invoiceNumber: generateInvoiceNumber(),
        guestId: input.guestId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        reservationId: input.reservationId ?? null,
        status: 'draft',
        lineItems: [],
        subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0,
        paidAmount: 0, balanceDue: 0,
        currency: input.currency ?? 'USD',
        dueDate: input.dueDate ?? null,
        paidDate: null,
        notes: input.notes ?? null,
        createdBy: input.createdBy,
        createdAt: now, updatedAt: null,
      };
      await repo.save(invoice);
      logger?.info('Invoice created', { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
      return invoice;
    },

    async getInvoice(id) { return repo.findById(id); },
    async getInvoiceByNumber(num) { return repo.findByNumber(num); },
    async getInvoices() { return repo.findAll(); },
    async getInvoicesByGuest(guestId) { return repo.findByGuestId(guestId); },
    async getInvoicesByStatus(status) { return repo.findByStatus(status); },

    async updateInvoice(id, updates) {
      const inv = await getInvoiceOrThrow(id);
      if (inv.status !== 'draft' && inv.status !== 'partial') throw new Error('Cannot edit invoice in current status');
      const updated = { ...inv, ...updates, updatedAt: new Date().toISOString() };
      return repo.save(updated);
    },

    async deleteInvoice(id) {
      const inv = await getInvoiceOrThrow(id);
      if (inv.status !== 'draft') throw new Error('Only draft invoices can be deleted');
      await repo.delete(id);
    },

    async addLineItem(invoiceId, itemInput) {
      const inv = await getInvoiceOrThrow(invoiceId);
      if (itemInput.quantity <= 0) throw new Error('Quantity must be greater than 0');
      if (itemInput.unitPrice < 0) throw new Error('Unit price cannot be negative');
      const newItem: InvoiceLineItem = {
        id: randomUUID(),
        description: itemInput.description,
        quantity: itemInput.quantity,
        unitPrice: itemInput.unitPrice,
        discount: itemInput.discount,
        taxRate: itemInput.taxRate,
        total: itemInput.quantity * itemInput.unitPrice,
      };
      const items = [...inv.lineItems, newItem];
      const totals = calculateTotals(items);
      const updated = { ...inv, lineItems: items, ...totals, balanceDue: totals.totalAmount - inv.paidAmount, updatedAt: new Date().toISOString() };
      return repo.save(updated);
    },

    async removeLineItem(invoiceId, lineItemId) {
      const inv = await getInvoiceOrThrow(invoiceId);
      const item = inv.lineItems.find(l => l.id === lineItemId);
      if (!item) throw new Error('Line item not found');
      const items = inv.lineItems.filter(l => l.id !== lineItemId);
      const totals = calculateTotals(items);
      const updated = { ...inv, lineItems: items, ...totals, balanceDue: totals.totalAmount - inv.paidAmount, updatedAt: new Date().toISOString() };
      return repo.save(updated);
    },

    async updateLineItem(invoiceId, lineItemId, updates) {
      const inv = await getInvoiceOrThrow(invoiceId);
      const idx = inv.lineItems.findIndex(l => l.id === lineItemId);
      if (idx === -1) throw new Error('Line item not found');
      if (updates.quantity !== undefined && updates.quantity <= 0) throw new Error('Quantity must be greater than 0');
      const items = [...inv.lineItems];
      items[idx] = { ...items[idx], ...updates };
      const totals = calculateTotals(items);
      const updated = { ...inv, lineItems: items, ...totals, balanceDue: totals.totalAmount - inv.paidAmount, updatedAt: new Date().toISOString() };
      return repo.save(updated);
    },

    async sendInvoice(id) {
      const inv = await getInvoiceOrThrow(id);
      if (inv.status !== 'draft' && inv.status !== 'partial') throw new Error('Can only send draft or pending invoices');
      if (inv.lineItems.length === 0) throw new Error('Cannot send invoice with no line items');
      return repo.save({ ...inv, status: 'sent', updatedAt: new Date().toISOString() });
    },

    async markAsPaid(id) {
      const inv = await getInvoiceOrThrow(id);
      if (inv.status === 'cancelled' || inv.status === 'refunded') throw new Error('Cannot mark cancelled or refunded invoice as paid');
      const now = new Date().toISOString();
      return repo.save({ ...inv, status: 'paid', paidAmount: inv.totalAmount, balanceDue: 0, paidDate: now, updatedAt: now });
    },

    async cancelInvoice(id) {
      const inv = await getInvoiceOrThrow(id);
      if (inv.status === 'paid' || inv.status === 'refunded') throw new Error('Cannot cancel invoice in current status');
      return repo.save({ ...inv, status: 'cancelled', updatedAt: new Date().toISOString() });
    },

    async refundInvoice(id) {
      const inv = await getInvoiceOrThrow(id);
      if (inv.status !== 'paid') throw new Error('Can only refund paid invoices');
      return repo.save({ ...inv, status: 'refunded', updatedAt: new Date().toISOString() });
    },

    async recordPayment(input) {
      const inv = await getInvoiceOrThrow(input.invoiceId);
      if (inv.status === 'cancelled' || inv.status === 'refunded') throw new Error('Cannot record payment on invoice in current status');
      if (input.amount <= 0) throw new Error('Payment amount must be greater than 0');
      if (input.amount > inv.balanceDue) throw new Error('Payment amount exceeds balance due');
      const payment: InvoicePayment = {
        id: randomUUID(),
        invoiceId: input.invoiceId,
        amount: input.amount,
        paymentMethod: input.paymentMethod as any,
        processedBy: input.processedBy,
        processedAt: new Date().toISOString(),
        transactionId: input.transactionId ?? null,
        notes: input.notes ?? null,
      };
      await repo.savePayment(payment);
      const newPaid = inv.paidAmount + input.amount;
      const newBalance = Math.round((inv.balanceDue - input.amount) * 100) / 100;
      const newStatus: InvoiceStatus = newBalance <= 0 ? 'paid' : 'partial';
      return repo.save({ ...inv, paidAmount: newPaid, balanceDue: newBalance, status: newStatus, updatedAt: new Date().toISOString() });
    },

    async getPayments(invoiceId) { return repo.findPayments(invoiceId); },

    async getTotalPaid(invoiceId) {
      const payments = await repo.findPayments(invoiceId);
      return payments.reduce((s, p) => s + p.amount, 0);
    },

    async getUnpaidTotal(guestId) {
      const invoices = await repo.findByGuestId(guestId);
      return invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'refunded').reduce((s, i) => s + i.totalAmount, 0);
    },

    isOverdue(invoice) {
      if (invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.status === 'refunded') return false;
      if (!invoice.dueDate) return false;
      return new Date(invoice.dueDate) < new Date();
    },

    canEdit(invoice) { return invoice.status === 'draft'; },
    canCancel(invoice) { return invoice.status !== 'paid' && invoice.status !== 'refunded'; },
    canRefund(invoice) { return invoice.status === 'paid'; },

    formatCurrency(amount, currency) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    },
  };
}
