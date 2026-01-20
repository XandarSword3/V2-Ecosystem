# V2 Resort — Production Hardening Execution Plan

## System Context

| Component | Path | Status |
|-----------|------|--------|
| Backend API | `backend/src/app.ts` | Running on port 3005 |
| Frontend Web | `frontend/` | Next.js on port 3000/3001 |
| Mobile Shell | `mobile/` | Expo 51, minimal auth shell |
| Database | Supabase PostgreSQL | Migrations in `supabase/migrations` |
| OpenAPI v1 | `backend/src/docs/openapi.v1.ts` | ✅ Created |
| Permissions | `backend/src/security/permissions.ts` | ✅ 12 roles, ~70 permissions |
| Permission Middleware | `backend/src/middleware/permission.middleware.ts` | ✅ Created |
| Stripe Platform | `backend/src/services/stripe-platform.service.ts` | ✅ Created |
| Push Service | `backend/src/services/pushNotification.service.ts` | Needs creation |
| Device Module | `backend/src/modules/devices/` | Exists, needs hardening |

## Priority Execution Order

```
PHASE A: Contract & Auth Hardening ──────────────────► BLOCKER
PHASE B: Data Integrity & Delete Behavior ───────────► BLOCKER  
PHASE C: Auth Lifecycle Robustness ──────────────────► BLOCKER
PHASE D: Push Notifications E2E ─────────────────────► BLOCKER (marketing)
PHASE E: Platform-Aware Stripe ──────────────────────► BLOCKER (payments)
PHASE F: Load & Performance Testing ─────────────────► BLOCKER
PHASE G: Mobile App Features ────────────────────────► BLOCKER (app stores)
PHASE H: Offline Resilience ─────────────────────────► HIGH PRIORITY
PHASE I: Security Audit ─────────────────────────────► BLOCKER
PHASE J: App Store Preparation ──────────────────────► BLOCKER (publishing)
PHASE K: CI/CD & Monitoring ─────────────────────────► BLOCKER (production)
PHASE L: QA & Handover ──────────────────────────────► FINAL GATE
```

---

# PHASE A — CONTRACT & AUTHENTICATION

## A.1 OpenAPI Completeness

**Current State**: `openapi.v1.ts` created with ~50 endpoints

**Tasks**:
- [ ] Export machine-readable JSON to `backend/docs/openapi.v1.json`
- [ ] Validate with OpenAPI CLI
- [ ] Cross-reference all route files against spec
- [ ] Add `securitySchemes` for Bearer JWT

**V2 Resort Routes to Validate**:
```
backend/src/modules/
├── auth/auth.routes.ts
├── bookings/booking.routes.ts
├── chalets/chalet.routes.ts
├── coupons/coupon.routes.ts
├── devices/devices.routes.ts
├── giftCards/giftCard.routes.ts
├── housekeeping/housekeeping.routes.ts
├── inventory/inventory.routes.ts
├── loyalty/loyalty.routes.ts
├── menu/menu.routes.ts
├── modules/modules.routes.ts
├── orders/order.routes.ts
├── payments/payment.routes.ts
├── pool/pool.routes.ts
├── reviews/review.routes.ts
├── snackbar/snackbar.routes.ts
├── staff/staff.routes.ts
├── support/support.routes.ts
└── users/user.routes.ts
```

**Acceptance**:
- `npx @openapitools/openapi-generator-cli validate -i backend/docs/openapi.v1.json` ✅
- Contract lint test passes

## A.2 Permission Enforcement

**Current State**: Middleware created but not mounted on all routes

**Tasks**:
- [ ] Audit every route file for permission middleware usage
- [ ] Implement deny-by-default: unauthenticated requests blocked unless explicitly public
- [ ] Create integration tests for permission checks
- [ ] Test 403 responses for unauthorized roles

**V2 Resort Permission Matrix** (from `permissions.ts`):
| Endpoint | Required Permission |
|----------|-------------------|
| `GET /api/v1/admin/dashboard` | `admin:dashboard:read` |
| `POST /api/v1/restaurant/orders` | `restaurant:order:create` |
| `PUT /api/v1/chalets/:id` | `chalet:manage` |
| `DELETE /api/v1/modules/:id` | `admin:modules:manage` |

