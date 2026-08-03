-- ============================================================
-- Migration: Seed the Engine E signup module ("Pricing" page)
--
-- Item 5 in CONTEXT.md's fix queue, built the way item 5 actually
-- says to build it: "a real module, owned by Alessandro's seeded
-- tenant, built through the module builder like any other module"
-- — NOT a hand-coded Next.js page.
--
-- A prior session's "build order" for item 5 drifted into planning
-- a standalone frontend/src/app/pricing/page.tsx route. That was
-- caught and abandoned before any frontend file was written. This
-- migration replaces that plan entirely.
--
-- How this renders with zero new frontend code:
--   frontend/src/app/[slug]/page.tsx is the generic public module
--   renderer. Any module row with a populated settings.layout gets
--   rendered automatically by DynamicModuleRenderer — no per-module
--   page, no per-engine component. This migration only inserts data;
--   the rendering machinery already exists and is untouched.
--
-- Block types used (both already exist in DynamicModuleRenderer.tsx,
-- nothing new): hero_v2, pricing_table.
--
-- Checkout: pricing_table's "Get Started" button now has a real
-- onClick path, scoped to engine_type = 'platform_entitlement' only
-- (every other engine's pricing_table is untouched and still static).
-- Clicking it opens a small dialog (name/email/subdomain), POSTs
-- POST /api/v1/platform/checkout, and redirects to the Stripe url it
-- returns. See DynamicModuleRenderer.tsx's PricingTableComponent.
-- This requires each plan object below to carry a `code` field
-- matching the `tier` the checkout endpoint expects.
--
-- Plan data is denormalized from the `plans` table (items 2/3, DONE)
-- at migration time. It will NOT auto-update if plans are edited
-- later via the admin CRUD UI — a live-syncing version (fetching from
-- GET /api/v1/platform/plans instead of static props.plans) is a
-- reasonable future improvement, not done here.
--
-- Idempotent: ON CONFLICT (slug, tenant_id) DO NOTHING, matching the
-- existing idx_modules_slug_tenant unique index.
--
-- No-op if the platform-root tenant doesn't exist yet (INSERT...SELECT
-- from a WHERE that matches zero rows inserts zero rows — no error).
-- ============================================================

INSERT INTO modules (
  engine_type,
  template_type,
  name,
  slug,
  description,
  settings,
  settings_version,
  is_active,
  show_in_main,
  property_id,
  tenant_id
)
SELECT
  'platform_entitlement',
  NULL,                      -- no legacy template_type alias for Engine E
  'Pricing',
  'pricing',
  'Choose a plan and start your V2 trial.',
  '{
    "layout": [
      {
        "id": "hero-pricing-1",
        "type": "hero_v2",
        "props": {
          "eyebrow": "14-day free trial",
          "title": "Run your business on V2",
          "subtitle": "The same platform powering this site can power yours.",
          "description": "Pick a plan, get your own subdomain, and start configuring modules in minutes.",
          "align": "center"
        }
      },
      {
        "id": "pricing-table-1",
        "type": "pricing_table",
        "props": {
          "title": "Choose your plan",
          "plans": [
            {
              "name": "Starter",
              "code": "starter",
              "price": "$29/mo",
              "features": [
                "For small venues getting started with one location",
                "1 property",
                "3 modules",
                "5 team members"
              ],
              "popular": false
            },
            {
              "name": "Growth",
              "code": "growth",
              "price": "$79/mo",
              "features": [
                "For growing operations with multiple properties",
                "5 properties",
                "15 modules",
                "25 team members"
              ],
              "popular": true
            },
            {
              "name": "Enterprise",
              "code": "enterprise",
              "price": "$199/mo",
              "features": [
                "Unlimited access for large portfolios",
                "Unlimited properties",
                "Unlimited modules",
                "Unlimited team members",
                "White-glove onboarding included"
              ],
              "popular": false
            }
          ]
        }
      }
    ],
    "showInNavigation": true,
    "icon": "CreditCard"
  }'::jsonb,
  1,
  TRUE,
  TRUE,
  NULL,
  t.id
FROM tenants t
WHERE t.is_platform_root = TRUE
ON CONFLICT (slug, tenant_id) DO NOTHING;

-- ------------------------------------------------------------
-- Navbar visibility.
--
-- Module creation through the normal API (modules.controller.ts's
-- createModule()) auto-appends a link to site_settings.navbar.links
-- whenever a CMS-configured navbar already exists (see its "Auto-add
-- to navbar CMS" block). This migration bypasses that controller
-- entirely (raw SQL insert), so it must replicate that side effect
-- itself or this module silently never appears in the nav.
--
-- frontend/src/components/layout/Header.tsx only reads from two
-- places: settings.navbar.links (CMS mode, used whenever that array
-- is non-empty) or an auto-generated fallback list built straight
-- from active modules (only used when navbar.links is empty). The
-- settings.showInNavigation / settings.icon fields set above on the
-- module row itself are NOT read by Header.tsx for navigation at
-- all -- they were a no-op as far as nav visibility goes. The real
-- mechanism is this site_settings.navbar.links array.
--
-- Only fires if a CMS navbar already exists (links is a non-null,
-- non-empty jsonb array) AND doesn't already contain a 'pricing'
-- module link (idempotent on re-run). If no CMS navbar exists yet,
-- Header.tsx's auto-generate fallback already covers this module
-- correctly (it reads modules directly), so no action is needed.
UPDATE site_settings
SET value = jsonb_set(
  value,
  '{links}',
  (value->'links') || jsonb_build_array(
    jsonb_build_object(
      'type', 'internal',
      'href', '/pricing',
      'moduleSlug', 'pricing',
      'label', 'Pricing',
      'icon', 'CreditCard'
    )
  )
)
WHERE key = 'navbar'
  AND value IS NOT NULL
  AND jsonb_typeof(value->'links') = 'array'
  AND jsonb_array_length(value->'links') > 0
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(value->'links') AS link
    WHERE link->>'moduleSlug' = 'pricing'
  );

COMMENT ON TABLE modules IS
  'Includes the Engine E signup module (slug=pricing, engine_type=platform_entitlement) '
  'seeded by 20260621180000_seed_engine_e_signup_module.sql. Renders via the generic '
  '/[slug] module renderer — no dedicated frontend page. Checkout button is wired in '
  'DynamicModuleRenderer.tsx PricingTableComponent, scoped to this engine_type only.';
