# V2 Ecosystem — Backend

Express.js + TypeScript REST API backed by Supabase (PostgreSQL).

## Tech Stack

- **Runtime**: Node.js with TypeScript (tsx for dev, tsc for build)
- **Framework**: Express 4.x
- **Database**: Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Auth**: JWT (jsonwebtoken) + bcryptjs + optional 2FA (otplib)
- **Payments**: Stripe SDK
- **Email**: Nodemailer
- **SMS**: Twilio
- **Monitoring**: Sentry, OpenTelemetry
- **Real-time**: Socket.IO with Redis adapter
- **Testing**: Vitest
- **Validation**: Zod

## Directory Structure

| Directory | Contents |
|-----------|----------|
| `src/modules/` | 38 feature modules (auth, admin, restaurant, pool, etc.) |
| `src/services/` | 33 shared services (email, SMS, payments, backup, etc.) |
| `src/middleware/` | 20 middleware files (auth, CSRF, rate-limit, security, etc.) |
| `src/engines/` | 11 engine files (pricing pipeline, state machine, feature flags, etc.) |
| `src/routes/` | 6 standalone route files (terminology, translations, docs, etc.) |
| `src/database/` | Database connection, migrations, seeds |
| `src/config/` | Configuration files |
| `src/lib/` | Shared libraries and utilities |
| `src/repositories/` | Data access layer |
| `tests/` | Unit, integration, and contract tests |

## API Mount Points (from app.ts)

All module routes are mounted under `/api/v1/`:

| Route | Module |
|-------|--------|
| `/api/v1/admin` | Admin dashboard, modules, settings |
| `/api/v1/auth` | Authentication (login, register, OAuth) |
| `/api/v1/bookings` | Booking modifications |
| `/api/v1/chalets` | Chalet management |
| `/api/v1/channels` | OTA channel management |
| `/api/v1/coupons` | Coupon system |
| `/api/v1/customizations` | Unified customization system |
| `/api/v1/devices` | Device management |
| `/api/v1/finance` | Financial operations |
| `/api/v1/gdpr` | GDPR/privacy compliance |
| `/api/v1/giftcards` | Gift card management |
| `/api/v1/groups` | Group bookings |
| `/api/v1/housekeeping` | Housekeeping operations |
| `/api/v1/i18n` | Internationalization |
| `/api/v1/inventory` | Inventory management |
| `/api/v1/kiosk` | Self-service kiosk |
| `/api/v1/loyalty` | Loyalty program |
| `/api/v1/manager` | Manager operations |
| `/api/v1/marketing` | Marketing campaigns |
| `/api/v1/messaging` | Guest messaging |
| `/api/v1/mobile-checkin` | Mobile check-in |
| `/api/v1/multi-property` | Multi-property management |
| `/api/v1/payments` | Payment processing |
| `/api/v1/payments/platform` | Platform payments (Apple Pay, Google Pay) |
| `/api/v1/pool` | Pool/amenity management |
| `/api/v1/pos` | POS hardware integration |
| `/api/v1/rate-parity` | Rate parity monitoring |
| `/api/v1/reporting` | Reporting and analytics |
| `/api/v1/restaurant` | Restaurant operations |
| `/api/v1/restaurant/modifiers` | Menu item modifiers |
| `/api/v1/restaurant/waitlist` | Restaurant waitlist |
| `/api/v1/revenue` | Revenue management |
| `/api/v1/reviews` | Guest reviews |
| `/api/v1/snack` | Snack bar operations |
| `/api/v1/staff` | Staff management |
| `/api/v1/support` | Support tickets |
| `/api/v1/terminology` | White-label terminology |
| `/api/v1/translations` | Dynamic translations |
| `/api/v1/users` | User management |

Additional endpoints:
- `/health`, `/api/health` — liveness probe
- `/health/ready` — readiness probe (checks DB)
- `/api/csrf-token` — CSRF token endpoint
- `/api/docs` — Swagger/OpenAPI documentation
- `/api/modules` — module listing
- `/webhooks/channels` — channel webhook receiver

**Disabled**: QuickBooks integration (requires Prisma refactor)

## Test Results (verified 2026-03-21)

| Metric | Value |
|--------|-------|
| Total test suites | 2,752 |
| Passing suites | 2,713 |
| Failing suites | 39 |
| Total tests | 6,768 |
| Passing tests | 6,717 |
| Failing tests | 28 |
| **Pass rate** | **99.6%** |

### Failing Test Suites (13 files)

1. `tests/ai-agent.integration.test.ts`
2. `tests/security-patches.test.ts`
3. `tests/contract/openapi-lint.test.ts`
4. `tests/unit/auth.controller.test.ts`
5. `tests/unit/chalet.controller.test.ts`
6. `tests/unit/csrf.middleware.test.ts`
7. `tests/unit/oauth.controller.test.ts`
8. `tests/unit/security.middleware.test.ts`
9. `tests/unit/auth/oauth.controller.test.ts`
10. `tests/unit/controllers/settings.controller.test.ts`
11. `tests/unit/restaurant/modifiers.controller.test.ts`
12. `tests/unit/restaurant/waitlist.controller.test.ts`
13. `tests/unit/services/backup.service.test.ts`

## Commands

```bash
npm run dev              # Start dev server (tsx watch)
npm run build            # TypeScript compile
npm run start            # Run production build
npm run test             # Run all unit tests (vitest)
npm run test:coverage    # Run with coverage
npm run test:integration # Integration tests
npm run lint             # ESLint
npm run migrate          # Run database migrations
npm run seed             # Seed database
npm run db:reset         # Reset database
```

## Known Issues

- QuickBooks integration disabled (uses PrismaClient, needs Supabase refactor)
- 13 test suites failing (28 individual tests) — mostly controller mock mismatches
- `backup.service.test.ts` fails due to Supabase client mock chainability issue
