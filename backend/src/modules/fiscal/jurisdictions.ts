/**
 * Jurisdiction adapters — the only place jurisdiction-specific fiscal rules
 * live. The commerce engine never hardcodes a tax authority's rules; it asks
 * the adapter. The generic adapter is the safe fallback for any jurisdiction
 * without a specific profile.
 */
import type { JurisdictionAdapter } from './types.js';

export const GENERIC_JURISDICTION: JurisdictionAdapter = {
  code: 'GENERIC',
  label: 'Generic (no specific jurisdiction profile)',
  defaultCurrency: 'EUR',
  documentTypes: ['invoice', 'receipt', 'credit_note', 'debit_note', 'adjustment'],
  requiresGaplessNumbering: false,
  retentionDays: 3650,
  requiresEInvoicing: false,
  creditNoteReferencesOriginal: true,
  correctionMode: 'credit_note',
};

/** Lebanon — VAT 11%, receipts for retail, gapless not mandated. */
export const LEBANON_JURISDICTION: JurisdictionAdapter = {
  code: 'LB',
  label: 'Lebanon',
  defaultCurrency: 'EUR',
  documentTypes: ['invoice', 'receipt', 'credit_note', 'debit_note'],
  requiresGaplessNumbering: false,
  retentionDays: 3650,
  requiresEInvoicing: false,
  creditNoteReferencesOriginal: true,
  correctionMode: 'credit_note',
};

/** Germany — EU VAT, gapless numbering for invoicing, e-invoicing rolling out. */
export const GERMANY_JURISDICTION: JurisdictionAdapter = {
  code: 'DE',
  label: 'Germany',
  defaultCurrency: 'EUR',
  documentTypes: ['invoice', 'receipt', 'credit_note', 'debit_note'],
  requiresGaplessNumbering: true,
  retentionDays: 3650, // 10 years (GoBD)
  requiresEInvoicing: true,
  creditNoteReferencesOriginal: true,
  correctionMode: 'credit_note',
};

/** United Arab Emirates — VAT 5%, mandatory e-invoicing (FTA). */
export const UAE_JURISDICTION: JurisdictionAdapter = {
  code: 'AE',
  label: 'United Arab Emirates',
  defaultCurrency: 'AED',
  documentTypes: ['invoice', 'receipt', 'credit_note', 'debit_note'],
  requiresGaplessNumbering: false,
  retentionDays: 1825, // 5 years
  requiresEInvoicing: true,
  creditNoteReferencesOriginal: true,
  correctionMode: 'credit_note',
};

const REGISTRY: Record<string, JurisdictionAdapter> = {
  LB: LEBANON_JURISDICTION,
  DE: GERMANY_JURISDICTION,
  AE: UAE_JURISDICTION,
};

/**
 * Resolve the adapter for a jurisdiction code. Always returns an adapter —
 * unknown jurisdictions fall back to the generic one so a new market can be
 * onboarded by adding a profile, never by editing the commerce engine.
 */
export function getJurisdictionAdapter(jurisdiction: string): JurisdictionAdapter {
  const code = jurisdiction.toUpperCase();
  return REGISTRY[code] ?? GENERIC_JURISDICTION;
}

/** List all registered jurisdiction adapters (for onboarding/configuration UI). */
export function listJurisdictionAdapters(): JurisdictionAdapter[] {
  return Object.values(REGISTRY);
}
