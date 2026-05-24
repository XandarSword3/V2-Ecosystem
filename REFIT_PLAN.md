# V2 Engine Framework Refitting Plan

## STATUS SUMMARY — updated after full audit pass (2026-05-24)

### Prior fixes (unchanged)

| Item | Status |
|---|---|
| `booking-modification.service.ts` legacy table refs (row 28) | ✅ DONE — fully rewritten to `transactions` |
| `seasonal-pricing.service.ts` legacy occupancy query (row 29) | ✅ DONE — uses `accommodation_units` + `transactions` |
| `payment.controller.ts` `canUseIdempotencyGuard` runtime probe | ✅ DONE — probe removed; `IdempotencyGuard` always used |
| `bookings.service.ts` — `Math.random()` in `generateBookingNumber` | ✅ FIXED — replaced with `randomBytes(4)` |
| `bookings.service.ts` — `updateBooking` unconstrained spread | ✅ FIXED — field allowlist enforced; `status` excluded |
| `bookings.service.ts` — engine pricing failure silently swallowed | ✅ FIXED — `logger.warn` now emitted on catch |
| `seasonal-pricing.service.ts` — TS2345 (`accommodation_units` type) | ✅ FIXED — type union extended |
| `inventory.controller.ts` — missing `property_id` scoping | ✅ FIXED — `resolvePropertyScope` helper added |

### Section 1A — Legacy table name references (full audit complete)

| Row(s) | File | Status |
|--------|------|--------|
| 1–5 | `metrics-layer.service.ts` | ✅ CLEAN — migrated to `transactions` |
| 6–8 | `dashboard.service.ts` | ✅ CLEAN — migrated to `transactions` |
| 9–11 | `business-metrics.service.ts` | ✅ CLEAN — migrated to `transactions` |
| 12–15 | `admin.controller.ts` | ✅ CLEAN — split into sub-controllers; legacy code removed |
| 16 | `reports.controller.ts` | ✅ CLEAN |
| 17 | `user.controller.ts` | ✅ CLEAN — `getMyStatement` queries `transactions` with `engine_type` |
| 18–19 | `gdpr.controller.ts` | ✅ CLEAN — export and anonymize both use unified `transactions` |
| 20 | `module-staff.controller.ts` | ✅ CLEAN — all data access via `transactions` |
| 21 | `staff.controller.ts` | ✅ CLEAN — spend rollup uses `transactions` |
| 22–23 | `shifts.controller.ts` | ✅ CLEAN — `calculateShiftFinancials` uses `transactions` |
| 24 | `approvals.controller.ts` | ✅ CLEAN — void/comp act on `transactions`; refund via payment service |
| 25 | `payment.controller.ts` | ✅ DONE (see prior fixes) |
| 26 | `loyalty-integration.ts` | ✅ CLEAN — customer resolved from `transactions` via atomic RPC |
| 27 | `booking-reminders.service.ts` | ✅ CLEAN — queries `transactions` with `engine_type: time_exclusive_reservation` |
| 28 | `booking-modification.service.ts` | ✅ DONE (see prior fixes) |
| 29 | `seasonal-pricing.service.ts` | ✅ DONE (see prior fixes) |
| 30 | `transaction.ts` | ✅ CLEAN — inserts into `transactions` and `transaction_add_ons`; no legacy names |
| 31 | `expire-pool-tickets.ts` | ✅ CLEAN — queries `transactions` with `engine_type: shared_capacity_access` |
| 32 | `check_pool_schema.ts` | ✅ DELETED — file no longer exists on disk |
| 33 | `reporting.service.ts` | ✅ ACCEPTABLE — `config.table \|\| 'bookings'` is generic; all KPI/revenue queries use `transactions` |

### Section 1B — Legacy type strings (full audit complete)

