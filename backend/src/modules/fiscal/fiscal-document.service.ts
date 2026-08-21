/**
 * Fiscal document service — the canonical fiscal authority (DOMAIN.md G1/G3).
 *
 * G1: a fiscal document is built ONLY from the immutable transaction snapshot
 *     (transactions row + the authoritative engine_financial_ledger charge
 *     entry + payment facts + fiscal profile). It NEVER re-prices, re-taxes,
 *     or recomputes totals — a parallel calculation would violate the
 *     "no parallel calculation engines" rule.
 * G3: issuance is immutable; corrections are credit notes that reference the
 *     original document.
 */
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { allocateFiscalDocumentNumber } from './fiscal-numbering.service.js';
import { getJurisdictionAdapter } from './jurisdictions.js';
import type {
  FiscalDocument,
  FiscalDocumentLineItem,
  FiscalDocumentType,
  FiscalProfile,
  FiscalTaxComponent,
} from './types.js';

// ============================================================
// Errors
// ============================================================

export class FiscalDocumentError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FiscalDocumentError';
    this.code = code;
  }
}

// ============================================================
// Types
// ============================================================

export interface TransactionSnapshot {
  id: string;
  tenantId: string;
  propertyId: string;
  moduleId?: string | null;
  status: string;
  amount: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  currency: string;
  customerId?: string | null;
  staffId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt?: string | null;
}

export interface LedgerChargeSnapshot {
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  serviceCharge: number;
  deliveryFee: number;
  totalDiscount: number;
  totalAmount: number;
  currency: string;
  lineItems?: FiscalDocumentLineItem[];
  taxBreakdown?: FiscalTaxComponent[];
  feeBreakdown?: Array<{ type: string; name: string; amount: number; rate?: number }>;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  discountBreakdown?: Array<{ type: string; label: string; amount: number }>;
}

export interface PaymentFact {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string | null;
  paidAt?: string | null;
}

export interface BuyerSnapshot {
  customerId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  [key: string]: unknown;
}

export interface IssueDocumentOptions {
  tenantId: string;
  propertyId: string;
  actorId?: string | null;
  documentType?: FiscalDocumentType;
}

// ============================================================
// Pure snapshot → document builder (no DB, no re-pricing)
// ============================================================

/**
 * Build a fiscal document payload from authoritative snapshots. All monetary
 * values are copied from the snapshots — nothing is recalculated here.
 * This is the enforcement point of G1 and is unit-tested directly.
 */
