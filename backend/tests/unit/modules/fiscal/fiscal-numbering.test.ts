/**
 * Fiscal numbering (G2) — allocation must come from the atomic,
 * concurrency-safe `next_fiscal_document_number` RPC. The service never
 * formats or invents a number itself; it only relays the RPC's result.
 * The RPC's FOR UPDATE locking + UNIQUE(document_number) is the hard
 * guarantee (covered by the migration); here we prove the service contract.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpcMock = vi.fn();

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => ({ rpc: rpcMock }),
}));

import { allocateFiscalDocumentNumber, FiscalNumberingError } from '../../../../src/modules/fiscal/fiscal-numbering.service.js';

describe('FiscalNumberingService', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('returns the number allocated by the atomic RPC', async () => {
    rpcMock.mockResolvedValue({
      data: [{ success: true, series_id: 'series-1', document_number: 'INV-0001' }],
      error: null,
    });
    const allocated = await allocateFiscalDocumentNumber({
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      fiscalProfileId: 'profile-1',
      documentType: 'invoice',
      year: 2026,
    });
    expect(allocated.documentNumber).toBe('INV-0001');
    expect(allocated.seriesId).toBe('series-1');
    expect(rpcMock).toHaveBeenCalledWith('next_fiscal_document_number', expect.any(Object));
    const params = rpcMock.mock.calls[0][1] as Record<string, unknown>;
    expect(params.p_tenant_id).toBe('tenant-1');
    expect(params.p_property_id).toBe('prop-1');
    expect(params.p_fiscal_profile_id).toBe('profile-1');
    expect(params.p_document_type).toBe('invoice');
    expect(params.p_series).toBe('A');
    expect(params.p_year).toBe(2026);
  });

  it('throws when the RPC reports failure (e.g. no active profile)', async () => {
    rpcMock.mockResolvedValue({
      data: [{ success: false, series_id: null, document_number: null, error_message: 'Fiscal profile not found' }],
      error: null,
    });
    await expect(
      allocateFiscalDocumentNumber({ tenantId: 't', fiscalProfileId: 'missing', documentType: 'invoice' }),
    ).rejects.toThrow(FiscalNumberingError);
  });

  it('throws on an RPC transport error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'connection lost' } });
    await expect(
      allocateFiscalDocumentNumber({ tenantId: 't', fiscalProfileId: 'p', documentType: 'invoice' }),
    ).rejects.toThrow(FiscalNumberingError);
  });
});