| Row(s) | File | Status |
|--------|------|--------|
| 1 | `container/types.ts` | ✅ CLEAN — `ReferenceType` = `'instant_transaction' \| 'time_exclusive_reservation' \| 'shared_capacity_access' \| 'ongoing_entitlement'` |
| 2 | `payment.service.ts` | ✅ CLEAN — `VALID_REFERENCE_TYPES` uses engine types |
| 3 | `validation/schemas.ts` | ✅ CLEAN — all `z.enum` schemas use engine type strings |
| 4 | `stripe-platform.service.ts` | ✅ CLEAN — `referenceType` typed as engine type union |
| 5 | `payment.v1.routes.ts` | ✅ CLEAN — `z.enum` uses engine types |
| 6–7 | `business-metrics.service.ts` | ✅ CLEAN — confirmed in prior pass |
| 8–9 | `dashboard.service.ts` | ✅ CLEAN — confirmed in prior pass |
| 10–12 | `cockpit/page.tsx` | ⚠️ HARDCODED — `ENGINE_CONFIG` uses correct engine type keys but is a static constant, not derived from `/analytics/engines`. Non-blocking; addressed in Step 9 of migration plan. |
| 13 | `StripePayment.tsx` | ✅ FIXED — `referenceType` prop updated to engine type union (fixed in this pass) |
| 14 | `cartStore.ts` | ⚠️ HARDCODED — `type: 'restaurant'`, `moduleId: 'restaurant'` are UI routing strings, not analytics engine types. Low priority; non-blocking. |
| 15 | `api.ts` | ✅ KEEP — engine-specific UI routes; marked intentional in plan |

---

## 1. FULL AUDIT

### 1A. Files that hardcode legacy table names

| # | File | Lines | What it hardcodes | Category |
|---|------|-------|-------------------|----------|
| 1 | `backend/src/modules/analytics/metrics-layer.service.ts` | 650, 655, 660 | `restaurant_orders`, `chalet_bookings`, `pool_tickets` in `calculateMetric` active_transactions/guests_on_property | (a) replace with transactions table |
| 2 | `backend/src/modules/analytics/metrics-layer.service.ts` | 860, 877, 895 | `restaurant_orders`, `chalet_bookings`, `pool_tickets` in `getEngineHealth` per-engine queries | (a) replace with transactions table |
| 3 | `backend/src/modules/analytics/metrics-layer.service.ts` | 919, 927, 934 | Same tables in sparkline loop inside `getEngineHealth` | (a) replace with transactions table |
| 4 | `backend/src/modules/analytics/metrics-layer.service.ts` | 1013-1030 | All 3 tables × 2 (today/yesterday) in `getHourlyRevenue` | (a) replace with transactions table |
| 5 | `backend/src/modules/analytics/metrics-layer.service.ts` | 1124, 1144 | `restaurant_orders`, `chalet_bookings` in `getTimeline` | (a) replace with transactions table |
| 6 | `backend/src/modules/admin/services/dashboard.service.ts` | 74-129 | All 4 tables (`restaurant_orders`, `snack_orders`, `chalet_bookings`, `pool_tickets`) in `getDashboardStats` | (a) replace with transactions table |
| 7 | `backend/src/modules/admin/services/dashboard.service.ts` | 191 | `restaurant_orders` in `getRecentOrders` | (b) engine-specific detail |
| 8 | `backend/src/modules/admin/services/dashboard.service.ts` | 219-238 | All 4 tables in `getRevenueByPeriod` | (a) replace with transactions table |
| 9 | `backend/src/services/business-metrics.service.ts` | 163 | `.from('transactions')` — references a transactions table that **does not exist** in the DB | (a) this is the target, but table must be created |
| 10 | `backend/src/services/business-metrics.service.ts` | 187-199 | `switch(tx.type)` with `'booking'`, `'food'`, `'pool_ticket'` | (a) replace with engine_type values |
| 11 | `backend/src/services/business-metrics.service.ts` | 311, 315 | `orders`, `pool_tickets` in `getOperationalMetrics` | (a) replace with transactions table |
| 12 | `backend/src/modules/admin/admin.controller.ts` | 78-90 | `snack_orders` × 2 in dashboard stats | (a) replace with transactions table |
| 13 | `backend/src/modules/admin/admin.controller.ts` | 1105-1109 | `snack_orders` in recent activity | (a) replace with transactions table |
| 14 | `backend/src/modules/admin/admin.controller.ts` | 1350-1353 | `snack_orders` in export | (b) engine-specific detail |
| 15 | `backend/src/modules/admin/admin.controller.ts` | 1596-1600 | All 4 tables in customer lookup | (a) replace with transactions table |
| 16 | `backend/src/modules/admin/controllers/reports.controller.ts` | 421-437 | `restaurant_orders`, `pool_tickets`, `snack_orders` in CSV export | (b) engine-specific detail |
| 17 | `backend/src/modules/users/user.controller.ts` | 406-409 | All 4 tables in user activity | (a) replace with transactions table |
| 18 | `backend/src/modules/users/gdpr.controller.ts` | 63-81 | All 4 tables in GDPR export | (b) engine-specific detail — must remain for PII access |
| 19 | `backend/src/modules/users/gdpr.controller.ts` | 261-272 | All 4 tables in GDPR anonymize | (b) engine-specific detail — must remain |
| 20 | `backend/src/modules/staff/module-staff.controller.ts` | 997-1000 | All 4 tables in customer spend | (a) replace with transactions table |
| 21 | `backend/src/modules/staff/staff.controller.ts` | 992-995 | All 4 tables in customer spend | (a) replace with transactions table |
| 22 | `backend/src/modules/manager/shifts.controller.ts` | 29-33 | All 4 tables in shift stats | (a) replace with transactions table |
| 23 | `backend/src/modules/manager/shifts.controller.ts` | 478-482 | All 4 tables in shift report | (a) replace with transactions table |
| 24 | `backend/src/modules/manager/approvals.controller.ts` | 358-375 | `restaurant_orders`, `chalet_bookings`, `pool_tickets` in void/comp | (b) engine-specific detail — must update status on source table |
| 25 | `backend/src/modules/payments/payment.controller.ts` | 353-369 | `snack_orders`, `pool_tickets` in payment status update | (b) engine-specific detail |
| 26 | `backend/src/modules/payments/loyalty-integration.ts` | 37-67 | `restaurant_orders`, `snack_orders`, `chalet_bookings`, `pool_tickets` in user lookup | (b) engine-specific detail — needs user_id from source |
| 27 | `backend/src/services/booking-reminders.service.ts` | 16-59 | `chalet_bookings` for reminder emails | (b) engine-specific detail — needs chalet name, dates |
| 28 | `backend/src/services/booking-modification.service.ts` | 111-575 | `chalet_bookings`, `pool_tickets` for modification | (b) engine-specific detail — full CRUD |
| 29 | `backend/src/services/seasonal-pricing.service.ts` | 372 | `chalet_bookings` for occupancy calc | (b) engine-specific detail |
| 30 | `backend/src/utils/transaction.ts` | 71-147 | `chalet_bookings`, `restaurant_orders` in transaction helpers | (b) engine-specific detail — insert into source |
| 31 | `backend/src/scripts/expire-pool-tickets.ts` | 26-50 | `pool_tickets` for expiration cron | (b) engine-specific detail |
| 32 | `backend/src/scripts/check_pool_schema.ts` | 14 | `pool_tickets` for schema check | (c) dev script, low priority |
| 33 | `backend/src/modules/reporting/reporting.service.ts` | 237 | `config.table || 'bookings'` — dynamic table name from template | (c) view abstraction — already generic |