export function buildDocumentFromSnapshot(params: {
  transaction: TransactionSnapshot;
  ledger: LedgerChargeSnapshot;
  payments: PaymentFact[];
  profile: FiscalProfile;
  buyer: BuyerSnapshot;
  documentType: FiscalDocumentType;
  documentNumber: string;
  seriesId: string;
  issuedAt?: string;
}): Omit<FiscalDocument, 'id' | 'status' | 'createdAt'> & { status: 'issued' } {
  const { transaction, ledger, payments, profile, buyer, documentType, documentNumber, seriesId } = params;
  const adapter = getJurisdictionAdapter(profile.jurisdiction);

  const isCredit = documentType === 'credit_note' || documentType === 'debit_note';
  const sign = isCredit ? -1 : 1;

  // Line items are copied from the snapshot as-is — no field is invented
  // (metadata is preserved only when the snapshot actually carries it).
  const lineItems = (ledger.lineItems ?? []).map((li) => ({
    itemId: li.itemId ?? null,
    name: li.name,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    lineTotal: li.lineTotal,
    taxCategory: li.taxCategory ?? null,
    ...(li.metadata !== undefined ? { metadata: li.metadata } : {}),
  }));

  const taxBreakdown = (ledger.taxBreakdown ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    rate: t.rate,
    amount: t.amount,
    type: t.type,
  }));

  const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    tenantId: transaction.tenantId,
    propertyId: transaction.propertyId,
    moduleId: transaction.moduleId ?? null,
    transactionId: transaction.id,
    paymentId: payments[0]?.id ?? null,
    fiscalProfileId: profile.id,
    seriesId,
    documentType,
    documentNumber,
    issuedAt: params.issuedAt ?? new Date().toISOString(),
    currency: transaction.currency,
    subtotal: sign * ledger.subtotal,
    taxAmount: sign * ledger.taxAmount,
    serviceCharge: sign * ledger.serviceCharge,
    deliveryFee: sign * ledger.deliveryFee,
    totalDiscount: sign * ledger.totalDiscount,
    totalAmount: sign * ledger.totalAmount,
    taxBreakdown,
    lineItems,
    buyer,
    metadata: {
      source: 'transaction_snapshot',
      transactionStatus: transaction.status,
      transactionCreatedAt: transaction.createdAt,
      transactionCompletedAt: transaction.completedAt ?? null,
      paymentFacts: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        method: p.paymentMethod ?? null,
        paidAt: p.paidAt ?? null,
      })),
      paymentMethod: ledger.paymentMethod ?? payments[0]?.paymentMethod ?? null,
      paymentReference: ledger.paymentReference ?? null,
      discountBreakdown: ledger.discountBreakdown ?? [],
      feeBreakdown: ledger.feeBreakdown ?? [],
      orderNumber: transaction.metadata.order_number ?? null,
      jurisdictionAdapter: adapter.code,
      correctionMode: adapter.correctionMode,
      profileName: profile.name,
    },
    replacedByDocumentId: null,
    replacesDocumentId: null,
    createdBy: undefined,
    status: 'issued' as const,
  };
}

// ============================================================
// Service
// ============================================================

/**
 * Transaction-layer statuses that are economically committed. Fulfillment
 * meaning no longer lives on transactions.status (Stage 6) — the in-progress
 * fulfillment states come from the fulfillments table (see
 * issueForTransaction's fulfillment lookup below).
 */
const ISSUABLE_TRANSACTION_STATUSES = new Set([
  'confirmed',
  'completed',
]);

/** Canonical fulfillment states that also make a transaction economically committed. */
const ISSUABLE_FULFILLMENT_STATUSES = new Set([
  'in_progress',
  'ready',
  'handed_off',
  'completed',
]);

/**
 * Map a fiscal_profiles row (snake_case) to the camelCase FiscalProfile shape.
 */
function mapProfileRow(row: Record<string, unknown>): FiscalProfile {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    legalEntityId: row.legal_entity_id ? String(row.legal_entity_id) : null,
    name: String(row.name),
    jurisdiction: String(row.jurisdiction),
    taxRegime: (String(row.tax_regime ?? 'standard')) as FiscalProfile['taxRegime'],
    documentTypes: Array.isArray(row.document_types) ? (row.document_types as FiscalDocumentType[]) : [],
    numberingPolicy: (row.numbering_policy as FiscalProfile['numberingPolicy']) ?? { gapless: false, perYear: true, prefix: '', suffix: '', padding: 4 },
    taxIdentification: (row.tax_identification as FiscalProfile['taxIdentification']) ?? {},
    requiredFields: (row.required_fields as FiscalProfile['requiredFields']) ?? {},
    eInvoicingProvider: row.e_invoicing_provider ? String(row.e_invoicing_provider) : null,
    archivalDays: Number(row.archival_days ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : String(row.created_at),
  };
}

