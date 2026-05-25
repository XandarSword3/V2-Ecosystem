/**
 * Invoice Service
 * 
 * Generates customer-facing invoices from transaction/ledger data.
 * Supports line items, partial payments, overdue tracking.
 */

import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { randomBytes } from 'crypto';

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type InvoicePaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'whish' | 'omt' | 'online';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  property_id?: string;
  guest_id?: string;
  guest_name: string;
  guest_email: string;
  transaction_id?: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: InvoiceStatus;
  currency: string;
  issue_date: string;
  due_date: string;
  paid_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceInput {
  propertyId?: string;
  guestId?: string;
  guestName: string;
  guestEmail: string;
  transactionId?: string;
  dueDate: string;
  currency?: string;
  notes?: string;
  createdBy?: string;
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
  processedBy?: string;
}

export class InvoiceServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'InvoiceServiceError';
  }
}

function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `INV-${year}${month}-${rand}`;
}

function calculateTotals(lineItems: InvoiceLineItem[]): {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;

  for (const item of lineItems) {
    const gross = item.quantity * item.unit_price;
    const disc = gross * (item.discount / 100);
    const afterDisc = gross - disc;
    const tax = afterDisc * (item.tax_rate / 100);
    subtotal += gross;
    discountAmount += disc;
    taxAmount += tax;
  }

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    totalAmount: Math.round((subtotal - discountAmount + taxAmount) * 100) / 100,
  };
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const supabase = getSupabase();
  const invoiceNumber = generateInvoiceNumber();

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      property_id: input.propertyId || null,
      guest_id: input.guestId || null,
      guest_name: input.guestName,
      guest_email: input.guestEmail.toLowerCase(),
      transaction_id: input.transactionId || null,
      line_items: [],
      subtotal: 0,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: 0,
      paid_amount: 0,
      balance_due: 0,
      status: 'draft',
      currency: input.currency || 'USD',
      issue_date: new Date().toISOString(),
      due_date: input.dueDate,
      notes: input.notes || null,
      created_by: input.createdBy || null,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create invoice', { error });
    throw new InvoiceServiceError('Failed to create invoice', 'CREATE_FAILED', 500);
  }

  logger.info('Invoice created', { invoiceId: data.id, invoiceNumber });
  return data as Invoice;
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new InvoiceServiceError('Failed to fetch invoice', 'FETCH_FAILED', 500);
  return data as Invoice | null;
}

export async function getInvoicesByGuest(guestId: string): Promise<Invoice[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('guest_id', guestId)
    .order('created_at', { ascending: false });

  if (error) throw new InvoiceServiceError('Failed to fetch invoices', 'FETCH_FAILED', 500);
  return (data || []) as Invoice[];
}

export async function getInvoicesByProperty(propertyId: string): Promise<Invoice[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });

  if (error) throw new InvoiceServiceError('Failed to fetch invoices', 'FETCH_FAILED', 500);
  return (data || []) as Invoice[];
}

export async function getInvoiceByTransaction(transactionId: string): Promise<Invoice | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (error) throw new InvoiceServiceError('Failed to fetch invoice', 'FETCH_FAILED', 500);
  return data as Invoice | null;
}

export async function addLineItem(invoiceId: string, item: AddLineItemInput): Promise<Invoice> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new InvoiceServiceError('Invoice not found', 'NOT_FOUND', 404);
  if (!['draft', 'sent'].includes(invoice.status)) {
    throw new InvoiceServiceError('Cannot edit invoice in current status', 'INVALID_STATUS');
  }
  if (item.quantity <= 0) throw new InvoiceServiceError('Quantity must be positive', 'INVALID_QUANTITY');
  if (item.unitPrice < 0) throw new InvoiceServiceError('Unit price cannot be negative', 'INVALID_PRICE');

  const lineItem: InvoiceLineItem = {
    id: randomBytes(4).toString('hex'),
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    discount: item.discount ?? 0,
    tax_rate: item.taxRate ?? 0,
    total: 0,
  };
  const gross = lineItem.quantity * lineItem.unit_price;
  const disc = gross * (lineItem.discount / 100);
  const afterDisc = gross - disc;
  lineItem.total = Math.round((afterDisc + afterDisc * (lineItem.tax_rate / 100)) * 100) / 100;

  const newItems = [...invoice.line_items, lineItem];
  const totals = calculateTotals(newItems);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .update({
      line_items: newItems,
      ...totals,
      balance_due: totals.totalAmount - invoice.paid_amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) throw new InvoiceServiceError('Failed to add line item', 'UPDATE_FAILED', 500);
  return data as Invoice;
}

export async function removeLineItem(invoiceId: string, lineItemId: string): Promise<Invoice> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new InvoiceServiceError('Invoice not found', 'NOT_FOUND', 404);
  if (!['draft', 'sent'].includes(invoice.status)) {
    throw new InvoiceServiceError('Cannot edit invoice in current status', 'INVALID_STATUS');
  }

  const newItems = invoice.line_items.filter(i => i.id !== lineItemId);
  if (newItems.length === invoice.line_items.length) {
    throw new InvoiceServiceError('Line item not found', 'NOT_FOUND', 404);
  }

  const totals = calculateTotals(newItems);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .update({
      line_items: newItems,
      ...totals,
      balance_due: totals.totalAmount - invoice.paid_amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) throw new InvoiceServiceError('Failed to remove line item', 'UPDATE_FAILED', 500);
  return data as Invoice;
}