### 1B. Files that hardcode legacy type strings (ReferenceType, tx.type, module names)

| # | File | Lines | What it hardcodes | Fix |
|---|------|-------|-------------------|-----|
| 1 | `backend/src/lib/container/types.ts` | 956 | `ReferenceType = 'order' \| 'booking' \| 'pool_ticket' \| 'snack_order'` | Replace with `EngineType` from shared |
| 2 | `backend/src/lib/services/payment.service.ts` | 28 | `VALID_REFERENCE_TYPES = ['order', 'booking', 'pool_ticket', 'snack_order']` | Replace with engine types |
| 3 | `backend/src/validation/schemas.ts` | 207, 212, 219 | `z.enum(['restaurant_order', 'snack_order', 'chalet_booking', 'pool_ticket'])` | Replace with engine-type enums |
| 4 | `backend/src/services/stripe-platform.service.ts` | 91 | `referenceType: 'order' \| 'booking' \| 'pool_ticket' \| 'snack_order'` | Replace with EngineType |
| 5 | `backend/src/modules/payments/payment.v1.routes.ts` | 24 | `z.enum(['order', 'booking', 'pool_ticket', 'snack_order'])` | Replace with engine-type enums |
| 6 | `backend/src/services/business-metrics.service.ts` | 21-30 | `RevenueMetrics` interface: `accommodation_revenue`, `food_revenue`, `pool_revenue` | Replace with `engine_revenue: Record<EngineType, number>` |
| 7 | `backend/src/services/business-metrics.service.ts` | 44-53 | `OperationalMetrics`: `orders_today`, `pool_tickets_today` | Replace with engine-agnostic fields |
| 8 | `backend/src/modules/admin/services/dashboard.service.ts` | 4-27 | `DashboardStats` interface: `restaurantRevenue`, `snackRevenue`, `chaletRevenue`, `poolRevenue` | Replace with `revenueByEngine` |
| 9 | `backend/src/modules/admin/services/dashboard.service.ts` | 29-35 | `RevenueDataPoint`: `restaurant`, `snack`, `chalet`, `pool` | Replace with `Record<EngineType, number>` |
| 10 | `frontend/src/app/admin/cockpit/page.tsx` | 42-66 | `ENGINE_CONFIG` with hardcoded colors/names per engine | Derive from `/analytics/engines` response |
| 11 | `frontend/src/app/admin/cockpit/page.tsx` | 1191-1194 | Hardcoded 4-engine initial state | Derive from API |
| 12 | `frontend/src/app/admin/cockpit/page.tsx` | 1221-1224 | Hardcoded `revenueByEngine` initial state | Derive from API |
| 13 | `frontend/src/components/payments/StripePayment.tsx` | 129 | `referenceType: 'restaurant_order' \| 'snack_order' \| 'chalet_booking' \| 'pool_ticket'` | Replace with engine-type |
| 14 | `frontend/src/stores/cartStore.ts` | 141-142 | `type: 'restaurant'`, `moduleId: 'restaurant'` | Derive from module config |
| 15 | `frontend/src/lib/api.ts` | 367-398 | Separate `restaurantApi`, `chaletsApi`, `poolApi` | Keep — these are engine-specific UI routes, not analytics |

