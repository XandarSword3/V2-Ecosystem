import { 
  Container, 
  Invoice, 
  InvoiceStatus,
  InvoiceLineItem,
  InvoicePayment,
  InvoicePaymentMethod
} from '../container/types';

export interface CreateInvoiceInput {
  guestId: string;
  guestName: string;
  guestEmail: string;
  reservationId?: string;
  dueDate: string;
  notes?: string;
  currency?: string;
  createdBy: string;
}

export interface AddLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: InvoicePaymentMethod;
  reference?: string;
  processedBy: string;
}

export interface InvoiceService {
  // CRUD Operations
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | null>;
  getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null>;
  getInvoices(): Promise<Invoice[]>;
  getInvoicesByGuest(guestId: string): Promise<Invoice[]>;
  getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]>;
  getInvoicesForDateRange(startDate: string, endDate: string): Promise<Invoice[]>;
  updateInvoice(id: string, updates: Partial<Pick<Invoice, 'notes' | 'dueDate'>>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;
  
  // Line Items
  addLineItem(invoiceId: string, item: AddLineItemInput): Promise<Invoice>;
  removeLineItem(invoiceId: string, lineItemId: string): Promise<Invoice>;
  updateLineItem(invoiceId: string, lineItemId: string, updates: Partial<AddLineItemInput>): Promise<Invoice>;
  
  // Status Operations
  sendInvoice(id: string): Promise<Invoice>;
  markAsPaid(id: string): Promise<Invoice>;
  cancelInvoice(id: string): Promise<Invoice>;
  refundInvoice(id: string): Promise<Invoice>;
  
  // Payment Operations
  recordPayment(input: RecordPaymentInput): Promise<Invoice>;
  getPayments(invoiceId: string): Promise<InvoicePayment[]>;
  getTotalPaid(invoiceId: string): Promise<number>;
  
  // Queries
  getOverdueInvoices(): Promise<Invoice[]>;
  getPendingInvoices(): Promise<Invoice[]>;
  getUnpaidTotal(guestId: string): Promise<number>;
  
  // Utilities
  generateInvoiceNumber(): string;
  calculateTotals(lineItems: InvoiceLineItem[]): { subtotal: number; taxAmount: number; discountAmount: number; totalAmount: number };
  isOverdue(invoice: Invoice): boolean;
  canEdit(invoice: Invoice): boolean;
  canCancel(invoice: Invoice): boolean;
  canRefund(invoice: Invoice): boolean;
  formatCurrency(amount: number, currency: string): string;
}

