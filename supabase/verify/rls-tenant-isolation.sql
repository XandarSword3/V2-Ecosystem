-- ============================================================================
-- RLS hardening verification (post-review, plan step 3)
--
-- Run these in the Supabase SQL editor (as postgres) or psql against the
-- migrated database. Do NOT accept "policy added" as done — prove it:
--
--   1. RLS is actually enabled on the five tables;
--   2. anon/authenticated have no SELECT on fulfillments / fulfillment_events;
--   3. the SECURITY DEFINER RPCs are service_role-only;
--   4. with SET ROLE authenticated, a cross-tenant read returns ZERO rows;
--   5. calling transition_fulfillment as authenticated fails with a
--      PERMISSION error, not a business-logic error.
-- ============================================================================

-- ── 1. RLS enabled on all five tables ───────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'fiscal_profiles', 'fiscal_documents', 'fiscal_submissions',
    'fulfillments', 'fulfillment_events'
  )
ORDER BY tablename;
-- EXPECTED: rowsecurity = true for all five rows. If any row is false, stop.

-- ── 2. No anon/authenticated SELECT on fulfillments (revoked for anon;       ──
--      authenticated reads are RLS-filtered, which the SET ROLE check proves) ──
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('fulfillments', 'fulfillment_events')
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, table_name;
-- EXPECTED: no anon rows at all; authenticated may hold SELECT (RLS filters it).

-- ── 3. SECURITY DEFINER RPCs are service_role-only ──────────────────────────
SELECT p.proname AS function,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') AS svc_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('transition_fulfillment', 'ensure_fulfillment', 'next_fiscal_document_number')
ORDER BY p.proname;
-- EXPECTED: anon_exec = false, auth_exec = false, svc_exec = true for all three.

-- ── 4. Cross-tenant read returns ZERO rows as authenticated ─────────────────
-- In the SQL editor, auth.uid() comes from the request JWT; a raw session has
-- none, so every policy denies — proving the tables are not world-readable.
-- To test a REAL user: SET LOCAL request.jwt.claims = '{"sub": "<user uuid>",
-- "role": "authenticated"}'; then rows from ANOTHER tenant must be absent and
-- rows from the user's own tenant must be present.
SET ROLE authenticated;
SELECT 'fiscal_documents' AS table_name, count(*)::int AS visible_rows FROM public.fiscal_documents
UNION ALL SELECT 'fulfillments', count(*)::int FROM public.fulfillments
UNION ALL SELECT 'fulfillment_events', count(*)::int FROM public.fulfillment_events;
RESET ROLE;
-- EXPECTED (raw session): visible_rows = 0 for every table.

-- ── 5. RPC as authenticated → PERMISSION error, not a business error ────────
-- Pass the FULL 7-arg signature so the function is FOUND and the
-- EXECUTE-permission check is what fires (a short arg list would fail
-- earlier with "function does not exist", masking the real test).
SET ROLE authenticated;
SELECT public.transition_fulfillment(
  '00000000-0000-0000-0000-000000000000', 'ready', 'mark_ready',
  'staff', NULL, NULL, NULL
);
-- EXPECTED: ERROR: permission denied for function transition_fulfillment
-- (SQLSTATE 42501). If you instead see the function run and return a
-- business-logic result, the REVOKE did not take effect — stop and fix.
RESET ROLE;