---

## 2. MIGRATION PLAN (ordered, independently deployable steps)

### Step 1: Create the `transactions` table
**Safe because**: Additive only. No existing code breaks. Table is empty initially.

- Create migration `20260506000000_create_transactions_table.sql`
- See Section 3 for exact SQL
- Add trigger/function to backfill from existing tables (run once)

### Step 2: Add write-side hooks — every engine-specific insert/update also writes to `transactions`
**Safe because**: Dual-write. Existing tables remain authoritative. Transactions table is a shadow copy.

- Add `transactionLedger` service in `backend/src/engines/transaction-ledger.ts`
- Hook into:
  - `restaurant_orders` AFTER INSERT/UPDATE trigger (via SQL)
  - `chalet_bookings` AFTER INSERT/UPDATE trigger (via SQL)
  - `pool_tickets` AFTER INSERT/UPDATE trigger (via SQL)
  - `snack_orders` AFTER INSERT/UPDATE trigger (via SQL)
- Each trigger resolves `module_id` → `engine_type` from the `modules` table and writes the financial row
- Alternatively (preferred for control): call `transactionLedger.record()` from the engine service layer after each successful operation

### Step 3: Backfill the `transactions` table from existing data
**Safe because**: Read-only from source tables. Insert-only into transactions.

- SQL script that INSERTs into `transactions` from each legacy table
- Maps `module_id` → `engine_type` using the `modules` table
- Sets `reference_id` = source table PK, `reference_table` = source table name

### Step 4: Create `GET /analytics/engines` endpoint
**Safe because**: New endpoint. No existing endpoint changes.

- See Section 5 for full spec
- Queries `modules` + `transactions` tables only
- No hardcoded table names

### Step 5: Refactor `metrics-layer.service.ts` to use `transactions` table
**Safe because**: Internal service change. Same output shape.

- Replace all `from('restaurant_orders')` / `from('chalet_bookings')` / `from('pool_tickets')` with `from('transactions')`
- `getEngineHealth`: query `transactions` grouped by `engine_type`
- `getHourlyRevenue`: query `transactions` grouped by hour
- `getFinancialRows`: query `transactions` for today/yesterday/week
- `getTimeline`: query `transactions` for recent events
- `calculateMetric` active_transactions: query `transactions` WHERE status IN (active states)

### Step 6: Refactor `dashboard.service.ts` to use `transactions` table
**Safe because**: Internal service change. Same output shape (initially).

- `getDashboardStats`: single query to `transactions` grouped by `engine_type`
- `getRevenueByPeriod`: query `transactions` grouped by date + engine_type
- `getRecentOrders`: keep legacy table for detail, but add `transactions` join for engine_type

### Step 7: Refactor `business-metrics.service.ts`
**Safe because**: Internal service change.

- Replace `RevenueMetrics` interface: `accommodation_revenue`/`food_revenue`/`pool_revenue` → `engine_revenue: Record<EngineType, number>`
- Replace `switch(tx.type)` with `engine_type` from transactions table
- Replace `OperationalMetrics` hardcoded fields with engine-agnostic counts

