/**
 * Fiscal profile service — per legal entity / jurisdiction fiscal
 * configuration. Profiles are tenant-scoped; every read/write is filtered by
 * tenant_id (defense-in-depth on top of RLS), matching the repo's
 * tenant-scoped-client pattern.
 */
import { getSupabase } from '../../database/connection.js';
import type { FiscalProfile, NumberingPolicy } from './types.js';

const DEFAULT_NUMBERING_POLICY: NumberingPolicy = {
  gapless: false,
  perYear: true,
  prefix: '',
  suffix: '',
  padding: 4,
};

export interface FiscalProfileInput {
  name: string;
  jurisdiction: string;
  legalEntityId?: string | null;
  taxRegime?: FiscalProfile['taxRegime'];
  documentTypes?: FiscalProfile['documentTypes'];
  numberingPolicy?: Partial<NumberingPolicy>;
  taxIdentification?: FiscalProfile['taxIdentification'];
  requiredFields?: Record<string, boolean>;
  eInvoicingProvider?: string | null;
  archivalDays?: number;
  isActive?: boolean;
}

function mapRow(row: Record<string, unknown>): FiscalProfile {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    legalEntityId: row.legal_entity_id ? String(row.legal_entity_id) : null,
    name: String(row.name),
    jurisdiction: String(row.jurisdiction).toUpperCase(),
    taxRegime: (row.tax_regime as FiscalProfile['taxRegime']) ?? 'standard',
    documentTypes: Array.isArray(row.document_types)
      ? (row.document_types as FiscalProfile['documentTypes'])
      : ['invoice', 'receipt', 'credit_note'],
    numberingPolicy: {
      ...DEFAULT_NUMBERING_POLICY,
      ...((row.numbering_policy as Partial<NumberingPolicy>) ?? {}),
    },
    taxIdentification: (row.tax_identification as Record<string, unknown>) ?? {},
    requiredFields: (row.required_fields as Record<string, boolean>) ?? {},
    eInvoicingProvider: row.e_invoicing_provider ? String(row.e_invoicing_provider) : null,
    archivalDays: Number(row.archival_days ?? 3650),
    isActive: row.is_active !== false,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class FiscalProfileService {
  async listProfiles(tenantId: string): Promise<FiscalProfile[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('fiscal_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapRow);
  }

  async getProfile(id: string, tenantId: string): Promise<FiscalProfile | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('fiscal_profiles')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  /** Active profile for a tenant (first match) — used at issuance time. */
  async getActiveProfileForTenant(tenantId: string): Promise<FiscalProfile | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('fiscal_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  async createProfile(tenantId: string, input: FiscalProfileInput): Promise<FiscalProfile> {
    const supabase = getSupabase();
    const jurisdiction = input.jurisdiction.toUpperCase();
    // ISO 3166-1 alpha-2 country code (e.g. LB, DE, AE) or the GENERIC adapter.
    if (!/^[A-Z]{2}$/.test(jurisdiction) && jurisdiction !== 'GENERIC') {
      throw new Error(`Invalid jurisdiction: '${input.jurisdiction}' (expected ISO 3166-1 alpha-2 country code or GENERIC)`);
    }
    const { data, error } = await supabase
      .from('fiscal_profiles')
      .insert({
        tenant_id: tenantId,
        legal_entity_id: input.legalEntityId ?? null,
        name: input.name,
        jurisdiction,
        tax_regime: input.taxRegime ?? 'standard',
        document_types: input.documentTypes ?? ['invoice', 'receipt', 'credit_note'],
        numbering_policy: { ...DEFAULT_NUMBERING_POLICY, ...(input.numberingPolicy ?? {}) },
        tax_identification: input.taxIdentification ?? {},
        required_fields: input.requiredFields ?? {},
        e_invoicing_provider: input.eInvoicingProvider ?? null,
        archival_days: input.archivalDays ?? 3650,
        is_active: input.isActive ?? true,
      })
      .select()
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  async updateProfile(
    id: string,
    tenantId: string,
    input: Partial<FiscalProfileInput>,
  ): Promise<FiscalProfile> {
    const supabase = getSupabase();
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.jurisdiction !== undefined) patch.jurisdiction = input.jurisdiction.toUpperCase();
    if (input.taxRegime !== undefined) patch.tax_regime = input.taxRegime;
    if (input.documentTypes !== undefined) patch.document_types = input.documentTypes;
    if (input.numberingPolicy !== undefined) patch.numbering_policy = input.numberingPolicy;
    if (input.taxIdentification !== undefined) patch.tax_identification = input.taxIdentification;
    if (input.requiredFields !== undefined) patch.required_fields = input.requiredFields;
    if (input.eInvoicingProvider !== undefined) patch.e_invoicing_provider = input.eInvoicingProvider;
    if (input.archivalDays !== undefined) patch.archival_days = input.archivalDays;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('fiscal_profiles')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Fiscal profile not found');
    return mapRow(data);
  }
}

export const fiscalProfileService = new FiscalProfileService();
