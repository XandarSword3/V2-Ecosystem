<!-- Last updated: 2026-05-10 -->

# Feature Audit Master Plan — V2 Resort Ecosystem

> **Modules:** 37 | **Engines:** 4 | **Commits:** 257 | **Migrations:** 158  
> **Backend Tests:** 219 | **Frontend Tests:** 113 | **E2E Specs:** 90

**Created:** 2026-02-08  
**System:** V2 Resort — Full-stack resort management platform with 4-engine transaction framework  
**Scope:** Micro-level audit (~550-650 features)

---

## System Overview (Ground Truth)

| Metric | Count | Source |
|---|---|------|
| Frontend Pages (`page.tsx`) | **108** | Confirmed from frontend directory scan |
| Backend Modules | **37** | Confirmed from subsystem registry |
| API Endpoints | **711** | Confirmed from 40 route files (router.get/post/put/delete/patch) |
| Database Tables | **255** | Confirmed from 255 CREATE TABLE statements across all migrations |
| Active Migrations | **158** | Confirmed from supabase/migrations (timestamped files) |
| External Integrations | **8** | Confirmed from backend/package.json (stripe, sentry, supabase, socket.io, intuit-oauth, nodemailer, twilio, axios) |
| E2E Playwright Specs | **90** | Confirmed from tests/ directory |
| Backend Unit Tests | **219** | Confirmed from backend/tests/ |
| Frontend Unit Tests | **113** | Confirmed from frontend/tests/ |
| Engine Types | **4** | instant_transaction, time_exclusive_reservation, shared_capacity_access, ongoing_entitlement |
| Supported Languages | **20** | Confirmed from frontend/locales (20 locale files) |
| Themes | 3 | Confirmed from frontend/src theme references |

### Tech Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS 3.4, Zustand, TanStack React Query v5, Radix UI, Framer Motion
- **Backend:** Node.js, Express.js 4.18, TypeScript, Supabase (PostgreSQL), Drizzle ORM, Redis, Socket.IO
- **Payments:** Stripe (incl. Terminal for POS)
- **Auth:** JWT + 2FA + OAuth (Google/Facebook/Apple) + WebAuthn biometrics
- **Testing:** Vitest (unit), Playwright (E2E)

---

## Phase 1: Feature Discovery & Registry (Steps 1-4)

### Step 1: Build Master Feature Inventory

Systematically enumerate every user-facing action by scanning:
- All 103 `page.tsx` files — map every button, form, modal, and workflow per page
- All ~500+ API endpoints across 38 backend modules — map each endpoint to a user action
- All ~130 database tables — identify CRUD operations per entity
- The existing 287-feature inventory in `strategic-analysis/EXECUTIVE-SUMMARY.md`
- The 84-question audit in `audit/V2_RESORT_COMMERCIAL_AUDIT.md`
- Missing features in `audit/MISSING_FEATURES.md`

### Step 2: Assign Feature IDs

Numbering scheme: `{CATEGORY}-{MODULE}-{NNN}`
- `CUS-REST-001` = Customer > Restaurant > Browse Menu
- `STF-POOL-003` = Staff > Pool > Validate Ticket
- `ADM-USR-012` = Admin > Users > Assign Roles
- `SYS-AUTH-005` = System > Auth > 2FA Setup

Categories: `CUS` (Customer), `STF` (Staff), `MGR` (Manager), `ADM` (Admin), `SYS` (System/Cross-cutting), `KSK` (Kiosk), `INT` (Integration)

Module codes: `REST` (Restaurant), `POOL` (Pool), `CHAL` (Chalets), `SNCK` (Snack), `BOOK` (Bookings), `PAY` (Payments), `LOY` (Loyalty), `GFT` (Gift Cards), `CPN` (Coupons), `INV` (Inventory), `HSK` (Housekeeping), `REV` (Reviews), `RPT` (Reports), `MKT` (Marketing), `MSG` (Messaging), `I18N` (i18n), `GDPR` (GDPR), `CHN` (Channels), `POS` (POS), `KSK` (Kiosk), `USR` (Users), `AUTH` (Auth), `MOD` (Modules), `SET` (Settings), `GRP` (Groups), `MPROP` (Multi-Property), `RVMGT` (Revenue Mgmt), `MOBCI` (Mobile Check-in), `CUST` (Customization), `FIN` (Finance), `DEV` (Devices), `SUP` (Support), `AUD` (Audit), `NOTIF` (Notifications), `STF` (Staff Mgmt), `PROMO` (Promotions), `PARITY` (Rate Parity), `ACCOM` (Accommodations)

### Step 3: Create Feature Registry

Deliver `FEATURE_REGISTRY.md` containing:
- Master table: ID | Feature Name | Category | Module | Frontend Path(s) | Backend Endpoint(s) | DB Tables | Status | Doc Link | Test Link
- Cross-reference to 34 subsystem READMEs
- File-path index mapping features to source files