### Step 8: Update `ReferenceType` across the payment layer
**Safe because**: Type rename. Add new values, keep old as aliases during transition.

- `container/types.ts`: `ReferenceType` → union of engine types + legacy aliases
- `payment.service.ts`: `VALID_REFERENCE_TYPES` → engine types
- `validation/schemas.ts`: update z.enum
- `stripe-platform.service.ts`: update referenceType
- `payment.v1.routes.ts`: update z.enum
- `loyalty-integration.ts`: resolve user_id from `transactions.customer_id` first, fall back to source table

### Step 9: Refactor cockpit frontend
**Safe because**: UI-only change. Consumes new endpoint.

- Remove hardcoded `ENGINE_CONFIG` — derive from `/analytics/engines` response
- Remove hardcoded initial state arrays — derive from API
- Engine colors/names come from backend response
- `revenueByEngine` initial state: empty array, populated from API

### Step 10: Clean up legacy references in reporting/admin
**Safe because**: Last step. All consumers already migrated.

- `admin.controller.ts`: replace 4-table queries with transactions
- `reports.controller.ts`: CSV exports can query transactions + join source table for detail
- `user.controller.ts`: activity feed from transactions
- `gdpr.controller.ts`: KEEP source table references (PII access requires source)
- `shifts.controller.ts`: shift stats from transactions
- `approvals.controller.ts`: KEEP source table references (must update status on source)

---

## 3. SCHEMA CHANGES

### 3A. `transactions` table

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    engine_type VARCHAR(50) NOT NULL,  -- 'instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement'
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    service_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reference_id UUID NOT NULL,          -- FK to the engine-specific table row
    reference_table VARCHAR(50) NOT NULL, -- 'restaurant_orders', 'chalet_bookings', 'pool_tickets', 'snack_orders'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'          -- engine-specific fields (order_number, booking_number, etc.)
);

-- Indexes for common query patterns
CREATE INDEX idx_transactions_property_id ON transactions(property_id);
CREATE INDEX idx_transactions_engine_type ON transactions(engine_type);
CREATE INDEX idx_transactions_module_id ON transactions(module_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_property_engine ON transactions(property_id, engine_type);
CREATE INDEX idx_transactions_property_date ON transactions(property_id, created_at);
CREATE INDEX idx_transactions_property_engine_date ON transactions(property_id, engine_type, created_at);

-- RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_property_isolation ON transactions
    FOR ALL
    USING (property_id IN (
        SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    ));

COMMIT;
```

### 3B. Backfill script

```sql
BEGIN;

-- From restaurant_orders
INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, service_charge, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
SELECT
    ro.module_id,
    COALESCE(m.engine_type, 'instant_transaction'),
    ro.property_id,
    ro.payment_status,
    COALESCE(ro.total_amount, 0),
    COALESCE(ro.tax_amount, 0),
    COALESCE(ro.service_charge, 0),
    COALESCE(ro.discount_amount, 0),
    COALESCE(ro.total_amount, 0) - COALESCE(ro.discount_amount, 0),
    'USD',
    ro.customer_id,
    ro.id,
    'restaurant_orders',
    ro.created_at,
    ro.completed_at,
    jsonb_build_object('order_number', ro.order_number, 'order_type', ro.order_type)
FROM restaurant_orders ro
LEFT JOIN modules m ON ro.module_id = m.id
WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.reference_id = ro.id AND t.reference_table = 'restaurant_orders');

-- From chalet_bookings
INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, service_charge, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
SELECT
    NULL, -- bookings don't have module_id currently
    'time_exclusive_reservation',
    cb.property_id,
    COALESCE(cb.payment_status, 'pending'),
    COALESCE(cb.total_price, 0),
    0, 0, 0,
    COALESCE(cb.total_price, 0),
    'USD',
    cb.user_id,
    cb.id,
    'chalet_bookings',
    cb.created_at,
    CASE WHEN cb.status IN ('checked_out', 'CHECKED_OUT') THEN cb.updated_at ELSE NULL END,
    jsonb_build_object('booking_number', cb.booking_number, 'chalet_id', cb.chalet_id)
FROM chalet_bookings cb
WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.reference_id = cb.id AND t.reference_table = 'chalet_bookings');

