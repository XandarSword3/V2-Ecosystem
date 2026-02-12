# Dependency & Architecture Graph

## 📦 System-Level Dependencies

The system is a Monorepo with two primary applications and shared logic.

### 1. Backend (`@v2-resort/backend`)
**Role**: API Server, Event Broker, Data Access Layer.

**Core Dependencies:**
*   **Runtime**: `node.js` (v20+), `express` (v4.18)
*   **Database**: `@supabase/supabase-js`, `pg` (PostgreSQL), `prisma/drizzle` (ORM hybrid)
*   **Real-time**: `socket.io` (v4.8) + `@socket.io/redis-adapter`
*   **Security**: `helmet`, `cors`, `csurf` (CSRF), `bcryptjs`, `jsonwebtoken`
*   **Validation**: `zod` (v3.25)
*   **Observability**: `winston` (Logging), `@sentry/node`, `@opentelemetry/*`

**Internal Coupling:**
*   **Modules**: The backend uses a "Modular Monolith" pattern. `app.ts` aggregates routes from `modules/*`.
*   **Shared Logic**: All modules depend on `src/database`, `src/utils`, and `src/middleware`.

### 2. Frontend (`@v2-resort/frontend`)
**Role**: Client Application, Admin Dashboard, Kiosk Interface.

**Core Dependencies:**
*   **Framework**: `next.js` (v14.2 App Router), `react` (v18.3)
*   **State Management**: `zustand` (v4.5), `@tanstack/react-query` (Server State)
*   **UI System**: `tailwindcss`, `radix-ui` (Headless Primitives), `framer-motion`
*   **Networking**: `axios`, `socket.io-client`
*   **I18n**: `next-intl`

### 3. Mobile (`@v2-resort/mobile`)
**Role**: Native experience (likely React Native/Expo).
*   **Framework**: Expo / React Native.
*   **State**: Shares patterns with Frontend.

## 🔗 Cross-Module Dependencies

| Source | Target | interaction Type | Data |
|--------|--------|------------------|------|
| **Frontend** | **Backend** | HTTP/REST | JSON (Zod Validated) |
| **Frontend** | **Backend** | WebSocket (Socket.io) | Events (`order:status`, `user:presence`) |
| **Backend** | **Supabase** | TCP/5432 | SQL Queries |
| **Backend** | **Redis** | TCP/6379 | Session Store, Socket Pub/Sub |
| **Backend** | **Stripe** | HTTPS | Payments & Webhooks |

## 📐 Static Analysis (Imports)

The inspection of `backend/src/app.ts` reveals a **Centralized Registry** pattern:
*   `app.ts` is the dependency root.
*   It imports routes from: `admin`, `auth`, `chalets`, `pool`, `restaurant`, `inventory`, `staff`, `users`, etc.
*   **Risk**: `app.ts` couples the startup phase to *all* modules. A syntax error in `snack.routes.ts` prevents the `admin` module from starting (Monolithic startup).
