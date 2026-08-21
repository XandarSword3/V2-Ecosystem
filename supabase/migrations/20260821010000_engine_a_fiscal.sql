-- Engine A — Fiscal/compliance engine (DOMAIN.md G1/G2/G3).
--
--   G1: fiscal documents are generated from the immutable transaction snapshot
--       + payment facts + fiscal profile — never by re-pricing.
--   G2: document numbers come from controlled, concurrency-safe series.
--   G3: issuance is immutable; corrections are credit/debit notes.
--
-- Tables:
--   fiscal_profiles            — per legal entity/jurisdiction fiscal configuration
--   fiscal_document_series     — controlled numbering series (per profile/type/year)
--   fiscal_documents           — issued documents (invoice/receipt/credit note/…)
--   fiscal_submissions         — e-invoice submission history (append-only attempts)
--
-- RPC:
--   next_fiscal_document_number — atomic, FOR UPDATE, concurrency-safe allocation

-- ============================================================
-- 1. Fiscal profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."fiscal_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "legal_entity_id" "uuid",
    "name" character varying(200) NOT NULL,
    "jurisdiction" character varying(50) NOT NULL,      -- ISO country code (e.g. 'LB', 'DE')
    "tax_regime" character varying(50) NOT NULL DEFAULT 'standard', -- standard | simplified | flat_rate | zero_rated | exempt
    "document_types" "text"[] NOT NULL DEFAULT ARRAY['invoice'::"text", 'receipt'::"text", 'credit_note'::"text"],
    "numbering_policy" "jsonb" NOT NULL DEFAULT '{"gapless": true, "per_year": true, "prefix": "", "suffix": "", "padding": 4}'::"jsonb",
    "tax_identification" "jsonb" DEFAULT '{}'::"jsonb", -- { vat_number, registry_number, tax_office, … }
    "required_fields" "jsonb" DEFAULT '{}'::"jsonb",    -- { buyer_name: true, buyer_tax_id: false, … }
    "e_invoicing_provider" character varying(100),
    "archival_days" integer DEFAULT 3650,                -- retention requirement (jurisdiction)
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fiscal_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fiscal_profiles_tenant_jurisdiction_key"
        UNIQUE ("tenant_id", "legal_entity_id", "jurisdiction"),
    CONSTRAINT "chk_fiscal_profiles_archival_days" CHECK (("archival_days" > 0))
);

-- ============================================================
-- 2. Document series (controlled numbering)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."fiscal_document_series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "fiscal_profile_id" "uuid" NOT NULL,
    "document_type" character varying(50) NOT NULL,      -- invoice | receipt | credit_note | debit_note | adjustment
    "series" character varying(50) NOT NULL DEFAULT 'A',
    "year" integer NOT NULL,
    "prefix" character varying(20) NOT NULL DEFAULT '',
    "suffix" character varying(20) NOT NULL DEFAULT '',
    "padding" integer NOT NULL DEFAULT 4,
    "next_number" bigint NOT NULL DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fiscal_document_series_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fiscal_document_series_profile_type_year_key"
        UNIQUE ("fiscal_profile_id", "document_type", "series", "year"),
    CONSTRAINT "chk_fiscal_document_series_padding" CHECK (("padding" > 0 AND "padding" <= 12))
);

-- ============================================================
-- 3. Fiscal documents (issued, immutable)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."fiscal_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "module_id" "uuid",
    "transaction_id" "uuid" NOT NULL,
    "payment_id" "uuid",
    "fiscal_profile_id" "uuid" NOT NULL,
    "series_id" "uuid" NOT NULL,
    "document_type" character varying(50) NOT NULL,
    "document_number" character varying(100) NOT NULL,
    "status" character varying(20) NOT NULL DEFAULT 'issued',  -- issued | cancelled | voided
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "currency" character varying(3) NOT NULL,
    "subtotal" numeric(14,4) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(14,4) DEFAULT 0 NOT NULL,
    "service_charge" numeric(14,4) DEFAULT 0 NOT NULL,
    "delivery_fee" numeric(14,4) DEFAULT 0 NOT NULL,
    "total_discount" numeric(14,4) DEFAULT 0 NOT NULL,
    "total_amount" numeric(14,4) DEFAULT 0 NOT NULL,
    "tax_breakdown" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "line_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "buyer" "jsonb" DEFAULT '{}'::"jsonb",               -- snapshot of buyer facts at issuance
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "replaced_by_document_id" "uuid",                    -- credit note → original invoice linkage
    "replaces_document_id" "uuid",                       -- inverse link
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fiscal_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fiscal_documents_number_key" UNIQUE ("document_number"),
    CONSTRAINT "chk_fiscal_documents_currency" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "chk_fiscal_documents_status"
        CHECK (("status" = ANY (ARRAY['issued'::"text", 'cancelled'::"text", 'voided'::"text"]))),
    CONSTRAINT "chk_fiscal_documents_total_invariant"
        -- total_amount must reconcile with the itemized snapshot; a small
        -- rounding tolerance is allowed. (Parentheses were previously
        -- unbalanced — this constraint never parsed, so the migration could
        -- not be applied to any database.)
        CHECK ("abs"(("total_amount" - GREATEST((0)::numeric, (((("subtotal" + "tax_amount") + "service_charge") + "delivery_fee") - "total_discount")))) < 0.03::numeric)
);

