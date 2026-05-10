<!-- Last updated: 2026-05-10 -->

# 📦 Subsystem Registry & Inventory

> **Total Commits:** 257 | **Backend Modules:** 37 | **Active Migrations:** 158 | **Engine Types:** 4

This registry is the single source of truth for all modules in the V2 Resort platform. All other documentation references this file for module counts and listings.

---

## � Backend Modules (37 Total)

All modules are located in `backend/src/modules/`. Each module follows the standard structure: `controller.ts`, `routes.ts`, `index.ts`, and optional subdirectories for complex features.

| Module | Path | Description | Engine Integration |
|--------|------|-------------|-------------------|
| **accommodations** | `backend/src/modules/accommodations/` | Property and room inventory management | `time_exclusive_reservation` pricing |
| **admin** | `backend/src/modules/admin/` | System administration, dashboard, user management | Analytics aggregation |
| **analytics** | `backend/src/modules/analytics/` | Data aggregation, metrics, and reporting engine | All engine types |
| **auth** | `backend/src/modules/auth/` | Authentication, JWT, 2FA, session management | N/A |
| **bookings** | `backend/src/modules/bookings/` | Reservation management and modification | `time_exclusive_reservation` state machine |
| **channels** | `backend/src/modules/channels/` | OTA integration and channel management | Transaction sync |
| **coupons** | `backend/src/modules/coupons/` | Discount codes and promotional pricing | All engine types |
| **customization** | `backend/src/modules/customization/` | Visual theming and branding configuration | N/A |
| **devices** | `backend/src/modules/devices/` | Hardware integration (POS, printers, scanners) | N/A |
| **economics** | `backend/src/modules/economics/` | Pricing engine and revenue optimization | All engine types |
| **finance** | `backend/src/modules/finance/` | Accounting, ledgers, financial reporting | Transaction ledger |
| **gdpr** | `backend/src/modules/gdpr/` | Data privacy compliance and user data export | All transaction tables |
| **giftcards** | `backend/src/modules/giftcards/` | Gift card issuance, redemption, tracking | All engine types |
| **groups** | `backend/src/modules/groups/` | Group booking management and coordination | `time_exclusive_reservation` |
| **housekeeping** | `backend/src/modules/housekeeping/` | Room cleaning schedules and task management | `time_exclusive_reservation` |
| **i18n** | `backend/src/modules/i18n/` | Internationalization and translation management | N/A |
| **integrations** | `backend/src/modules/integrations/` | Third-party service connectors | N/A |
| **inventory** | `backend/src/modules/inventory/` | Stock tracking and BOM management | `instant_transaction` |
| **kiosk** | `backend/src/modules/kiosk/` | Self-service terminal interface | All engine types |
| **loyalty** | `backend/src/modules/loyalty/` | Points program and tier management | All engine types |
| **manager** | `backend/src/modules/manager/` | Property manager dashboard and approvals | N/A |
| **marketing** | `backend/src/modules/marketing/` | Campaigns, automation, and guest outreach | N/A |
| **messaging** | `backend/src/modules/messaging/` | In-app and email communication | N/A |
| **mobile-checkin** | `backend/src/modules/mobile-checkin/` | Guest self-check-in functionality | `time_exclusive_reservation` |
| **multi-property** | `backend/src/modules/multi-property/` | Multi-location management | N/A |
| **parity** | `backend/src/modules/parity/` | Rate parity monitoring and enforcement | `time_exclusive_reservation` |
| **payments** | `backend/src/modules/payments/` | Payment processing and Stripe integration | All engine types |
| **pos** | `backend/src/modules/pos/` | Point-of-sale terminal operations | `instant_transaction` |
| **promotions** | `backend/src/modules/promotions/` | Dynamic pricing and promotional rules | All engine types |
| **public** | `backend/src/modules/public/` | Public-facing API endpoints | N/A |
| **reporting** | `backend/src/modules/reporting/` | Report generation and scheduling | All engine types |
| **revenue** | `backend/src/modules/revenue/` | Revenue management and forecasting | All engine types |
| **reviews** | `backend/src/modules/reviews/` | Guest feedback and review management | N/A |
| **shared** | `backend/src/modules/shared/` | Shared utilities and common functions | N/A |
| **staff** | `backend/src/modules/staff/` | Staff management and shift scheduling | N/A |
| **support** | `backend/src/modules/support/` | Help desk and ticket management | N/A |
| **users** | `backend/src/modules/users/` | User accounts, profiles, and preferences | N/A |

