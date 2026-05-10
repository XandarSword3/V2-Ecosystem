<!-- Last updated: 2026-05-10 -->

# Dependency & Architecture Graph

## 📦 System-Level Dependencies

The system is a monorepo with three applications and shared logic.

### 1. Backend (`@v2-resort/backend`)
**Role**: API Server, Event Broker, Data Access Layer, Engine Framework

**Core Dependencies:**
- **Runtime**: Node.js 20+, Express.js 4.18, TypeScript 5.3
- **Database**: PostgreSQL 15 (Supabase), `pg` driver, Drizzle ORM 0.45
- **Real-time**: Socket.io 4.8 + `@socket.io/redis-adapter`
- **Security**: Helmet, CORS, CSRF (`csurf`), bcryptjs, jsonwebtoken
- **Validation**: Zod 3.25
- **Observability**: Winston (logging), Sentry, OpenTelemetry

**Internal Coupling:**
- **37 Modules**: Located in `src/modules/*`, each with `controller.ts`, `routes.ts`, `index.ts`
- **Engine Framework**: `src/engines/*` — 4 unified transaction engines (see below)
- **Shared Layer**: All modules depend on `src/database`, `src/utils`, `src/middleware`

### 2. Frontend (`@v2-resort/frontend`)
**Role**: Client Application, Admin Dashboard, Kiosk Interface

**Core Dependencies:**
- **Framework**: Next.js 14.2 (App Router), React 18.3, TypeScript 5.4
- **State**: Zustand 4.5, TanStack Query 5.28
- **UI**: Tailwind CSS 3.4, Radix UI primitives, Framer Motion
- **Networking**: Axios, Socket.io-client
- **I18n**: next-intl 3.26

### 3. Mobile (`@v2-resort/mobile`)
**Role**: Native iOS/Android experience
- **Framework**: React Native 0.81.5, Expo 54.0
- **Navigation**: Expo Router
- **State**: Shares Zustand patterns with Frontend
- **Testing**: Jest, React Test Renderer

---

## ⚡ Engine Framework Dependencies

The 4-engine framework in `backend/src/engines/` is the core abstraction for all transactions:

```
Engine Dependencies:
├── definitions/
│   ├── instant-transaction.ts → inventory, pos modules
│   ├── time-exclusive-reservation.ts → accommodations, bookings modules
│   ├── shared-capacity-access.ts → (dynamic capacity management)
│   └── ongoing-entitlement.ts → loyalty, subscriptions
├── registry.ts → All 37 modules (via dynamic routing)
├── state-machine.ts → All engine types
└── types.ts → Shared types package
```

**Engine-to-Module Mapping:**
| Engine Type | Primary Modules | Database Table (via sync) |
|-------------|-----------------|---------------------------|
| `instant_transaction` | `pos`, `inventory`, `orders` | `restaurant_orders` |
| `time_exclusive_reservation` | `accommodations`, `bookings`, `housekeeping` | `chalet_bookings` |
| `shared_capacity_access` | Dynamic capacity modules | `pool_tickets` |
| `ongoing_entitlement` | `loyalty`, `promotions` | `membership_subscriptions` |

---

## 🔗 Cross-Module Dependencies

| Source | Target | Protocol | Purpose |
|--------|--------|----------|---------|
| **Frontend** | **Backend** | HTTP/REST | API calls (port 3005) |
| **Frontend** | **Backend** | WebSocket | Real-time events |
| **Backend** | **Supabase** | TCP/5432 | Database queries |
| **Backend** | **Redis** | TCP/6379 | Sessions, Socket pub/sub |
| **Backend** | **Stripe** | HTTPS | Payment processing |
| **Mobile** | **Backend** | HTTP/REST | API calls |

---

## 📐 Module Dependency Graph

### Core Infrastructure (All modules depend on these)
```
backend/src/
├── database/ → All 37 modules
├── middleware/
│   ├── auth.ts → All protected routes
│   ├── validation.ts → All API endpoints
│   └── rate-limit.ts → All public endpoints
├── utils/
│   ├── logger.ts → All modules
│   └── errors.ts → All modules
└── engines/
    ├── registry.ts → Dynamic module router
    └── state-machine.ts → Transaction controllers
```

### Feature Module Clusters

**Reservation Cluster:**
```
accommodations ↔ bookings ↔ housekeeping
      ↕              ↕           ↕
    payments ←→ analytics ←→ reporting
```

**Commerce Cluster:**
```
pos ↔ inventory ↔ payments
  ↕        ↕          ↕
orders ←→ coupons ←→ giftcards
```

**Customer Cluster:**
```
users ↔ auth ↔ loyalty
  ↕       ↕      ↕
marketing ←→ messaging
```

**Operations Cluster:**
```
staff ↔ manager ↔ admin
  ↕        ↕        ↕
kiosk ←→ channels ←→ integrations
```

---

## 🔄 Dynamic Routing Architecture

The `dynamic-module.router.ts` decouples route registration from engine implementation:

```
Request Flow:
POST /api/[module]/[action]
    ↓
dynamic-module.router.ts
    ↓
Template Resolution (module template_type)
    ↓
Engine Resolution (TEMPLATE_TO_ENGINE mapping)
    ↓
State Machine Creation (createStateMachine(engineType))
    ↓
Controller Execution (engine-specific logic)
    ↓
Unified Transaction Record (transactions table)
    ↓
Sync Trigger (updates source table)
```

**Benefit**: New modules using existing templates require **zero** backend route changes.

---

## 📊 Dependency Metrics

| Metric | Count |
|--------|-------|
| Backend Modules | 37 |
| Engine Types | 4 |
| Frontend Routes | 20+ |
| Test Files (Backend) | 219 |
| Test Files (Frontend) | 113 |
| E2E Spec Files | 90 |
| Database Migrations | 160 active |
| CI Pipeline Stages | 7 |

---

## 🔗 Related Documentation

- [Control Flow](./control-flow.md) — Request lifecycle
- [Subsystem Registry](../meta/subsystem-registry.md) — Module listing
- [Testing Guide](../guides/TESTING.md) — Test infrastructure
