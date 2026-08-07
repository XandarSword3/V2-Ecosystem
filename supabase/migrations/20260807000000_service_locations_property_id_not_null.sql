-- Migration: service_locations.property_id was nullable with no legitimate
-- use case — every service_location belongs to a module (module_id NOT NULL),
-- and every module belongs to exactly one property (modules.property_id
-- NOT NULL). The nullable column let the RLS policy fall back to tenant-wide
-- access instead of property-scoped access, which is a real isolation gap
-- in a system where property is the hard boundary (never a subdomain).
-- Date: 2026-08-07

-- Defensive backfill: per the invariant above this should touch zero rows,
-- but repair anything already NULL from the module's own property_id before
-- the NOT NULL constraint lands, rather than assuming.
UPDATE public.service_locations sl
SET property_id = m.property_id
FROM public.modules m
WHERE sl.module_id = m.id
  AND sl.property_id IS NULL;

ALTER TABLE public.service_locations
  ALTER COLUMN property_id SET NOT NULL;

-- Replace the partial index (property_id IS NOT NULL) with a plain one —
-- the predicate is now always true.
DROP INDEX IF EXISTS idx_service_locations_property;
CREATE INDEX idx_service_locations_property
  ON public.service_locations USING btree (property_id);

-- Drop the now-dead "(property_id IS NULL) OR" fallback branch.
DROP POLICY IF EXISTS "service_locations_isolation" ON public.service_locations;
CREATE POLICY "service_locations_isolation" ON public.service_locations
  USING (
    public.user_has_tenant_access(auth.uid(), tenant_id)
    AND public.user_has_property_access(auth.uid(), property_id)
  )
  WITH CHECK (
    public.user_has_tenant_access(auth.uid(), tenant_id)
    AND public.user_has_property_access(auth.uid(), property_id)
  );