function mapDocumentRow(row: Record<string, unknown>): FiscalDocument {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    propertyId: String(row.property_id),
    moduleId: row.module_id ? String(row.module_id) : null,
    transactionId: String(row.transaction_id),
    paymentId: row.payment_id ? String(row.payment_id) : null,
    fiscalProfileId: String(row.fiscal_profile_id),
    seriesId: String(row.series_id),
    documentType: row.document_type as FiscalDocumentType,
    documentNumber: String(row.document_number),
    status: row.status as FiscalDocument['status'],
    issuedAt: String(row.issued_at),
    currency: String(row.currency),
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount),
    serviceCharge: Number(row.service_charge),
    deliveryFee: Number(row.delivery_fee),
    totalDiscount: Number(row.total_discount),
    totalAmount: Number(row.total_amount),
    taxBreakdown: Array.isArray(row.tax_breakdown) ? row.tax_breakdown as FiscalTaxComponent[] : [],
    lineItems: Array.isArray(row.line_items) ? row.line_items as FiscalDocumentLineItem[] : [],
    buyer: (row.buyer as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    replacedByDocumentId: row.replaced_by_document_id ? String(row.replaced_by_document_id) : null,
    replacesDocumentId: row.replaces_document_id ? String(row.replaces_document_id) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
  };
}