export function createInvoiceService(container: Container): InvoiceService {
  const { invoiceRepository, logger } = container;
  
  let invoiceCounter = 1000;
  
  function generateInvoiceNumber(): string {
    invoiceCounter++;
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `INV-${year}${month}-${String(invoiceCounter).padStart(5, '0')}`;
  }
  
  function calculateTotals(lineItems: InvoiceLineItem[]): { 
    subtotal: number; 
    taxAmount: number; 
    discountAmount: number; 
    totalAmount: number 
  } {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    
    for (const item of lineItems) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = itemSubtotal * (item.discount / 100);
      const itemAfterDiscount = itemSubtotal - itemDiscount;
      const itemTax = itemAfterDiscount * (item.taxRate / 100);
      
      subtotal += itemSubtotal;
      discountAmount += itemDiscount;
      taxAmount += itemTax;
    }
    
    const totalAmount = subtotal - discountAmount + taxAmount;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100
    };
  }
  
  function isOverdue(invoice: Invoice): boolean {
    if (['paid', 'cancelled', 'refunded'].includes(invoice.status)) {
      return false;
    }
    return new Date(invoice.dueDate) < new Date() && invoice.balanceDue > 0;
  }
  
  function canEdit(invoice: Invoice): boolean {
    return ['draft', 'pending'].includes(invoice.status);
  }
  
  function canCancel(invoice: Invoice): boolean {
    return ['draft', 'pending', 'sent', 'overdue'].includes(invoice.status);
  }
  
  function canRefund(invoice: Invoice): boolean {
    return invoice.status === 'paid' && invoice.paidAmount > 0;
  }
  
  function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }
  
  function updateInvoiceStatus(invoice: Invoice): InvoiceStatus {
    if (invoice.status === 'cancelled' || invoice.status === 'refunded') {
      return invoice.status;
    }
    
    if (invoice.balanceDue <= 0 && invoice.paidAmount >= invoice.totalAmount) {
      return 'paid';
    }
    
    if (invoice.paidAmount > 0 && invoice.balanceDue > 0) {
      return 'partial';
    }
    
    if (isOverdue(invoice)) {
      return 'overdue';
    }
    
    return invoice.status;
  }
  
  async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const invoiceNumber = generateInvoiceNumber();
    
    const invoice = await invoiceRepository.create({
      invoiceNumber,
      guestId: input.guestId,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      reservationId: input.reservationId,
      lineItems: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
      paidAmount: 0,
      balanceDue: 0,
      status: 'draft',
      dueDate: input.dueDate,
      issueDate: new Date().toISOString(),
      notes: input.notes,
      currency: input.currency || 'USD',
      createdBy: input.createdBy
    });
    
    logger.info('Invoice created', { 
      invoiceId: invoice.id, 
      invoiceNumber 
    });
    
    return invoice;
  }
  
  async function getInvoice(id: string): Promise<Invoice | null> {
    return invoiceRepository.getById(id);
  }
  
  async function getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    return invoiceRepository.getByInvoiceNumber(invoiceNumber);
  }
  
  async function getInvoices(): Promise<Invoice[]> {
    return invoiceRepository.getAll();
  }
  
  async function getInvoicesByGuest(guestId: string): Promise<Invoice[]> {
    return invoiceRepository.getByGuestId(guestId);
  }
  
  async function getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    return invoiceRepository.getByStatus(status);
  }
  
  async function getInvoicesForDateRange(startDate: string, endDate: string): Promise<Invoice[]> {
    return invoiceRepository.getByDateRange(startDate, endDate);
  }
  
  async function updateInvoice(
    id: string, 
    updates: Partial<Pick<Invoice, 'notes' | 'dueDate'>>
  ): Promise<Invoice> {
    const invoice = await invoiceRepository.getById(id);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (!canEdit(invoice)) {
      throw new Error('Cannot edit invoice in current status');
    }
    
    const updated = await invoiceRepository.update(id, updates);
    
    logger.info('Invoice updated', { invoiceId: id });
    
    return updated;
  }
  
  async function deleteInvoice(id: string): Promise<void> {
    const invoice = await invoiceRepository.getById(id);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (invoice.status !== 'draft') {
      throw new Error('Only draft invoices can be deleted');
    }
    
    await invoiceRepository.delete(id);
    
    logger.info('Invoice deleted', { invoiceId: id });
  }
  
  async function addLineItem(invoiceId: string, item: AddLineItemInput): Promise<Invoice> {
    const invoice = await invoiceRepository.getById(invoiceId);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (!canEdit(invoice)) {
      throw new Error('Cannot add items to invoice in current status');
    }
    
    if (item.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    
    if (item.unitPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }
    
    const discount = item.discount || 0;
    const taxRate = item.taxRate || 0;
    const itemSubtotal = item.quantity * item.unitPrice;
    const itemDiscount = itemSubtotal * (discount / 100);
    const itemAfterDiscount = itemSubtotal - itemDiscount;
    const itemTax = itemAfterDiscount * (taxRate / 100);
    const itemTotal = itemAfterDiscount + itemTax;
    
    const lineItem: InvoiceLineItem = {
      id: crypto.randomUUID(),
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount,
      taxRate,
      total: Math.round(itemTotal * 100) / 100
    };
    
    const newLineItems = [...invoice.lineItems, lineItem];
    const totals = calculateTotals(newLineItems);
    
    const updated = await invoiceRepository.update(invoiceId, {
      lineItems: newLineItems,
      ...totals,
      balanceDue: totals.totalAmount - invoice.paidAmount
    });
    
    logger.info('Line item added to invoice', { invoiceId, lineItemId: lineItem.id });
    
    return updated;
  }
  
  async function removeLineItem(invoiceId: string, lineItemId: string): Promise<Invoice> {
    const invoice = await invoiceRepository.getById(invoiceId);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (!canEdit(invoice)) {
      throw new Error('Cannot remove items from invoice in current status');
    }
    
    const newLineItems = invoice.lineItems.filter(item => item.id !== lineItemId);
    
    if (newLineItems.length === invoice.lineItems.length) {
      throw new Error('Line item not found');
    }
    
    const totals = calculateTotals(newLineItems);
    
    const updated = await invoiceRepository.update(invoiceId, {
      lineItems: newLineItems,
      ...totals,
      balanceDue: totals.totalAmount - invoice.paidAmount
    });
    
    logger.info('Line item removed from invoice', { invoiceId, lineItemId });
    
    return updated;
  }
  
  async function updateLineItem(
    invoiceId: string, 
    lineItemId: string, 
    updates: Partial<AddLineItemInput>
  ): Promise<Invoice> {
    const invoice = await invoiceRepository.getById(invoiceId);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (!canEdit(invoice)) {
      throw new Error('Cannot update items on invoice in current status');
    }
    
    const itemIndex = invoice.lineItems.findIndex(item => item.id === lineItemId);
    
    if (itemIndex === -1) {
      throw new Error('Line item not found');
    }
    
    const existingItem = invoice.lineItems[itemIndex];
    const quantity = updates.quantity ?? existingItem.quantity;
    const unitPrice = updates.unitPrice ?? existingItem.unitPrice;
    const discount = updates.discount ?? existingItem.discount;
    const taxRate = updates.taxRate ?? existingItem.taxRate;
    
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    
    const itemSubtotal = quantity * unitPrice;
    const itemDiscount = itemSubtotal * (discount / 100);
    const itemAfterDiscount = itemSubtotal - itemDiscount;
    const itemTax = itemAfterDiscount * (taxRate / 100);
    const itemTotal = itemAfterDiscount + itemTax;
    
    const updatedItem: InvoiceLineItem = {
      id: lineItemId,
      description: updates.description ?? existingItem.description,
      quantity,
      unitPrice,
      discount,
      taxRate,
      total: Math.round(itemTotal * 100) / 100
    };
    
    const newLineItems = [...invoice.lineItems];
    newLineItems[itemIndex] = updatedItem;
    
    const totals = calculateTotals(newLineItems);
    
    const updated = await invoiceRepository.update(invoiceId, {
      lineItems: newLineItems,
      ...totals,
      balanceDue: totals.totalAmount - invoice.paidAmount
    });
    
    logger.info('Line item updated on invoice', { invoiceId, lineItemId });
    
    return updated;
  }
  
  async function sendInvoice(id: string): Promise<Invoice> {
    const invoice = await invoiceRepository.getById(id);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (invoice.status !== 'draft' && invoice.status !== 'pending') {
      throw new Error('Can only send draft or pending invoices');
    }
    
    if (invoice.lineItems.length === 0) {
      throw new Error('Cannot send invoice with no line items');
    }
    
    const updated = await invoiceRepository.update(id, {
      status: 'sent'
    });
    
    logger.info('Invoice sent', { invoiceId: id });
    
    return updated;
  }
  
  async function markAsPaid(id: string): Promise<Invoice> {
    const invoice = await invoiceRepository.getById(id);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (invoice.status === 'cancelled' || invoice.status === 'refunded') {
      throw new Error('Cannot mark cancelled or refunded invoice as paid');
    }
    
    const updated = await invoiceRepository.update(id, {
      status: 'paid',
      paidAmount: invoice.totalAmount,
      balanceDue: 0,
      paidDate: new Date().toISOString()
    });
    
    logger.info('Invoice marked as paid', { invoiceId: id });
    
    return updated;
  }
  
  async function cancelInvoice(id: string): Promise<Invoice> {
    const invoice = await invoiceRepository.getById(id);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (!canCancel(invoice)) {
      throw new Error('Cannot cancel invoice in current status');
    }
    
    const updated = await invoiceRepository.update(id, {
      status: 'cancelled'
    });
    
    logger.info('Invoice cancelled', { invoiceId: id });
    
    return updated;
  }
  
  async function refundInvoice(id: string): Promise<Invoice> {
    const invoice = await invoiceRepository.getById(id);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (!canRefund(invoice)) {
      throw new Error('Can only refund paid invoices');
    }
    
    const updated = await invoiceRepository.update(id, {
      status: 'refunded'
    });
    
    logger.info('Invoice refunded', { invoiceId: id });
    
    return updated;
  }
  
  async function recordPayment(input: RecordPaymentInput): Promise<Invoice> {
    const invoice = await invoiceRepository.getById(input.invoiceId);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (['cancelled', 'refunded', 'paid'].includes(invoice.status)) {
      throw new Error('Cannot record payment on invoice in current status');
    }
    
    if (input.amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }
    
    if (input.amount > invoice.balanceDue) {
      throw new Error('Payment amount exceeds balance due');
    }
    
    await invoiceRepository.addPayment({
      invoiceId: input.invoiceId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      reference: input.reference,
      processedBy: input.processedBy
    });
    
    const newPaidAmount = invoice.paidAmount + input.amount;
    const newBalanceDue = invoice.totalAmount - newPaidAmount;
    const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial';
    
    const updated = await invoiceRepository.update(input.invoiceId, {
      paidAmount: newPaidAmount,
      balanceDue: newBalanceDue,
      status: newStatus,
      paidDate: newBalanceDue <= 0 ? new Date().toISOString() : undefined
    });
    
    logger.info('Payment recorded', { 
      invoiceId: input.invoiceId, 
      amount: input.amount,
      newStatus 
    });
    
    return updated;
  }
  
  async function getPayments(invoiceId: string): Promise<InvoicePayment[]> {
    return invoiceRepository.getPayments(invoiceId);
  }
  
  async function getTotalPaid(invoiceId: string): Promise<number> {
    const payments = await invoiceRepository.getPayments(invoiceId);
    return payments.reduce((total, payment) => total + payment.amount, 0);
  }
  
  async function getOverdueInvoices(): Promise<Invoice[]> {
    return invoiceRepository.getOverdue();
  }
  
  async function getPendingInvoices(): Promise<Invoice[]> {
    const pending = await invoiceRepository.getByStatus('pending');
    const sent = await invoiceRepository.getByStatus('sent');
    return [...pending, ...sent];
  }
  
  async function getUnpaidTotal(guestId: string): Promise<number> {
    const invoices = await invoiceRepository.getByGuestId(guestId);
    return invoices
      .filter(i => !['paid', 'cancelled', 'refunded'].includes(i.status))
      .reduce((total, invoice) => total + invoice.balanceDue, 0);
  }
  
  return {
    createInvoice,
    getInvoice,
    getInvoiceByNumber,
    getInvoices,
    getInvoicesByGuest,
    getInvoicesByStatus,
    getInvoicesForDateRange,
    updateInvoice,
    deleteInvoice,
    addLineItem,
    removeLineItem,
    updateLineItem,
    sendInvoice,
    markAsPaid,
    cancelInvoice,
    refundInvoice,
    recordPayment,
    getPayments,
    getTotalPaid,
    getOverdueInvoices,
    getPendingInvoices,
    getUnpaidTotal,
    generateInvoiceNumber,
    calculateTotals,
    isOverdue,
    canEdit,
    canCancel,
    canRefund,
    formatCurrency
  };
}