**Acceptance**:
- `backend/tests/integration/permissions.test.ts` passes
- Roles without permission get HTTP 403

## A.3 Contract Tests

**Tasks**:
- [ ] Generate contract tests from OpenAPI spec
- [ ] Assert responses match schemas
- [ ] Fail CI on schema mismatches

---

# PHASE B — DATA INTEGRITY & DELETE BEHAVIOR

## B.1 Delete Cascade Audit

**V2 Resort Critical Dependencies**:
```
modules
├── menu_categories (FK: module_id)
│   └── menu_items (FK: category_id)
├── chalets (FK: module_id)
│   └── chalet_bookings (FK: chalet_id)
├── pool_sessions (FK: module_id)
│   └── pool_tickets (FK: session_id)
└── snackbar_items (FK: module_id)

users
├── orders (FK: user_id)
├── bookings (FK: user_id)
├── loyalty_accounts (FK: user_id)
├── device_tokens (FK: user_id)
└── reviews (FK: user_id)
```

**Tasks**:
- [ ] Create `GET /api/v1/admin/modules/:id/delete-preview` endpoint
- [ ] Return dependent entity counts
- [ ] Implement `force=true` cascade or soft-delete fallback
- [ ] Add 409 Conflict response with dependency list

## B.2 Backup Verification

**Tasks**:
- [ ] Document Supabase backup mechanism
- [ ] Create `scripts/backup_restore_test.sh`
- [ ] Test restore on staging
- [ ] Verify file storage consistency

## B.3 Database Indexes

**V2 Resort Critical Indexes Needed**:
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX idx_payments_reference ON payments(reference_id, reference_type);
```

---

# PHASE C — AUTH LIFECYCLE ROBUSTNESS

**Current State**: Tests created at `backend/tests/unit/auth-lifecycle.test.ts`

**Tasks**:
- [ ] Implement refresh token rotation in DB
- [ ] Add `token_version` column to users table
- [ ] Implement `/api/v1/auth/logout-all` (increment token_version)
- [ ] Test multi-device sessions
- [ ] Verify mobile background refresh flow

**V2 Resort Auth Flow**:
```
Login → Access Token (15min) + Refresh Token (7d)
       ↓
Token Expiry → Call /api/v1/auth/refresh
       ↓