-- From pool_tickets
INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, service_charge, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
SELECT
    NULL,
    'shared_capacity_access',
    pt.property_id,
    pt.payment_status,
    COALESCE(pt.total_price, 0),
    0, 0, 0,
    COALESCE(pt.total_price, 0),
    'USD',
    pt.user_id,
    pt.id,
    'pool_tickets',
    pt.created_at,
    NULL,
    jsonb_build_object('ticket_number', pt.ticket_number, 'session_id', pt.session_id)
FROM pool_tickets pt
WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.reference_id = pt.id AND t.reference_table = 'pool_tickets');

-- From snack_orders (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snack_orders') THEN
    INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, service_charge, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
    SELECT
        so.module_id,
        'instant_transaction',
        so.property_id,
        so.payment_status,
        COALESCE(so.total_amount, 0),
        COALESCE(so.tax_amount, 0),
        0,
        COALESCE(so.discount_amount, 0),
        COALESCE(so.total_amount, 0) - COALESCE(so.discount_amount, 0),
        'USD',
        so.customer_id,
        so.id,
        'snack_orders',
        so.created_at,
        so.completed_at,
        jsonb_build_object('order_number', so.order_number)
    FROM snack_orders so
    WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.reference_id = so.id AND t.reference_table = 'snack_orders');
  END IF;
END $$;

COMMIT;
```

### 3C. Sync triggers (keep transactions table in sync with source tables)

```sql
-- Example: restaurant_orders sync trigger
CREATE OR REPLACE FUNCTION sync_transaction_from_restaurant_order()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, service_charge, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
  VALUES (
    NEW.module_id,
    COALESCE((SELECT engine_type FROM modules WHERE id = NEW.module_id), 'instant_transaction'),
    NEW.property_id,
    NEW.payment_status,
    COALESCE(NEW.total_amount, 0),
    COALESCE(NEW.tax_amount, 0),
    COALESCE(NEW.service_charge, 0),
    COALESCE(NEW.discount_amount, 0),
    COALESCE(NEW.total_amount, 0) - COALESCE(NEW.discount_amount, 0),
    'USD',
    NEW.customer_id,
    NEW.id,
    'restaurant_orders',
    NEW.created_at,
    NEW.completed_at,
    jsonb_build_object('order_number', NEW.order_number, 'order_type', NEW.order_type)
  )
  ON CONFLICT DO NOTHING; -- idempotent
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction ON restaurant_orders;
CREATE TRIGGER trg_sync_transaction
  AFTER INSERT OR UPDATE OF status, payment_status, total_amount ON restaurant_orders
  FOR EACH ROW EXECUTE FUNCTION sync_transaction_from_restaurant_order();

-- Similar triggers for chalet_bookings, pool_tickets, snack_orders
-- (same pattern, different column mappings)
```

---

## 4. SERVICE CHANGES

### 4A. `business-metrics.service.ts` — Before/After

**BEFORE** (`RevenueMetrics` interface):
```ts
export interface RevenueMetrics {
  total_revenue: number;
  accommodation_revenue: number;
  food_revenue: number;
  pool_revenue: number;
  other_revenue: number;
  revenue_by_day: Array<{ date: string; amount: number }>;
  revenue_by_payment_method: Record<string, number>;
  average_transaction_value: number;
  refunds_total: number;
}
```

**AFTER**:
```ts
import type { EngineType } from '../../engines/types.js';

export interface RevenueMetrics {
  total_revenue: number;
  engine_revenue: Record<EngineType, number>;  // replaces accommodation/food/pool
  other_revenue: number;
  revenue_by_day: Array<{ date: string; amount: number }>;
  revenue_by_payment_method: Record<string, number>;
  average_transaction_value: number;
  refunds_total: number;
}
```

**BEFORE** (revenue categorization):
```ts
switch (tx.type) {
  case 'booking':
  case 'accommodation':
    metrics.accommodation_revenue += tx.amount;
    break;
  case 'order':
  case 'food':
    metrics.food_revenue += tx.amount;
    break;
  case 'pool_ticket':
  case 'pool':
    metrics.pool_revenue += tx.amount;
    break;
  default:
    metrics.other_revenue += tx.amount;
}
```

**AFTER**:
```ts
const engineType = tx.engine_type as EngineType;
if (engineType && metrics.engine_revenue.hasOwnProperty(engineType)) {
  metrics.engine_revenue[engineType] += tx.amount;
} else {
  metrics.other_revenue += tx.amount;
}
```

### 4B. `dashboard.service.ts` — Before/After

**BEFORE** (`DashboardStats`):
```ts
interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalBookings: number;
  totalGuests: number;
  restaurantRevenue: number;
  snackRevenue: number;
  chaletRevenue: number;
  poolRevenue: number;
  todayStats: {
    restaurantOrders: number;
    snackOrders: number;
    chaletBookings: number;
    poolTickets: number;
    restaurantRevenue: number;
    snackRevenue: number;
    chaletRevenue: number;
    poolRevenue: number;
  };
}
```

**AFTER**:
```ts
import type { EngineType } from '../../../engines/types.js';

