/**
 * Jurisdiction adapter registry tests (plan Phase 45).
 * The commerce engine must never hardcode a jurisdiction's rules — it asks
 * the adapter, and unknown jurisdictions fall back to the generic adapter.
 */
import { describe, it, expect } from 'vitest';
import {
  getJurisdictionAdapter,
  listJurisdictionAdapters,
  GENERIC_JURISDICTION,
} from '../../../../src/modules/fiscal/jurisdictions.js';

describe('jurisdiction adapters', () => {
  it('returns a registered adapter for a known jurisdiction', () => {
    expect(getJurisdictionAdapter('DE').requiresGaplessNumbering).toBe(true);
    expect(getJurisdictionAdapter('LB').defaultCurrency).toBe('EUR');
    expect(getJurisdictionAdapter('ae').requiresEInvoicing).toBe(true); // case-insensitive
  });

  it('falls back to the generic adapter for unknown jurisdictions', () => {
    const adapter = getJurisdictionAdapter('XX');
    expect(adapter).toBe(GENERIC_JURISDICTION);
    expect(adapter.requiresGaplessNumbering).toBe(false);
    expect(adapter.creditNoteReferencesOriginal).toBe(true);
  });

  it('lists all adapters for onboarding configuration', () => {
    const adapters = listJurisdictionAdapters();
    expect(adapters.length).toBeGreaterThanOrEqual(3);
    const codes = adapters.map((a) => a.code);
    expect(codes).toContain('LB');
    expect(codes).toContain('DE');
    expect(codes).toContain('AE');
  });

  it('every adapter declares a correction mode and retention policy', () => {
    for (const adapter of listJurisdictionAdapters()) {
      expect(['credit_note', 'void']).toContain(adapter.correctionMode);
      expect(adapter.retentionDays).toBeGreaterThan(0);
      expect(adapter.defaultCurrency).toMatch(/^[A-Z]{3}$/);
    }
  });
});
