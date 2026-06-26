-- =============================================================
-- 2A: Complete i18n schema
-- Fixes /api/v1/i18n/keys 500 — ensures all tables the i18n
-- service touches actually exist with the right columns.
--
-- Root cause: 20260130172000_dynamic_translations.sql created
-- a partial translation_keys and an incompatible translations
-- table (flat translation_key+language columns instead of the
-- relational key_id+language_code+status schema the service
-- now uses). Five other required tables were never created.
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. translation_keys — add missing columns to the existing
--    partial table (migration 20260130172000 may have created
--    it with only id/key_path/context/default_value/is_active)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE translation_keys ADD COLUMN IF NOT EXISTS module      TEXT;
ALTER TABLE translation_keys ADD COLUMN IF NOT EXISTS component   TEXT;
ALTER TABLE translation_keys ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE translation_keys ADD COLUMN IF NOT EXISTS max_length  INTEGER;
ALTER TABLE translation_keys ADD COLUMN IF NOT EXISTS placeholders TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE translation_keys ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE translation_keys ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Re-ensure indexes (IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_translation_keys_key_path ON translation_keys(key_path);
CREATE INDEX IF NOT EXISTS idx_translation_keys_context  ON translation_keys(context);
CREATE INDEX IF NOT EXISTS idx_translation_keys_is_active ON translation_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_translation_keys_module   ON translation_keys(module) WHERE module IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. translations — drop the old incompatible table and
--    recreate with the relational schema the service expects.
--    (No live data — CONTEXT.md: "can be reset at any time")
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS translations CASCADE;

CREATE TABLE translations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id            UUID        NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
  property_id       UUID,                              -- NULL = global translation
  language_code     TEXT        NOT NULL,
  value             TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  is_custom         BOOLEAN     NOT NULL DEFAULT false,
  translated_by     UUID,
  machine_translated BOOLEAN    NOT NULL DEFAULT false,
  reviewed_by       UUID,
  reviewed_at       TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- NULLS NOT DISTINCT: two rows where property_id IS NULL
  -- count as conflicting, enabling upsert on global translations
  UNIQUE NULLS NOT DISTINCT (key_id, property_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_translations_key_id       ON translations(key_id);
CREATE INDEX IF NOT EXISTS idx_translations_language      ON translations(language_code);
CREATE INDEX IF NOT EXISTS idx_translations_status        ON translations(status);
CREATE INDEX IF NOT EXISTS idx_translations_property      ON translations(property_id) WHERE property_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. translation_bundles — cached compiled bundles per
--    language/context, optionally scoped to a property
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS translation_bundles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID,                               -- NULL = global bundle
  language_code TEXT        NOT NULL,
  context       TEXT        NOT NULL DEFAULT 'ui',
  bundle        JSONB       NOT NULL DEFAULT '{}',
  checksum      TEXT,
  key_count     INTEGER     DEFAULT 0,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE NULLS NOT DISTINCT (property_id, language_code, context)
);

CREATE INDEX IF NOT EXISTS idx_translation_bundles_lookup
  ON translation_bundles(language_code, context);

-- ─────────────────────────────────────────────────────────────
-- 4. translation_memory — TM for assisted translation
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS translation_memory (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_language  TEXT        NOT NULL,
  target_language  TEXT        NOT NULL,
  source_text      TEXT        NOT NULL,
  translated_text  TEXT        NOT NULL,
  context          TEXT,
  domain           TEXT        NOT NULL DEFAULT 'hospitality',
  quality_score    NUMERIC(3,2),
  usage_count      INTEGER     NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (source_language, target_language, source_text)
);

-- ─────────────────────────────────────────────────────────────
-- 5. property_languages — which languages each property has
--    enabled, plus their translation progress
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS property_languages (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          UUID        NOT NULL,
  language_code        TEXT        NOT NULL,
  language_name        TEXT        NOT NULL,
  native_name          TEXT,
  is_default           BOOLEAN     NOT NULL DEFAULT false,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  date_format          TEXT        NOT NULL DEFAULT 'MM/DD/YYYY',
  time_format          TEXT        NOT NULL DEFAULT '12h',
  currency_format      TEXT,
  number_format        TEXT,
  translation_progress INTEGER     NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (property_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_property_languages_property
  ON property_languages(property_id);

-- ─────────────────────────────────────────────────────────────
-- 6. guest_language_preferences — per-guest preferred locale
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_language_preferences (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id           UUID        NOT NULL UNIQUE,
  preferred_language TEXT        NOT NULL DEFAULT 'en',
  secondary_language TEXT,
  email_language     TEXT        NOT NULL DEFAULT 'en',
  sms_language       TEXT        NOT NULL DEFAULT 'en',
  detection_source   TEXT        NOT NULL DEFAULT 'explicit',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 7. content_translations — per-entity field translations
--    (e.g. a menu item's name/description in French)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_translations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT        NOT NULL,
  entity_id     UUID        NOT NULL,
  field_name    TEXT        NOT NULL,
  language_code TEXT        NOT NULL,
  value         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published')),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (entity_type, entity_id, field_name, language_code)
);

CREATE INDEX IF NOT EXISTS idx_content_translations_entity
  ON content_translations(entity_type, entity_id, language_code);

-- ─────────────────────────────────────────────────────────────
-- 8. Seed default English UI keys
--    These are the minimum set to make the storefront functional.
--    ON CONFLICT DO NOTHING — safe to re-run.
-- ─────────────────────────────────────────────────────────────
INSERT INTO translation_keys (key_path, context, default_value, description, is_active) VALUES
  -- Navigation
  ('nav.home',              'ui', 'Home',          'Navigation: home link',            true),
  ('nav.menu',              'ui', 'Menu',           'Navigation: menu link',            true),
  ('nav.book',              'ui', 'Book',           'Navigation: book link',            true),
  ('nav.profile',           'ui', 'Profile',        'Navigation: profile link',         true),
  ('nav.cart',              'ui', 'Cart',           'Navigation: cart link',            true),
  ('nav.pricing',           'ui', 'Pricing',        'Navigation: pricing link',         true),
  ('nav.logout',            'ui', 'Log Out',        'Navigation: logout link',          true),

  -- Common actions
  ('action.submit',         'ui', 'Submit',         'Generic submit button',            true),
  ('action.cancel',         'ui', 'Cancel',         'Generic cancel button',            true),
  ('action.confirm',        'ui', 'Confirm',        'Generic confirm button',           true),
  ('action.save',           'ui', 'Save',           'Generic save button',              true),
  ('action.edit',           'ui', 'Edit',           'Generic edit button',              true),
  ('action.delete',         'ui', 'Delete',         'Generic delete button',            true),
  ('action.back',           'ui', 'Back',           'Generic back button',              true),
  ('action.next',           'ui', 'Next',           'Generic next/continue button',     true),
  ('action.close',          'ui', 'Close',          'Generic close button',             true),
  ('action.search',         'ui', 'Search',         'Generic search action',            true),
  ('action.filter',         'ui', 'Filter',         'Generic filter action',            true),
  ('action.view_all',       'ui', 'View All',       'View all items link',              true),
  ('action.load_more',      'ui', 'Load More',      'Load more items button',           true),
  ('action.retry',          'ui', 'Try Again',      'Retry after error',                true),

  -- Status / feedback
  ('status.loading',        'ui', 'Loading...',              'Loading indicator text',   true),
  ('status.error',          'ui', 'Something went wrong',    'Generic error state',      true),
  ('status.success',        'ui', 'Done!',                   'Generic success state',    true),
  ('status.not_found',      'ui', 'Not Found',               'Not found message',        true),
  ('status.empty',          'ui', 'No items found',          'Empty state message',      true),
  ('status.unavailable',    'ui', 'Currently unavailable',   'Item unavailable',         true),

  -- Booking / reservations
  ('booking.select_date',   'ui', 'Select Date',             'Date picker label',        true),
  ('booking.select_time',   'ui', 'Select Time',             'Time picker label',        true),
  ('booking.guests',        'ui', 'Guests',                  'Number of guests label',   true),
  ('booking.total',         'ui', 'Total',                   'Price total label',        true),
  ('booking.subtotal',      'ui', 'Subtotal',                'Price subtotal label',     true),
  ('booking.book_now',      'ui', 'Book Now',                'Book now CTA button',      true),
  ('booking.add_to_cart',   'ui', 'Add to Cart',             'Add to cart button',       true),
  ('booking.confirm',       'ui', 'Confirm Booking',         'Confirm booking button',   true),
  ('booking.cancellation',  'ui', 'Cancellation Policy',     'Cancellation policy label',true),
  ('booking.availability',  'ui', 'Check Availability',      'Availability CTA',         true),

  -- Authentication
  ('auth.login',            'ui', 'Log In',         'Login button / heading',   true),
  ('auth.logout',           'ui', 'Log Out',        'Logout button',            true),
  ('auth.register',         'ui', 'Register',       'Register button / heading',true),
  ('auth.email',            'ui', 'Email',          'Email field label',        true),
  ('auth.password',         'ui', 'Password',       'Password field label',     true),
  ('auth.name',             'ui', 'Full Name',      'Name field label',         true),
  ('auth.phone',            'ui', 'Phone Number',   'Phone field label',        true),
  ('auth.forgot_password',  'ui', 'Forgot Password?','Forgot password link',    true),

  -- Forms
  ('form.required',         'ui', 'Required',           'Required field indicator',         true),
  ('form.optional',         'ui', 'Optional',           'Optional field indicator',         true),
  ('form.select_option',    'ui', 'Select an option',   'Default select placeholder',       true),
  ('form.enter_value',      'ui', 'Enter a value',      'Generic input placeholder',        true),
  ('form.characters_left',  'ui', '{{count}} characters left', 'Character counter',         true),

  -- Validation errors
  ('error.required_field',  'ui', 'This field is required',          'Required field error', true),
  ('error.invalid_email',   'ui', 'Please enter a valid email',      'Email format error',   true),
  ('error.min_length',      'ui', 'Must be at least {{min}} characters', 'Min length error', true),
  ('error.max_length',      'ui', 'Cannot exceed {{max}} characters',    'Max length error', true),
  ('error.network',         'ui', 'Network error. Please try again.','Network error',        true),
  ('error.unauthorized',    'ui', 'You are not authorized to do this','Auth error',          true),
  ('error.session_expired', 'ui', 'Your session has expired. Please log in again.','Session error', true),

  -- Cart / checkout
  ('cart.empty',            'ui', 'Your cart is empty',      'Empty cart state',     true),
  ('cart.items',            'ui', '{{count}} item(s)',        'Cart item count',      true),
  ('cart.checkout',         'ui', 'Proceed to Checkout',     'Checkout CTA',         true),
  ('cart.remove',           'ui', 'Remove',                  'Remove item button',   true),
  ('cart.clear',            'ui', 'Clear Cart',              'Clear cart button',    true),

  -- Loyalty
  ('loyalty.points',        'ui', '{{count}} points',        'Loyalty points display',   true),
  ('loyalty.redeem',        'ui', 'Redeem Points',           'Redeem points button',     true),
  ('loyalty.earn',          'ui', 'Earn Points',             'Earn points label',        true)

ON CONFLICT (key_path) DO NOTHING;

COMMIT;
