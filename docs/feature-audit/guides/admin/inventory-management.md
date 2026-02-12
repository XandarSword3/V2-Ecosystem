# Admin Guide: Inventory Management

> Module: ADM-INV | Features: 18 | Role: super_admin | Updated: 2026-02-08

## Overview

The Inventory Management module provides full control over resort stock, suppliers, and procurement. Administrators track inventory items with real-time stock levels, configure low-stock alerts, manage suppliers, create purchase orders, and generate inventory reports. This module integrates directly with Restaurant Management (menu item ingredients), Housekeeping (cleaning supplies), and the POS system.

Data is stored in Supabase PostgreSQL tables: `inventory_items`, `inventory_categories`, `stock_adjustments`, `suppliers`, `purchase_orders`, `purchase_order_items`, and `low_stock_alerts`. The Express.js backend (localhost:3005) provides REST APIs under `/api/admin/inventory/*`. Stock changes emit Socket.IO events for real-time dashboard updates. Redis caches current stock levels for fast reads.

## Prerequisites

| Requirement | Details |
|---|---|
| Admin Access | Login at `/admin/login` with `admin@v2resort.com` / `admin123` |
| Role Required | `super_admin`, `admin`, or `manager` |
| Browser | Chrome 90+, Firefox 88+, Edge 90+ |
| Backend Running | Express.js API on `localhost:3005` |
| Frontend Running | Next.js 14 dev server on `localhost:3000` |
| Database | Supabase PostgreSQL with `inventory_items` table |
| Redis | Running for stock level caching |

## Features Covered

| # | Feature ID | Feature Name | Description | Status |
|---|---|---|---|---|
| 1 | INV-001 | Item List View | Paginated inventory items with search, filter, sort | ✅ Implemented |
| 2 | INV-002 | Create Item | Add new inventory item with all details and initial stock | ✅ Implemented |
| 3 | INV-003 | Edit Item | Update item details, unit, reorder levels | ✅ Implemented |
| 4 | INV-004 | Delete Item | Soft-delete item with stock history retained | ✅ Implemented |
| 5 | INV-005 | Stock Level Display | Current quantity shown per item with visual indicators | ✅ Implemented |
| 6 | INV-006 | Stock Adjustment (Add) | Increase stock with reason (delivery, return, correction) | ✅ Implemented |
| 7 | INV-007 | Stock Adjustment (Remove) | Decrease stock with reason (usage, damage, expired, theft) | ✅ Implemented |
| 8 | INV-008 | Stock Adjustment History | View log of all adjustments per item with timestamps | ✅ Implemented |
| 9 | INV-009 | Low Stock Alert Config | Set reorder point and reorder quantity per item | ✅ Implemented |
| 10 | INV-010 | Low Stock Notifications | Email/push alerts when stock falls below reorder point | ✅ Implemented |
| 11 | INV-011 | Supplier List | View all suppliers with contact info and status | ✅ Implemented |
| 12 | INV-012 | Create Supplier | Add supplier with company, contact person, terms | ✅ Implemented |
| 13 | INV-013 | Edit Supplier | Update supplier details and payment terms | ✅ Implemented |
| 14 | INV-014 | Delete Supplier | Deactivate supplier (blocked if open POs exist) | ✅ Implemented |
| 15 | INV-015 | Create Purchase Order | Generate PO with line items, quantities, prices | ✅ Implemented |
| 16 | INV-016 | Receive Purchase Order | Mark PO as received, auto-increment stock levels | ✅ Implemented |
| 17 | INV-017 | Purchase Order History | View all POs with status filters | ✅ Implemented |
| 18 | INV-018 | Inventory Reports | Stock valuation, usage trends, expiring items, turnover | ✅ Implemented |

## Dashboard Overview

**URL:** `http://localhost:3000/admin/inventory`

**API Base:** `http://localhost:3005/api/admin/inventory`

### Key Metrics (Top Cards)

| Metric | Description | API Endpoint |
|---|---|---|
| Total Items | Count of active inventory items | `GET /api/admin/inventory/stats` |
| Low Stock Items | Items below their `reorder_point` | `GET /api/admin/inventory/stats` |
| Total Stock Value | Sum of (`quantity × unit_cost`) for all items | `GET /api/admin/inventory/stats` |
| Pending POs | Purchase orders with `status = 'pending'` or `'ordered'` | `GET /api/admin/inventory/stats` |
| Expiring Soon | Items with `expiry_date` within next 7 days | `GET /api/admin/inventory/stats` |

