# Unified Customization System

A comprehensive, cross-module customization system for V2 Resort that supports all customizable entities (menu items, chalets, spa services, activities, etc.) with a single, consistent data model.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Transactional Order Processing](#transactional-order-processing)
6. [Refund & Reversal Flow](#refund--reversal-flow)
7. [Observability](#observability)
8. [Dual-Write Migration](#dual-write-migration)
9. [Frontend Components](#frontend-components)
10. [Admin UI](#admin-ui)
11. [Performance](#performance)
12. [Security (RLS)](#security-rls)
13. [Migration Guide](#migration-guide)

---

## Overview

The Unified Customization System replaces module-specific customization implementations (menu modifiers, chalet add-ons, spa upgrades) with a single, flexible system that:

- Supports **10 entity types**: menu_item, snack_bar_item, chalet, pool_session, spa_service, activity, rental_item, event_ticket, room, package
- Handles **5 customization types**: add, remove, swap, upgrade, replace
- Provides **3 selection modes**: single, multiple, quantity
- Supports **5 price types**: fixed, percentage, per_unit, per_night, per_person
- Includes **inventory tracking** with automatic deduction and reversal
- Offers **full observability** with events and metrics
- Enables **safe migration** via dual-write monitoring

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend                                       │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────┐ │
│  │ CustomizationSelector│  │  useCustomizations   │  │   Admin UI     │ │
│  │     (Component)      │  │     (Hooks)          │  │                │ │
│  └──────────┬──────────┘  └──────────┬───────────┘  └────────┬───────┘ │
└─────────────┼─────────────────────────┼────────────────────────┼────────┘
              │                         │                        │
              ▼                         ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Backend API                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    /api/v1/customizations                          │ │
│  │  GET /for-entity/:type/:id  │  POST /validate  │  POST /orders/... │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    CustomizationService                            │ │
│  │  createOrderSnapshot() │ reverseOrderItemInventory() │ emitEvent() │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Supabase/PostgreSQL                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │ customization_groups│  │customization_options│  │entity_customiz..│ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────┘ │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │ order_customizations│  │customization_events │  │ ...metrics      │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  SQL Functions: validate_customizations, process_inventory_safe │   │
│  │  create_order_customization_snapshot, reverse_order_item_inv... │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

```sql
-- Customization Groups (e.g., "Size", "Extra Toppings", "Room Upgrades")
customization_groups
├── id UUID PRIMARY KEY
├── name, name_ar, name_fr TEXT
├── selection_mode ENUM ('single', 'multiple', 'quantity')
├── min_selections, max_selections INT
├── is_required BOOLEAN
├── applicable_entity_types TEXT[]
├── is_global BOOLEAN
├── is_available BOOLEAN
└── sort_order INT

-- Customization Options (e.g., "Large", "Extra Cheese", "Sea View")
customization_options
├── id UUID PRIMARY KEY
├── group_id UUID REFERENCES customization_groups
├── name, name_ar, name_fr TEXT
├── customization_type ENUM ('add', 'remove', 'swap', 'upgrade', 'replace')
├── price_adjustment DECIMAL
├── price_type ENUM ('fixed', 'percentage', 'per_unit', 'per_night', 'per_person')
├── inventory_item_id UUID REFERENCES inventory_items
├── quantity_per_selection DECIMAL
├── replaces_inventory_item_id UUID
├── is_default, is_popular BOOLEAN
└── is_available BOOLEAN

-- Links groups to specific entities with overrides
entity_customizations
├── id UUID PRIMARY KEY
├── entity_type ENUM (10 types)
├── entity_id UUID
├── customization_group_id UUID
├── is_required_override, min/max_selections_override
├── price_multiplier DECIMAL
└── is_enabled BOOLEAN

-- Order snapshots (immutable for receipts/auditing)
order_customizations
├── id UUID PRIMARY KEY
├── order_type, order_id, order_item_id
├── customization_group_id, customization_option_id
├── group_name, option_name (snapshot at order time)
├── quantity, unit_price_adjustment, total_price_adjustment
├── inventory_item_id, inventory_quantity_used, inventory_deducted
├── reversed_at, reversed_by, reversal_reason (for refunds)
└── created_at
```

### Observability Tables

```sql
-- Event log for monitoring and debugging
customization_events
├── id UUID PRIMARY KEY
├── event_type TEXT ('price.calculated', 'inventory.warning', 'inventory.executed', 'inventory.reversed')
├── entity_type, entity_id, order_type, order_id
├── payload JSONB
└── created_at TIMESTAMPTZ

-- Metrics for performance monitoring
customization_metrics
├── id UUID PRIMARY KEY
├── metric_name TEXT ('validation_latency_ms', 'inventory_processing_ms')
├── metric_value DECIMAL
├── dimensions JSONB
└── recorded_at TIMESTAMPTZ

-- Migration validation
customization_dual_write_log
├── operation TEXT
├── old_system_result, new_system_result JSONB
├── results_match BOOLEAN
└── discrepancies JSONB
```

---

## API Endpoints

### Public (Customer-Facing)

```
GET  /api/v1/customizations/for-entity/:entityType/:entityId
     → Returns available customization groups and options for an entity

POST /api/v1/customizations/validate
     Body: { entityType, entityId, selections: [{ optionId, quantity }] }
     → Validates selections and returns price adjustment

GET  /api/v1/customizations/orders/:orderType/:orderId
     → Returns customizations for an order (receipts, staff display)
```

### Protected (Staff/Admin)

```
# Transactional Order Processing
POST /api/v1/customizations/orders/snapshot
     Body: { orderType, orderId, orderItemId?, entityType, entityId, selections, baseQuantity?, executeInventory? }
     → Creates atomic snapshot + inventory deduction

POST /api/v1/customizations/orders/reverse
     Body: { snapshotId, reason? }
     → Reverses inventory for refunds (admin/manager only)

GET  /api/v1/customizations/orders/:orderType/:orderId/reversible
     → Lists customizations that can be reversed

# CRUD Operations
POST/PUT/DELETE /api/v1/customizations/groups/:id
POST/PUT/DELETE /api/v1/customizations/options/:id
POST/PUT/DELETE /api/v1/customizations/entity-links/:id

# Observability
GET  /api/v1/customizations/events
GET  /api/v1/customizations/metrics
GET  /api/v1/customizations/dual-write/stats
GET  /api/v1/customizations/dual-write/discrepancies

# Migration
POST /api/v1/customizations/migrate
     → Migrates existing menu modifiers to unified system
```

---

## Transactional Order Processing

When an order is confirmed, use `create_order_customization_snapshot` to atomically:

1. **Validate** all selections against current rules
2. **Create snapshots** with prices locked at order time
3. **Execute inventory** deductions
4. **Emit events** for observability
5. **Record metrics** for performance tracking

```typescript
const result = await customizationService.createOrderSnapshot({
  orderType: 'restaurant_order',
  orderId: 'order-123',
  orderItemId: 'item-456', // optional
  entityType: 'menu_item',
  entityId: 'menu-item-789',
  selections: [
    { optionId: 'opt-large', quantity: 1 },
    { optionId: 'opt-extra-cheese', quantity: 2 }
  ],
  baseQuantity: 1,
  executeInventory: true // default true
});

// Returns:
{
  success: true,
  snapshotId: 'snap-xxx',
  totalPriceAdjustment: 5.50,
  inventoryResult: {
    items_added: 2,
    items_removed: 0,
    items_swapped: 0,
    deduction_log: [...]
  },
  errors: [],
  eventIds: ['evt-1', 'evt-2']
}
```

---

## Refund & Reversal Flow

**CRITICAL for financial accuracy**: When refunding an order with customizations:

```typescript
// 1. Get reversible customizations
const reversible = await customizationService.getReversibleOrderCustomizations(
  'restaurant_order',
  'order-123'
);

// 2. Reverse inventory (restores stock + marks as reversed)
const result = await customizationService.reverseOrderItemInventory(
  'snap-xxx',      // snapshot ID
  'Customer refund', // reason
  'user-456'       // reversed by (optional)
);

// Returns:
{
  success: true,
  itemsReversed: 2,
  reversalLog: [
    { action: 'inventory_restored', inventoryItemId: 'inv-1', quantity: 2 }
  ],
  errorMessage: null
}
```

Safeguards:
- Idempotent: Cannot reverse already-reversed snapshots
- Auditable: `reversed_at`, `reversed_by`, `reversal_reason` tracked
- Event emitted: `inventory.reversed` for monitoring

---

## Observability

### Events Emitted

| Event Type | When | Payload |
|------------|------|---------|
| `price.calculated` | Validation success | selections_count, total_price, latency_ms |
| `validation.failed` | Validation failure | errors, latency_ms |
| `inventory.warning` | Low/insufficient stock | item_id, current_stock, required |
| `inventory.executed` | Stock deducted | items_added/removed/swapped, log |
| `inventory.reversed` | Refund processed | items_reversed, reason |

### Metrics Recorded

| Metric | Target | Description |
|--------|--------|-------------|
| `validation_latency_ms` | <50ms p95 | Time to validate selections |
| `inventory_processing_ms` | <50ms p95 | Time to process inventory |

### Accessing Observability Data

```typescript
// Get recent events
const events = await customizationService.getEvents({
  eventType: 'inventory.warning',
  since: new Date(Date.now() - 3600000) // last hour
});

// Get performance metrics
const metrics = await customizationService.getMetricsSummary();
// Returns: p50, p95, p99 for each metric
```

---

## Dual-Write Migration

For safe migration from old modifier systems:

### Phase 1: Enable Dual-Write

When processing orders, write to both old and new systems, then compare:

```typescript
const oldResult = await legacyModifierService.process(...);
const newResult = await customizationService.createOrderSnapshot(...);

await customizationService.logDualWriteComparison(
  'process_order',
  oldResult,
  newResult
);
```

### Phase 2: Monitor Match Rate

```typescript
const stats = await customizationService.getDualWriteStats();
// { total: 1000, matches: 995, mismatches: 5, matchRate: 99.5 }

// If matchRate < 99%, investigate discrepancies
const discrepancies = await customizationService.getDualWriteDiscrepancies(100);
```

### Phase 3: Cutover

After at least one week with >99.9% match rate:
1. Stop dual-write
2. Route all traffic to new system
3. Keep old tables for rollback (30 days)
4. Drop old tables after verification

---

## Frontend Components

### CustomizationSelector

```tsx
import { CustomizationSelector } from '@/components/customization/CustomizationSelector';

<CustomizationSelector
  entityType="menu_item"
  entityId={menuItem.id}
  basePrice={menuItem.price}
  onSelectionsChange={(selections) => setSelections(selections)}
  onPriceChange={(adjustedPrice) => setTotalPrice(adjustedPrice)}
/>
```

### Hooks

```tsx
import {
  useCustomizations,
  useValidateCustomizations,
  useOrderCustomizations
} from '@/hooks/useCustomizations';

// Fetch customizations for an entity
const { groups, isLoading } = useCustomizations('menu_item', itemId);

// Validate selections
const { mutate: validate, data: result } = useValidateCustomizations();
validate({ entityType, entityId, selections });

// Get order customizations
const { data: orderCustomizations } = useOrderCustomizations('restaurant_order', orderId);
```

---

## Admin UI

Navigate to `/admin/customizations` to:

- **View all groups** with expandable options
- **Create/edit/delete** groups and options
- **Run migration** from legacy modifier system
- **Monitor metrics** (validation latency, inventory processing time)
- **Track dual-write** match rate during migration

---

## Performance

### Targets

| Operation | Target (p95) |
|-----------|--------------|
| Validate selections | <50ms |
| Calculate price | <50ms |
| Process inventory | <50ms |
| Full order snapshot | <100ms |
| Get entity customizations | <30ms |

### Indexes

```sql
idx_entity_customizations_lookup (entity_type, entity_id, is_enabled)
idx_customization_options_group (group_id, is_available)
idx_order_customizations_lookup (order_type, order_id, order_item_id)
```

### Optimization Tips

1. Always include `entity_type` + `entity_id` together for entity lookups
2. Use `includeOptions=true` query param to reduce round trips
3. Batch validate before order confirmation
4. Monitor `customization_metrics_summary` view for p95 trends

---

## Security (RLS)

### Row-Level Security Policies

| Table | Read | Insert | Update | Delete |
|-------|------|--------|--------|--------|
| customization_groups | Public | Admin/Manager | Admin/Manager | Admin only |
| customization_options | Public | Admin/Manager | Admin/Manager | Admin only |
| entity_customizations | Public | Admin/Manager/Staff | Admin/Manager/Staff | Admin/Manager |
| order_customizations | Staff+ | Service role only | Admin only | - |
| customization_events | Admin/Manager | System only | - | - |
| customization_metrics | Admin/Manager | System only | - | - |

### Server-Side Auth

All admin endpoints require authentication + role check:

```typescript
router.post('/groups', 
  authenticate, 
  authorize('admin', 'manager'),
  controller.createGroup
);

router.post('/orders/reverse',
  authenticate,
  authorize('admin', 'manager'), // Only admin/manager can reverse
  controller.reverseOrderItemInventory
);
```

---

## Migration Guide

### From Menu Modifiers

```bash
# 1. Run migration (copies data, doesn't delete originals)
POST /api/v1/customizations/migrate

# 2. Enable dual-write in order processing code

# 3. Monitor for 1+ week
GET /api/v1/customizations/dual-write/stats

# 4. Once stable, switch to new system only
```

### Adding New Entity Types

```sql
SELECT add_customizable_entity_type('new_entity_type');
```

Then update the TypeScript enum and frontend labels.

---

## Support

For issues or questions:
- Check `/api/v1/customizations/events` for recent errors
- Review `/admin/customizations` metrics tab
- File issue with event IDs for debugging
