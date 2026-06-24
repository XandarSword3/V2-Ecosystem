-- Add properties.public_slug — the customer-facing identifier used to resolve
-- a property from its subdomain, e.g. {public_slug}.{tenant_subdomain}.v2platform.com
--
-- This is DELIBERATELY a separate column from property_code:
--   - property_code is sent to external OTA systems (Booking.com, Expedia, Airbnb
--     hotel_id pairings) and is keyed in those external systems. It changes rarely
--     and is constrained by whatever format the channel manager / OTA expects.
--   - public_slug is purely internal routing identity for our own subdomains/URLs.
--     It changes whenever an operator rebrands a property's public name, and must
--     satisfy DNS label rules (lowercase, hyphens, max 63 chars), which property_code
--     was never designed around.
-- Coupling these two would mean a routine property rename breaks a live OTA sync.
-- See CONTEXT.md, session 7-9, "Public/Admin Property Context Contamination" for
-- the full investigation that led to this decision.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS public_slug VARCHAR(63);

-- DNS label constraint: lowercase alphanumeric + hyphens, no leading/trailing hyphen,
-- 1-63 chars. Enforced at the DB level so no code path can write an invalid slug.
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_public_slug_format;
ALTER TABLE properties
  ADD CONSTRAINT properties_public_slug_format
  CHECK (public_slug IS NULL OR public_slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$');

-- Unique per tenant — two different tenants' properties may share a slug since
-- the full subdomain also includes the tenant segment ({slug}.{tenant}.v2platform.com),
-- but two properties within the same tenant must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_tenant_public_slug
  ON properties (group_id, public_slug)
  WHERE public_slug IS NOT NULL;

-- Backfill existing properties with a slug derived from their name, so no
-- existing row is left without a usable public identifier. Collisions within
-- the same group get a short suffix.
DO $$
DECLARE
  prop RECORD;
  base_slug TEXT;
  candidate_slug TEXT;
  suffix INTEGER;
BEGIN
  FOR prop IN SELECT id, name, group_id FROM properties WHERE public_slug IS NULL LOOP
    base_slug := lower(regexp_replace(prop.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'property';
    END IF;
    base_slug := substring(base_slug FROM 1 FOR 50);

    candidate_slug := base_slug;
    suffix := 1;
    WHILE EXISTS (
      SELECT 1 FROM properties
      WHERE public_slug = candidate_slug
        AND (group_id = prop.group_id OR (group_id IS NULL AND prop.group_id IS NULL))
        AND id != prop.id
    ) LOOP
      suffix := suffix + 1;
      candidate_slug := base_slug || '-' || suffix;
    END LOOP;

    UPDATE properties SET public_slug = candidate_slug WHERE id = prop.id;
  END LOOP;
END $$;

COMMENT ON COLUMN properties.public_slug IS
  'Customer-facing routing identifier for subdomain resolution ({public_slug}.{tenant_subdomain}.v2platform.com). Distinct from property_code, which is reserved for external OTA channel mappings — do not conflate the two.';