### Quick Actions

- **+ Add Item** → Opens create inventory item form
- **+ New Purchase Order** → Opens PO creation wizard
- **Stock Adjustment** → Quick adjust modal for any item
- **Export Report** → Downloads current inventory as CSV/PDF

## CRUD Operations

### Inventory Items

#### Create Item

**URL:** `/admin/inventory/items/create`

**API:** `POST /api/admin/inventory/items`

**Steps:**
1. Click **+ Add Item** from the inventory dashboard
2. Fill in the item form:

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | Text input | 1–100 characters, unique per category | ✅ |
| `sku` | Text input | Alphanumeric + dashes, 1–30 chars, globally unique | ✅ |
| `category` | Select dropdown | Options: Food & Beverage, Cleaning, Linen, Amenities, Equipment, Office, Maintenance | ✅ |
| `description` | Textarea | Max 500 characters | ❌ |
| `unit` | Select dropdown | Each, Kg, Litre, Box, Pack, Case, Roll, Pair | ✅ |
| `unit_cost` | Number input | Decimal ≥ 0.00, 2 decimal places | ✅ |
| `selling_price` | Number input | Decimal ≥ 0.00 (for resale items only) | ❌ |
| `initial_quantity` | Number input | Integer ≥ 0 | ✅ |
| `reorder_point` | Number input | Integer ≥ 0, triggers low stock alert | ✅ |
| `reorder_quantity` | Number input | Integer ≥ 1, suggested order quantity | ✅ |
| `supplier_id` | Select dropdown | Link to existing supplier | ❌ |
| `location` | Text input | Storage location (e.g., "Warehouse A, Shelf 3") | ❌ |
| `expiry_date` | Date picker | Must be in the future | ❌ |
| `is_perishable` | Toggle | Enables expiry tracking and alerts | ❌ |
| `image` | File upload | JPEG/PNG/WebP, max 2MB | ❌ |

3. Click **Save Item**
4. On success: toast "Item created with initial stock of {quantity}", item appears in list
5. Stock level cached in Redis for fast dashboard reads

**Request Body Example:**
```json
{
  "name": "Extra Virgin Olive Oil",
  "sku": "FB-OIL-001",
  "category": "Food & Beverage",
  "unit": "Litre",
  "unit_cost": 8.50,
  "initial_quantity": 24,
  "reorder_point": 5,
  "reorder_quantity": 20,
  "supplier_id": "sup_abc123",
  "location": "Kitchen Store, Shelf B2",
  "is_perishable": true,
  "expiry_date": "2026-06-15"
}
```

#### Read / List Items

**URL:** `/admin/inventory`

**API:** `GET /api/admin/inventory/items?page=1&limit=25&search=&category=&stock_status=&sort=name&order=asc`

**Table Columns:**
| Column | Sortable | Description |
|---|---|---|
| Image | — | Product thumbnail |
| Name | ✅ | Item name |
| SKU | ✅ | Stock keeping unit code |
| Category | ✅ | Item category badge |
| Quantity | ✅ | Current stock level with color indicator |
| Unit | — | Unit of measurement |
| Unit Cost | ✅ | Cost per unit (£) |
| Stock Value | ✅ | `quantity × unit_cost` |
| Supplier | ✅ | Linked supplier name |
| Status | ✅ | In Stock (green), Low Stock (amber), Out of Stock (red) |
| Actions | — | Edit / Adjust Stock / Delete |

**Stock Status Filter:**
- All
- In Stock (quantity > reorder_point)
- Low Stock (0 < quantity ≤ reorder_point)
- Out of Stock (quantity = 0)

#### Update Item

**API:** `PUT /api/admin/inventory/items/:id`

1. Click **Edit** on item row
2. Modify any fields — same validation as Create
3. **Note:** Changing `unit_cost` does not retroactively change stock valuation (uses weighted average)
4. Click **Save Changes**

#### Delete Item

**API:** `DELETE /api/admin/inventory/items/:id`