export async function sendInvoice(id: string): Promise<Invoice> {
  const invoice = await getInvoiceById(id);
  if (!invoice) throw new InvoiceServiceError('Invoice not found', 'NOT_FOUND', 404);
  if (invoice.status !== 'draft') throw new InvoiceServiceError('Only draft invoices can be sent', 'INVALID_STATUS');
  if (invoice.line_items.length === 0) throw new InvoiceServiceError('Cannot send empty invoice', 'INVALID_STATE');

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'sent', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new InvoiceServiceError('Failed to send invoice', 'UPDATE_FAILED', 500);
  logger.info('Invoice sent', { invoiceId: id });
  return data as Invoice;
}

export async function recordPayment(input: RecordPaymentInput): Promise<Invoice> {
  const invoice = await getInvoiceById(input.invoiceId);
  if (!invoice) throw new InvoiceServiceError('Invoice not found', 'NOT_FOUND', 404);
  if (['cancelled', 'refunded', 'paid'].includes(invoice.status)) {
    throw new InvoiceServiceError('Cannot record payment on this invoice', 'INVALID_STATUS');
  }
  if (input.amount <= 0) throw new InvoiceServiceError('Amount must be positive', 'INVALID_AMOUNT');
  if (input.amount > invoice.balance_due) throw new InvoiceServiceError('Amount exceeds balance due', 'OVERPAYMENT');

  const newPaid = invoice.paid_amount + input.amount;
  const newBalance = invoice.total_amount - newPaid;
  const newStatus: InvoiceStatus = newBalance <= 0 ? 'paid' : 'partial';

  const supabase = getSupabase();

  // Record payment entry
  await supabase.from('invoice_payments').insert({
    invoice_id: input.invoiceId,
    amount: input.amount,
    payment_method: input.paymentMethod,
    reference: input.reference || null,
    processed_by: input.processedBy || null,
    paid_at: new Date().toISOString(),
  });

  const { data, error } = await supabase
    .from('invoices')
    .update({
      paid_amount: newPaid,
      balance_due: newBalance,
      status: newStatus,
      paid_date: newBalance <= 0 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.invoiceId)
    .select()
    .single();

  if (error) throw new InvoiceServiceError('Failed to record payment', 'UPDATE_FAILED', 500);
  logger.info('Payment recorded', { invoiceId: input.invoiceId, amount: input.amount, status: newStatus });
  return data as Invoice;
}

export async function cancelInvoice(id: string): Promise<Invoice> {
  const invoice = await getInvoiceById(id);
  if (!invoice) throw new InvoiceServiceError('Invoice not found', 'NOT_FOUND', 404);
  if (['paid', 'cancelled', 'refunded'].includes(invoice.status)) {
    throw new InvoiceServiceError('Cannot cancel this invoice', 'INVALID_STATUS');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new InvoiceServiceError('Failed to cancel invoice', 'UPDATE_FAILED', 500);
  return data as Invoice;
}

export async function getOverdueInvoices(propertyId?: string): Promise<Invoice[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('invoices')
    .select('*')
    .in('status', ['sent', 'partial'])
    .lt('due_date', new Date().toISOString())
    .gt('balance_due', 0);

  if (propertyId) query = query.eq('property_id', propertyId);

  const { data, error } = await query.order('due_date', { ascending: true });
  if (error) throw new InvoiceServiceError('Failed to fetch overdue invoices', 'FETCH_FAILED', 500);
  return (data || []) as Invoice[];
}

/**
 * Generate an invoice automatically from a transaction record.
 * Pulls pricing data from the transaction and creates a ready-to-send invoice.
 */
export async function generateFromTransaction(
  transactionId: string,
  guestName: string,
  guestEmail: string,
  options?: { dueDate?: string; notes?: string; createdBy?: string; propertyId?: string }
): Promise<Invoice> {
  const supabase = getSupabase();
  const { data: tx, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (error || !tx) throw new InvoiceServiceError('Transaction not found', 'NOT_FOUND', 404);

  const dueDate = options?.dueDate || new Date().toISOString();
  const invoice = await createInvoice({
    propertyId: options?.propertyId || tx.property_id,
    guestId: tx.customer_id,
    guestName,
    guestEmail,
    transactionId,
    dueDate,
    notes: options?.notes,
    createdBy: options?.createdBy,
  });

  // Add line item from transaction amount
  const description = tx.engine_type === 'time_exclusive_reservation'
    ? `Reservation — ${tx.booking_number || tx.id}`
    : tx.engine_type === 'instant_transaction'
    ? `Order — ${tx.order_number || tx.id}`
    : `Transaction — ${tx.id}`;

  await addLineItem(invoice.id, {
    description,
    quantity: 1,
    unitPrice: parseFloat(tx.amount || '0'),
    discount: tx.discount_amount ? (parseFloat(tx.discount_amount) / parseFloat(tx.amount)) * 100 : 0,
    taxRate: tx.tax_amount ? (parseFloat(tx.tax_amount) / parseFloat(tx.amount)) * 100 : 0,
  });

  return (await getInvoiceById(invoice.id))!;
}
