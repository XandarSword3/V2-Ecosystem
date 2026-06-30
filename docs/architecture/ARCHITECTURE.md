<!-- Last updated: 2026-05-10 -->

# Architecture Overview

> **Platform**: V2 Resort Management System | **Commits**: 257 | **Modules**: 37 | **Engines**: 4

This document describes the unified engine architecture that powers all transactions in the V2 platform.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         V2 Resort Platform                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐    │
│  │                 │     │   37 Modules    │     │                 │    │
│  │   Frontend      │────▶│   4 Engines     │────▶│   Supabase      │    │
│  │   Next.js 14    │     │   Express.js    │     │   PostgreSQL 15 │    │
│  │   (Port 3005)   │     │   PostgreSQL 15 │     │                 │    │
│  │                 │     │                 │     │  158 Migrations │    │
│  └────────┬────────┘     └────────┬────────┘     └─────────────────┘    │
│           │                       │                                      │
│           │  WebSocket (Socket.io)                                     │
│           └───────────────────────┘                                      │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Unified Transaction Layer                      │    │
│  ├───────────┬───────────────┬─────────────────┬─────────────────┤    │
│  │ instant_  │ time_exclusive│ shared_capacity │ ongoing_        │    │
│  │ transaction│ _reservation  │ _access         │ entitlement     │    │
│  │ (POS)     │ (Bookings)    │ (Pool/Gym)      │ (Memberships)   │    │
│  └───────────┴───────────────┴─────────────────┴─────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Third-Party Services                           │    │
│  ├───────────────┬───────────────┬─────────────────────────────────┤    │
│  │ Stripe        │ Nodemailer    │ Sentry                          │    │
│  │ (Payments)    │ (Email)       │ (Error Tracking)                │    │
│  └───────────────┴───────────────┴─────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The 4-Engine Abstraction

All transactions in V2 flow through one of four unified engines. This replaces the legacy architecture where restaurant, pool, chalets, and snack were separate modules.

| Engine Type | TypeScript Name | Template | Pattern | State Machine |
|-------------|-----------------|----------|---------|---------------|
| **Instant Transaction** | `instant_transaction` | `menu_service` | Point-of-sale, immediate fulfillment | `pending → confirmed → preparing → ready → delivered → completed` |
| **Time-Exclusive Reservation** | `time_exclusive_reservation` | `multi_day_booking` | Date-range bookings with exclusive unit lock | `pending → confirmed → checked_in → checked_out` |
| **Shared Capacity Access** | `shared_capacity_access` | `session_access` | Capacity-limited shared sessions | `valid → active → used` |
| **Ongoing Entitlement** | `ongoing_entitlement` | `subscription` | Recurring memberships and subscriptions | `pending → active → paused → expired` |

### Engine Definition Files

```
backend/src/engines/
├── definitions/
│   ├── instant-transaction.ts         # POS orders, food service
│   ├── time-exclusive-reservation.ts  # Chalets, rooms
│   ├── shared-capacity-access.ts      # Pool sessions, gym access
│   └── ongoing-entitlement.ts         # Memberships, subscriptions
├── registry.ts                        # Engine factory & mapping
├── state-machine.ts                   # State transition logic
└── types.ts                           # TypeScript definitions
```

---

## Transaction Lifecycle

Every transaction follows the same pipeline:

```
1. Client Request
        ↓
2. Dynamic Module Router (resolves template → engine)
        ↓
3. Engine Resolution (TEMPLATE_TO_ENGINE mapping)
        ↓
4. State Machine Creation (createStateMachine(engineType))
        ↓
5. Pricing Pipeline (calculatePricing with taxes, discounts, loyalty)
        ↓
6. Idempotency Guard (X-Idempotency-Key check)
        ↓
7. Payment Processing (Stripe integration)
        ↓
8. Unified Transaction Record (transactions table — single source of truth)
        ↓
9. Real-time Event (Socket.io emit)
        ↓
10. Client Response (transaction_id, state, pricing breakdown)
```

> **Architecture Law**: All financial and access events are recorded exclusively in the `transactions` table with `engine_type` + `metadata` JSONB. There are no parallel per-engine tables (no `restaurant_orders`, `chalet_bookings`, `pool_tickets`). Any reference to such tables in older code or documentation is legacy and should be treated as a bug.

---

## Directory Structure

```
v2-resort/
├── backend/                 # Express.js API (Node 20, TypeScript 5.3)
│   ├── src/
│   │   ├── modules/         # 37 feature modules
│   │   ├── engines/         # 4 unified transaction engines
│   │   ├── services/        # Shared business services
│   │   ├── database/        # Connection, migrations, seeding
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # Route definitions
│   │   └── socket/          # Socket.io handlers
│   └── tests/               # 219 test files
│
├── frontend/                # Next.js 14 (TypeScript 5.4)
│   ├── src/
│   │   ├── app/             # 20+ App Router routes
│   │   ├── components/      # React components
│   │   ├── lib/             # Client utilities
│   │   ├── stores/          # Zustand state stores
│   │   └── types/           # TypeScript types
│   └── tests/               # 113 test files
│
├── mobile/                  # React Native 0.81.5 + Expo 54.0
├── shared/                  # Shared TypeScript types
├── supabase/                # 158 active SQL migrations
├── tests/                   # 90 Playwright E2E spec files
└── docs/                    # Documentation
```

---

## Backend Modules (37)

All modules located in `backend/src/modules/`:

| Category | Modules |
|----------|---------|
| **Core** | auth, users, admin, shared |
| **Commerce** | pos, inventory, payments, coupons, giftcards, promotions |
| **Reservations** | accommodations, bookings, groups, housekeeping |
| **Operations** | staff, manager, kiosk, devices, support |
| **Marketing** | marketing, messaging, loyalty, reviews |
| **Integrations** | channels, integrations, parity, multi-property, i18n |
| **Analytics** | analytics, reporting, revenue, economics, finance |
| **Compliance** | gdpr, public, mobile-checkin, customization |

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js 4.18
- **Language**: TypeScript 5.3
- **Database**: PostgreSQL 15 (Supabase)
- **ORM**: Drizzle 0.45
- **Real-time**: Socket.io 4.8 + Redis Adapter
- **Payments**: Stripe 14.25
- **Validation**: Zod 3.25
- **Testing**: Vitest
- **Security**: Helmet, CORS, CSRF, bcrypt, JWT, otplib

### Frontend
- **Framework**: Next.js 14.2 (App Router)
- **Language**: TypeScript 5.4
- **Styling**: Tailwind CSS 3.4
- **State**: Zustand 4.5, TanStack Query 5.28
- **UI**: Radix UI, Framer Motion
- **Forms**: React Hook Form + Zod
- **i18n**: next-intl 3.26
- **Testing**: Vitest

### Mobile
- **Framework**: React Native 0.81.5
- **Platform**: Expo 54.0
- **Testing**: Jest

### Infrastructure
- **Database**: Supabase PostgreSQL
- **Cache**: Redis 7
- **CI/CD**: GitHub Actions (10 stages)
- **E2E Testing**: Playwright (90 spec files)

---

## Security Architecture

1. **Authentication**: JWT with refresh tokens, stored in httpOnly cookies
2. **Authorization**: Role-based access control (RBAC) with 4 roles (admin, manager, staff, customer)
3. **Encryption**: bcrypt password hashing (cost 12)
4. **2FA**: TOTP-based two-factor authentication
5. **Rate Limiting**: Per-route request limits via Redis
6. **Input Validation**: Zod schemas on all API inputs
7. **CSRF Protection**: Token-based CSRF for state-changing operations
8. **Idempotency**: X-Idempotency-Key header for payment operations

---

## Data Flow Examples

### Example 1: POS Order (Instant Transaction)
```
Customer → Frontend → POST /api/v1/payments/intent
  → Engine: instant_transaction
  → State: pending → confirmed
  → Side Effect: Inventory deduction
  → Table: transactions (engine_type = 'instant_transaction')
```

### Example 2: Chalet Booking (Time-Exclusive Reservation)
```
Customer → Frontend → POST /api/bookings
  → Engine: time_exclusive_reservation
  → State: pending → confirmed → checked_in → checked_out
  → Side Effect: Calendar hold, housekeeping schedule
  → Table: transactions (engine_type = 'time_exclusive_reservation')
```

### Example 3: Pool Session (Shared Capacity Access)
```
Customer → Frontend → POST /api/pool/tickets
  → Engine: shared_capacity_access
  → State: valid → active → used
  → Side Effect: Capacity check, entry/exit logging
  → Table: transactions (engine_type = 'shared_capacity_access')
```

---

## Deployment

### Development

```bash
# Start all services
docker-compose up -d

# Or individually
cd backend && npm run dev     # Port 3005
cd frontend && npm run dev    # Port 3000
```

**Docker Services:**
- `postgres` (postgres:15-alpine, port 5432)
- `redis` (redis:7-alpine, port 6379)

### Production

- **Frontend**: Vercel
- **Backend**: Render / Railway / Docker
- **Database**: Supabase Cloud
- **Monitoring**: Sentry, OpenTelemetry

---

## Related Documentation

- [Control Flow](./control-flow.md) — Request lifecycle through engines
- [Dependency Graph](./dependency-graph.md) — Module dependencies
- [Subsystem Registry](../meta/subsystem-registry.md) — Module listing
- [Testing Guide](../guides/TESTING.md) — CI pipeline and test structure
- [API Reference](../api/API.md) — Endpoint documentation

---

## Configuration Tables — The Rule

The 4 engines govern **financial and access events**. Modules also need **configuration data** — what products exist, what time slots are available, what can be booked. These configuration tables are legitimate. But they must be **engine-generic, not module-specific.**

### The distinction

| ❌ Wrong — module-specific | ✅ Right — engine-generic |
|---|---|
| `pool_sessions` | `capacity_windows` |
| `menu_items` | `catalog_items` |
| `menu_categories` | Flat `category` text field on `catalog_items` |
| `snack_items` | `catalog_items` |
| `chalets` | `bookable_units` |
| `chalet_add_ons` | Metadata on `catalog_items` or `bookable_units` |

### The rule

**If a configuration table name contains a module word (`pool_`, `menu_`, `chalet_`, `snack_`, `restaurant_`), it is wrong.** Replace it with the generic equivalent.

### The test before naming any table

Ask: **"Could a hotel, a marina, a gym, and a cinema all use this table?"**

- Yes → the name belongs in the codebase.
- No → you are hardcoding a business type. Stop. Use the generic equivalent.

### Canonical configuration table per engine

| Engine | Configuration table | What it stores |
|---|---|---|
| `instant_transaction` | `catalog_items` | Orderable products with price and category |
| `time_exclusive_reservation` | `bookable_units` | Reservable units with base price and capacity |
| `shared_capacity_access` | `capacity_windows` | Time slots with max capacity and pricing |
| `ongoing_entitlement` | `membership_plans` | Subscription tiers with interval and pricing |

### What happens with `transactions`

All financial events flow through `transactions` regardless of engine. Configuration tables are read-only references — they define what exists. Transactions record what happened. Never duplicate financial state into a configuration table.