### Step 4: Create Feature-to-File Map

Deliver `FEATURE_FILE_MAP.md` — reverse-index mapping every source file to its feature(s).

---

## Phase 2: Test Triage & Cleanup (Steps 5-7)

### Step 5: Audit Every Existing Playwright Spec

Read all 51+ specs and classify each test as:
- **KEEP**: Meaningful assertions, real workflows
- **REWRITE**: Good concept but always-pass patterns — salvage structure, replace assertions
- **DELETE**: Pure noise (`expect(true).toBe(true)` throughout)

### Step 6: Establish Test Standards

Create `tests/README.md` defining:
- Banned patterns: `expect(true)`, `expect(x || true)`, `if (visible) { click }` without else-fail
- Required patterns: `await expect(element).toBeVisible()`, specific text assertions, shared login helpers
- Test structure: one spec per feature group, `test.describe` per sub-feature, `test.skip()` for unimplemented

### Step 7: Fix/Delete Bad Tests

Execute triage: delete DELETE specs, rewrite REWRITE specs, consolidate duplicate login helpers.

---

## Phase 3: Systematic Test Creation (Steps 8-11)

### Step 8: Write Smoke Tests (5 specs)

- `smoke/public-pages.spec.ts` — all 23 public routes
- `smoke/customer-pages.spec.ts` — 7 customer pages
- `smoke/staff-pages.spec.ts` — 14 staff pages
- `smoke/admin-pages.spec.ts` — 52 admin pages
- `smoke/kiosk.spec.ts` — kiosk page

### Step 9: Write Feature Tests (~35 specs)

Organized by user journey in `tests/features/`:

**Customer (8):** `restaurant-browsing`, `restaurant-ordering`, `snack-bar-ordering`, `chalet-booking`, `pool-tickets`, `account-management`, `reservations`, `auth`
**Staff (5):** `restaurant-orders`, `chalet-operations`, `pool-operations`, `snack-bar-operations`, `scanner`
**Manager (3):** `dashboard`, `approvals`, `shifts`
**Admin (16):** `dashboard`, `restaurant-management`, `chalet-management`, `pool-management`, `snack-management`, `user-management`, `orders`, `loyalty`, `giftcards`, `coupons`, `inventory`, `housekeeping`, `reports`, `notifications`, `modules`, `settings`
**Cross-cutting (3):** `i18n`, `themes`, `payments`

### Step 10: Write Integration/Workflow Tests (5 specs)

- `customer-order-to-delivery.spec.ts`
- `chalet-booking-lifecycle.spec.ts`
- `pool-ticket-lifecycle.spec.ts`
- `loyalty-journey.spec.ts`
- `admin-module-creation.spec.ts`

### Step 11: Create Test Coverage Matrix

Map every feature ID to test file(s) and pass/fail status.

---

## Phase 4: Documentation (Steps 12-15)

### Step 12: Guide Templates (3 templates)

- Quick Reference (1-2 pages)
- Comprehensive Guide (3-10 pages)
- Feature Group Guide

### Step 13: Customer Guides (8)

`getting-started`, `restaurant-ordering`, `chalet-booking`, `pool-access`, `snack-bar`, `loyalty-rewards`, `gift-cards`, `privacy-gdpr`

### Step 14: Staff & Manager Guides (7)

Staff: `getting-started`, `order-management`, `chalet-operations`, `pool-operations`, `scanner`
Manager: `approvals`, `shift-management`

### Step 15: Admin Guides (11)

`getting-started`, `module-management`, `restaurant-setup`, `accommodation-setup`, `pool-setup`, `user-management`, `marketing`, `inventory`, `reports`, `settings`, `system`

---

## Phase 5: Verification & Completion (Steps 16-18)

### Step 16: Execute Full Test Suite
### Step 17: Gap Analysis
### Step 18: Final Deliverables Assembly

---

## Key Decisions

- **Granularity:** Micro-level (~550-650 features)
- **Code marking:** External registry only (no in-code annotations)
- **Test strategy:** Extend/fix existing + add new systematic specs
- **Output location:** `v2-resort/docs/feature-audit/`
- **Feature ID scheme:** `{CATEGORY}-{MODULE}-{NNN}`

## Test Environment

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:3005/api` |
| Supabase Studio | `http://localhost:54323` |
| Supabase DB | `postgresql://postgres:postgres@localhost:54322/postgres` |

## Test Credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@v2resort.com` | `admin123` |
| Customer | `customer@test.com` | `password123` |
| Restaurant Staff | `restaurant.staff@v2resort.com` | `staff123` |
| Pool Staff | `pool.staff@v2resort.com` | `staff123` |
| Chalet Staff | `chalet.staff@v2resort.com` | `staff123` |
