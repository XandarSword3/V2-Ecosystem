# PHASE 1: COMPLETE SYSTEM MAP

> **Purpose**: Exhaustive audit of every path through the V2 Resort Management System.  
> **Scope**: Backend (`v2-resort/backend/src/`) — all modules, routes, roles, state machines, side effects, failure paths, and automated processes.  
> **Method**: Generated from direct source code analysis. No speculation.  
> **Date**: June 2025

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Complete Module & Route Inventory](#2-complete-module--route-inventory)
3. [Roles, Permissions & Authorization](#3-roles-permissions--authorization)
4. [Entity State Machines & Lifecycles](#4-entity-state-machines--lifecycles)
5. [Cross-Module Side Effects & Boundary Crossings](#5-cross-module-side-effects--boundary-crossings)
6. [Failure Paths & Error Handling](#6-failure-paths--error-handling)
7. [Concurrency, Race Conditions & Transaction Boundaries](#7-concurrency-race-conditions--transaction-boundaries)
8. [Idempotency Coverage](#8-idempotency-coverage)
9. [Automated Processes & Scheduled Tasks](#9-automated-processes--scheduled-tasks)
10. [Dead Code & Uninitialized Systems](#10-dead-code--uninitialized-systems)
11. [Critical Risk Register](#11-critical-risk-register)
12. [Verification Requirements Summary](#12-verification-requirements-summary)

---

## 1. System Architecture Overview

### 1.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js, TypeScript |
| Framework | Express.js |
| Database | PostgreSQL via Supabase |
| ORM | Supabase Client (PostgREST) + raw RPCs |
| Real-time | Socket.IO |
| Payments | Stripe |
| Email | Nodemailer |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Testing | Vitest (6,767 tests; 6,723 passing) |
| Monitoring | Sentry |
| Auth | Supabase Auth (JWT) |

### 1.2 Global Middleware Chain (request processing order)

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | Sentry request handler | Error tracking context |
| 2 | Helmet | Security headers |
| 3 | CORS | Cross-origin access control |
| 4 | Compression | Response compression |
| 5 | Cookie Parser | Cookie deserialization |
| 6 | `express.json({ limit: '10mb' })` | Body parsing |
| 7 | CSRF protection | Cross-site request forgery prevention |
| 8 | Morgan | HTTP request logging |
| 9 | Health check routes | `/health`, `/api/health`, `/health/ready` |
| 10 | ~44 module route mounts | Under `/api/v1/` |
| 11 | Channel webhook routes | Under `/webhooks/channels` |
| 12 | 404 handler | Unmatched routes |
| 13 | Global error handler | Centralized error responses |

### 1.3 Rate Limiting

| Target | Limiter Applied |
|--------|-----------------|
| Auth routes | Rate-limited |
| Financial operations | Rate-limited |
| Booking operations | Rate-limited |
| Order operations | Rate-limited |
| File uploads | Rate-limited |
| Backup operations | Rate-limited |

### 1.4 Engine Framework

Four engine types govern transactional entity lifecycles:

| Engine | Template Name | Governs | Key Pattern |
|--------|--------------|---------|-------------|
| A — Instant Transaction | `menu_service` | Restaurant orders, snack orders | Create → prepare → deliver → complete |
| B — Time-Exclusive Reservation | `multi_day_booking` | Chalet bookings | Reserve → confirm → check-in → check-out |
| C — Shared Capacity Access | `session_access` | Pool tickets | Purchase → validate → use → exit |
| D — Ongoing Entitlement | `subscription` | Memberships (planned) | Activate → renew/pause → expire/cancel |

---

## 2. Complete Module & Route Inventory

### 2.1 Module Summary

**47 route files total. 44 actively mounted. 3 unmounted.**

| # | Module | Mount Path | Route Count | Auth Level |
|---|--------|-----------|-------------|------------|
| 1 | Auth | `/api/v1/auth` | 20+ | Mixed (public + authenticated) |
| 2 | Admin | `/api/v1/admin` | 60+ | Admin/Super Admin |
| 3 | Chalets | `/api/v1/chalets` | 20+ | Mixed |
| 4 | Pool | `/api/v1/pool` | 30+ | Mixed |
| 5 | Restaurant | `/api/v1/restaurant` | 40+ | Mixed |
| 6 | Snack | `/api/v1/snack` | 15 | Mixed |
| 7 | Payments | `/api/v1/payments` | 18+ | Mixed (webhook public) |
| 8 | Loyalty | `/api/v1/loyalty` | 18 | Mixed |
| 9 | Coupons | `/api/v1/coupons` | 10 | Mixed |
| 10 | Gift Cards | `/api/v1/giftcards` | 16 | Mixed |
| 11 | Housekeeping | `/api/v1/housekeeping` | 17 | Staff/Admin |
| 12 | Inventory | `/api/v1/inventory` | 22 | Staff/Admin |
| 13 | Staff | `/api/v1/staff` | 25+ | Manager/Admin |
| 14 | Support | `/api/v1/support` | 2 | Public |
| 15 | Finance | `/api/v1/finance` | 4 | Admin |
| 16 | Reporting | `/api/v1/reporting` | 30+ | Admin/Manager |
| 17 | Revenue | `/api/v1/revenue` | 25+ | Admin/Manager |
| 18 | Groups | `/api/v1/groups` | 20 | Mixed |
| 19 | Marketing | `/api/v1/marketing` | 30+ | Admin |
| 20 | Kiosk | `/api/v1/kiosk` | 25 | Admin/Staff |
| 21 | Messaging | `/api/v1/messaging` | 25 | Mixed |
| 22 | i18n | `/api/v1/i18n` | 20+ | Admin/Manager |
| 23 | GDPR | `/api/v1/gdpr` | 18 | Authenticated |
| 24 | Channels | `/api/v1/channels` | 17 | Admin |
| 25 | Rate Parity | `/api/v1/rate-parity` | 10 | Admin |
| 26 | Multi-Property | `/api/v1/multi-property` | 15 | Admin |
| 27 | Customization | `/api/v1/customization` | 20+ | Admin |
| 28 | POS | `/api/v1/pos` | 12 | Staff/Admin |
| 29 | Mobile Check-in | `/api/v1/mobile-checkin` | 25 | Mixed |
| 30 | Promotions | `/api/v1/promotions` | 12 | Staff/Admin |
| 31 | Users | `/api/v1/users` | 8 | Admin |
| 32 | Bookings | `/api/v1/bookings` | 6 | Mixed |
| 33 | Devices | `/api/v1/devices` | 6 | Admin |
| 34 | Reviews | `/api/v1/reviews` | 7 | Mixed |
| 35 | Kitchen Display | `/api/v1/kitchen` | 8+ | Kitchen Staff |
| 36 | Restaurant Tables | `/api/v1/restaurant/tables` | 10+ | Staff/Admin |
| 37 | Restaurant Waitlist | `/api/v1/restaurant/waitlist` | 8+ | Staff/Admin |
| 38 | Restaurant Reservations | `/api/v1/restaurant/reservations` | 8+ | Mixed |
| 39 | Restaurant Modifiers | `/api/v1/restaurant/modifiers` | 6+ | Admin |
| 40 | Tabs | `/api/v1/restaurant/tabs` | 10+ | Staff |
| 41 | Notifications | `/api/v1/notifications` | 8+ | Admin |
| 42 | Tax Settings | `/api/v1/admin/tax` | 4+ | Admin |
| 43 | Platform Payments | `/api/v1/platform/payments` | 4+ | Admin |
| 44 | Health | `/health`, `/api/health`, `/health/ready` | 3-4 | Public |

**Unmounted (dead) route files:**
- QuickBooks integration
- Accommodations module
- Unsubscribe routes

### 2.2 Route Access Classification

| Category | Approximate Count | Description |
|----------|-------------------|-------------|
| Public (no auth) | ~65 | Menu viewing, availability checks, health, webhooks, support |
| Authenticated (any role) | ~80 | Profile, order placement, booking creation |
| Role-restricted | ~300+ | Staff operations, admin panels, management |

### 2.3 Key Route Details by Module

#### Auth Module (~20 routes)
- `POST /register` — public, creates user account
- `POST /login` — public, returns JWT
- `POST /logout` — authenticated
- `POST /refresh-token` — authenticated
- `POST /forgot-password` — public
- `POST /reset-password` — public (with reset token)
- `POST /change-password` — authenticated
- `POST /verify-email` — public (with verification token)
- `GET /me` — authenticated, returns current user profile
- `PUT /me` — authenticated, updates profile
- `POST /biometric/register-challenge` — authenticated
- `POST /biometric/register-verify` — authenticated
- `POST /biometric/login-challenge` — public
- `POST /biometric/login-verify` — public
- `POST /2fa/setup` — authenticated
- `POST /2fa/verify` — authenticated
- `POST /2fa/disable` — authenticated
- `GET /sessions` — authenticated
- `DELETE /sessions/:id` — authenticated
- `POST /social/:provider` — public

#### Payment Module (~18 routes)
- `POST /create-intent` — authenticated, creates Stripe PaymentIntent
- `POST /webhook/stripe` — public (Stripe signature verified), webhook receiver
- `GET /history` — authenticated, user payment history
- `GET /:id` — authenticated, payment details
- `POST /refund/:id` — admin, initiates refund
- `POST /record-cash` — staff, records cash payment
- `POST /record-manual` — staff, records manual payment
- `GET /methods` — authenticated, saved payment methods
- `POST /methods` — authenticated, add payment method
- `DELETE /methods/:id` — authenticated, remove payment method
- `GET /analytics` — admin, payment analytics
- `POST /platform/connect` — super_admin, Stripe Connect
- `POST /platform/transfer` — super_admin, platform transfer
- `GET /platform/balance` — super_admin, platform balance
- `POST /chargebacks/:id/evidence` — admin, submit dispute evidence
- `GET /chargebacks` — admin, list chargebacks
- `GET /chargebacks/:id` — admin, chargeback details

#### Chalet Module (~20 routes)
- `GET /` — public, list chalets
- `GET /:id` — public, chalet details
- `GET /:id/availability` — public, check availability
- `POST /bookings` — authenticated, create booking
- `GET /bookings` — authenticated, list user's bookings
- `GET /bookings/:id` — authenticated, booking details
- `PUT /bookings/:id` — staff/admin, update booking
- `PUT /bookings/:id/status` — staff/admin, change status
- `POST /bookings/:id/cancel` — authenticated (owner or admin)
- `PUT /bookings/:id/modify` — staff/admin, modify booking
- `POST /` — admin, create chalet
- `PUT /:id` — admin, update chalet
- `DELETE /:id` — admin, soft-delete chalet
- `GET /admin/bookings` — admin, all bookings
- `GET /admin/dashboard` — admin, booking dashboard
- `POST /:id/amenities` — admin, manage amenities
- `POST /:id/images` — admin, manage images
- `POST /:id/pricing` — admin, set pricing rules

#### Pool Module (~30 routes)
- `GET /sessions` — public, list pool sessions
- `GET /sessions/:id` — public, session details
- `POST /sessions` — admin, create session (via RPC)
- `PUT /sessions/:id` — admin, update session (via RPC)
- `DELETE /sessions/:id` — admin, soft-delete session
- `POST /tickets` — authenticated, purchase ticket
- `GET /tickets` — authenticated, user's tickets
- `GET /tickets/:id` — authenticated, ticket details
- `POST /tickets/:id/cancel` — authenticated
- `POST /tickets/:id/entry` — staff, record entry
- `POST /tickets/:id/exit` — staff, record exit
- `GET /occupancy` — staff, current occupancy
- `POST /occupancy/reset` — admin, reset occupancy counter
- `POST /memberships` — authenticated, create membership
- `GET /memberships` — admin, list memberships
- `PUT /memberships/:id` — admin, update membership
- `GET /settings` — admin, pool settings
- `PUT /settings` — admin, update settings
- `GET /admin/tickets` — admin, all tickets
- `GET /admin/dashboard` — admin, pool dashboard
- `GET /admin/analytics` — admin, analytics

#### Restaurant Order Module (~40 routes)
- `GET /menu` — public, view menu
- `GET /menu/:id` — public, item details
- `POST /menu` — admin, create menu item
- `PUT /menu/:id` — admin, update menu item
- `DELETE /menu/:id` — admin, soft-delete menu item
- `POST /menu/categories` — admin, create category
- `PUT /menu/categories/:id` — admin, update category
- `DELETE /menu/categories/:id` — admin, soft-delete category
- `POST /orders` — authenticated, place order
- `GET /orders` — authenticated, user's orders
- `GET /orders/:id` — authenticated, order details
- `PUT /orders/:id/status` — staff, update order status
- `POST /orders/:id/cancel` — authenticated (owner or staff)
- `POST /orders/:id/void` — admin, void order
- `POST /orders/:id/comp` — admin, comp order
- `GET /orders/:id/history` — staff, order status history
- `GET /admin/orders` — admin, all orders
- `GET /admin/dashboard` — admin, restaurant dashboard
- `POST /tables` — admin, create table
- `PUT /tables/:id` — admin, update table
- `PUT /tables/:id/status` — staff, update table status
- `GET /tables` — staff, list tables
- `POST /waitlist` — public, join waitlist
- `GET /waitlist` — staff, view waitlist
- `PUT /waitlist/:id` — staff, update waitlist entry
- `POST /reservations` — authenticated, make reservation
- `GET /reservations` — staff, list reservations
- `PUT /reservations/:id` — staff, update reservation
- `POST /modifiers` — admin, create modifier
- `PUT /modifiers/:id` — admin, update modifier
- `GET /modifiers` — staff, list modifiers
- `POST /tabs` — staff, open tab
- `PUT /tabs/:id` — staff, update tab
- `POST /tabs/:id/close` — staff, close tab
- `POST /tabs/transfer` — staff, transfer tab
- `POST /tabs/merge` — staff, merge tabs

#### Loyalty Module (~18 routes)
- `POST /members` — authenticated, enroll in loyalty
- `GET /members/me` — authenticated, self-lookup
- `GET /members/:id` — admin, member details
- `GET /members` — admin, list all members
- `POST /earn` — staff/admin, earn points for purchase
- `POST /redeem` — staff/admin, redeem points
- `POST /adjust` — admin, manual adjustment
- `GET /tiers` — public, view tier structure
- `POST /tiers` — admin, create tier
- `PUT /tiers/:id` — admin, update tier
- `GET /transactions` — authenticated, point transaction history
- `GET /analytics` — admin, loyalty analytics
- `GET /leaderboard` — public, loyalty leaderboard
- `PUT /members/:id` — admin, update member
- `POST /rewards` — admin, create reward
- `GET /rewards` — public, available rewards
- `PUT /rewards/:id` — admin, update reward
- `POST /rewards/:id/claim` — authenticated, claim reward

---

## 3. Roles, Permissions & Authorization

### 3.1 Formally Defined Roles (16 roles in `src/security/permissions.ts`)

| # | Role | Scope | Description |
|---|------|-------|-------------|
| 1 | `customer` | End-user | Guest/patron of the resort |
| 2 | `guest` | Unauthenticated | Limited read-only access |
| 3 | `restaurant_staff` | Module | Restaurant floor staff |
| 4 | `snack_bar_staff` | Module | Snack bar staff |
| 5 | `chalet_staff` | Module | Chalet operations staff |
| 6 | `pool_staff` | Module | Pool operations staff |
| 7 | `housekeeping_staff` | Module | Housekeeping staff |
| 8 | `bar_staff` | Module | Bar staff |
| 9 | `kitchen_staff` | Module | Kitchen staff |
| 10 | `restaurant_admin` | Module admin | Restaurant management |
| 11 | `snack_bar_admin` | Module admin | Snack bar management |
| 12 | `chalet_admin` | Module admin | Chalet management |
| 13 | `pool_admin` | Module admin | Pool management |
| 14 | `manager` | System-wide | Cross-module management |
| 15 | `admin` | System-wide | Full system administration |
| 16 | `super_admin` | God-mode | Wildcard `'*'` — all permissions |

### 3.2 Ghost Roles (used in `authorize()` but NOT in `RolePermissions` enum)

These roles appear in route-level `authorize()` calls but have **no entry** in the permission matrix. They pass role-based auth (`authorize()`) but will always fail permission-based auth (`requirePermission()`).

| Ghost Role | Where Used |
|-----------|-----------|
| `chef` | Kitchen routes |
| `server` | Kitchen routes (order bump) |
| `front_desk` | Mobile check-in, kiosk, i18n routes |
| `housekeeping` | Staff module, mobile check-in |
| `hotel_staff` | Staff module |
| `maintenance` | Kiosk routes |
| `staff` (generic) | Restaurant, pool, chalet, housekeeping, promotions, loyalty, waitlist routes |

**Audit finding**: Any route guarded by `authorize('front_desk')` will allow that user in, but if the same route also calls `requirePermission('admin:read')`, it will fail because `front_desk` has no permissions in the matrix.

### 3.3 Permission Slugs (53 defined)

| Domain | Permissions |
|--------|------------|
| User | `user:read`, `user:write`, `user:delete` |
| Restaurant | `restaurant:read`, `restaurant:write`, `restaurant:manage`, `restaurant:order:create`, `restaurant:order:update`, `restaurant:order:cancel` |
| Chalet | `chalet:read`, `chalet:write`, `chalet:manage`, `chalet:booking:create`, `chalet:booking:update`, `chalet:booking:cancel` |
| Pool | `pool:read`, `pool:write`, `pool:manage`, `pool:ticket:create`, `pool:ticket:update`, `pool:ticket:cancel` |
| Snack | `snack:read`, `snack:write`, `snack:manage` |
| Payment | `payment:read`, `payment:process`, `payment:refund` |
| Loyalty | `loyalty:read`, `loyalty:earn`, `loyalty:redeem`, `loyalty:manage` |
| Gift Card | `giftcard:read`, `giftcard:create`, `giftcard:redeem`, `giftcard:manage` |
| Coupon | `coupon:read`, `coupon:create`, `coupon:manage` |
| Support | `support:read`, `support:write`, `support:manage` |
| Review | `review:read`, `review:moderate`, `review:delete` |
| Housekeeping | `housekeeping:read`, `housekeeping:write`, `housekeeping:manage` |
| Inventory | `inventory:read`, `inventory:write`, `inventory:manage` |
| Admin | `admin:read`, `admin:write`, `admin:manage` |
| Device | `device:read`, `device:manage` |
| Notification | `notification:send`, `notification:manage` |

### 3.4 Role → Permission Matrix

| Role | Permissions |
|------|------------|
| `super_admin` | `'*'` (wildcard — ALL permissions) |
| `admin` | All 53 permissions explicitly |
| `manager` | All read/write/manage except `user:delete`, `admin:manage` |
| `restaurant_admin` | `restaurant:*`, `snack:*`, `payment:read/process`, `loyalty:read/earn`, `review:read/moderate`, `inventory:read/write`, `housekeeping:read` |
| `restaurant_staff` | `restaurant:read/write`, `restaurant:order:create/update`, `payment:read`, `loyalty:earn`, `review:read`, `inventory:read` |
| `chalet_admin` | `chalet:*`, `payment:read/process`, `loyalty:read/earn`, `housekeeping:read/write/manage`, `review:read/moderate`, `inventory:read/write` |
| `chalet_staff` | `chalet:read/write`, `chalet:booking:create/update`, `payment:read`, `loyalty:earn`, `housekeeping:read/write`, `review:read` |
| `pool_admin` | `pool:*`, `payment:read/process`, `loyalty:read/earn`, `review:read/moderate`, `inventory:read/write` |
| `pool_staff` | `pool:read/write`, `pool:ticket:create/update`, `payment:read`, `loyalty:earn`, `review:read`, `inventory:read` |
| `snack_bar_admin` | `snack:*`, `restaurant:read`, `payment:read/process`, `loyalty:read/earn`, `inventory:read/write` |
| `snack_bar_staff` | `snack:read/write`, `restaurant:read`, `payment:read`, `loyalty:earn`, `inventory:read` |
| `housekeeping_staff` | `housekeeping:read/write`, `chalet:read` |
| `kitchen_staff` | `restaurant:read`, `inventory:read` |
| `bar_staff` | `restaurant:read`, `snack:read`, `payment:read`, `inventory:read` |
| `customer` | `restaurant:read`, `restaurant:order:create`, `chalet:read`, `chalet:booking:create`, `pool:read`, `pool:ticket:create`, `snack:read`, `loyalty:read/earn/redeem`, `giftcard:read/redeem`, `coupon:read`, `support:read/write`, `review:read` |
| `guest` | `restaurant:read`, `chalet:read`, `pool:read`, `snack:read`, `review:read` |

### 3.5 Route-Level Role Arrays

| Module | Staff Roles | Admin Roles |
|--------|------------|-------------|
| Restaurant | `staff`, `restaurant_staff`, `restaurant_admin`, `snack_bar_staff`, `snack_bar_admin`, `chalet_staff`, `chalet_admin`, `pool_staff`, `pool_admin`, `super_admin` | `restaurant_admin`, `snack_bar_admin`, `chalet_admin`, `pool_admin`, `admin`, `super_admin` |
| Snack | `snack_bar_staff`, `snack_bar_admin`, `super_admin` | `snack_bar_admin`, `super_admin` |
| Pool | `staff`, `pool_staff`, `pool_admin`, `super_admin` | `pool_admin`, `super_admin` |
| Chalet | `staff`, `chalet_staff`, `chalet_admin`, `super_admin` | `chalet_admin`, `super_admin` |
| Staff Mgmt | — | `admin`, `super_admin`, `manager` |
| POS | `admin`, `super_admin`, `manager`, `staff` | Same |
| Payment | All module staff + admins + `super_admin` | `super_admin` only |
| Kitchen | `kitchen_staff`, `chef`, `admin` | — |
| Mobile Check-in | — | `admin`, `manager`, `front_desk` |
| Kiosk | — | `admin`, `manager`, `front_desk`, `maintenance` |

### 3.6 Authorization Mechanisms (5 distinct)

| # | Mechanism | Type | Location | Behavior |
|---|-----------|------|----------|----------|
| 1 | `authorize(...roles)` | Role-based, in-memory | `auth.middleware.ts` | Checks if `req.user.role` is in listed roles OR is `super_admin` |
| 2 | `requirePermission(slug)` (v1) | Permission-based, in-memory | `permission.middleware.ts` | Checks against `RolePermissions` map from `permissions.ts` |
| 3 | `requirePermission(slug)` (v2) | Permission-based, DB lookup | `auth.middleware.ts` | Checks against `app_role_permissions` table. Bypasses for `super_admin` |
| 4 | `ownerOrAdmin(field)` | Ownership-based | `auth.middleware.ts` | Allows if user owns resource or is admin/super_admin |
| 5 | `optionalAuth()` | Non-blocking | `auth.middleware.ts` | Attaches user if token present, continues regardless |

**CONFLICT**: Two different `requirePermission` implementations exist. Which is used depends on which middleware file a route imports from. This is an inconsistency that needs auditing per-route.

---

## 4. Entity State Machines & Lifecycles

### 4.1 Engine-Governed Entities (formal `StateMachine` class)

The `StateMachine<TStatus>` class (`src/engines/state-machine.ts`, 297 lines) provides:
- Typed states with `from → to` transition maps
- Guard functions (sync/async) that can block transitions
- Side effect functions (fire-and-forget, post-transition)
- `canTransition()`, `transition()`, `getAvailableActions()` methods
- Throws `StateMachineError` on invalid transitions

#### Engine A: Instant Transaction (Restaurant/Snack Orders)

**Tables**: `restaurant_orders`, `snack_orders`

```
                                        ┌──────────────┐
                                        │   cancelled   │
                                        └──────────────┘
                                              ▲
         ┌────────┐   ┌───────────┐   ┌────────────┐   ┌───────┐   ┌───────────┐   ┌───────────┐
         │ pending │──▶│ confirmed │──▶│ preparing  │──▶│ ready │──▶│ delivered │──▶│ completed │
         └────────┘   └───────────┘   └────────────┘   └───────┘   └───────────┘   └───────────┘
              │              │              │                │                             ▲
              └──cancel──────┘──cancel──────┘                └─────────complete_takeaway───┘
```

| Transition | From → To | Allowed By | Side Effects |
|-----------|-----------|-----------|-------------|
| `confirm` | pending → confirmed | staff, system | Status history, socket emit |
| `start_preparing` | confirmed → preparing | staff, system | Status history, socket emit |
| `mark_ready` | preparing → ready | staff | Status history, socket emit |
| `deliver` | ready → delivered | staff | Status history, socket emit |
| `complete` | delivered → completed | staff, system | `payment_status = 'paid'`, status history, socket emit |
| `complete_takeaway` | ready → completed | staff, system | Same as complete (skip delivery) |
| `cancel` | pending → cancelled | customer, staff, admin | `cancelled_at` timestamp, status history, socket emit |
| `cancel_confirmed` | confirmed → cancelled | staff, admin | Triggers refund process |
| `cancel_preparing` | preparing → cancelled | admin only | Requires refund + inventory reversal |

**Extended statuses in actual code** (not in engine definition):
- `served` — used in timestamp tracking
- `voided` — order voided (`payment_status = 'voided'`)
- `comped` — order comped (`payment_status = 'comped'`)

**Pricing Pipeline**: tax → service charge (dine-in only) → delivery fee → coupon discount → gift card redemption → loyalty point redemption → loyalty points earned → inventory deduction

#### Engine B: Time-Exclusive Reservation (Chalet Bookings)

**Table**: `chalet_bookings`

```
         ┌────────┐   ┌───────────┐   ┌────────────┐   ┌─────────────┐
         │ pending │──▶│ confirmed │──▶│ checked_in │──▶│ checked_out │
         └────────┘   └───────────┘   └────────────┘   └─────────────┘
              │    ╲         │              ▲
              │     ╲        │    walk_in   │
              │      ╲       │─────────────┘
              │       ╲      │
              ▼        ▼     ▼
         ┌───────────┐  ┌─────────┐
         │ cancelled │  │ no_show │
         └───────────┘  └─────────┘
```

| Transition | From → To | Allowed By | Side Effects |
|-----------|-----------|-----------|-------------|
| `confirm` | pending → confirmed | staff, system | Activity log, socket emit |
| `check_in` | confirmed → checked_in | staff | Socket `booking:checked_in` |
| `walk_in_check_in` | pending → checked_in | staff, admin | Skip confirmation |
| `check_out` | checked_in → checked_out | staff | **Creates housekeeping task** (pending), socket emit |
| `cancel_pending` | pending → cancelled | customer, staff, admin | Activity log, socket emit |
| `cancel_confirmed` | confirmed → cancelled | customer, staff, admin | May incur cancellation fee |
| `mark_no_show` | pending → no_show | staff, system | Activity log |
| `mark_no_show_confirmed` | confirmed → no_show | staff, system | Activity log |

#### Engine C: Shared Capacity Access (Pool Tickets)

**Table**: `pool_tickets`

```
         ┌───────┐   ┌────────┐   ┌──────┐
         │ valid │──▶│ active │──▶│ used │
         └───────┘   └────────┘   └──────┘
              │                        
              ├──▶ expired (auto, cron)
              │
              └──▶ cancelled
```

| Transition | From → To | Allowed By | Side Effects |
|-----------|-----------|-----------|-------------|
| `validate_entry` | valid → active | staff, system | **Increments pool occupancy**, socket emit |
| `record_exit` | active → used | staff, system | **Decrements pool occupancy**, socket emit |
| `cancel` | valid → cancelled | customer, staff, admin | Socket emit |
| `expire` | valid → expired | system (cron) | Audit log entry |

#### Engine D: Ongoing Entitlement (Subscriptions/Memberships) — PLANNED

**Table**: Not yet created

```
         ┌─────────┐   ┌────────┐   ┌────────┐   ┌─────────┐
         │ pending │──▶│ active │◀─▶│ paused │──▶│ expired │
         └─────────┘   └────────┘   └────────┘   └─────────┘
              │              │           │              │
              └──cancel──────┘───cancel──┘              │
                             │                          │
                        ┌───────────┐                   │
                        │ cancelled │◀──────cancel───────┘
                        └───────────┘
              
              active → active (renew, self-transition)
              expired → active (reactivate, within grace period)
```

### 4.2 Non-Engine Entity Lifecycles (no formal state machine)

#### Restaurant Reservation
**States**: `PENDING → CONFIRMED → SEATED → COMPLETED`  
**Cancel**: `PENDING → CANCELLED`, `CONFIRMED → CANCELLED`  
**No-show**: `PENDING → NO_SHOW`, `CONFIRMED → NO_SHOW`

#### Restaurant Table Status
**States**: `AVAILABLE → RESERVED → OCCUPIED → CLEANING → AVAILABLE`  
**Out of service**: Any → `OUT_OF_SERVICE`

#### Housekeeping Task
**States**: `pending → in_progress → completed`  
**Pause**: `in_progress → on_hold → in_progress`  
**Cancel**: Any → `cancelled`  
**Auto-trigger**: Created on chalet check-out with status `pending`

#### Staff Shift
**States**: `scheduled → active (clock-in) → completed (clock-out)`  
**Missed**: `scheduled → missed` (no clock-in by end of shift)  
**Additional fields**: `clock_in_time`, `clock_out_time`, `overtime_approved`

#### Shift Swap Request
**States**: `pending → accepted/rejected (by target) → approved/rejected (by manager)`  
**Flow**: Staff requests → target responds → manager approves → shifts swapped  
**Cancel**: Requester can cancel while `pending`

#### Review
**States**: `pending → approved`  
**Flow**: User submits → admin moderates → approve or delete

#### Gift Card
**States**: `active → redeemed` (when balance = 0)  
**Other states**: `expired`, `disabled`, `cancelled`, `suspended`  
**Auto-transition**: `UPDATE ... SET status = CASE WHEN balance <= 0 THEN 'redeemed' ELSE 'active' END`

#### Coupon
**No formal status** — uses `is_active` boolean + date range (`valid_from`/`valid_until`) + usage count (`times_used` vs `max_uses`)

#### Support Inquiry
**Single state**: `new` — simple contact form, not a ticket system

#### Order Payment Status
**States**: `pending → partial → paid → refunded`  
**Alternate**: `→ voided`, `→ comped`

---

## 5. Cross-Module Side Effects & Boundary Crossings

### 5.1 Order Creation Side Effects (6 cross-module effects)

| # | Trigger | Target Module | Effect | Mechanism |
|---|---------|--------------|--------|-----------|
| 1 | Order created | Inventory | Deduct ingredients | RPC `deduct_inventory_for_order_v2` → `inventory_transactions` |
| 2 | Order created | Kitchen | Propagate KDS items | `propagateToKitchen()` function call |
| 3 | Order created | Loyalty | Calculate earned points | Pricing pipeline sets `loyaltyPointsEarned` |
| 4 | Order created | Email | Confirmation email | `emailService.sendOrderConfirmation()` |
| 5 | Order created | Admin Dashboard | Real-time activity | `emitToRole('admin', 'dashboard:activity', ...)` |
| 6 | Order created | Socket | Staff notification | `emitToUnit(module, 'order:new', ...)` |

### 5.2 Order Status Change Side Effects (6 effects)

| # | Trigger | Target Module | Effect | Mechanism |
|---|---------|--------------|--------|-----------|
| 7 | Any status change | Audit | Status history record | Insert `restaurant_order_status_history` |
| 8 | Any status change | Socket | Real-time update | `emitToUnit(module, 'order:updated', ...)` |
| 9 | → `completed` | Payment | Mark paid | `payment_status = 'paid'` |
| 10 | → `cancelled` | Payment | Timestamp | `cancelled_at` set |
| 11 | → `voided` | Payment | Mark voided | `payment_status = 'voided'` |
| 12 | → `comped` | Payment | Mark comped | `payment_status = 'comped'` |

### 5.3 Booking Side Effects (8 effects)

| # | Trigger | Target Module | Effect | Mechanism |
|---|---------|--------------|--------|-----------|
| 13 | Booking created | Email | Confirmation email | `emailService.sendBookingConfirmation()` |
| 14 | Booking created | Audit | Activity log | `logActivity()` |
| 15 | Booking confirmed | Availability | Block dates | Engine interaction `block_availability_on_confirm` |
| 16 | Booking checked out | **Housekeeping** | **Create task** | Insert `housekeeping_tasks` (status `pending`) |
| 17 | Booking cancelled | Availability | Release dates | Engine interaction `release_availability_on_cancel` |
| 18 | Booking cancelled | Finance | Refund/credit | `booking-modification.service.ts` handles refunds + store credits |
| 19 | Booking status change | Socket | Real-time update | `emitToUnit('chalets', 'booking:statusChanged', ...)` |
| 20 | Booking status change | Audit | Activity log | `logActivity()` |

### 5.4 Pool Ticket Side Effects (6 effects)

| # | Trigger | Target Module | Effect | Mechanism |
|---|---------|--------------|--------|-----------|
| 21 | Ticket entry (valid→active) | Capacity | **Increment occupancy** | Update `current_occupancy` in pool settings |
| 22 | Ticket exit (active→used) | Capacity | **Decrement occupancy** | Update `current_occupancy` in pool settings |
| 23 | Ticket purchased | Socket | Staff notification | `emitToUnit('pool', 'pool:ticket:new', ...)` |
| 24 | Ticket cancelled | Socket | Staff notification | `emitToUnit('pool', 'pool:ticket:cancelled', ...)` |
| 25 | Entry/exit | Socket | Occupancy update | `emitToUnit('pool', 'pool:entry'/'pool:exit', ...)` |
| 26 | Ticket auto-expired | Audit | Audit entry | `expire-pool-tickets.ts` → `audit_logs` |

### 5.5 Payment Side Effects (3 effects)

| # | Trigger | Target Module | Effect | Mechanism |
|---|---------|--------------|--------|-----------|
| 27 | Payment success (Stripe webhook) | **Loyalty** | **Award points** | `awardLoyaltyPointsForPayment()` → RPC `earn_loyalty_points_atomic` |
| 28 | Payment processed | Financial Ledger | Ledger entry | `FinancialLedgerService.record()` → `engine_financial_ledger` |
| 29 | Refund processed | Financial Ledger | Refund entry | `FinancialLedgerService.recordRefund()` |

**Loyalty point award flow**: Webhook handler resolves `user_id` from reference (looks up `restaurant_orders`, `snack_orders`, `chalet_bookings`, or `pool_tickets` by `referenceType`). Uses atomic RPC with tier multiplier.

### 5.6 Restaurant Table & Reservation Side Effects (4 effects)

| # | Trigger | Target Module | Effect | Mechanism |
|---|---------|--------------|--------|-----------|
| 30 | Reservation created | Socket | Staff alert | `io.to('restaurant-staff').emit('new-reservation')` |
| 31 | Table status changed | Socket | Staff update | `io.to('restaurant-staff').emit('table-status-changed')` |
| 32 | Table needs cleaning | Socket | Staff alert | `io.to('restaurant-staff').emit('table-needs-cleaning')` |
| 33 | Guest seated | Kitchen | Kitchen alert | `io.to('kitchen').emit('table-seated')` |

### 5.7 Review & Support Side Effects (4 effects)

| # | Trigger | Target Module | Effect | Mechanism |
|---|---------|--------------|--------|-----------|
| 34 | Review submitted | Socket | Admin notification | `emitToUnit('admin', 'review:created')` |
| 35 | Review moderated | Socket | Admin update | `emitToUnit('admin', 'review:approved/rejected/deleted')` |
| 36 | Support inquiry created | Email | Admin notification | Email to admin address |
| 37 | Support inquiry created | Email | User confirmation | Confirmation email to submitter |

### 5.8 Menu & Configuration Side Effects (3 effects)

| # | Trigger | Target Module | Effect | Mechanism |
|---|---------|--------------|--------|-----------|
| 38 | Category CRUD | Socket | Real-time sync | `emitToUnit('restaurant', 'menu:categoryCreated/Updated/Deleted')` |
| 39 | Item CRUD | Socket | Real-time sync | `emitToUnit('restaurant', 'menu:itemCreated/Updated/Deleted')` |
| 40 | Item availability toggled | Socket | Real-time sync | `emitToUnit('restaurant', 'menu:availabilityChanged')` |

### 5.9 Tab Side Effects (5 effects)

| # | Trigger | Target Module | Effect |
|---|---------|--------------|--------|
| 41 | Tab opened | Socket | `emitToUnit('restaurant', 'tab:opened')` |
| 42 | Tab updated | Socket | `emitToUnit('restaurant', 'tab:updated')` |
| 43 | Tab closed | Socket | `emitToUnit('restaurant', 'tab:closed')` |
| 44 | Tab transferred | Socket | `emitToUnit('restaurant', 'tab:transferred')` |
| 45 | Tab merged | Socket | `emitToUnit('restaurant', 'tab:merged')` |

### 5.10 Pool Session Side Effects (2 effects)

| # | Trigger | Target Module | Effect |
|---|---------|--------------|--------|
| 46 | Session CRUD | Socket | `emitToUnit('pool', 'pool.sessions.created/updated/deleted')` |
| 47 | Occupancy reset | Socket | `emitToUnit('pool', 'pool:occupancy:reset')` |

### 5.11 Push Notification Side Effects (2 effects)

| # | Trigger | Target Module | Effect |
|---|---------|--------------|--------|
| 48 | Mobile check-in event | Push (FCM) | `sendPushNotification()` |
| 49 | Admin sends template | Push (FCM) | `notificationService.sendFromTemplate()` |

**Push notification templates**: `orderReady`, `orderStatusUpdate`, `bookingConfirmed`, `bookingReminder`, `paymentReceived`, `loyaltyPointsEarned`, `promotion`

### 5.12 Audit & Security Side Effects (3 effects)

| # | Trigger | Target Module | Effect |
|---|---------|--------------|--------|
| 50 | User CRUD, GDPR, Staff, Pool, Orders, Bookings, etc. | Audit | `activityLogger` → `audit_logs` table |
| 51 | Suspicious API activity | Security | `securityAuditLogger.logSecurityEvent()` → `security_audit_log` |
| 52 | Scheduled jobs | Audit | `scheduler.service.ts` → `audit_logs` |

### 5.13 Side-Effect Communication Channel Summary

| Channel | Usage Count | Purpose |
|---------|-------------|---------|
| Socket.IO (`emitToUnit`/`emitToRole`/`emitToUser`) | ~55+ call sites | Real-time staff & admin dashboards |
| Direct DB writes (cross-table) | ~30+ | Status history, audit logs, housekeeping tasks, ledger entries |
| Email service | ~5 | Order/booking confirmations, support notifications |
| Push notifications (FCM) | ~3 call sites | Mobile guest notifications |
| RPC calls (Supabase functions) | ~5 | Atomic loyalty points, FIFO inventory deduction |
| Activity logger | ~12+ call sites | Compliance audit trail |

---

## 6. Failure Paths & Error Handling

### 6.1 Global Error Infrastructure

| Component | Behavior |
|-----------|----------|
| Global error middleware (`app.ts`) | Operational errors → status + message; unexpected errors → sanitized 500 in production |
| `asyncHandler()` wrapper | All route handlers wrapped; catches async rejections → routes to error middleware |
| `AppError` class | Custom error with `statusCode`, `isOperational` flag, `code` string |
| Sentry | `initSentry(app)` at startup; captures unhandled exceptions/rejections |
| Circuit breaker | Available but **unused** (no production imports) |

### 6.2 Payment Failure Scenarios

#### Stripe PaymentIntent Creation
| Failure | Handling |
|---------|----------|
| Missing `referenceType`/`referenceId` | Returns 400 |
| Stripe API error | Returns 500 with error message |
| Invalid amount (≤ 0) | **NOT validated** at controller level — relies on Stripe rejection |

#### Stripe Webhook: `payment_intent.succeeded`
| Step | Failure | What Happens |
|------|---------|-------------|
| 1 | Invalid signature | 400 returned |
| 2 | Duplicate `webhook_id` in `payment_ledger` | Returns 200 (idempotent) |
| 3 | Duplicate `stripe_payment_intent_id` in `payments` | Returns 200 (double guard) |
| 4 | `payment_ledger` insert fails | 500 → Stripe retries |
| 5 | `payments` insert fails | 500 → Stripe retries, BUT `payment_ledger` row exists → **next retry returns 200 idempotent, payments row NEVER created** |
| 6 | `updateReferencePaymentStatus()` fails | **CRITICAL**: Payment recorded but order/booking status not updated. Retries hit idempotency → 200, status **NEVER** updated |
| 7 | `awardLoyaltyPointsForPayment()` fails | Non-fatal: wrapped in try/catch, logged only |

#### Manual Refund
| Step | Failure | Impact |
|------|---------|--------|
| Stripe rejects refund | Returns 400, order status unchanged (correct) |
| `payments` update fails | Stripe refund exists, DB not updated (orphan refund) |
| Order status update fails | Payment marked refunded, order still shows paid |

#### Cash/Manual Payment Recording
| Step | Failure | Impact |
|------|---------|--------|
| `payments` insert fails | Reference not updated |
| Reference status update fails | `payments` row exists but order unpaid |
| **No transaction wrapping** | Two separate operations — partial failure possible |

### 6.3 Module-Level Error Handling Patterns

| Module | Key Error Handling |
|--------|-------------------|
| Chalet | 404 not found; 409 date conflict; lock timeout → 429/500; email failure is non-fatal |
| Pool | 404 not found; 400 capacity exceeded; `StateMachineError` → 400 |
| Restaurant Orders | 400 for inactive items; rollback handler deletes order on item insertion failure; inventory/kitchen/email failures non-fatal |
| Gift Cards | 404 not found; 400 expired/insufficient/already redeemed; **no concurrency protection** |
| Coupons | 404 not found; 400 expired/over-limit/min-amount; RPC `apply_coupon_atomic` failure → 500 |
| Loyalty | 404 member not found; 400 insufficient points; atomic via `pg_advisory_xact_lock` |
| GDPR | Per-table error catching (continues with available data); partial deletion resets to `pending` for retry |

### 6.4 Process-Level Failure Handling

| Event | Behavior |
|-------|----------|
| `SIGTERM`/`SIGINT` | Graceful shutdown: HTTP → WebSocket → Database. 30s timeout then `exit(1)` |
| Uncaught exception `"write after end"`/"headers sent" | **Ignored** (known Express issue) |
| Other uncaught exceptions | Log error, initiate graceful shutdown |
| Unhandled promise rejections | **Log only — process continues running** (potentially corrupted state) |
| Database init failure | Logged, **server continues without DB** — all requests will fail on first DB access |
| Socket.IO init failure | **Process crashes** (no try/catch) |
| SchedulerService init failure | **Process crashes** (no try/catch) |

---

## 7. Concurrency, Race Conditions & Transaction Boundaries

### 7.1 PROTECTED Operations (Atomic)

| Operation | Protection | Mechanism |
|-----------|-----------|-----------|
| Loyalty `earnPoints()` | `pg_advisory_xact_lock` | RPC `earn_loyalty_points_atomic` |
| Loyalty `redeemPoints()` | `pg_advisory_xact_lock` | RPC `redeem_loyalty_points_atomic` |
| Loyalty `adjustPoints()` | `pg_advisory_xact_lock` | RPC `earn_loyalty_points_atomic` |
| Coupon `applyCoupon()` | Atomic RPC | `apply_coupon_atomic` |
| Gift card (engine pipeline) | Atomic RPC | `redeem_giftcard_atomic` |
| Chalet booking creation | Redis distributed lock | `acquireBookingLock()` — 30s TTL, 10s spin-wait, in-memory fallback |
| Chalet row lock (in RPC) | `SELECT ... FOR UPDATE` | On chalets row during availability check |
| Idempotency key claim | Upsert with unique constraint | `engine_idempotency_keys` |

### 7.2 UNPROTECTED Operations (Race Condition Risks)

| Operation | Risk | Impact |
|-----------|------|--------|
| **Gift card redemption (direct endpoint)** | SELECT balance → UPDATE balance as two separate queries | Concurrent requests can both read same balance, **over-redeeming** |
| **Pool ticket purchase** | Capacity count + ticket creation are separate queries, no lock | Concurrent purchases can both pass capacity check, **exceeding max_capacity** |
| **Order creation** | Menu item availability check then order creation — no lock | Concurrent orders could both pass stock check |
| **Booking add-ons** | Booking row created first, then add-ons in a loop — no transaction | Server crash between steps → orphan booking without add-ons |
| **Coupon post-RPC order update** | RPC atomically increments usage, but order update with discount is separate | If update fails, coupon usage consumed but discount not applied |
| **Payment reference status update** | Payment recorded as separate operation from status update | Payment exists but reference status stale |

### 7.3 Transaction Model

**The system does NOT use database-level `BEGIN/COMMIT/ROLLBACK`.**

Instead, it uses:

1. **Application-level Saga** (`TransactionManager` in `src/engines/transaction-manager.ts`):
   - Sequential step execution
   - On failure: compensates completed steps in reverse order
   - Compensation failure: **logged and swallowed**, marked `requires_manual_review: true` in `engine_compensation_log`
   - **Risk**: Process crash mid-saga → no DB transaction to rollback, partial state persists

2. **Simple transaction helpers** (`src/utils/transaction.ts`):
   - `createBookingTransactional()`: Insert booking → insert add-ons (on failure: delete booking)
   - `createOrderTransactional()`: Insert order → insert items (on failure: delete order)
   - Same pattern: application-level rollback via DELETE, not DB transactions

### 7.4 Cascade Failure Scenarios

| Scenario | What Happens | Handled? |
|----------|-------------|----------|
| Order items insert fails | `createOrderTransactional` deletes order row | ✅ If rollback succeeds |
| Order created, inventory deduction fails | Order persists, inventory not deducted | ⚠️ Non-fatal by design — may over-sell |
| Order created, kitchen propagation fails | Order persists, kitchen never shows it | ⚠️ Non-fatal — logged |
| Booking created, add-on insert fails (controller path) | Orphan booking without add-ons | ❌ Silent data inconsistency |
| Payment webhook: ledger written, `payments` insert fails | Next retry → idempotent on ledger → 200, **payments row NEVER created** | ❌ |
| Payment webhook: payments written, status update fails | Next retry → idempotent → 200, **status NEVER updated** | ❌ |
| GDPR deletion partially fails | Status reset to `pending` for retry | ✅ |

---

## 8. Idempotency Coverage

### 8.1 Engine Idempotency Guard (`src/engines/idempotency-guard.ts`)

| Aspect | Detail |
|--------|--------|
| Storage | `engine_idempotency_keys` table |
| Key format | `{tenantId}:{engineType}:{entityId}:{action}:{nonce}` |
| On duplicate (completed) | Returns cached result, HTTP 200 |
| On duplicate (processing) | Throws `IdempotencyConflictError` (409) |
| On claim failure | **Proceeds WITHOUT protection** ("better to process than to block") |
| On operation failure | Marks key as 'failed' — retries can re-attempt |
| TTL | 24 hours |
| Cleanup | `cleanupExpired()` exists but **never scheduled** — table grows indefinitely |

### 8.2 Payment Webhook Idempotency

| Layer | Mechanism | Status |
|-------|-----------|--------|
| `payment_ledger` webhook_id check | Inline in webhook handler | ✅ Active |
| `payments` table `stripe_payment_intent_id` check | Inline in webhook handler | ✅ Active |
| Chargeback `stripe_dispute_id` check | Inline in service | ✅ Active |
| Generic `processWithIdempotency()` | Uses `processed_webhook_events` table | ❌ Dead code — never imported |

### 8.3 Operations WITHOUT Idempotency

| Operation | Risk |
|-----------|------|
| `POST /create-intent` | Client could create multiple PaymentIntents for same order |
| `POST /record-cash` | Accidental double-tap creates duplicate payment record |
| `POST /record-manual` | Same risk |
| Booking creation (controller path) | Manual double-submit risk |

---

## 9. Automated Processes & Scheduled Tasks

### 9.1 Active Cron Jobs (started at server startup)

| Job | Schedule | What It Does |
|-----|----------|-------------|
| Daily Backup | `0 3 * * *` (3:00 AM) | Full schema backup to Supabase Storage bucket |
| Pool Ticket Expiry (midnight) | `0 0 * * *` | Updates `pool_tickets` with status `valid` and past date → `expired`, writes audit logs |
| Pool Ticket Expiry (4-hour) | `0 4,8,12,16,20 * * *` | Same logic, additional coverage runs |
| Session Cleanup | `0 4 * * *` (4:00 AM) | Deletes `sessions` older than 7 days, writes audit log |
| Booking Reminders | `0 9 * * *` (9:00 AM) | Emails guests with confirmed bookings checking in tomorrow (marks `reminder_sent: true`) |
| Scheduled Report Delivery | `*/5 * * * *` (every 5 min) | Processes up to 10 due reports per cycle from `report_scheduled` |
| Dashboard Metric Push | setInterval 30s | Pushes `businessMetricsService.getDashboardMetrics()` via Socket.IO to admins |

### 9.2 Always-On Timers

| Timer | Interval | Purpose |
|-------|----------|---------|
| Socket Connection Stats | 60 seconds | Logs connection/client count (debug level) |
| Biometric Challenge Cleanup | 5 minutes | Clears expired WebAuthn challenges from in-memory Map |
| Dashboard Metrics Push | 30 seconds | Real-time admin dashboard updates via Socket.IO |

### 9.3 Startup Initialization Sequence

```
main()
  ├── 1. http.createServer(app)           ← Express app with all middleware
  ├── 2. initSentry(app)                  ← Error tracking
  ├── 3. server.listen(port, '0.0.0.0')   ← Start accepting requests IMMEDIATELY
  ├── 4. initializeDatabase()             ← BACKGROUND (non-blocking!)
  │      └── On failure: logged, server continues without DB
  ├── 5. initializeSocketServer(server)    ← WebSocket (Socket.IO)
  │      └── Starts socket stats interval (60s)
  ├── 6. SchedulerService.init()           ← All cron jobs
  ├── 7. Shutdown handlers (SIGTERM, SIGINT)
  ├── 8. uncaughtException handler
  └── 9. unhandledRejection handler (log only, NO shutdown)
```

**Critical observation**: Server starts accepting HTTP requests (step 3) BEFORE the database is initialized (step 4).

### 9.4 Webhook Endpoints

| Endpoint | Auth | Events/Purpose |
|----------|------|----------------|
| `POST /api/v1/payments/webhook/stripe` | Stripe signature | `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.*` |
| `POST /webhooks/channels/webhooks/siteminder/:property_id/:channel` | Handler validates | Channel manager sync (SiteMinder) |
| `POST /webhooks/channels/webhooks/ota/:property_id/:channel` | Handler validates | OTA channel sync |

### 9.5 Health Check Endpoints

| Endpoint | What It Checks | Response on Failure |
|----------|---------------|-------------------|
| `GET /health` | DB ping (`system_settings` select) | 503 |
| `GET /api/health` | Nothing (always 200) | N/A |
| `GET /health/ready` | DB connectivity + latency | 503 |
| `GET /health/detailed` | DB + Storage + Stripe + Email + Memory + CPU | Detailed report |

### 9.6 External Processes

| Process | Mechanism | Purpose |
|---------|-----------|---------|
| Keep-alive pinger | Standalone script, `setInterval(30_000)` | Pings production `/health` to prevent Render cold starts |

---

## 10. Dead Code & Uninitialized Systems

### 10.1 Never-Started Background Processes

| Process | Status | Impact |
|---------|--------|--------|
| **Marketing automation** (`startBackgroundProcessing()` in `marketing.service.ts`) | Method defined, **never called** at startup or anywhere | Marketing automations, journey steps, queued emails, and scheduled campaigns **never fire** |
| **Webhook retry** (`startBackgroundProcessing()` in `webhook-retry.service.ts`) | Singleton exported, **never started** | Failed webhooks accumulate in `webhook_failures` and are **never retried**. Admin alerts **never sent**. |
| **Idempotency key cleanup** (`cleanupExpired()` in `idempotency-guard.ts`) | Method exists, **no cron job** | `engine_idempotency_keys` table grows **indefinitely** |
| **Webhook event cleanup** (`cleanupOldEvents()` in `webhookIdempotency.service.ts`) | Method exists, **never called** | `processed_webhook_events` table grows indefinitely (if used — also dead) |
| **Soft-delete purge** | No job exists | Soft-deleted records accumulate indefinitely in ~15+ tables |

### 10.2 Dead Code (Available but Never Used)

| Component | File | Status |
|-----------|------|--------|
| `processWithIdempotency()` | `webhookIdempotency.service.ts` | Exported, **never imported** in `src/` |
| `cleanupOldEvents()` | `webhookIdempotency.service.ts` | Defined, **never called** |
| Circuit breaker pattern | `utils/circuit-breaker.ts` | Exported, **no production imports** |
| Generic webhook retry service (full impl) | `webhook-retry.service.ts` | Fully implemented, **never initialized** |

### 10.3 Unmounted Route Files

| File | Reason |
|------|--------|
| QuickBooks integration routes | Module never wired into `app.ts` |
| Accommodations routes | Module never wired into `app.ts` |
| Unsubscribe routes | Module never wired into `app.ts` |

---

## 11. Critical Risk Register

### 11.1 HIGH Severity

| # | Risk | Description | Evidence |
|---|------|-------------|----------|
| H1 | **Gift card over-redemption** | Direct endpoint (`redeemGiftCard()`) does SELECT→UPDATE without atomic RPC. Two concurrent requests can over-redeem. The engine resolver correctly uses `redeem_giftcard_atomic` RPC, but the controller endpoint does not. | `giftcard.controller.ts` |
| H2 | **Pool capacity breach** | Capacity check (COUNT tickets) and ticket creation are separate queries with no lock. Concurrent purchases can exceed `max_capacity`. | `pool.controller.ts` |
| H3 | **Payment webhook partial failure** | If `updateReferencePaymentStatus()` fails after payment ledger + payments recorded, retries hit idempotency and return 200. The order/booking status is **never** updated. No reconciliation job exists. | `payment.controller.ts` |
| H4 | **No DB transactions** | All multi-step operations use application-level compensation (Saga). Process crash mid-operation leaves partial state with no automatic rollback. | System-wide |
| H5 | **Ghost role permission gap** | 7 roles (`chef`, `server`, `front_desk`, `housekeeping`, `hotel_staff`, `maintenance`, `staff`) pass `authorize()` checks but have **zero** entries in `RolePermissions`. Any route using both `authorize()` and `requirePermission()` will behave inconsistently. | `permissions.ts`, route files |
| H6 | **Dual requirePermission conflict** | Two different `requirePermission` implementations (in-memory vs DB-based) exist in separate middleware files. Which is used depends on import. Routes may check different permission sources. | `auth.middleware.ts` vs `permission.middleware.ts` |

### 11.2 MEDIUM Severity

| # | Risk | Description |
|---|------|-------------|
| M1 | **Marketing automation never fires** | `startBackgroundProcessing()` is never called — all marketing automations, journeys, queued emails, campaigns are dead |
| M2 | **Webhook retry never fires** | Failed webhooks accumulate but are never retried — admin alerts never sent |
| M3 | **Booking add-ons not transactional** | Booking created, then add-ons inserted in loop with no transaction — crash = orphan booking |
| M4 | **Coupon usage consumed without discount** | Atomic RPC increments coupon usage, but separate order update can fail — usage wasted |
| M5 | **Unhandled rejections don't shutdown** | Process continues with potentially corrupted state |
| M6 | **Server accepts requests before DB ready** | `server.listen()` called before `initializeDatabase()` completes — early requests will fail |
| M7 | **Cash payment double-record** | No idempotency on `POST /record-cash` — double-tap creates duplicate payment |

### 11.3 LOW Severity

| # | Risk | Description |
|---|------|-------------|
| L1 | Idempotency keys never cleaned up | Table grows indefinitely (24h TTL exists but cleanup never scheduled) |
| L2 | Soft-deleted records never purged | ~15+ tables accumulate `deleted_at` records forever |
| L3 | Circuit breaker available but unused | External service calls (Stripe, email) have no circuit breaker protection |
| L4 | Generic webhook idempotency unused | `processWithIdempotency()` exists but payment webhook uses inline checks instead |
| L5 | Inventory deduction non-fatal | Order succeeds even if stock deduction fails — potential over-selling |
| L6 | Kitchen propagation non-fatal | Order succeeds but KDS never shows it — staff may miss orders |

---

## 12. Verification Requirements Summary

Based on this system map, the following areas require verification in Phase 2:

### 12.1 State Machine Verification (4 engines + 7 non-engine lifecycles)
- Every valid transition must succeed with correct side effects
- Every invalid transition must be rejected with correct error
- Terminal states must not allow further transitions
- Side effects must fire reliably (or be documented as non-fatal)

### 12.2 Role & Permission Verification (16 formal + 7 ghost roles, 53 permissions)
- Every route must be tested with authorized AND unauthorized roles
- Ghost roles must be verified: do they work where used, or silently fail?
- Both `requirePermission` implementations must be mapped per-route
- `super_admin` wildcard must be verified to work everywhere

### 12.3 Cross-Module Side Effect Verification (52+ effects)
- Every side effect must be verified to fire on its trigger
- Non-fatal side effects must be verified to not block the primary operation
- Socket emissions must reach intended recipients
- Financial ledger entries must maintain invariants

### 12.4 Failure Path Verification
- Payment webhook partial failure: verify the orphan state described in H3
- Gift card concurrent redemption: verify the race condition in H1
- Pool capacity concurrent purchase: verify the breach in H2
- Cascade failures in booking/order creation: verify compensation works

### 12.5 Concurrency Verification
- All "PROTECTED" operations: verify locks work under concurrent load
- All "UNPROTECTED" operations: verify the race conditions exist and quantify risk
- Saga compensation: verify it runs correctly and handles compensation failures

### 12.6 Automated Process Verification
- All 7 cron jobs: verify they run and produce expected results
- Pool ticket expiry: verify correct tickets are expired with audit logs
- Booking reminders: verify correct bookings are targeted and emails sent
- Report scheduler: verify reports execute and deliver on schedule

### 12.7 Dead Code & Initialization Verification
- Verify marketing automation is truly dead (not started)
- Verify webhook retry is truly dead (not started)
- Verify unmounted route files have no side-effect registrations

### 12.8 Data Integrity Verification
- Financial ledger invariant: `totalAmount = subtotal + taxAmount + serviceCharge + deliveryFee - totalDiscount`
- Audit log completeness: verify every auditable action produces a log entry
- Soft-delete filter integrity: verify no query returns soft-deleted records

---

*End of Phase 1 System Map. This document serves as the authoritative reference for Phase 2 verification system design.*
