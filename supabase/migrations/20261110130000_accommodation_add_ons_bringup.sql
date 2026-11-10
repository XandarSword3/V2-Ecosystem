-- Migration: accommodation_add_ons bring-up (2026-11-10)
--
-- Purpose: committed code references this table but no repo migration
-- ever created it — it existed only on the hosted production project
-- (reverse of the usual drift: created there by runtime bootstrapping).
-- Live consumers at HEAD:
--   backend/src/routes/units.routes.ts        (GET /api/v1/units/add-ons)
--   backend/src/services/catalog-pricing.service.ts (pricing fallback)
--   backend/src/modules/admin/translations.controller.ts (editable tables)
-- Without this migration a fresh environment 500s on /units/add-ons.
--
-- Source of truth: live production DDL inspected 2026-11-10 (0 rows,
-- 2 indexes, 3 constraints as below). The create is guarded so applying
-- it on the hosted project (which already has the table) is a no-op and
-- never touches production data.
--
-- RLS: enabled deny-by-default, consistent with the hardened i18n and
-- menu-modifier tables — the backend's only access path is the
-- service-role client, which bypasses RLS. NOTE (flagged, not resolved):
-- the table has no tenant_id of its own (indirect scope via modules);
-- /units/add-ons filters is_active only — a cross-tenant-aware query
-- would need a join. Tracked in DATA_OWNERSHIP_CONTRACT's
-- indirectly-scoped section.

DO $$ BEGIN
  IF to_regclass('public.accommodation_add_ons') IS NULL THEN
    CREATE TABLE public.accommodation_add_ons (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      module_id uuid,
      name character varying(255) NOT NULL,
      name_ar character varying(255),
      name_fr character varying(255),
      description text,
      price numeric NOT NULL,
      price_type character varying(20) DEFAULT 'one_time'::character varying NOT NULL,
      is_active boolean DEFAULT true,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      CONSTRAINT accommodation_add_ons_pkey PRIMARY KEY (id),
      CONSTRAINT accommodation_add_ons_module_id_fkey
        FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE,
      CONSTRAINT accommodation_add_ons_price_type_check
        CHECK (((price_type)::text = ANY ((ARRAY['one_time'::character varying, 'per_night'::character varying])::text[])))
    );
    CREATE INDEX idx_accommodation_add_ons_module_id ON public.accommodation_add_ons USING btree (module_id);
  END IF;
END $$;

ALTER TABLE public.accommodation_add_ons ENABLE ROW LEVEL SECURITY;
