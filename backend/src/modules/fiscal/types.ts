/**
 * Fiscal engine — canonical domain types.
 *
 * DOMAIN.md G1/G2/G3:
 *   G1: documents are generated from the immutable transaction snapshot +
 *       payment facts + fiscal profile — never by re-pricing.
 *   G2: document numbers come from controlled, concurrency-safe series.
 *   G3: issuance is immutable; corrections are credit/debit notes.
 */

export type FiscalDocumentType =
  | 'invoice'
  | 'receipt'
  | 'credit_note'
  | 'debit_note'
  | 'adjustment';

export type FiscalDocumentStatus = 'issued' | 'cancelled' | 'voided';

export type FiscalSubmissionStatus =
  | 'created'
  | 'validated'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'retrying'
  | 'archived';

export interface NumberingPolicy {
  /** Enforce no gaps in issued numbers (strict jurisdictions). */
  gapless: boolean;
  /** Reset the series each calendar year. */
  perYear: boolean;
  prefix: string;
  suffix: string;
  padding: number;
}

export interface TaxIdentification {
  vatNumber?: string;
  registryNumber?: string;
  taxOffice?: string;
  [key: string]: unknown;
}

export interface FiscalProfile {
  id: string;
  tenantId: string;
  legalEntityId?: string | null;
  name: string;
  jurisdiction: string; // ISO country code
  taxRegime: 'standard' | 'simplified' | 'flat_rate' | 'zero_rated' | 'exempt';
  documentTypes: FiscalDocumentType[];
  numberingPolicy: NumberingPolicy;
  taxIdentification: TaxIdentification;
  requiredFields: Record<string, boolean>;
  eInvoicingProvider?: string | null;
  archivalDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalDocumentSeries {
  id: string;
  tenantId: string;
  propertyId?: string | null;
  fiscalProfileId: string;
  documentType: FiscalDocumentType;
  series: string;
  year: number;
  prefix: string;
  suffix: string;
  padding: number;
  nextNumber: number;
}

export interface FiscalTaxComponent {
  id: string;
  name: string;
  rate: number; // percent
  amount: number;
  type: string;
}

export interface FiscalDocumentLineItem {
  itemId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxCategory?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FiscalDocument {
  id: string;
  tenantId: string;
  propertyId: string;
  moduleId?: string | null;
  transactionId: string;
  paymentId?: string | null;
  fiscalProfileId: string;
  seriesId: string;
  documentType: FiscalDocumentType;
  documentNumber: string;
  status: FiscalDocumentStatus;
  issuedAt: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  deliveryFee: number;
  totalDiscount: number;
  totalAmount: number;
  taxBreakdown: FiscalTaxComponent[];
  lineItems: FiscalDocumentLineItem[];
  buyer: Record<string, unknown>;
  metadata: Record<string, unknown>;
  replacedByDocumentId?: string | null;
  replacesDocumentId?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface FiscalSubmission {
  id: string;
  tenantId: string;
  fiscalDocumentId: string;
  provider: string;
  status: FiscalSubmissionStatus;
  attempt: number;
  authorityResponse: Record<string, unknown>;
  errorMessage?: string | null;
  createdAt: string;
}

/**
 * Jurisdiction adapter contract (DOMAIN.md / plan Phase 45). Each supported
 * market declares its own fiscal rules; the commerce engine never hardcodes
 * a jurisdiction's rules. `getJurisdictionAdapter(jurisdiction)` must always
 * return an adapter (falling back to the generic one).
 */
export interface JurisdictionAdapter {
  code: string;                       // ISO country code, uppercase
  label: string;
  defaultCurrency: string;            // ISO 4217
  /** Which document types this jurisdiction recognizes. */
  documentTypes: FiscalDocumentType[];
  /** Whether numbering must be gapless (strict regimes). */
  requiresGaplessNumbering: boolean;
  /** Default retention period in days for fiscal records. */
  retentionDays: number;
  /** Whether e-invoicing submission is mandatory for B2B sales. */
  requiresEInvoicing: boolean;
  /** Whether a credit note must reference the original invoice number. */
  creditNoteReferencesOriginal: boolean;
  /** Correction semantics: 'credit_note' (normal) or 'void' (cancel in place). */
  correctionMode: 'credit_note' | 'void';
}