---

## 🎨 Frontend Application Routes

The Next.js 14 frontend uses the App Router structure in `frontend/src/app/`.

| Route | Purpose | Engine Context |
|-------|---------|----------------|
| `/[slug]` | Dynamic module routing | All engine types |
| `/account` | User account management | N/A |
| `/admin` | Administration dashboard | All engine types |
| `/api` | API routes and webhooks | N/A |
| `/cancellation` | Booking cancellation flow | `time_exclusive_reservation` |
| `/cart` | Shopping cart and checkout | All engine types |
| `/contact` | Contact form | N/A |
| `/cookie-policy` | Legal page | N/A |
| `/forgot-password` | Password recovery | N/A |
| `/giftcards` | Gift card purchase | `instant_transaction` |
| `/kiosk` | Self-service kiosk interface | All engine types |
| `/login` | Authentication | N/A |
| `/offline` | Offline fallback page | N/A |
| `/order` | Order tracking | `instant_transaction` |
| `/privacy` | Privacy policy | N/A |
| `/profile` | User profile | N/A |
| `/register` | Account creation | N/A |
| `/reset-password` | Password reset | N/A |
| `/staff` | Staff portal | All engine types |
| `/terms` | Terms of service | N/A |

---

## ⚡ Engine Framework

The V2 platform uses 4 unified engine types to handle all transaction patterns:

| Engine Type | Template | Description | State Machine |
|-------------|----------|-------------|---------------|
| `instant_transaction` | `menu_service` | Point-of-sale transactions fulfilled immediately (food orders, snack bar) | `pending → confirmed → preparing → ready → delivered → completed` (or `cancelled`) |
| `time_exclusive_reservation` | `multi_day_booking` | Date-range bookings that lock a unit exclusively (chalets, rooms) | `pending → confirmed → checked_in → checked_out` (or `cancelled`, `no_show`) |
| `shared_capacity_access` | `session_access` | Capacity-limited sessions shared across guests (pool, gym) | `valid → active → used` (or `expired`, `cancelled`) |
| `ongoing_entitlement` | `subscription` | Recurring memberships and subscriptions | `pending → active → paused` (or `expired`, `cancelled`) |

**Engine Definition Files:**
- `backend/src/engines/definitions/instant-transaction.ts`
- `backend/src/engines/definitions/time-exclusive-reservation.ts`
- `backend/src/engines/definitions/shared-capacity-access.ts`
- `backend/src/engines/definitions/ongoing-entitlement.ts`

**Engine Registry:** `backend/src/engines/registry.ts`

---

## 📊 Test Infrastructure

| Test Category | Location | File Count |
|---------------|----------|------------|
| Backend Unit/Integration | `backend/tests/` | 219 |
| Frontend Unit | `frontend/tests/` | 113 |
| E2E Playwright | `tests/` | 90 |

**E2E Test Suites:**
- `tests/admin-functional/` — Admin workflow tests
- `tests/e2e/` — End-to-end integration tests
- `tests/features/` — Feature-specific tests
- `tests/phase3/` — Engine-aligned critical path tests (00-24)
- `tests/rebrand/` — White-label/rebranding tests
- `tests/smoke/` — Production smoke tests
- `tests/workflows/` — Full workflow tests

---

## 🗄️ Database & Infrastructure

| Component | Technology | Details |
|-----------|------------|---------|
| Database | PostgreSQL 15 | Supabase-hosted, 160 active migrations |
| Cache | Redis 7 | Session storage, rate limiting |
| Backend | Node.js 20 + Express 4.18 | TypeScript 5.3 |
| Frontend | Next.js 14.2 | TypeScript 5.4, Tailwind CSS 3.4 |
| Mobile | React Native 0.81.5 + Expo 54.0 | iOS/Android apps |
| Testing | Vitest + Playwright | Unit, integration, E2E |
| CI/CD | GitHub Actions | 7-stage pipeline |

**Docker Services:**
- `postgres` (postgres:15-alpine, port 5432)
- `redis` (redis:7-alpine, port 6379)

---

## 🔗 Related Documentation

