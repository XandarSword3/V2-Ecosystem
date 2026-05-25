/**
 * Invoice Service
 *
 * Pure business-logic service for invoice management.
 * Uses dependency injection — pass `db` to override the default
 * Supabase client (production) with an in-memory store (tests).
 */

import { v4 as uuidv4 } from 'uuid';

// ─── Types ───────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'cancelled' | 'refunded';
export type PaymentMethod =
  | 'cash'
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'check'
  | 'room_charge'
  | 'gift_card'
  | 'other';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // percentage 0-100
  taxRate: number;  // percentage 0-100
  total: number;    // computed: (qty * unitPrice) * (1 - discount/100) * (1 + taxRate/100)
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  reservationId?: string;
  status: InvoiceStatus;
  lineItems: LineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
  dueDate?: string;
  paidDate?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  processedBy?: string;
  processedAt: string;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

// ─── Repository interface ─────────────────────────────────────────────────────

export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByNumber(invoiceNumber: string): Promise<Invoice | null>;
  findAll(): Promise<Invoice[]>;
  findByGuestId(guestId: string): Promise<Invoice[]>;
  findByStatus(status: InvoiceStatus): Promise<Invoice[]>;
  save(invoice: Invoice): Promise<Invoice>;
  delete(id: string): Promise<void>;
  savePayment(payment: InvoicePayment): Promise<InvoicePayment>;
  findPayments(invoiceId: string): Promise<InvoicePayment[]>;
}

// ─── Logger interface ─────────────────────────────────────────────────────────

export interface InvoiceLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

// ─── Container ───────────────────────────────────────────────────────────────

export interface InvoiceServiceContainer {
  invoiceRepository: InvoiceRepository;
  logger?: InvoiceLogger;
}

// ─── Service interface ────────────────────────────────────────────────────────

export interface InvoiceService {
  createInvoice(input: {
    guestId: string;
    guestName: string;
    guestEmail: string;
    reservationId?: string;
    dueDate?: string;
    notes?: string;
    currency?: string;
    createdBy?: string;
  }): Promise<Invoice>;

