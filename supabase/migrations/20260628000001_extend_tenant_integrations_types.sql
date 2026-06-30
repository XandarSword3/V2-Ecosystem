-- ============================================================
-- Migration: Extend tenant_integrations CHECK constraint
--
-- Adds twilio, salto, and openkey as valid integration_type values.
-- The original migration (20260628000000) only listed 6 types;
-- Twilio (per-tenant SMS numbers), Salto and OpenKey (door lock
-- providers) are all per-tenant credentials that belong in this
-- table alongside the original six.
--
-- ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT is the only
-- way to modify a CHECK constraint in PostgreSQL — no ALTER COLUMN.
-- ============================================================

ALTER TABLE tenant_integrations
  DROP CONSTRAINT IF EXISTS tenant_integrations_integration_type_check;

ALTER TABLE tenant_integrations
  ADD CONSTRAINT tenant_integrations_integration_type_check
  CHECK (integration_type IN (
    'stripe', 'smtp', 'sendgrid', 'siteminder',
    'door_lock', 'whatsapp', 'twilio', 'salto', 'openkey'
  ));

COMMENT ON COLUMN tenant_integrations.integration_type IS
  'Supported integration types: stripe, smtp, sendgrid, siteminder, '
  'door_lock, whatsapp, twilio, salto, openkey. '
  'Add new types here + extend the IntegrationType union in '
  'backend/src/modules/platform/tenant-integrations.service.ts.';