export class FiscalDocumentService {
  /**
   * Issue a fiscal document for a transaction. Idempotent: issuing twice for
   * the same transaction returns the existing document instead of a duplicate.
   */
  async issueForTransaction(
    transactionId: string,
    opts: IssueDocumentOptions,
  ): Promise<FiscalDocument> {
    const supabase = getSupabase();

    // 1. Load + scope the transaction.
    const { data: txRow, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('tenant_id', opts.tenantId)
      .maybeSingle();
    if (txError) throw txError;
    if (!txRow) throw new FiscalDocumentError('TRANSACTION_NOT_FOUND', 'Transaction not found for this tenant');

    const transaction: TransactionSnapshot = {
      id: String(txRow.id),
      tenantId: String(txRow.tenant_id),
      propertyId: String(txRow.property_id),
      moduleId: txRow.module_id ? String(txRow.module_id) : null,
      status: String(txRow.status),
      amount: Number(txRow.amount),
      taxAmount: Number(txRow.tax_amount),
      serviceCharge: Number(txRow.service_charge),
      discountAmount: Number(txRow.discount_amount),
      currency: String(txRow.currency),
      customerId: txRow.customer_id ? String(txRow.customer_id) : null,
      staffId: txRow.staff_id ? String(txRow.staff_id) : null,
      metadata: (txRow.metadata as Record<string, unknown>) ?? {},
      createdAt: String(txRow.created_at),
      completedAt: txRow.completed_at ? String(txRow.completed_at) : null,
    };

    // 2. Only economically committed transactions get documents. The
    // transaction layer (confirmed/completed) is issuable directly; the
    // fulfillment layer (in_progress/ready/handed_off) is issuable via the
    // canonical fulfillment row — never from transactions.status (Stage 6).
    // FAIL-CLOSED (Stage 6 fix): an error reading the canonical fulfillment
    // row aborts issuance — it is never treated as "no fulfillment", which
    // would silently fall back to transactions.status. An economically
    // committed transaction with an unreadable fulfillment state must not
    // produce a document from an assumption.
    const { data: fulfillmentRow, error: fulfillmentReadError } = await supabase
      .from('fulfillments')
      .select('status')
      .eq('transaction_id', transactionId)
      .maybeSingle();
    if (fulfillmentReadError) {
      throw new FiscalDocumentError(
        'FULFILLMENT_STATE_READ_FAILED',
        `Cannot determine fulfillment state for transaction ${transactionId}: ${fulfillmentReadError.message}`,
      );
    }
    const fulfillmentStatus = fulfillmentRow?.status ? String(fulfillmentRow.status) : null;
    const committed =
      ISSUABLE_TRANSACTION_STATUSES.has(transaction.status) ||
      (fulfillmentStatus !== null && ISSUABLE_FULFILLMENT_STATUSES.has(fulfillmentStatus));
    if (!committed) {
      throw new FiscalDocumentError(
        'TRANSACTION_NOT_ISSUABLE',
        `Transaction is not economically committed (transaction status '${transaction.status}', fulfillment '${fulfillmentStatus ?? 'none'}') — expected confirmed/completed or fulfillment in progress`,
      );
    }

    const documentType = opts.documentType ?? 'invoice';

    // 3. Idempotency — one invoice per transaction.
    if (documentType === 'invoice') {
      const { data: existing } = await supabase
        .from('fiscal_documents')
        .select('*')
        .eq('transaction_id', transactionId)
        .eq('tenant_id', opts.tenantId)
        .eq('document_type', 'invoice')
        .maybeSingle();
      if (existing) return mapDocumentRow(existing);
    }

    // 4. Fiscal profile (business must configure one — never a silent default).
    const { data: profileRow } = await supabase
      .from('fiscal_profiles')
      .select('*')
      .eq('tenant_id', opts.tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!profileRow) {
      throw new FiscalDocumentError(
        'FISCAL_PROFILE_REQUIRED',
        'No active fiscal profile configured for this tenant — configure one before issuing documents',
      );
    }
    const profile = mapProfileRow(profileRow as Record<string, unknown>);
    if (!profile.documentTypes.includes(documentType)) {
      throw new FiscalDocumentError(
        'DOCUMENT_TYPE_NOT_SUPPORTED',
        `Document type '${documentType}' is not enabled in the fiscal profile`,
      );
    }

    // 5. Authoritative ledger snapshot (the financial authority).
    const { data: ledgerRows } = await supabase
      .from('engine_financial_ledger')
      .select('*')
      .eq('entity_id', transactionId)
      .eq('tenant_id', opts.tenantId)
      .eq('transaction_type', 'charge')
      .order('created_at', { ascending: false })
      .limit(1);
    const ledgerRow = ledgerRows?.[0] as Record<string, unknown> | undefined;

    const ledgerMetadata = (ledgerRow?.metadata as Record<string, unknown>) ?? {};
    const ledger: LedgerChargeSnapshot = ledgerRow
      ? {
          subtotal: Number(ledgerRow.subtotal),
          taxAmount: Number(ledgerRow.tax_amount),
          taxRate: Number(ledgerRow.tax_rate),
          serviceCharge: Number(ledgerRow.service_charge),
          deliveryFee: Number(ledgerRow.delivery_fee),
          totalDiscount: Number(ledgerRow.total_discount),
          totalAmount: Number(ledgerRow.total_amount),
          currency: String(ledgerRow.currency),
          lineItems: ledgerMetadata.lineItems as FiscalDocumentLineItem[] | undefined,
          taxBreakdown: ledgerMetadata.taxBreakdown as FiscalTaxComponent[] | undefined,
          feeBreakdown: ledgerMetadata.feeBreakdown as LedgerChargeSnapshot['feeBreakdown'],
          paymentMethod: ledgerRow.payment_method ? String(ledgerRow.payment_method) : null,
          paymentReference: ledgerRow.payment_reference ? String(ledgerRow.payment_reference) : null,
          discountBreakdown: Array.isArray(ledgerRow.discount_breakdown)
            ? (ledgerRow.discount_breakdown as LedgerChargeSnapshot['discountBreakdown'])
            : undefined,
        }
      : {
          // No ledger row (legacy data): fall back to the transaction scalars —
          // still the snapshot, never a recomputation.
          subtotal: transaction.amount - transaction.taxAmount - transaction.serviceCharge + transaction.discountAmount,
          taxAmount: transaction.taxAmount,
          taxRate: 0,
          serviceCharge: transaction.serviceCharge,
          deliveryFee: 0,
          totalDiscount: transaction.discountAmount,
          totalAmount: transaction.amount,
          currency: transaction.currency,
          lineItems: undefined,
          taxBreakdown: undefined,
        };

    // 6. Payment facts.
    const { data: paymentRows } = await supabase
      .from('payments')
      .select('id, amount, currency, status, payment_method, paid_at, created_at')
      .eq('tenant_id', opts.tenantId)
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true });
    const payments: PaymentFact[] = (paymentRows ?? []).map((p) => ({
      id: String(p.id),
      amount: Number(p.amount),
      currency: String(p.currency),
      status: String(p.status),
      paymentMethod: p.payment_method ? String(p.payment_method) : null,
      paidAt: p.paid_at ? String(p.paid_at) : null,
    }));

