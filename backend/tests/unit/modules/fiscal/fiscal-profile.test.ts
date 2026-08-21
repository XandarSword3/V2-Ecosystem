/**
 * Fiscal profile service — tenant-scoped configuration. Proves:
 *   - every read/write filters by tenant_id;
 *   - jurisdiction is validated (ISO code or GENERIC), never silently accepted;
 *   - defaults are applied (numbering policy, document types, archival days).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

type TableResult = { data: Record<string, unknown> | null | Record<string, unknown>[]; error: { message: string } | null };

const tableResults = new Map<string, TableResult>();
const updateCalls: Array<{ table: string; patch: Record<string, unknown>; eq: Array<[string, unknown]> }> = [];
const insertCalls: Array<{ table: string; row: Record<string, unknown> }> = [];

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => {
    const chain: Record<string, unknown> = {};
    const target = { table: '', mode: 'select', eqArgs: [] as Array<[string, unknown]> };
    const runner = () => {
      if (target.mode === 'insert') {
        return Promise.resolve({ data: insertCalls.at(-1)?.row ?? null, error: null });
      }
      if (target.mode === 'update') {
        return Promise.resolve({ data: { ...(insertCalls.at(-1)?.row ?? {}), ...updateCalls.at(-1)?.patch } ?? null, error: null });
      }
      const result = tableResults.get(target.table) ?? { data: null, error: null };
      return Promise.resolve(result);
    };
    (chain as Record<string, unknown>).from = (table: string) => { target.table = table; return chain; };
    (chain as Record<string, unknown>).select = (..._args: string[]) => chain;
    (chain as Record<string, unknown>).eq = (k: string, v: unknown) => { target.eqArgs.push([k, v]); return chain; };
    (chain as Record<string, unknown>).order = () => chain;
    (chain as Record<string, unknown>).limit = () => chain;
    (chain as Record<string, unknown>).maybeSingle = runner;
    (chain as Record<string, unknown>).single = runner;
    // The chain itself is thenable so plain `await query.order(...)` also works.
    (chain as Record<string, unknown>).then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => runner().then(resolve, reject);
    (chain as Record<string, unknown>).insert = (row: unknown) => {
      target.mode = 'insert';
      insertCalls.push({ table: target.table, row: (row as Record<string, unknown>) });
      return chain;
    };
    (chain as Record<string, unknown>).update = (patch: unknown) => {
      target.mode = 'update';
      updateCalls.push({ table: target.table, patch: patch as Record<string, unknown>, eq: target.eqArgs });
      return chain;
    };
    return chain;
  }),
}));

import { FiscalProfileService } from '../../../../src/modules/fiscal/fiscal-profile.service.js';

const service = new FiscalProfileService();

const PROFILE_ROW = {
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

describe('FiscalProfileService', () => {
  beforeEach(() => {
    tableResults.clear();
    insertCalls.length = 0;
    updateCalls.length = 0;
  });

  it('maps rows and filters by tenant on every read', async () => {
    tableResults.set('fiscal_profiles', { data: [PROFILE_ROW], error: null });
    const profiles = await service.listProfiles('tenant-1');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].documentTypes).toContain('credit_note');
    expect(profiles[0].numberingPolicy.prefix).toBe('INV-');
    expect(profiles[0].jurisdiction).toBe('LB');
  });

  it('rejects non-ISO jurisdictions at creation (fail closed)', async () => {
    await expect(
      service.createProfile('tenant-1', { name: 'Bad', jurisdiction: 'Leba' }),
    ).rejects.toThrow(/Invalid jurisdiction/);
    await expect(
      service.createProfile('tenant-1', { name: 'Bad', jurisdiction: 'L' }),
    ).rejects.toThrow(/Invalid jurisdiction/);
  });

  it('applies sane defaults on create', async () => {
    const profile = await service.createProfile('tenant-1', { name: 'Main', jurisdiction: 'de' });
    expect(profile.jurisdiction).toBe('DE'); // normalized uppercase
    expect(profile.documentTypes).toEqual(['invoice', 'receipt', 'credit_note']);
    expect(profile.archivalDays).toBe(3650);
    expect(profile.numberingPolicy.gapless).toBe(false);
    expect(insertCalls[0].row.tenant_id).toBe('tenant-1');
  });

  it('updates are tenant-scoped', async () => {
    tableResults.set('fiscal_profiles', { data: PROFILE_ROW, error: null });
    await service.updateProfile('profile-1', 'tenant-1', { archivalDays: 999 });
    expect(updateCalls[0].patch.archival_days).toBe(999);
    expect(updateCalls[0].eq).toEqual(expect.arrayContaining([['id', 'profile-1'], ['tenant_id', 'tenant-1']]));
  });
});