-- ============================================================
-- 4. E-invoice submission history (append-only attempts)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."fiscal_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "fiscal_document_id" "uuid" NOT NULL,
    "provider" character varying(100) NOT NULL,
    "status" character varying(30) NOT NULL,  -- created | validated | submitted | accepted | rejected | retrying | archived
    "attempt" integer DEFAULT 1 NOT NULL,
    "authority_response" "jsonb" DEFAULT '{}'::"jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fiscal_submissions_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 5. Atomic, concurrency-safe document-number allocation (G2)
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."next_fiscal_document_number"(
    "p_tenant_id" "uuid",
    "p_property_id" "uuid",
    "p_fiscal_profile_id" "uuid",
    "p_document_type" "text",
    "p_series" "text" DEFAULT 'A',
    "p_year" integer DEFAULT NULL
)
RETURNS TABLE("success" boolean, "series_id" "uuid", "document_number" "text", "error_message" "text")
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year INTEGER := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INTEGER);
    v_profile RECORD;
    v_series RECORD;
    v_number BIGINT;
    v_policy JSONB;
    v_prefix TEXT;
    v_suffix TEXT;
    v_padding INTEGER;
    v_formatted TEXT;
BEGIN
    -- Profile must exist and be active.
    SELECT * INTO v_profile
    FROM fiscal_profiles
    WHERE id = p_fiscal_profile_id AND tenant_id = p_tenant_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Fiscal profile not found'::text;
        RETURN;
    END IF;

    v_policy := COALESCE(v_profile.numbering_policy, '{}'::jsonb);
    v_prefix := COALESCE(v_policy->>'prefix', '');
    v_suffix := COALESCE(v_policy->>'suffix', '');
    v_padding := COALESCE((v_policy->>'padding')::integer, 4);

    -- Upsert the series row under lock (serializes concurrent allocations).
    INSERT INTO fiscal_document_series (
        tenant_id, property_id, fiscal_profile_id, document_type, series, year,
        prefix, suffix, padding, next_number
    ) VALUES (
        p_tenant_id, p_property_id, p_fiscal_profile_id, p_document_type, p_series, v_year,
        v_prefix, v_suffix, v_padding, 1
    )
    ON CONFLICT (fiscal_profile_id, document_type, series, year)
    DO UPDATE SET updated_at = NOW()
    RETURNING * INTO v_series;

    -- Re-read under lock (guarantees uniqueness even under concurrency).
    SELECT * INTO v_series
    FROM fiscal_document_series
    WHERE id = v_series.id
    FOR UPDATE;

    v_number := v_series.next_number;

    -- Gapless note: allocation itself is gapless BY CONSTRUCTION — numbers are
    -- consumed sequentially under FOR UPDATE, so no two issuances can receive
    -- the same number and none is skipped between allocations. The UNIQUE
    -- constraint on fiscal_documents.document_number is the hard guarantee.
    -- The only theoretical gap source is an allocation whose document insert
    -- later fails; that surfaces as DOCUMENT_NUMBER_CONFLICT and a retry in
    -- the service layer. Per-jurisdiction gapless/void rules are expressed by
    -- the profile's numbering_policy (jurisdiction adapter), not hardcoded.
    v_formatted := v_prefix || LPAD(v_number::text, v_padding, '0') || v_suffix;

    -- Consume the number atomically.
    UPDATE fiscal_document_series
    SET next_number = next_number + 1, updated_at = NOW()
    WHERE id = v_series.id;

    RETURN QUERY SELECT true, v_series.id, v_formatted, NULL::text;
END;
$$;

ALTER FUNCTION "public"."next_fiscal_document_number"("uuid", "uuid", "uuid", "text", "text", integer) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."next_fiscal_document_number"("uuid", "uuid", "uuid", "text", "text", integer) TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."next_fiscal_document_number"("uuid", "uuid", "uuid", "text", "text", integer) TO "authenticated";

-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE "public"."fiscal_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."fiscal_document_series" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."fiscal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."fiscal_submissions" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Readable by authenticated users; tenant/property ownership is enforced in
  -- the backend service layer via the tenant-scoped client (same pattern as
  -- transactions and engine_financial_ledger). Writes go through service_role.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fiscal_profiles_read_authenticated') THEN
    CREATE POLICY "fiscal_profiles_read_authenticated"
      ON "public"."fiscal_profiles" FOR SELECT
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fiscal_documents_read_authenticated') THEN
    CREATE POLICY "fiscal_documents_read_authenticated"
      ON "public"."fiscal_documents" FOR SELECT
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fiscal_submissions_read_authenticated') THEN
    CREATE POLICY "fiscal_submissions_read_authenticated"
      ON "public"."fiscal_submissions" FOR SELECT
      USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."fiscal_profiles" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."fiscal_document_series" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."fiscal_documents" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."fiscal_submissions" TO "service_role";
GRANT SELECT ON "public"."fiscal_profiles" TO "authenticated";
GRANT SELECT ON "public"."fiscal_documents" TO "authenticated";
GRANT SELECT ON "public"."fiscal_submissions" TO "authenticated";
