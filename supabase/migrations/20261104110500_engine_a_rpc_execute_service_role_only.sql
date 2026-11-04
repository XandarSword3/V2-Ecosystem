-- ═══════════════════════════════════════════════════════════════════════════
-- Engine A — SECURITY DEFINER RPCs are service_role-only (explicit grants)
--
-- Second half of the reproducibility gap found by the isolated-stack audit:
-- 20260821150000 revoked EXECUTE from PUBLIC on these RPCs, but explicit
-- grants to anon/authenticated (present in the migration-built baseline via
-- Supabase's default function privileges) survive a PUBLIC-only revoke. The
-- hosted DB had them revoked manually, outside the migration chain.
--
-- This migration revokes the explicit grants so a fresh replay reproduces
-- the hosted posture: anon = no EXECUTE, authenticated = no EXECUTE,
-- service_role = EXECUTE.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION "public"."ensure_fulfillment"("uuid", "text", "uuid", "uuid", "uuid", "text", "text", "text") FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."ensure_fulfillment"("uuid", "text", "uuid", "uuid", "uuid", "text", "text", "text") FROM "authenticated";

REVOKE EXECUTE ON FUNCTION "public"."transition_fulfillment"("uuid", "text", "text", "text", "uuid", "text", "jsonb") FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."transition_fulfillment"("uuid", "text", "text", "text", "uuid", "text", "jsonb") FROM "authenticated";

REVOKE EXECUTE ON FUNCTION "public"."next_fiscal_document_number"("uuid", "uuid", "uuid", "text", "text", integer) FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."next_fiscal_document_number"("uuid", "uuid", "uuid", "text", "text", integer) FROM "authenticated";

-- Re-assert the intended grants (idempotent with 20260821150000).
GRANT EXECUTE ON FUNCTION "public"."ensure_fulfillment"("uuid", "text", "uuid", "uuid", "uuid", "text", "text", "text") TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."transition_fulfillment"("uuid", "text", "text", "text", "uuid", "text", "jsonb") TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."next_fiscal_document_number"("uuid", "uuid", "uuid", "text", "text", integer) TO "service_role";
