/**
 * Fiscal document tests.
 *
 * G1 (no re-pricing): documents are built from the immutable transaction +
 * ledger + payment snapshots — totals are copied, never recomputed.
 * G2: numbers come from the atomic numbering RPC.
 * Idempotency: one invoice per transaction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildDocumentFromSnapshot,
  FiscalDocumentService,
  FiscalDocumentError,
} from '../../../../src/modules/fiscal/fiscal-document.service.js';
import type {
  TransactionSnapshot,
  LedgerChargeSnapshot,
  BuyerSnapshot,
} from '../../../../src/modules/fiscal/fiscal-document.service.js';
import type { FiscalProfile } from '../../../../src/modules/fiscal/types.js';

// ============================================================
// Shared fixtures
// ============================================================

const transaction: TransactionSnapshot = {
  id: 'tx-1',
  tenantId: 'tenant-1',
  propertyId: 'prop-1',
  moduleId: 'mod-1',
  status: 'confirmed',
  amount: 121,
  taxAmount: 11,
  serviceCharge: 10,
  discountAmount: 0,
  currency: 'EUR',
  customerId: 'cust-1',
  staffId: null,
  metadata: { order_number: 'ORD-ABC12' },
  createdAt: '2026-08-21T10:00:00Z',
  completedAt: null,
};

const ledger: LedgerChargeSnapshot = {
  subtotal: 100,
  taxAmount: 11,
  taxRate: 11,
  serviceCharge: 10,
  deliveryFee: 0,
  totalDiscount: 0,
  totalAmount: 121,
  currency: 'EUR',
  lineItems: [
    { itemId: 'item-1', name: 'Burger', quantity: 1, unitPrice: 100, lineTotal: 100, taxCategory: 'food_beverage' },
  ],
  taxBreakdown: [{ id: 'tax-1', name: 'VAT', rate: 11, amount: 11, type: 'vat' }],
  paymentMethod: 'cash',
  discountBreakdown: [],
};

const profile: FiscalProfile = {
  id: 'profile-1',
  tenantId: 'tenant-1',
  legalEntityId: null,
  name: 'Main',
  jurisdiction: 'LB',
  taxRegime: 'standard',
  documentTypes: ['invoice', 'receipt', 'credit_note', 'debit_note'],
  numberingPolicy: { gapless: false, perYear: true, prefix: 'INV-', suffix: '', padding: 4 },
  taxIdentification: { vatNumber: 'LB-123' },
  requiredFields: { buyerName: true },
  eInvoicingProvider: null,
  archivalDays: 3650,
  isActive: true,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

const buyer: BuyerSnapshot = { customerId: 'cust-1', name: 'Jane Doe', email: 'jane@example.com' };

// ============================================================
// Pure builder — G1 enforcement point
// ============================================================

describe('buildDocumentFromSnapshot (G1: no re-pricing)', () => {
  it('copies totals from the snapshots without recomputation', () => {
    const doc = buildDocumentFromSnapshot({
      transaction,
      ledger,
      payments: [],
      profile,
      buyer,
      documentType: 'invoice',
      documentNumber: 'INV-0001',
      seriesId: 'series-1',
    });

    expect(doc.subtotal).toBe(100);
    expect(doc.taxAmount).toBe(11);
    expect(doc.serviceCharge).toBe(10);
    expect(doc.totalAmount).toBe(121);
    expect(doc.currency).toBe('EUR');
    expect(doc.documentNumber).toBe('INV-0001');
    expect(doc.lineItems).toEqual(ledger.lineItems);
    expect(doc.taxBreakdown).toEqual(ledger.taxBreakdown);
    // The invariant holds without any calculation on our side.
    expect(doc.subtotal + doc.taxAmount + doc.serviceCharge + doc.deliveryFee - doc.totalDiscount).toBe(doc.totalAmount);
  });

  it('marks credit notes with negative totals', () => {
    const doc = buildDocumentFromSnapshot({
      transaction,
      ledger,
      payments: [],
      profile,
      buyer,
      documentType: 'credit_note',
      documentNumber: 'CN-0001',
      seriesId: 'series-1',
    });
    expect(doc.totalAmount).toBe(-121);
    expect(doc.taxAmount).toBe(-11);
  });

  it('embeds payment facts and jurisdiction metadata (reproducible audit trail)', () => {
    const doc = buildDocumentFromSnapshot({
      transaction,
      ledger,
      payments: [
        { id: 'pay-1', amount: 121, currency: 'EUR', status: 'completed', paymentMethod: 'cash', paidAt: '2026-08-21T10:05:00Z' },
      ],
      profile,
      buyer,
      documentType: 'invoice',
      documentNumber: 'INV-0002',
      seriesId: 'series-1',
    });
    expect(doc.paymentId).toBe('pay-1');
    expect(doc.metadata.paymentFacts).toHaveLength(1);
    expect(doc.metadata.jurisdictionAdapter).toBe('LB');
    expect(doc.metadata.orderNumber).toBe('ORD-ABC12');
    expect(doc.buyer).toEqual(buyer);
  });

  it('never mutates the source snapshots', () => {
    const ledgerCopy = structuredClone(ledger);
    buildDocumentFromSnapshot({
      transaction,
      ledger,
      payments: [],
      profile,
      buyer,
      documentType: 'invoice',
      documentNumber: 'INV-0003',
      seriesId: 'series-1',
    });
    expect(ledger).toEqual(ledgerCopy);
  });
});

// ============================================================
// Orchestration — issueForTransaction
// ============================================================

function buildQuery(result: unknown, insertResult?: unknown) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  q.select = vi.fn(() => q);
  q.eq = vi.fn(() => q);
  q.order = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  q.maybeSingle = vi.fn().mockResolvedValue(
    Array.isArray(result) ? { data: result[0] ?? null, error: null } : { data: result ?? null, error: null },
  );
  q.single = vi.fn().mockResolvedValue({ data: result, error: null });
  q.insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: insertResult ?? result, error: null }),
    })),
  }));
  return q;
}

function makeSupabaseMock(config: Record<string, { result?: unknown; insertResult?: unknown }>) {
  const fromMock = vi.fn((table: string) => {
    const c = config[table] ?? {};
    return buildQuery(c.result, c.insertResult);
  });
  const rpcMock = vi.fn();
  return { from: fromMock, rpc: rpcMock };
}

const txRow = {
  id: 'tx-1',
  tenant_id: 'tenant-1',
  property_id: 'prop-1',
  module_id: 'mod-1',
  status: 'confirmed',
  amount: 121,
  tax_amount: 11,
  service_charge: 10,
  discount_amount: 0,
  currency: 'EUR',
  customer_id: null,
  staff_id: null,
  metadata: { order_number: 'ORD-ABC12' },
  created_at: '2026-08-21T10:00:00Z',
  completed_at: null,
};

const profileRow = {
  id: 'profile-1',
  tenant_id: 'tenant-1',
  legal_entity_id: null,
  name: 'Main',
  jurisdiction: 'LB',
  tax_regime: 'standard',
  document_types: ['invoice', 'receipt', 'credit_note', 'debit_note'],
  numbering_policy: { gapless: false, perYear: true, prefix: 'INV-', suffix: '', padding: 4 },
  tax_identification: { vatNumber: 'LB-123' },
  required_fields: { buyerName: true },
  e_invoicing_provider: null,
  archival_days: 3650,
  is_active: true,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

const ledgerRow = {
  id: 'ledger-1',
  tenant_id: 'tenant-1',
  entity_id: 'tx-1',
  transaction_type: 'charge',
  subtotal: 100,
  tax_amount: 11,
  tax_rate: 11,
  service_charge: 10,
  delivery_fee: 0,
  total_discount: 0,
  total_amount: 121,
  currency: 'EUR',
  payment_method: 'cash',
  payment_reference: null,
  discount_breakdown: [],
  metadata: {
    lineItems: [{ itemId: 'item-1', name: 'Burger', quantity: 1, unitPrice: 100, lineTotal: 100 }],
    taxBreakdown: [{ id: 'tax-1', name: 'VAT', rate: 11, amount: 11, type: 'vat' }],
  },
  created_at: '2026-08-21T10:01:00Z',
};

const insertedDoc = {
  id: 'doc-1',
  tenant_id: 'tenant-1',
  property_id: 'prop-1',
  module_id: 'mod-1',
  transaction_id: 'tx-1',
  payment_id: null,
  fiscal_profile_id: 'profile-1',
  series_id: 'series-1',
  document_type: 'invoice',
  document_number: 'INV-0001',
  status: 'issued',
  issued_at: '2026-08-21T10:06:00Z',
  currency: 'EUR',
  subtotal: 100,
  tax_amount: 11,
  service_charge: 10,
  delivery_fee: 0,
  total_discount: 0,
  total_amount: 121,
  tax_breakdown: [],
  line_items: [],
  buyer: {},
  metadata: {},
  replaced_by_document_id: null,
  replaces_document_id: null,
  created_by: null,
  created_at: '2026-08-21T10:06:00Z',
};

let mockSupabase: ReturnType<typeof makeSupabaseMock>;

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabase,
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('FiscalDocumentService.issueForTransaction', () => {
  let service: FiscalDocumentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FiscalDocumentService();
  });

  it('issues an invoice from the transaction snapshot', async () => {
    mockSupabase = makeSupabaseMock({
      transactions: { result: txRow },
      fiscal_documents: { result: null, insertResult: insertedDoc },
      fiscal_profiles: { result: profileRow },
      engine_financial_ledger: { result: [ledgerRow] },
      payments: { result: [] },
      users: { result: null },
    });
    mockSupabase.rpc.mockResolvedValue({
      data: [{ success: true, series_id: 'series-1', document_number: 'INV-0001' }],
      error: null,
    });

    const doc = await service.issueForTransaction('tx-1', {
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
    });

    expect(doc.documentNumber).toBe('INV-0001');
    expect(doc.totalAmount).toBe(121);
    // Numbering came from the atomic RPC — G2.
    expect(mockSupabase.rpc).toHaveBeenCalledWith('next_fiscal_document_number', expect.objectContaining({
      p_tenant_id: 'tenant-1',
      p_fiscal_profile_id: 'profile-1',
      p_document_type: 'invoice',
    }));
  });

  it('is idempotent — returns the existing invoice instead of duplicating', async () => {
    mockSupabase = makeSupabaseMock({
      transactions: { result: txRow },
      fiscal_documents: { result: insertedDoc },
    });

    const doc = await service.issueForTransaction('tx-1', { tenantId: 'tenant-1', propertyId: 'prop-1' });

    expect(doc.id).toBe('doc-1');
    // No numbering RPC — the existing document wins.
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects issuance for economically uncommitted transactions', async () => {
    mockSupabase = makeSupabaseMock({
      transactions: { result: { ...txRow, status: 'pending' } },
    });

    await expect(
      service.issueForTransaction('tx-1', { tenantId: 'tenant-1', propertyId: 'prop-1' }),
    ).rejects.toThrow(FiscalDocumentError);
  });

  it('requires a configured fiscal profile (never a silent default)', async () => {
    mockSupabase = makeSupabaseMock({
      transactions: { result: txRow },
      fiscal_documents: { result: null },
      fiscal_profiles: { result: null },
    });

    await expect(
      service.issueForTransaction('tx-1', { tenantId: 'tenant-1', propertyId: 'prop-1' }),
    ).rejects.toThrow(/fiscal profile/i);
  });

  it('scopes the transaction fetch to the caller tenant', async () => {
    mockSupabase = makeSupabaseMock({
      transactions: { result: null },
    });

    await expect(
      service.issueForTransaction('tx-1', { tenantId: 'other-tenant', propertyId: 'prop-1' }),
    ).rejects.toMatchObject({ code: 'TRANSACTION_NOT_FOUND' });
  });
});