interface DashboardStats {
  totalTransactions: number;
  totalRevenue: number;
  revenueByEngine: Record<EngineType, number>;
  transactionCountByEngine: Record<EngineType, number>;
  todayStats: {
    revenueByEngine: Record<EngineType, number>;
    transactionCountByEngine: Record<EngineType, number>;
  };
  ordersChange: number;
  revenueChange: number;
}
```

**BEFORE** (4 parallel queries):
```ts
const [restaurantOrdersResult, restaurantRevenueResult, snackOrdersResult, snackRevenueResult, ...] = await Promise.all([
  this.supabase.from('restaurant_orders').select(...),
  this.supabase.from('snack_orders').select(...),
  this.supabase.from('chalet_bookings').select(...),
  this.supabase.from('pool_tickets').select(...),
]);
```

**AFTER** (single query):
```ts
const { data: todayTx } = await this.supabase
  .from('transactions')
  .select('engine_type, amount, status')
  .eq('property_id', propertyId)
  .gte('created_at', today)
  .lte('created_at', endOfDay);

const stats = { revenueByEngine: {}, transactionCountByEngine: {} };
for (const tx of todayTx || []) {
  const e = tx.engine_type as EngineType;
  stats.revenueByEngine[e] = (stats.revenueByEngine[e] || 0) + (tx.amount || 0);
  stats.transactionCountByEngine[e] = (stats.transactionCountByEngine[e] || 0) + 1;
}
```

### 4C. `metrics-layer.service.ts` — Before/After

**BEFORE** (`getEngineHealth` — 3 separate table queries per engine):
```ts
if (engineType === 'instant_transaction') {
  const { data: orders } = await this.supabase.from('restaurant_orders')...
} else if (engineType === 'time_exclusive_reservation') {
  const { data: bookings } = await this.supabase.from('chalet_bookings')...
} else if (engineType === 'shared_capacity_access') {
  const { data: tickets } = await this.supabase.from('pool_tickets')...
}
```

**AFTER** (single query, engine-agnostic):
```ts
const { data: txData } = await this.supabase
  .from('transactions')
  .select('engine_type, status, amount, created_at')
  .eq('property_id', propertyId)
  .gte('created_at', todayStart)
  .lte('created_at', todayEnd);

// Group by engine_type
const engineGroups = {};
for (const tx of txData || []) {
  if (!engineGroups[tx.engine_type]) engineGroups[tx.engine_type] = [];
  engineGroups[tx.engine_type].push(tx);
}

// Build result from grouped data — no hardcoded table names
```

---

## 5. NEW ENDPOINT SPEC

### `GET /analytics/engines`

**TypeScript response interface**:
```ts
import type { EngineType } from '../../engines/types.js';

interface EngineModuleSummary {
  moduleId: string;
  moduleName: string;
  templateType: string;
  engineType: EngineType;
  isActive: boolean;
  revenueToday: number;
  revenueYesterday: number;
  transactionCountToday: number;
  transactionCountYesterday: number;
  stateDistribution: Record<string, number>;  // e.g., { pending: 3, completed: 12 }
  sparkline: number[];  // 7-day revenue
}

interface EngineGroupSummary {
  engineType: EngineType;
  engineName: string;           // from EngineDefinition.name
  moduleCount: number;
  revenueToday: number;
  revenueYesterday: number;
  transactionCountToday: number;
  transactionCountYesterday: number;
  stateDistribution: Record<string, number>;
  sparkline: number[];
  modules: EngineModuleSummary[];
}