    // 7. Buyer snapshot (never live profile data).
    const buyer: BuyerSnapshot = {
      customerId: transaction.customerId,
      name: typeof transaction.metadata.customer_name === 'string' ? transaction.metadata.customer_name : null,
      phone: typeof transaction.metadata.customer_phone === 'string' ? transaction.metadata.customer_phone : null,
    };
    if (transaction.customerId) {
      const { data: userRow } = await supabase
        .from('users')
        .select('id, email, full_name, phone, first_name, last_name')
        .eq('id', transaction.customerId)
        .maybeSingle();
      if (userRow) {
        buyer.email = userRow.email ?? null;
        const fullName = (userRow.first_name && userRow.last_name)
          ? `${userRow.first_name} ${userRow.last_name}`
          : null;
        buyer.name = buyer.name ?? userRow.full_name ?? fullName;
      }
    }

    // 8. Allocate the number (atomic RPC) then insert.
    const allocated = await allocateFiscalDocumentNumber({
      tenantId: opts.tenantId,
      propertyId: opts.propertyId,
      fiscalProfileId: profile.id,
      documentType,
      year: new Date().getFullYear(),
    });

    const payload = buildDocumentFromSnapshot({
      transaction,
      ledger,
      payments,
      profile,
      buyer,
      documentType,
      documentNumber: allocated.documentNumber,
      seriesId: allocated.seriesId,
    });

    const { data: inserted, error: insertError } = await supabase
      .from('fiscal_documents')
      .insert({
        tenant_id: payload.tenantId,
        property_id: payload.propertyId,
        module_id: payload.moduleId,
        transaction_id: payload.transactionId,
        payment_id: payload.paymentId,
        fiscal_profile_id: payload.fiscalProfileId,
        series_id: payload.seriesId,
        document_type: payload.documentType,
        document_number: payload.documentNumber,
        status: payload.status,
        issued_at: payload.issuedAt,
        currency: payload.currency,
        subtotal: payload.subtotal,
        tax_amount: payload.taxAmount,
        service_charge: payload.serviceCharge,
        delivery_fee: payload.deliveryFee,
        total_discount: payload.totalDiscount,
        total_amount: payload.totalAmount,
        tax_breakdown: payload.taxBreakdown,
        line_items: payload.lineItems,
        buyer: payload.buyer,
        metadata: payload.metadata,
        created_by: opts.actorId ?? null,
      })
      .select()
      .single();
    if (insertError) {
      // Unique violation on document_number → another issuer won the race.
      if (insertError.code === '23505') {
        throw new FiscalDocumentError(
          'DOCUMENT_NUMBER_CONFLICT',
          'Document number collision — retry the issuance',
        );
      }
      throw insertError;
    }

    logger.info('[Fiscal] Document issued', {
      documentId: inserted.id,
      documentNumber: inserted.document_number,
      transactionId,
      documentType,
    });

