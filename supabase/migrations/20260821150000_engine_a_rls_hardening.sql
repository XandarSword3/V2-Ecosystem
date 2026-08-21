-- Engine A — RLS hardening (post-review fix).
--
-- Closes the tenant-isolation holes on the fiscal and fulfillment tables:
--
--   1. fiscal_profiles / fiscal_documents / fiscal_submissions carried
--      FOR SELECT USING (true) policies readable by ANY authenticated user,
--      with tenant scoping left entirely to the app layer. Replaced with
--      tenant/property-scoped policies using the schema's own
--      user_has_tenant_access() / user_has_property_access() helpers (the
--      same pattern cash_transactions and the other isolated tables use).
--
--   2. fulfillments / fulfillment_events had NO RLS at all — and the
--      baseline's ALTER DEFAULT PRIVILEGES grants SELECT on new tables to
--      anon/authenticated, so they were directly readable (for delivery
--      orders, destination_ref is the customer's address). RLS is now
--      enabled with tenant/property-scoped policies; anon is revoked.
--
--   3. The SECURITY DEFINER RPCs next_fiscal_document_number,
--      transition_fulfillment and ensure_fulfillment were executable by
--      PUBLIC (and the first by authenticated) — SECURITY DEFINER means they
--      run with full privileges, so any caller could mint invoice numbers or
--      transition any tenant's fulfillment. Revoked to service_role only;
--      the backend controller/service are the only callers (verified — no
--      frontend calls them).
--
--   4. Schema default flipped: from now on, a new table gets NO anon/
--      authenticated access by default. RLS enablement + explicit grants
--      become mandatory, so a forgotten RLS fails closed instead of open.
--
-- The app itself is unaffected: it talks through service_role, which bypasses
-- RLS. These policies close the direct-client (anon/authenticated key) door.

-- ============================================================
-- 1. Fiscal tables — replace USING (true) with scoped policies
-- ============================================================
DROP POLICY IF EXISTS "fiscal_profiles_read_authenticated" ON "public"."fiscal_profiles";
CREATE POLICY "fiscal_profiles_isolation" ON "public"."fiscal_profiles"
  FOR SELECT TO "authenticated"
  USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));

DROP POLICY IF EXISTS "fiscal_documents_read_authenticated" ON "public"."fiscal_documents";
CREATE POLICY "fiscal_documents_isolation" ON "public"."fiscal_documents"
  FOR SELECT TO "authenticated"
  USING (
    "public"."user_has_tenant_access"("auth"."uid"(), "tenant_id")
    AND "public"."user_has_property_access"("auth"."uid"(), "property_id")
  );

DROP POLICY IF EXISTS "fiscal_submissions_read_authenticated" ON "public"."fiscal_submissions";
CREATE POLICY "fiscal_submissions_isolation" ON "public"."fiscal_submissions"
  FOR SELECT TO "authenticated"
  USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));

-- ============================================================
-- 2. Fulfillments — enable RLS (was none) + scoped policies
-- ============================================================
ALTER TABLE "public"."fulfillments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."fulfillment_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fulfillments_isolation" ON "public"."fulfillments"
  FOR SELECT TO "authenticated"
  USING (
    "public"."user_has_tenant_access"("auth"."uid"(), "tenant_id")
    AND "public"."user_has_property_access"("auth"."uid"(), "property_id")
  );

CREATE POLICY "fulfillment_events_isolation" ON "public"."fulfillment_events"
  FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."fulfillments" f
      WHERE f.id = fulfillment_events.fulfillment_id
        AND "public"."user_has_tenant_access"("auth"."uid"(), f.tenant_id)
        AND "public"."user_has_property_access"("auth"."uid"(), f.property_id)
    )
  );

-- The baseline default privileges granted SELECT on these tables to anon at
-- creation time (they predate the default-privilege flip below). anon has no
-- legitimate read of fulfillment data — revoke explicitly.
REVOKE SELECT ON "public"."fulfillments" FROM "anon";
REVOKE SELECT ON "public"."fulfillment_events" FROM "anon";

-- ============================================================
-- 3. SECURITY DEFINER RPCs — service_role only
-- ============================================================
-- next_fiscal_document_number: authenticated had an explicit EXECUTE grant,
-- and PostgreSQL's DEFAULT grants EXECUTE on new functions to PUBLIC (which
-- includes anon). Nothing in the frontend calls it
-- (fiscal-numbering.service.ts is the only caller, over service_role). It is
-- SECURITY DEFINER and trusts p_tenant_id blindly — revoke BOTH grants.
REVOKE EXECUTE ON FUNCTION "public"."next_fiscal_document_number"("uuid", "uuid", "uuid", "text", "text", integer) FROM "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."next_fiscal_document_number"("uuid", "uuid", "uuid", "text", "text", integer) FROM PUBLIC;

-- transition_fulfillment / ensure_fulfillment: default PUBLIC execute on a
-- SECURITY DEFINER function would let any caller transition another tenant's
-- fulfillment. Revoke PUBLIC, grant service_role only.
REVOKE EXECUTE ON FUNCTION "public"."transition_fulfillment"("uuid", "text", "text", "text", "uuid", "text", "jsonb") FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."ensure_fulfillment"("uuid", "text", "uuid", "uuid", "uuid", "text", "text", "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."transition_fulfillment"("uuid", "text", "text", "text", "uuid", "text", "jsonb") TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."ensure_fulfillment"("uuid", "text", "uuid", "uuid", "uuid", "text", "text", "text") TO "service_role";

-- Trigger functions: they fire under the role performing the DML, so
-- service_role must be able to EXECUTE them (the app writes transactions and
-- fulfillment_events with the service-role key). PUBLIC is revoked — no other
-- role performs that DML.
REVOKE EXECUTE ON FUNCTION "public"."_ensure_fulfillment_on_confirm"() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."_fulfillment_events_immutability"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."_ensure_fulfillment_on_confirm"() TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."_fulfillment_events_immutability"() TO "service_role";

-- ============================================================
-- 4. Fail closed by default for future tables
-- ============================================================
-- The baseline granted SELECT on NEW tables to anon/authenticated by default
-- (ALTER DEFAULT PRIVILEGES ... GRANT SELECT ON TABLES). That is the root
-- enabler of every "forgot RLS" exposure: a new table starts world-readable.
-- Flip it: future tables get no client access unless a migration explicitly
-- enables RLS and grants. service_role keeps its ALL grant (the app key).
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE SELECT ON TABLES FROM "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE SELECT ON TABLES FROM "authenticated";
