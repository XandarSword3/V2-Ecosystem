/**
 * Fiscal numbering service — wraps the atomic, concurrency-safe
 * `next_fiscal_document_number` RPC (DOMAIN.md G2). The RPC locks the series
 * row with FOR UPDATE and consumes the number transactionally, so two
 * concurrent issuances can never receive the same number.
 */
import { getSupabase } from '../../database/connection.js';

export interface AllocatedFiscalNumber {
  success: boolean;
  seriesId: string;
  documentNumber: string;
  errorMessage?: string;
}

export class FiscalNumberingError extends Error {
  public readonly code = 'FISCAL_NUMBERING_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'FiscalNumberingError';
  }
}

export async function allocateFiscalDocumentNumber(params: {
  tenantId: string;
  propertyId?: string | null;
  fiscalProfileId: string;
  documentType: string;
  series?: string;
  year?: number;
}): Promise<AllocatedFiscalNumber> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('next_fiscal_document_number', {
    p_tenant_id: params.tenantId,
    p_property_id: params.propertyId ?? null,
    p_fiscal_profile_id: params.fiscalProfileId,
    p_document_type: params.documentType,
    p_series: params.series ?? 'A',
    p_year: params.year ?? null,
  });

  if (error) {
    throw new FiscalNumberingError(`Fiscal number allocation failed: ${error.message}`);
  }

  const row = data?.[0] as
    | { success: boolean; series_id: string; document_number: string; error_message?: string }
    | undefined;

  if (!row || !row.success) {
    throw new FiscalNumberingError(row?.error_message ?? 'Fiscal number allocation failed');
  }

  return {
    success: true,
    seriesId: row.series_id,
    documentNumber: row.document_number,
  };
}