    return mapDocumentRow(inserted);
  }

  async getDocument(id: string, tenantId: string): Promise<FiscalDocument | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('fiscal_documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapDocumentRow(data) : null;
  }

  async listDocuments(
    tenantId: string,
    filters: { propertyId?: string; transactionId?: string; documentType?: string } = {},
  ): Promise<FiscalDocument[]> {
    const supabase = getSupabase();
    let query = supabase
      .from('fiscal_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('issued_at', { ascending: false });
    if (filters.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters.transactionId) query = query.eq('transaction_id', filters.transactionId);
    if (filters.documentType) query = query.eq('document_type', filters.documentType);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapDocumentRow);
  }

  /**
   * Cancel a document by issuing a credit note (or voiding in place, per the
   * jurisdiction adapter's correction mode). The original document is never
   * mutated — G3.
   */
  async cancelDocument(
    id: string,
    opts: { tenantId: string; propertyId: string; actorId?: string | null; reason?: string },
  ): Promise<FiscalDocument> {
    const supabase = getSupabase();
    const original = await this.getDocument(id, opts.tenantId);
    if (!original) throw new FiscalDocumentError('DOCUMENT_NOT_FOUND', 'Document not found');
    if (original.status !== 'issued') {
      throw new FiscalDocumentError('DOCUMENT_NOT_ISSUED', 'Only issued documents can be cancelled');
    }
    if (original.documentType === 'credit_note' || original.documentType === 'debit_note') {
      throw new FiscalDocumentError('ALREADY_CORRECTION', 'Correction documents cannot be cancelled');
    }

    const { data: profileRow } = await supabase
      .from('fiscal_profiles')
      .select('*')
      .eq('id', original.fiscalProfileId)
      .eq('tenant_id', opts.tenantId)
      .maybeSingle();
    const profile = profileRow ? mapProfileRow(profileRow as Record<string, unknown>) : null;
    const adapter = getJurisdictionAdapter(profile?.jurisdiction ?? 'GENERIC');

    if (adapter.correctionMode === 'void') {
      // Void in place (strict regimes allow cancelling before acceptance).
      const { data, error } = await supabase
        .from('fiscal_documents')
        .update({ status: 'voided', metadata: { ...original.metadata, voidReason: opts.reason ?? null } })
        .eq('id', id)
        .eq('tenant_id', opts.tenantId)
        .select()
        .single();
      if (error) throw error;
      return mapDocumentRow(data);
    }

    // Credit-note path: negative document linked to the original.
    const { data: txRow } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', original.transactionId)
      .eq('tenant_id', opts.tenantId)
      .maybeSingle();

    const creditNote = await this.issueForTransaction(original.transactionId, {
      tenantId: opts.tenantId,
      propertyId: original.propertyId,
      actorId: opts.actorId,
      documentType: 'credit_note',
    });

    // Link both directions.
    await supabase
      .from('fiscal_documents')
      .update({ replaces_document_id: original.id })
      .eq('id', creditNote.id)
      .eq('tenant_id', opts.tenantId);
    await supabase
      .from('fiscal_documents')
      .update({
        replaced_by_document_id: creditNote.id,
        metadata: {
          ...original.metadata,
          cancelledBy: creditNote.id,
          cancelReason: opts.reason ?? null,
        },
      })
      .eq('id', original.id)
      .eq('tenant_id', opts.tenantId);

    // Keep the original status 'issued' (immutable) — the credit note carries
    // the correction; the linkage makes the pair self-explanatory. (txRow kept
    // for future reconciliation use.)
    void txRow;

    return this.getDocument(creditNote.id, opts.tenantId) as Promise<FiscalDocument>;
  }

  /**
   * Append an e-invoice submission attempt (immutable history — each attempt
   * is a new row: create → validate → submit → accepted/rejected → retry).
   */
  async recordSubmission(params: {
    tenantId: string;
    fiscalDocumentId: string;
    provider: string;
    status: 'created' | 'validated' | 'submitted' | 'accepted' | 'rejected' | 'retrying' | 'archived';
    authorityResponse?: Record<string, unknown>;
    errorMessage?: string | null;
  }): Promise<string> {
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('fiscal_submissions')
      .select('attempt')
      .eq('fiscal_document_id', params.fiscalDocumentId)
      .eq('tenant_id', params.tenantId)
      .order('attempt', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('fiscal_submissions')
      .insert({
        tenant_id: params.tenantId,
        fiscal_document_id: params.fiscalDocumentId,
        provider: params.provider,
        status: params.status,
        attempt: (existing?.attempt as number | undefined ?? 0) + 1,
        authority_response: params.authorityResponse ?? {},
        error_message: params.errorMessage ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return String(data.id);
  }
}

export const fiscalDocumentService = new FiscalDocumentService();
