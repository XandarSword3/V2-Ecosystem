-- Change subscription_tier from enum to text to allow dynamic tiers from plans table
-- This removes the hardcoded enum constraint and allows any tier code from the plans table

-- Drop the view that depends on subscription_tier
DROP VIEW IF EXISTS v_tenant_overview;

-- Alter the column to be text instead of enum
ALTER TABLE tenants 
  ALTER COLUMN subscription_tier TYPE text USING subscription_tier::text;

-- Add a comment explaining the change
COMMENT ON COLUMN tenants.subscription_tier IS 'Tier code from plans table - no longer a hardcoded enum';

-- Recreate the view
CREATE OR REPLACE VIEW v_tenant_overview AS
SELECT
  t.id,
  t.subdomain,
  t.subscription_tier,
  t.billing_status,
  t.stripe_customer_id,
  t.stripe_subscription_id,
  t.trial_ends_at,
  t.created_at,
  pg.name AS group_name,
  COUNT(DISTINCT p.id) AS property_count
FROM tenants t
LEFT JOIN property_groups pg ON pg.id = t.property_group_id
LEFT JOIN properties p ON p.group_id = pg.id
GROUP BY t.id, pg.name;

COMMENT ON VIEW v_tenant_overview IS
  'Aggregated tenant view for the control plane dashboard. Service role only.';
