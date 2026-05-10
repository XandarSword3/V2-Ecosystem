<!-- Last updated: 2026-05-10 -->

# Admin Functional Audit

> **Admin Pages:** 69 | **Test Sectors:** 11 | **Engine Types:** 4

This document is the **current automated proof** (via Playwright) that admin pages work end-to-end per sector: **UI → backend → engine framework → database effects** where deterministic, plus button-to-endpoint wiring checks.

## How to run

From `v2-resort/`:

```bash
npx playwright test -c playwright.admin-functional.config.ts tests/admin-functional --project=chromium
```

Notes:
- Tests rely on `tests/fixtures/auth.fixture.ts` and will log in using `E2E_*` env vars (or fallbacks).
- `NEXT_PUBLIC_API_URL` is injected for the frontend webServer in `playwright.admin-functional.config.ts` so UI calls the local backend.

## Sector coverage status (current)

### Dynamic Modules (`/admin/[slug]/*`)
- **Spec**: `tests/admin-functional/dynamic-modules.functional.spec.ts`
- **Proves**:
  - Modules are discoverable by the UI (ensures module exists + is active/show_in_main)
  - Representative module flows work for engine-based modules:
    - `menu_service` (instant_transaction engine - restaurant operations)
    - `session_access` (shared_capacity_access engine - pool capacity/settings)
    - `multi_day_booking` (time_exclusive_reservation engine - chalet pricing/rules)
  - Mutations are verified by subsequent GET calls (and fallbacks are handled for schema drift like missing `module_id`)
  - Engine framework state transitions validated through unified `transactions` table

### Settings (`/admin/settings/*`)
- **Spec**: `tests/admin-functional/settings.functional.spec.ts`
- **Proves**:
  - Load → save → reload persists for key subpages (Tax, Homepage, Appearance)
  - “Save changes” asserts via successful backend responses (not flaky toast UI)

### Users (`/admin/users/*`)
- **Spec**: `tests/admin-functional/users.functional.spec.ts`
- **Proves**:
  - Customer list renders
  - Representative role/permission flows work where present

### Operations (`/admin/inventory`, `/admin/housekeeping`)
- **Spec**: `tests/admin-functional/operations.functional.spec.ts`
- **Proves**:
  - Inventory: deterministic create via API + UI render/search confirmation
  - Housekeeping: representative admin surface works (with deterministic assertions that tolerate data variance)

### Marketing (`/admin/loyalty`, `/admin/coupons`, `/admin/giftcards`)
- **Spec**: `tests/admin-functional/marketing.functional.spec.ts`
- **Proves**:
  - Loyalty: tiers CRUD + GET verification
  - Coupons: representative create/list flows
  - Gift cards: create a direct gift card (avoids template schema drift) + UI presence

### Reports (`/admin/reports/*`)
- **Spec**: `tests/admin-functional/reports.functional.spec.ts`
- **Proves**:
  - Overview endpoint returns data
  - Export returns a non-empty payload (API) and “Export All” triggers export (UI)
- **Compatibility fix**:
  - Frontend analytics page normalizes `/admin/reports/overview` to avoid crashing on response-shape differences.

### Integrations (`/admin/integrations/*`)
- **Spec**: `tests/admin-functional/integrations.functional.spec.ts`
- **Proves**:
  - Integrations index renders and QuickBooks page renders
  - `GET /integrations/quickbooks/status` is reachable and returns `{ connected: boolean }`
- **Environment safety**:
  - Status endpoint degrades gracefully when integration tables aren’t present (returns connected=false instead of 500).

### Misc (Channels + Reviews + Audit)
- **Spec**: `tests/admin-functional/misc.functional.spec.ts`
- **Proves**:
  - **Channels**: create/activate connection (API) → UI renders → UI “Disconnect” triggers DELETE and connection disappears from GET list
  - **Audit**: `/admin/audit` renders and refresh hits `/admin/audit-logs`
  - **Reviews**:
    - If schema supports it: pending review can be approved and the approved state is reflected via `GET /reviews/admin`
    - If schema does *not* support review creation (detected via PostgREST `PGRST204`): test still proves list endpoint + admin page render, and explicitly flags schema drift instead of producing false confidence

## Known gaps / drift surfaced by tests

- **Reviews schema drift**:
  - Some environments do not have a `reviews.text` column (PostgREST `PGRST204`), and may also differ on `comment` availability.
  - Current approach: controller tries a “full schema” insert first; tests tolerate `PGRST204` by falling back to render/list-only verification when creation is impossible.
  - Recommended follow-up: pick a single canonical `reviews` schema and apply migrations to the local test DB so admin actions can be fully proven deterministically.

- **QuickBooks integration DB tables**:
  - Some environments may not have the QuickBooks tables; status endpoint now returns `connected:false` instead of 500 so UI stays usable.

## Files that define the suite

- **Playwright config**: `playwright.admin-functional.config.ts`
- **Auth fixture**: `tests/fixtures/auth.fixture.ts`
- **Harness**: `tests/admin-functional/harness.ts`
- **Sector specs**: `tests/admin-functional/*.functional.spec.ts`