  getInvoice(id: string): Promise<Invoice | null>;
  getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null>;
  getInvoices(): Promise<Invoice[]>;
  getInvoicesByGuest(guestId: string): Promise<Invoice[]>;
  getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]>;

  updateInvoice(id: string, updates: {
    notes?: string;
    dueDate?: string;
  }): Promise<Invoice>;

  deleteInvoice(id: string): Promise<void>;

  addLineItem(invoiceId: string, item: {
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate?: number;
  }): Promise<Invoice>;

  removeLineItem(invoiceId: string, lineItemId: string): Promise<Invoice>;

  updateLineItem(invoiceId: string, lineItemId: string, updates: {
    description?: string;
    quantity?: number;
    unitPrice?: number;
    discount?: number;
    taxRate?: number;
  }): Promise<Invoice>;

  sendInvoice(id: string): Promise<Invoice>;
  markAsPaid(id: string): Promise<Invoice>;
  cancelInvoice(id: string): Promise<Invoice>;
  refundInvoice(id: string): Promise<Invoice>;

  recordPayment(input: {
    invoiceId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    processedBy?: string;
  }): Promise<Invoice>;

  getPayments(invoiceId: string): Promise<InvoicePayment[]>;
  getTotalPaid(invoiceId: string): Promise<number>;
  getUnpaidTotal(guestId: string): Promise<number>;

  // Utility
  generateInvoiceNumber(): string;
  calculateTotals(lineItems: LineItem[]): InvoiceTotals;
  isOverdue(invoice: Invoice): boolean;
  canEdit(invoice: Invoice): boolean;
  canCancel(invoice: Invoice): boolean;
  canRefund(invoice: Invoice): boolean;
  formatCurrency(amount: number, currency: string): string;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createInvoiceService(container: InvoiceServiceContainer): InvoiceService {
  const { invoiceRepository: repo, logger } = container;
  const noop = { info: () => {}, warn: () => {}, error: () => {} };
  const log = logger ?? noop;

  // ── Helpers ──

  function computeLineTotal(item: Omit<LineItem, 'id' | 'total'>): number {
    const base = item.quantity * item.unitPrice;
    const afterDiscount = base * (1 - (item.discount ?? 0) / 100);
    const withTax = afterDiscount * (1 + (item.taxRate ?? 0) / 100);
    return Math.round(withTax * 100) / 100;
  }

  function recalc(invoice: Invoice): Invoice {
    const totals = calculateTotals(invoice.lineItems);
    const paidAmount = invoice.paidAmount ?? 0;
    return {
      ...invoice,
      ...totals,
      paidAmount,
      balanceDue: Math.max(0, Math.round((totals.totalAmount - paidAmount) * 100) / 100),
      updatedAt: new Date().toISOString(),
    };
  }

  async function getOrThrow(id: string): Promise<Invoice> {
    const inv = await repo.findById(id);
    if (!inv) throw new Error('Invoice not found');
    return inv;
  }

  // ── Public methods ──

  function generateInvoiceNumber(): string {
    const date = new Date();
    const yymmdd = String(date.getFullYear()).slice(-2) +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `INV-${yymmdd}-${rand}`;
  }

  function calculateTotals(lineItems: LineItem[]): InvoiceTotals {
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;

    for (const item of lineItems) {
      const base = item.quantity * item.unitPrice;
      const disc = base * ((item.discount ?? 0) / 100);
      const afterDisc = base - disc;
      const tax = afterDisc * ((item.taxRate ?? 0) / 100);

      subtotal += base;
      discountAmount += disc;
      taxAmount += tax;
    }

    subtotal = Math.round(subtotal * 100) / 100;
    discountAmount = Math.round(discountAmount * 100) / 100;
    taxAmount = Math.round(taxAmount * 100) / 100;
    const totalAmount = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100;

    return { subtotal, discountAmount, taxAmount, totalAmount };
  }

  function isOverdue(invoice: Invoice): boolean {
    if (!['sent', 'partial'].includes(invoice.status)) return false;
    if (!invoice.dueDate) return false;
    return new Date(invoice.dueDate) < new Date();
  }

  function canEdit(invoice: Invoice): boolean {
    return invoice.status === 'draft';
  }

  function canCancel(invoice: Invoice): boolean {
    return ['draft', 'sent', 'partial'].includes(invoice.status);
  }

  function canRefund(invoice: Invoice): boolean {
    return invoice.status === 'paid';
  }

  function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  return {
    generateInvoiceNumber,
    calculateTotals,
    isOverdue,
    canEdit,
    canCancel,
    canRefund,
    formatCurrency,

    async createInvoice(input) {
      const now = new Date().toISOString();
      const invoice: Invoice = {
        id: uuidv4(),
        invoiceNumber: generateInvoiceNumber(),
        guestId: input.guestId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        reservationId: input.reservationId,
        status: 'draft',
        lineItems: [],
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        paidAmount: 0,
        balanceDue: 0,
        currency: input.currency ?? 'USD',
        dueDate: input.dueDate,
        notes: input.notes,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      };
      const saved = await repo.save(invoice);
      log.info('Invoice created', { invoiceId: saved.id, invoiceNumber: saved.invoiceNumber });
      return saved;
    },

    async getInvoice(id) {
      return repo.findById(id);
    },

    async getInvoiceByNumber(invoiceNumber) {
      return repo.findByNumber(invoiceNumber);
    },

    async getInvoices() {
      return repo.findAll();
    },

    async getInvoicesByGuest(guestId) {
      return repo.findByGuestId(guestId);
    },

    async getInvoicesByStatus(status) {
      return repo.findByStatus(status);
    },

    async updateInvoice(id, updates) {
      const invoice = await getOrThrow(id);
      if (!canEdit(invoice)) throw new Error('Cannot edit invoice in current status');
      const updated = recalc({ ...invoice, ...updates, updatedAt: new Date().toISOString() });
      return repo.save(updated);
    },

    async deleteInvoice(id) {
      const invoice = await getOrThrow(id);
      if (invoice.status !== 'draft') throw new Error('Only draft invoices can be deleted');
      await repo.delete(id);
    },

    async addLineItem(invoiceId, item) {
      if (item.quantity <= 0) throw new Error('Quantity must be greater than 0');
      if (item.unitPrice < 0) throw new Error('Unit price cannot be negative');

      const invoice = await getOrThrow(invoiceId);
      const lineItem: LineItem = {
        id: uuidv4(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount ?? 0,
        taxRate: item.taxRate ?? 0,
        total: 0,
      };
      lineItem.total = computeLineTotal(lineItem);
      const updated = recalc({ ...invoice, lineItems: [...invoice.lineItems, lineItem] });
      return repo.save(updated);
    },

    async removeLineItem(invoiceId, lineItemId) {
      const invoice = await getOrThrow(invoiceId);
      const exists = invoice.lineItems.find((li) => li.id === lineItemId);
      if (!exists) throw new Error('Line item not found');
      const updated = recalc({ ...invoice, lineItems: invoice.lineItems.filter((li) => li.id !== lineItemId) });
      return repo.save(updated);
    },

    async updateLineItem(invoiceId, lineItemId, updates) {
      if (updates.quantity !== undefined && updates.quantity <= 0) throw new Error('Quantity must be greater than 0');

      const invoice = await getOrThrow(invoiceId);
      const idx = invoice.lineItems.findIndex((li) => li.id === lineItemId);
      if (idx === -1) throw new Error('Line item not found');

      const existing = invoice.lineItems[idx];
      const merged: LineItem = { ...existing, ...updates };
      merged.total = computeLineTotal(merged);

      const lineItems = [...invoice.lineItems];
      lineItems[idx] = merged;
      const updated = recalc({ ...invoice, lineItems });
      return repo.save(updated);
    },

    async sendInvoice(id) {
      const invoice = await getOrThrow(id);
      if (!['draft', 'pending'].includes(invoice.status)) throw new Error('Can only send draft or pending invoices');
      if (invoice.lineItems.length === 0) throw new Error('Cannot send invoice with no line items');
      return repo.save(recalc({ ...invoice, status: 'sent' }));
    },

    async markAsPaid(id) {
      const invoice = await getOrThrow(id);
      if (['cancelled', 'refunded'].includes(invoice.status)) throw new Error('Cannot mark cancelled or refunded invoice as paid');
      const now = new Date().toISOString();
      return repo.save(recalc({
        ...invoice,
        status: 'paid',
        paidAmount: invoice.totalAmount,
        balanceDue: 0,
        paidDate: now,
      }));
    },

    async cancelInvoice(id) {
      const invoice = await getOrThrow(id);
      if (!canCancel(invoice)) throw new Error('Cannot cancel invoice in current status');
      return repo.save(recalc({ ...invoice, status: 'cancelled' }));
    },

    async refundInvoice(id) {
      const invoice = await getOrThrow(id);
      if (invoice.status !== 'paid') throw new Error('Can only refund paid invoices');
      return repo.save(recalc({ ...invoice, status: 'refunded' }));
    },

    async recordPayment({ invoiceId, amount, paymentMethod, processedBy }) {
      if (amount <= 0) throw new Error('Payment amount must be greater than 0');

      const invoice = await getOrThrow(invoiceId);
      if (['cancelled', 'refunded'].includes(invoice.status)) {
        throw new Error('Cannot record payment on invoice in current status');
      }
      if (amount > invoice.balanceDue) throw new Error('Payment amount exceeds balance due');

      const payment: InvoicePayment = {
        id: uuidv4(),
        invoiceId,
        amount,
        paymentMethod,
        processedBy,
        processedAt: new Date().toISOString(),
      };
      await repo.savePayment(payment);

      const newPaid = Math.round((invoice.paidAmount + amount) * 100) / 100;
      const newBalance = Math.round((invoice.balanceDue - amount) * 100) / 100;
      const newStatus: InvoiceStatus = newBalance <= 0 ? 'paid' : 'partial';
      const paidDate = newStatus === 'paid' ? new Date().toISOString() : invoice.paidDate;

      return repo.save({
        ...invoice,
        paidAmount: newPaid,
        balanceDue: newBalance,
        status: newStatus,
        paidDate,
        updatedAt: new Date().toISOString(),
      });
    },

    async getPayments(invoiceId) {
      return repo.findPayments(invoiceId);
    },

    async getTotalPaid(invoiceId) {
      const payments = await repo.findPayments(invoiceId);
      return Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
    },

    async getUnpaidTotal(guestId) {
      const invoices = await repo.findByGuestId(guestId);
      const unpaid = invoices.filter((inv) => !['paid', 'cancelled', 'refunded'].includes(inv.status));
      return Math.round(unpaid.reduce((sum, inv) => sum + inv.balanceDue, 0) * 100) / 100;
    },
  };
}