Logout → Revoke refresh token for device
Logout All → Increment user.token_version (invalidates all tokens)
```

---

# PHASE D — PUSH NOTIFICATIONS E2E

**Current State**: Test infrastructure created, real FCM not integrated

**Tasks**:
- [ ] Create `backend/src/services/pushNotification.service.ts`
- [ ] Configure Firebase Admin SDK
- [ ] Implement device token storage
- [ ] Create notification queue with retries
- [ ] Test on physical devices

**V2 Resort Notification Types**:
| Event | Notification |
|-------|-------------|
| Order confirmed | "Your order #{id} is confirmed" |
| Order ready | "Your order is ready for pickup!" |
| Booking confirmed | "Chalet booking confirmed for {date}" |
| Payment success | "Payment of €{amount} successful" |
| Loyalty points | "You earned {points} loyalty points!" |

---

# PHASE E — PLATFORM-AWARE STRIPE

**Current State**: `stripe-platform.service.ts` created with Apple/Google Pay support

**Tasks**:
- [ ] Configure domain verification for Apple Pay
- [ ] Test PaymentIntent with platform metadata
- [ ] Implement webhook handlers for all events
- [ ] Test refund flows
- [ ] Mobile integration with `@stripe/stripe-react-native`

**V2 Resort Payment Flows**:
```
Restaurant Order → PaymentIntent → Webhook → Update order.payment_status
Chalet Booking → PaymentIntent → Webhook → Confirm booking
Pool Ticket → PaymentIntent → Webhook → Issue ticket
Gift Card → PaymentIntent → Webhook → Activate card
```

---

# PHASE F — LOAD & PERFORMANCE

**Target**: 200 concurrent users, p95 latency < 500ms

**V2 Resort Critical Endpoints**:
```
GET  /api/v1/restaurant/menu          (high read volume)
POST /api/v1/restaurant/orders        (write + payment)
GET  /api/v1/chalets                  (high read volume)
POST /api/v1/chalets/bookings         (write + payment)
GET  /api/v1/pool/sessions            (high read volume)
POST /api/v1/pool/tickets             (write + payment)
```

**Tasks**:
- [ ] Create k6 load test scripts
- [ ] Profile slow queries with EXPLAIN ANALYZE
- [ ] Add Redis caching for menus and availability
- [ ] Test Socket.IO scaling

---

# PHASE G — MOBILE APP FEATURES

**Current State**: Shell with auth, push registration, deep linking

**Tasks**:
- [ ] Restaurant flow: menu → cart → order → payment → tracking
- [ ] Chalet flow: list → availability → booking → payment → confirmation
- [ ] Pool flow: sessions → ticket purchase → QR code display
- [ ] Account: profile, payment methods, order history, logout all
- [ ] Push handling: deep link to correct screen

**V2 Resort Mobile Screens**:
```
(tabs)/
├── index.tsx (Home - welcome, quick actions)
├── restaurant.tsx → MenuScreen → CartScreen → CheckoutScreen
├── pool.tsx → SessionsScreen → TicketScreen
├── chalets.tsx → ChaletListScreen → BookingScreen
└── account.tsx → ProfileScreen → OrderHistoryScreen
```

---

# PHASE H — OFFLINE RESILIENCE

**V2 Resort Offline Requirements**:
- Staff can take orders during connectivity issues
- Orders queue locally and sync when online
- Idempotency tokens prevent duplicates

**Tasks**:
- [ ] Implement AsyncStorage queue for orders
- [ ] Add `clientTxId` to all create operations
- [ ] Server-side deduplication by `clientTxId`
- [ ] Retry with exponential backoff

---

# PHASE I — SECURITY AUDIT

**Tasks**:
- [ ] `npm audit` fix critical/high
- [ ] Remove secrets from git history
- [ ] Verify CORS, CSRF, Helmet, rate limits
- [ ] OWASP Top 10 checklist
- [ ] Stripe webhook signature validation

---

# PHASE J — APP STORE PREPARATION

**Already Created**: `mobile/docs/APP_STORE_COMPLIANCE.md`

**Remaining Tasks**:
- [ ] Privacy policy page implementation
- [ ] ATT prompt configuration (iOS)
- [ ] Screenshots for all screen sizes
- [ ] TestFlight and Play Console setup
- [ ] Beta testing round

---

# PHASE K — CI/CD & MONITORING

**Tasks**:
- [ ] GitHub Actions workflow for tests
- [ ] Docker build pipeline
- [ ] Staging deploy on merge to main
- [ ] Production deploy on tag
- [ ] Sentry error tracking
- [ ] Uptime monitoring

---

# PHASE L — QA & HANDOVER

**Deliverables**:
- [ ] `DEPLOYMENT.md` - deployment instructions
- [ ] `RUNBOOK.md` - incident response
- [ ] `MAINTENANCE.md` - routine tasks
- [ ] `CHANGELOG.md` - version history
- [ ] Test evidence package
- [ ] Security scan report

---

# EXECUTION COMMANDS

```bash
# Phase A - Contract Validation
node backend/scripts/export-openapi.js
npx @openapitools/openapi-generator-cli validate -i backend/docs/openapi.v1.json

# Phase A - Run Tests
cd backend && npm test -- --grep "permissions"

# Phase C - Auth Tests
cd backend && npm test -- tests/unit/auth-lifecycle.test.ts

# Phase D - Push Tests
cd backend && npm test -- tests/unit/push-notification.test.ts

# Phase F - Load Test
k6 run scripts/k6/smoke.js

# Phase I - Security
npm audit --production
npx snyk test
```

---

*Plan tailored for V2 Resort on January 19, 2026*