interface EnginesResponse {
  engines: EngineGroupSummary[];
  generatedAt: string;
}
```

**Query logic sketch**:
```ts
async getEngines(propertyId: string): Promise<EnginesResponse> {
  const now = dayjs();
  const todayStart = now.startOf('day').toISOString();
  const todayEnd = now.endOf('day').toISOString();
  const yesterdayStart = now.subtract(1, 'day').startOf('day').toISOString();
  const yesterdayEnd = now.subtract(1, 'day').endOf('day').toISOString();

  // 1. Get all active modules for this property
  const { data: modules } = await this.supabase
    .from('modules')
    .select('id, name, template_type, engine_type, is_active')
    .eq('property_id', propertyId)
    .eq('is_active', true);

  // 2. Get today's transactions grouped by engine_type
  const { data: todayTx } = await this.supabase
    .from('transactions')
    .select('engine_type, module_id, status, amount')
    .eq('property_id', propertyId)
    .gte('created_at', todayStart)
    .lte('created_at', todayEnd);

  // 3. Get yesterday's transactions grouped by engine_type
  const { data: yesterdayTx } = await this.supabase
    .from('transactions')
    .select('engine_type, module_id, status, amount')
    .eq('property_id', propertyId)
    .gte('created_at', yesterdayStart)
    .lte('created_at', yesterdayEnd);

  // 4. Get 7-day sparkline per engine_type
  const { data: sparklineData } = await this.supabase
    .from('transactions')
    .select('engine_type, amount, created_at')
    .eq('property_id', propertyId)
    .gte('created_at', now.subtract(6, 'day').startOf('day').toISOString());

  // 5. Build response grouped by engine_type, with per-module breakdown
  // ... aggregate in-memory from the fetched data
  // ... use getEngine(engineType).name for engineName

  return { engines, generatedAt: new Date().toISOString() };
}
```

---

## 6. RISK ASSESSMENT

### Step 1: Create transactions table
- **Risk**: None. Additive only.
- **Rollback**: `DROP TABLE transactions;`

### Step 2: Add write-side hooks
- **Risk**: Triggers could slow down writes. Dual-write could have consistency gaps if trigger fails.
- **Mitigation**: Use `AFTER INSERT OR UPDATE` triggers with `ON CONFLICT DO NOTHING`. Monitor trigger latency.
- **Rollback**: `DROP TRIGGER trg_sync_transaction ON restaurant_orders;` etc.

### Step 3: Backfill
- **Risk**: Large data volume could lock tables. Long-running INSERT.
- **Mitigation**: Run in batches of 1000 rows with `LIMIT` + `OFFSET`. Run during low-traffic window.
- **Rollback**: `TRUNCATE transactions;` (no source data is mutated)

### Step 4: New endpoint
- **Risk**: None. New endpoint, no existing consumers.
- **Rollback**: Remove route registration.

### Step 5: Refactor metrics-layer.service
- **Risk**: Output shape change could break frontend if field names differ.
- **Mitigation**: Keep response shape identical. Add integration test comparing old vs new output.
- **Rollback**: Revert to legacy table queries.

### Step 6: Refactor dashboard.service
- **Risk**: `DashboardStats` interface change breaks consumers.
- **Mitigation**: Add adapter layer that maps new `revenueByEngine` to legacy `restaurantRevenue`/etc. for backward compatibility during transition.
- **Rollback**: Revert service.

### Step 7: Refactor business-metrics
- **Risk**: Same interface change risk.
- **Mitigation**: Same adapter approach.
- **Rollback**: Revert.

### Step 8: Update ReferenceType
- **Risk**: Breaking change for payment webhooks, Stripe metadata, and existing payment records.
- **Mitigation**: Add new engine-type values alongside legacy values. Support both in validation. Migrate existing payment records' `reference_type` column. Update Stripe metadata on new payments only.
- **Rollback**: Revert type definitions.

### Step 9: Refactor cockpit frontend
- **Risk**: UI breaks if `/analytics/engines` returns unexpected shape.
- **Mitigation**: Add fallback to `/analytics/snapshot` if engines endpoint fails. Test with empty data.
- **Rollback**: Revert to hardcoded ENGINE_CONFIG.

### Step 10: Clean up legacy references
- **Risk**: Highest risk step. Touches many files.
- **Mitigation**: Do file-by-file with build verification after each. Keep `gdpr.controller.ts` and `approvals.controller.ts` on source tables permanently (category b).
- **Rollback**: Git revert per file.

### Cross-cutting risks
- **Data loss**: None. Source tables are never dropped or truncated. Transactions table is a derived copy.
- **Performance**: The transactions table with proper indexes should be faster than 4-table UNION queries. Monitor with EXPLAIN ANALYZE.
- **Consistency**: Triggers ensure eventual consistency. For critical financial reports, add a reconciliation job that compares `transactions` totals vs source table totals.