- [Architecture Overview](../architecture/ARCHITECTURE.md) — Engine framework details
- [API Reference](../api/API.md) — Endpoint documentation
- [Testing Guide](../guides/TESTING.md) — CI pipeline and test structure
- [Codebase Map](./codebase-map.md) — Directory structure
- [File Index](./file-index.md) — Flat file listing

## 🧩 Other Components / Support

| Component | LOC | Files | Path |
|-----------|-----|-------|------|
| mobile/dist-android | 84960 | 26 | `mobile/dist-android` |
| backend/tests | 77186 | 190 | `backend/tests` |
| docs | 49567 | 91 | `docs` |
| backend/src | 27615 | 177 | `backend/src` |
| frontend | 21590 | 25 | `frontend` |
| mobile | 21489 | 21 | `mobile` |
| backend | 20681 | 74 | `backend` |
| tests | 10715 | 25 | `tests` |
| frontend/messages | 9927 | 5 | `frontend/messages` |
| mobile/__tests__ | 8935 | 26 | `mobile/__tests__` |
| supabase | 7151 | 67 | `supabase` |
| mobile/android | 6675 | 42 | `mobile/android` |
| mobile/app | 5503 | 29 | `mobile/app` |
| frontend/tests | 4798 | 22 | `frontend/tests` |
| frontend/src | 4317 | 15 | `frontend/src` |
| backend/docs | 3146 | 6 | `backend/docs` |
| backend/logs | 2238 | 2 | `backend/logs` |
| backend/scripts | 1278 | 10 | `backend/scripts` |
| package-lock.json | 1177 | 1 | `package-lock.json` |
| scripts | 1040 | 4 | `scripts` |
| README.md | 998 | 1 | `README.md` |
| USER_GUIDE.md | 526 | 1 | `USER_GUIDE.md` |
| notification-preferences.service.ts | 495 | 1 | `backend\src\services\notification-preferences.service.ts` |
| stripe-platform.service.ts | 489 | 1 | `backend\src\services\stripe-platform.service.ts` |
| bounce-handler.service.ts | 475 | 1 | `backend\src\services\bounce-handler.service.ts` |
| animations | 461 | 1 | `frontend\src\lib\animations` |
| webhook-retry.service.ts | 459 | 1 | `backend\src\services\webhook-retry.service.ts` |
| backend/supabase | 458 | 12 | `backend/supabase` |
| devices | 455 | 3 | `backend\src\modules\devices` |
| sms.service.ts | 454 | 1 | `backend\src\services\sms.service.ts` |
| seasonal-pricing.service.ts | 447 | 1 | `backend\src\services\seasonal-pricing.service.ts` |
| payments | 445 | 3 | `frontend\src\components\payments` |
| security-audit.service.ts | 438 | 1 | `backend\src\services\security-audit.service.ts` |
| api.ts | 432 | 1 | `frontend\src\lib\api.ts` |
| pos | 425 | 2 | `backend\src\modules\pos` |
| email-rate-limiter.service.ts | 421 | 1 | `backend\src\services\email-rate-limiter.service.ts` |
| API.md | 414 | 1 | `API.md` |
| theme-config.ts | 413 | 1 | `frontend\src\lib\theme-config.ts` |
| login | 407 | 1 | `frontend\src\app\login` |
| tracing.service.ts | 401 | 1 | `backend\src\services\tracing.service.ts` |
| RestaurantFloorPlan.tsx | 399 | 1 | `frontend\src\components\RestaurantFloorPlan.tsx` |
| performance-monitoring.service.ts | 398 | 1 | `backend\src\services\performance-monitoring.service.ts` |
| CookieConsentBanner.tsx | 393 | 1 | `frontend\src\components\CookieConsentBanner.tsx` |
| translation-audit.js | 392 | 1 | `tools\translation-audit.js` |
| BookingModificationModal.tsx | 389 | 1 | `frontend\src\components\BookingModificationModal.tsx` |
| settings-context.tsx | 378 | 1 | `frontend\src\lib\settings-context.tsx` |
| chalets | 370 | 2 | `frontend\src\components\chalets` |
| currency.service.ts | 369 | 1 | `backend\src\services\currency.service.ts` |
| frontend/public | 365 | 2 | `frontend/public` |
| index.ts | 352 | 1 | `shared\types\index.ts` |
| rate-limiter.service.ts | 345 | 1 | `backend\src\services\rate-limiter.service.ts` |
| two-factor.service.ts | 343 | 1 | `backend\src\services\two-factor.service.ts` |
| README.md | 336 | 1 | `backend\src\lib\README.md` |
| mobile/docs | 335 | 1 | `mobile/docs` |
| socket.ts | 331 | 1 | `frontend\src\lib\socket.ts` |
| ParallaxHero.tsx | 315 | 1 | `frontend\src\components\ParallaxHero.tsx` |
| password-policy.service.ts | 310 | 1 | `backend\src\services\password-policy.service.ts` |
| structured-data.tsx | 310 | 1 | `frontend\src\lib\structured-data.tsx` |
| frontend/scripts | 309 | 1 | `frontend/scripts` |
| Footer.tsx | 307 | 1 | `frontend\src\components\Footer.tsx` |
| translation.service.ts | 306 | 1 | `backend\src\services\translation.service.ts` |
| DEVELOPMENT_SETUP.md | 306 | 1 | `DEVELOPMENT_SETUP.md` |
| PasswordStrengthMeter.tsx | 296 | 1 | `frontend\src\components\PasswordStrengthMeter.tsx` |
| backup.service.ts | 295 | 1 | `backend\src\services\backup.service.ts` |
| TESTING.md | 293 | 1 | `TESTING.md` |
| bookings | 291 | 1 | `backend\src\modules\bookings` |
| Wishlist.tsx | 289 | 1 | `frontend\src\components\Wishlist.tsx` |
| contact | 286 | 1 | `frontend\src\app\contact` |
| nginx | 272 | 2 | `nginx` |
| register | 255 | 1 | `frontend\src\app\register` |
| DepthElements.tsx | 252 | 1 | `frontend\src\components\DepthElements.tsx` |
| WeatherWidget.tsx | 249 | 1 | `frontend\src\components\WeatherWidget.tsx` |
| README.md | 247 | 1 | `frontend\src\lib\README.md` |
| README.md | 245 | 1 | `shared\types\README.md` |
| accommodations | 242 | 2 | `backend\src\modules\accommodations` |
| README_OVERVIEW.md | 242 | 1 | `README_OVERVIEW.md` |
| ThemeInjector.tsx | 235 | 1 | `frontend\src\components\ThemeInjector.tsx` |
| .github | 234 | 1 | `.github` |
| reviews | 233 | 2 | `backend\src\modules\reviews` |
| InteractiveResortMap.tsx | 231 | 1 | `frontend\src\components\InteractiveResortMap.tsx` |
| auth-context.tsx | 230 | 1 | `frontend\src\lib\auth-context.tsx` |
| pwa.ts | 228 | 1 | `frontend\src\lib\pwa.ts` |
| stores | 227 | 2 | `frontend\src\lib\stores` |
| README.md | 224 | 1 | `backend\src\services\README.md` |
| LiveChatWidget.tsx | 223 | 1 | `frontend\src\components\LiveChatWidget.tsx` |
| cart | 219 | 1 | `frontend\src\app\cart` |
| strategic-analysis | 218 | 1 | `strategic-analysis` |
| pos | 215 | 1 | `frontend\src\components\pos` |
| reset-password | 214 | 1 | `frontend\src\app\reset-password` |
| backend/prisma | 209 | 1 | `backend/prisma` |
| cdn-config.yaml | 204 | 1 | `infrastructure\cdn-config.yaml` |
| README.md | 198 | 1 | `frontend\src\components\README.md` |
| server-api.ts | 186 | 1 | `frontend\src\lib\server-api.ts` |
| module-utils.ts | 185 | 1 | `frontend\src\lib\module-utils.ts` |
| README.md | 178 | 1 | `backend\src\modules\README.md` |
| webhookIdempotency.service.ts | 175 | 1 | `backend\src\services\webhookIdempotency.service.ts` |
| pwa | 174 | 2 | `frontend\src\components\pwa` |
| layout.tsx | 168 | 1 | `frontend\src\app\layout.tsx` |
| mobile/__mocks__ | 167 | 3 | `mobile/__mocks__` |
| translate.ts | 166 | 1 | `frontend\src\lib\translate.ts` |
| finance | 161 | 2 | `backend\src\modules\finance` |
| forgot-password | 159 | 1 | `frontend\src\app\forgot-password` |
| global-error.tsx | 157 | 1 | `frontend\src\app\global-error.tsx` |
| ARCHITECTURE.md | 154 | 1 | `ARCHITECTURE.md` |
| ErrorBoundary.tsx | 152 | 1 | `frontend\src\components\ErrorBoundary.tsx` |
| scheduler.service.ts | 151 | 1 | `backend\src\services\scheduler.service.ts` |
| dynamic-translation.service.ts | 142 | 1 | `backend\src\services\dynamic-translation.service.ts` |
| terminology.service.ts | 140 | 1 | `backend\src\services\terminology.service.ts` |
| utils.ts | 129 | 1 | `frontend\src\lib\utils.ts` |
| LanguageSwitcher.tsx | 127 | 1 | `frontend\src\components\LanguageSwitcher.tsx` |
| privacy | 126 | 1 | `frontend\src\app\privacy` |
| terms | 126 | 1 | `frontend\src\app\terms` |
| support | 124 | 1 | `backend\src\modules\support` |
| cancellation | 122 | 1 | `frontend\src\app\cancellation` |
| ThemeToggle.tsx | 116 | 1 | `frontend\src\components\ThemeToggle.tsx` |
| shared | 115 | 2 | `shared` |
| index.ts | 111 | 1 | `backend\src\lib\index.ts` |
| docker-compose.yml | 105 | 1 | `docker-compose.yml` |
| SessionTimeoutMonitor.tsx | 102 | 1 | `frontend\src\components\SessionTimeoutMonitor.tsx` |
| logger.ts | 101 | 1 | `frontend\src\lib\logger.ts` |
| usePWA.ts | 100 | 1 | `frontend\src\lib\usePWA.ts` |
| providers.tsx | 97 | 1 | `frontend\src\app\providers.tsx` |
| CurrencySwitcher.tsx | 86 | 1 | `frontend\src\components\CurrencySwitcher.tsx` |
| README.md | 77 | 1 | `tools\README.md` |
| .env.example | 75 | 1 | `.env.example` |
| playwright.config.ts | 69 | 1 | `playwright.config.ts` |
| providers | 66 | 1 | `frontend\src\components\providers` |
| structured-data-generator.ts | 64 | 1 | `frontend\src\lib\structured-data-generator.ts` |
| error.tsx | 60 | 1 | `frontend\src\app\error.tsx` |
| offline | 59 | 1 | `frontend\src\app\offline` |
| business-config.service.ts | 52 | 1 | `backend\src\services\business-config.service.ts` |
| booking-reminders.service.ts | 50 | 1 | `backend\src\services\booking-reminders.service.ts` |
| docker-compose.supabase.yml | 49 | 1 | `docker-compose.supabase.yml` |
| .gitignore | 46 | 1 | `.gitignore` |
| backend/tmp_prisma | 44 | 4 | `backend/tmp_prisma` |
| api | 41 | 1 | `frontend\src\app\api` |
| package.json | 39 | 1 | `package.json` |
| .env | 35 | 1 | `.env` |
| hydrate-settings.tsx | 34 | 1 | `frontend\src\lib\hydrate-settings.tsx` |
| common | 33 | 1 | `frontend\src\components\common` |
| DirectionSync.tsx | 32 | 1 | `frontend\src\components\DirectionSync.tsx` |
| PageTracker.tsx | 31 | 1 | `frontend\src\components\PageTracker.tsx` |
| hooks | 27 | 1 | `mobile\src\hooks` |
| config | 20 | 1 | `mobile\src\config` |
| ThemeProvider.tsx | 19 | 1 | `frontend\src\components\ThemeProvider.tsx` |
| mobile/.expo | 18 | 2 | `mobile/.expo` |
| vercel.json | 9 | 1 | `vercel.json` |
| .vercelignore | 8 | 1 | `.vercelignore` |
| cn.ts | 7 | 1 | `frontend\src\lib\cn.ts` |
| lib | 7 | 1 | `mobile\src\lib` |
| translation-audit-results.json | 6 | 1 | `tools\translation-audit-results.json` |
| supabase.ts | 5 | 1 | `backend\src\lib\supabase.ts` |
| prisma.ts | 4 | 1 | `backend\src\lib\prisma.ts` |
| backend/test-results | 4 | 1 | `backend/test-results` |
| mobile/assets | 1 | 1 | `mobile/assets` |