1. Click **Delete** on item row
2. Confirmation modal: "Delete {name}? This will:"
   - Soft-delete the item (`deleted_at` set)
   - Retain all stock adjustment history
   - Remove from active low stock alerts
   - Unlink from any pending purchase order lines (PO lines marked `cancelled`)
3. Click **Confirm Delete**

### Stock Adjustments

**URL:** `/admin/inventory/items/:id/adjust` or quick adjust button

**API:** `POST /api/admin/inventory/items/:id/adjustments`

**Steps:**
1. Click **Adjust Stock** button on any item row (or from item detail page)
2. Modal opens with current quantity displayed
3. Select adjustment type:

| Adjustment Type | Direction | Reason Options |
|---|---|---|
| **Add Stock** | + Increase | Delivery received, Customer return, Stock correction, Transfer in |
| **Remove Stock** | - Decrease | Used/consumed, Damaged, Expired, Theft/loss, Transfer out, Sold |

4. Enter quantity (integer ≥ 1)
5. Enter notes (optional, max 200 chars)
6. Click **Confirm Adjustment**
7. System updates: `inventory_items.quantity`, creates `stock_adjustments` record, updates Redis cache
8. If new quantity ≤ `reorder_point`, triggers low stock notification

**Adjustment History:**
- View per item: `/admin/inventory/items/:id/history`
- API: `GET /api/admin/inventory/items/:id/adjustments`
- Shows: Date, Type (+/-), Quantity, Reason, Notes, Adjusted By (user), Running Total

### Supplier Management

#### Create Supplier

**URL:** `/admin/inventory/suppliers/create`

**API:** `POST /api/admin/inventory/suppliers`

| Field | Type | Validation | Required |
|---|---|---|---|
| `company_name` | Text input | 1–100 characters, unique | ✅ |
| `contact_person` | Text input | 1–60 characters | ✅ |
| `email` | Email input | Valid email format | ✅ |
| `phone` | Tel input | Valid phone number | ✅ |
| `address` | Textarea | Max 300 characters | ❌ |
| `payment_terms` | Select | Net 15, Net 30, Net 60, COD, Prepaid | ✅ |
| `lead_time_days` | Number input | Integer 1–90, average delivery time | ✅ |
| `notes` | Textarea | Max 500 characters | ❌ |
| `is_active` | Toggle | Active/inactive supplier | ✅ |

#### Delete Supplier

**API:** `DELETE /api/admin/inventory/suppliers/:id`

1. Click **Deactivate** on supplier row
2. If open purchase orders exist → error "Cannot deactivate: {N} open POs. Complete or cancel them first."
3. Otherwise, sets `is_active = false` and `deactivated_at` timestamp
4. Linked inventory items retain the supplier reference for history

### Purchase Orders

#### Create Purchase Order

**URL:** `/admin/inventory/purchase-orders/create`

**API:** `POST /api/admin/inventory/purchase-orders`

**Steps:**
1. Click **+ New Purchase Order**
2. Select **Supplier** from dropdown (only active suppliers)
3. Add line items:

| Field | Type | Validation | Required |
|---|---|---|---|
| `item_id` | Searchable select | Must be existing inventory item | ✅ |
| `quantity` | Number input | Integer ≥ 1 | ✅ |
| `unit_price` | Number input | Decimal ≥ 0.01 (auto-fills from item's `unit_cost`) | ✅ |

4. Add multiple line items using **+ Add Line** button
5. Review totals: Subtotal, Tax (configurable), Total
6. Set **Expected Delivery Date** (date picker, must be future)
7. Add **Notes** (optional)
8. Click **Create Order** → Status = `draft`
9. Click **Submit Order** → Status = `ordered`, PO number generated (PO-YYYY-NNNN)

**PO Statuses:** `draft` → `ordered` → `partially_received` → `received` → `closed`

#### Receive Purchase Order

**API:** `POST /api/admin/inventory/purchase-orders/:id/receive`

1. Open PO detail page
2. Click **Receive Delivery**
3. For each line item, enter **Quantity Received** (can be partial)
4. Note any discrepancies in **Receiving Notes**
5. Click **Confirm Receipt**
6. System auto-adjusts stock levels for received quantities
7. If all lines fully received → PO status = `received`
8. If partial → PO status = `partially_received`

## Configuration Settings

| Setting | Location | Default | Description |
|---|---|---|---|
| `inventory.low_stock_email_enabled` | `/admin/inventory/settings` | `true` | Send email alerts for low stock |
| `inventory.low_stock_push_enabled` | `/admin/inventory/settings` | `true` | Send push notifications for low stock |
| `inventory.low_stock_check_interval` | `/admin/inventory/settings` | `60` | Minutes between low stock checks |
| `inventory.default_tax_rate` | `/admin/inventory/settings` | `20` | Tax rate for purchase orders (%) |
| `inventory.po_number_prefix` | `/admin/inventory/settings` | `PO-` | Prefix for purchase order numbers |
| `inventory.expiry_alert_days` | `/admin/inventory/settings` | `7` | Days before expiry to trigger alert |
| `inventory.stock_valuation_method` | `/admin/inventory/settings` | `weighted_average` | Valuation: weighted_average, FIFO, LIFO |
| `inventory.auto_po_on_low_stock` | `/admin/inventory/settings` | `false` | Auto-create draft PO when stock is low |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Stock level shows negative | Manual adjustment exceeded available stock | Use stock correction to set accurate level; review adjustment history |
| Low stock alert not firing | `reorder_point` set to 0 or notifications disabled | Set `reorder_point` > 0 on item; enable email/push in settings |
| SKU "already exists" on create | Duplicate SKU in system (possibly soft-deleted item) | Use a unique SKU; check deleted items if SKU should be reusable |
| Purchase order total mismatch | Tax rate changed between creation and viewing | PO stores tax rate at time of creation; displayed correctly in detail |
| "Cannot delete supplier" error | Supplier has open (non-closed) purchase orders | Close or cancel all open POs for this supplier first |
| Stock not updating after PO received | Receiving confirmation not completed | Re-open PO → Receive Delivery → Confirm Receipt |
| CSV export empty | No items match current filters | Clear filters and retry; check browser console for API errors |
| Expiry alerts for non-perishable items | `is_perishable` incorrectly set to `true` | Edit item → toggle off `is_perishable` → Save |
| Redis cache shows stale stock | Cache invalidation failed after adjustment | Restart Redis or wait for TTL expiry (5 min default) |
| Stock value report inaccurate | `unit_cost` not updated after price change from supplier | Update `unit_cost` on affected items; run stock valuation recalc |

## Security & Permissions

| Action | super_admin | admin | manager | staff | customer |
|---|---|---|---|---|---|
| View inventory items | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create inventory items | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit inventory items | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete inventory items | ✅ | ✅ | ❌ | ❌ | ❌ |
| Adjust stock levels | ✅ | ✅ | ✅ | ✅ | ❌ |
| View adjustment history | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage suppliers | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create purchase orders | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve/submit POs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Receive deliveries | ✅ | ✅ | ✅ | ✅ | ❌ |
| View reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export data | ✅ | ✅ | ✅ | ❌ | ❌ |
| Change settings | ✅ | ✅ | ❌ | ❌ | ❌ |

## Related Modules

| Module | Relationship | Link |
|---|---|---|
| Restaurant Management | Menu items link to inventory for ingredient tracking | [restaurant-management.md](./restaurant-management.md) |
| Housekeeping | Cleaning supply usage tracked against inventory | [housekeeping.md](./housekeeping.md) |
| User Management | Staff who perform adjustments tracked by user ID | [user-management.md](./user-management.md) |
| POS | Point of sale transactions decrement inventory | System POS module |
| Finance | Stock valuation feeds into financial reporting | System finance module |

## Feature Coverage Summary

| Category | Total Features | Implemented | Partial | Not Started |
|---|---|---|---|---|
| Item CRUD | 4 | 4 | 0 | 0 |
| Stock Level Management | 4 | 4 | 0 | 0 |
| Alert Configuration | 2 | 2 | 0 | 0 |
| Supplier Management | 4 | 4 | 0 | 0 |
| Purchase Orders | 3 | 3 | 0 | 0 |
| Reporting | 1 | 1 | 0 | 0 |
| **Total** | **18** | **18** | **0** | **0** |
