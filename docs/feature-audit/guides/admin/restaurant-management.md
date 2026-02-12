# Admin Guide: Restaurant Management

> Module: ADM-REST | Features: 30 | Role: super_admin | Updated: 2026-02-08

## Overview

The Restaurant Management module provides comprehensive control over the resort's dining operations. Administrators manage the full menu lifecycle (categories, items, modifiers), table layouts, order processing, reservations, waitlists, and revenue reporting. Real-time updates are powered by Socket.IO for live order tracking and kitchen display coordination.

Data is stored across multiple Supabase PostgreSQL tables: `menu_categories`, `menu_items`, `menu_modifiers`, `menu_item_modifiers`, `tables`, `orders`, `order_items`, `reservations`, `waitlist_entries`, and `restaurant_settings`. The Express.js backend (localhost:3005) exposes REST APIs under `/api/admin/restaurant/*` with Socket.IO events for real-time order and table status updates. The Next.js 14 frontend (localhost:3000) provides the admin dashboard.

## Prerequisites

| Requirement | Details |
|---|---|
| Admin Access | Login at `/admin/login` with `admin@v2resort.com` / `admin123` |
| Role Required | `super_admin`, `admin`, or `manager` (some features restricted) |
| Browser | Chrome 90+, Firefox 88+, Edge 90+ |
| Backend Running | Express.js API on `localhost:3005` |
| Frontend Running | Next.js 14 dev server on `localhost:3000` |
| Database | Supabase PostgreSQL with restaurant tables seeded |
| Stripe | Configured for payment processing on orders |
| Socket.IO | WebSocket connection active for real-time updates |
| Redis | Running for order queue and caching |

## Features Covered

| # | Feature ID | Feature Name | Description | Status |
|---|---|---|---|---|
| 1 | REST-001 | Menu Category List | View all menu categories with sort/filter | ✅ Implemented |
| 2 | REST-002 | Create Menu Category | Add new category with name, description, image, sort order | ✅ Implemented |
| 3 | REST-003 | Edit Menu Category | Update category details and display order | ✅ Implemented |
| 4 | REST-004 | Delete Menu Category | Remove category with item reassignment or cascade | ✅ Implemented |
| 5 | REST-005 | Menu Item List | View all items with category grouping, search, availability filter | ✅ Implemented |
| 6 | REST-006 | Create Menu Item | Add new item with full details (price, image, allergens, dietary) | ✅ Implemented |
| 7 | REST-007 | Edit Menu Item | Update item details, pricing, availability | ✅ Implemented |
| 8 | REST-008 | Delete Menu Item | Soft-delete item, remove from active menus | ✅ Implemented |
| 9 | REST-009 | Menu Item Images | Upload, crop, and manage item photos (max 5 per item) | ✅ Implemented |
| 10 | REST-010 | Allergen Tags | Assign allergen warnings per item (14 EU allergens) | ✅ Implemented |
| 11 | REST-011 | Dietary Tags | Mark items as vegetarian, vegan, gluten-free, halal, kosher | ✅ Implemented |
| 12 | REST-012 | Modifier Groups | Create modifier groups (e.g., "Sauce Choice", "Size") | ✅ Implemented |
| 13 | REST-013 | Modifier Items | Add individual modifiers with price adjustments | ✅ Implemented |
| 14 | REST-014 | Assign Modifiers to Items | Link modifier groups to menu items | ✅ Implemented |
| 15 | REST-015 | Table List | View all tables with status, capacity, zone | ✅ Implemented |
| 16 | REST-016 | Create Table | Add table with number, capacity, zone assignment | ✅ Implemented |
| 17 | REST-017 | Edit Table | Update table details and status | ✅ Implemented |
| 18 | REST-018 | Delete Table | Remove table (blocked if active order exists) | ✅ Implemented |
| 19 | REST-019 | Table Status Board | Real-time visual grid of all tables with status colors | ✅ Implemented |
| 20 | REST-020 | Order List | View all orders with status filters and date range | ✅ Implemented |
| 21 | REST-021 | Order Detail View | Full order details: items, modifiers, totals, timeline | ✅ Implemented |
| 22 | REST-022 | Cancel Order | Cancel an active order with reason (triggers refund flow) | ✅ Implemented |
| 23 | REST-023 | Refund Order | Process full or partial refund via Stripe | ✅ Implemented |
| 24 | REST-024 | Reservation List | View all reservations with status and date filters | ✅ Implemented |
| 25 | REST-025 | Manage Reservation | Confirm, decline, or modify reservations | ✅ Implemented |
| 26 | REST-026 | Waitlist Management | View and manage walk-in waitlist queue | ✅ Implemented |
| 27 | REST-027 | Restaurant Hours | Configure opening hours per day of week | ✅ Implemented |
| 28 | REST-028 | Capacity Settings | Set max covers, reservation slots, table turn time | ✅ Implemented |
| 29 | REST-029 | Auto-Accept Config | Toggle auto-accept for reservations and order settings | ✅ Implemented |
| 30 | REST-030 | Revenue Reports | Daily/weekly/monthly revenue, top items, average order value | ✅ Implemented |

## Dashboard Overview

**URL:** `http://localhost:3000/admin/restaurant`

**API Base:** `http://localhost:3005/api/admin/restaurant`

### Key Metrics (Top Dashboard Cards)

| Metric | Description | API Endpoint |
|---|---|---|
| Today's Revenue | Total revenue from completed orders today | `GET /api/admin/restaurant/stats/today` |
| Active Orders | Orders currently in progress (pending, preparing, ready) | `GET /api/admin/restaurant/stats/active-orders` |
| Tables Occupied | Count of tables with `status = 'occupied'` | `GET /api/admin/restaurant/stats/tables` |
| Reservations Today | Upcoming reservations for today | `GET /api/admin/restaurant/stats/reservations` |
| Average Order Value | Mean order total for current week | `GET /api/admin/restaurant/stats/aov` |

### Quick Actions

- **+ Add Menu Item** → Opens create item form
- **+ Add Category** → Opens create category modal
- **View Orders** → Navigates to orders list
- **Table Map** → Opens real-time table status board

### Navigation Sidebar

| Link | URL | Description |
|---|---|---|
| Menu | `/admin/restaurant/menu` | Categories and items management |
| Tables | `/admin/restaurant/tables` | Table layout and status |
| Orders | `/admin/restaurant/orders` | Order list and processing |
| Reservations | `/admin/restaurant/reservations` | Reservation management |
| Waitlist | `/admin/restaurant/waitlist` | Walk-in queue management |
| Settings | `/admin/restaurant/settings` | Hours, capacity, auto-accept |
| Reports | `/admin/restaurant/reports` | Revenue and performance analytics |

## CRUD Operations

### Menu Categories

#### Create Category

**URL:** `/admin/restaurant/menu` → Click **+ Add Category**

**API:** `POST /api/admin/restaurant/categories`

**Steps:**
1. Navigate to `/admin/restaurant/menu`
2. Click **+ Add Category** button
3. Fill in the category form:

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | Text input | 1–60 characters, unique across categories | ✅ |
| `description` | Textarea | Max 200 characters | ❌ |
| `image` | File upload | JPEG/PNG/WebP, max 2MB, min 400×300px | ❌ |
| `sort_order` | Number input | Integer ≥ 0, determines display position | ✅ |
| `is_active` | Toggle | Show/hide category on customer-facing menu | ✅ |

4. Click **Save Category**
5. On success: toast "Category created", appears in category list

#### Edit Category

**API:** `PUT /api/admin/restaurant/categories/:id`

1. Click the **Edit** (pencil icon) on a category card
2. Modify fields — same validation as Create
3. Click **Save Changes**
4. Reordering: Drag and drop category cards to change `sort_order`

#### Delete Category

**API:** `DELETE /api/admin/restaurant/categories/:id`

1. Click **Delete** (trash icon) on a category card
2. If category has items, modal prompts:
   - **Move items to another category** (select target from dropdown)
   - **Delete all items in this category** (requires typing category name to confirm)
3. Click **Confirm Delete**
4. Cascade: category image removed from storage; associated items handled per selection above

### Menu Items

#### Create Menu Item

**URL:** `/admin/restaurant/menu/items/create`

**API:** `POST /api/admin/restaurant/items`

**Steps:**
1. Click **+ Add Menu Item** from menu page or use quick action
2. Fill in the item form:

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | Text input | 1–100 characters | ✅ |
| `description` | Textarea | Max 500 characters | ❌ |
| `category_id` | Select dropdown | Must select existing category | ✅ |
| `price` | Number input | Decimal ≥ 0.01, max 9999.99, 2 decimal places | ✅ |
| `cost_price` | Number input | Decimal ≥ 0.00, used for margin calculation | ❌ |
| `images` | File upload (multi) | Up to 5 images, JPEG/PNG/WebP, max 2MB each | ❌ |
| `allergens` | Multi-select checkboxes | 14 EU allergens: Celery, Cereals containing gluten, Crustaceans, Eggs, Fish, Lupin, Milk, Molluscs, Mustard, Nuts, Peanuts, Sesame, Soybeans, Sulphur dioxide | ❌ |
| `dietary_tags` | Multi-select chips | Vegetarian, Vegan, Gluten-Free, Halal, Kosher, Dairy-Free, Nut-Free | ❌ |
| `preparation_time` | Number input | Minutes, integer 1–120 | ❌ |
| `calories` | Number input | Integer ≥ 0 | ❌ |
| `is_available` | Toggle | Item available for ordering | ✅ |
| `is_featured` | Toggle | Show in "Featured" section | ❌ |
| `sort_order` | Number input | Integer ≥ 0 within category | ✅ |

3. **Modifier Groups** section: Attach existing modifier groups or create new ones inline
4. Click **Save Item**
5. On success: toast "Menu item created", item appears in category list

#### Edit Menu Item

**API:** `PUT /api/admin/restaurant/items/:id`

1. Click item name or **Edit** button in the menu item list
2. All fields editable — same validation rules
3. **Price change warning:** If item is in active orders, modal warns "Price change will not affect existing orders"
4. Click **Save Changes**

#### Delete Menu Item

**API:** `DELETE /api/admin/restaurant/items/:id`

1. Click **Delete** on item row
2. Confirmation: "Delete {item name}? This will remove it from the menu."
3. Soft-delete: `deleted_at` timestamp set; item hidden from customer menu
4. Historical orders retain the item name and price at time of purchase

### Modifier Groups & Items

#### Create Modifier Group

**API:** `POST /api/admin/restaurant/modifiers/groups`

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | Text input | 1–60 characters (e.g., "Sauce Choice", "Size") | ✅ |
| `min_selections` | Number input | Integer ≥ 0 (0 = optional) | ✅ |
| `max_selections` | Number input | Integer ≥ `min_selections`, max 10 | ✅ |
| `is_required` | Toggle | Customer must select at least `min_selections` | ✅ |

#### Create Modifier Item

**API:** `POST /api/admin/restaurant/modifiers/items`

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | Text input | 1–60 characters (e.g., "BBQ Sauce", "Large") | ✅ |
| `price_adjustment` | Number input | Decimal, can be 0 or positive (e.g., +1.50) | ✅ |
| `group_id` | Select | Must belong to an existing modifier group | ✅ |
| `is_available` | Toggle | Modifier available for selection | ✅ |

#### Assign Modifiers to Items

1. Open a menu item's edit page
2. Scroll to **Modifier Groups** section
3. Click **+ Attach Group** → Select from existing groups
4. Reorder groups via drag-and-drop
5. Save item to persist assignments

### Table Management

#### Create Table

**URL:** `/admin/restaurant/tables` → **+ Add Table**

**API:** `POST /api/admin/restaurant/tables`

| Field | Type | Validation | Required |
|---|---|---|---|
| `table_number` | Text input | Alphanumeric, 1–10 chars, unique (e.g., "T1", "P3") | ✅ |
| `capacity` | Number input | Integer 1–20 | ✅ |
| `zone` | Select dropdown | Indoor, Outdoor, Terrace, Private, Bar | ✅ |
| `status` | Select | Available, Occupied, Reserved, Maintenance | ✅ |
| `is_active` | Toggle | Table visible in booking system | ✅ |

#### Table Status Board

**URL:** `/admin/restaurant/tables/board`

Real-time visual grid powered by Socket.IO:
- **Green** = Available
- **Red** = Occupied (shows order number, elapsed time)
- **Blue** = Reserved (shows reservation time, guest name)
- **Grey** = Maintenance

Click any table tile to view details, change status, or link to active order.

**Socket.IO Events:**
- `table:status_changed` — Emitted when any table status updates
- `order:created` — Links new order to table, changes status to Occupied
- `order:completed` — Triggers table status back to Available

### Order Management

#### View Orders

**URL:** `/admin/restaurant/orders`

**API:** `GET /api/admin/restaurant/orders?status=&date_from=&date_to=&page=1&limit=25`

**Filters:**
| Filter | Options |
|---|---|
| Status | All, Pending, Confirmed, Preparing, Ready, Served, Completed, Cancelled |
| Date Range | Date picker (from/to) |
| Order Type | Dine-in, Takeaway, Room Service |
| Payment Status | Paid, Unpaid, Refunded, Partial Refund |

#### Cancel Order

**API:** `POST /api/admin/restaurant/orders/:id/cancel`

1. Open order detail page
2. Click **Cancel Order**
3. Select cancellation reason from dropdown:
   - Customer request
   - Kitchen unable to prepare
   - Payment issue
   - Other (free text)
4. Confirm cancellation
5. If payment was already processed, auto-triggers refund flow via Stripe

#### Refund Order

**API:** `POST /api/admin/restaurant/orders/:id/refund`

1. Open order detail → Click **Process Refund**
2. Select refund type:
   - **Full Refund** — Entire order total
   - **Partial Refund** — Select specific items or enter custom amount
3. Enter refund reason (required, min 10 characters)
4. Click **Process Refund**
5. Stripe refund initiated; status updates to `refunded` or `partial_refund`
6. Customer notified via email and in-app notification

### Reservations

**URL:** `/admin/restaurant/reservations`

**API:** `GET /api/admin/restaurant/reservations?status=&date=&page=1&limit=25`

#### Manage Reservation

1. View reservation list with columns: Guest Name, Date, Time, Party Size, Table, Status
2. Click a reservation to expand details
3. Actions:
   - **Confirm** — Changes status to `confirmed`, sends confirmation email/SMS
   - **Decline** — Changes status to `declined`, prompts for reason, notifies guest
   - **Modify** — Change date, time, party size, or assigned table
   - **No-Show** — Mark as no-show after grace period (configurable)
   - **Seat** — Assign table and mark as seated

### Waitlist

**URL:** `/admin/restaurant/waitlist`

**API:** `GET /api/admin/restaurant/waitlist`

1. View queue: Position, Guest Name, Party Size, Wait Time, Status
2. **Notify** button sends SMS/push notification when table is ready
3. **Seat** assigns table and removes from waitlist
4. **Remove** removes from queue with reason
5. Estimated wait time auto-calculated based on current table turn times

## Configuration Settings

| Setting | Location | Default | Description |
|---|---|---|---|
| `restaurant.opening_hours` | `/admin/restaurant/settings` | Mon–Sun 07:00–22:00 | Operating hours per day of week |
| `restaurant.max_capacity` | `/admin/restaurant/settings` | `120` | Maximum total covers allowed |
| `restaurant.reservation_slot_minutes` | `/admin/restaurant/settings` | `30` | Reservation time slot duration |
| `restaurant.table_turn_time_minutes` | `/admin/restaurant/settings` | `90` | Average time per table sitting |
| `restaurant.auto_accept_reservations` | `/admin/restaurant/settings` | `false` | Auto-confirm reservation requests |
| `restaurant.auto_accept_orders` | `/admin/restaurant/settings` | `true` | Auto-confirm new orders |
| `restaurant.max_advance_reservation_days` | `/admin/restaurant/settings` | `30` | How far ahead reservations can be made |
| `restaurant.no_show_grace_minutes` | `/admin/restaurant/settings` | `15` | Minutes past reservation time before marking no-show |
| `restaurant.order_number_prefix` | `/admin/restaurant/settings` | `ORD-` | Prefix for order numbers |
| `restaurant.kitchen_display_enabled` | `/admin/restaurant/settings` | `true` | Enable kitchen display system |
| `restaurant.tax_rate_percent` | `/admin/restaurant/settings` | `20` | VAT/tax percentage applied to orders |
| `restaurant.service_charge_percent` | `/admin/restaurant/settings` | `0` | Optional service charge percentage |
| `restaurant.min_order_amount` | `/admin/restaurant/settings` | `0` | Minimum order value (0 = no minimum) |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Menu item image not displaying | Image exceeds 2MB or unsupported format | Re-upload as JPEG/PNG/WebP under 2MB |
| Table status not updating in real-time | Socket.IO disconnected | Check WebSocket connection; refresh page; verify Redis is running |
| "Category has items" error on delete | Category contains menu items | Move items to another category first, or select cascade delete |
| Order refund fails | Stripe API key invalid or payment older than 90 days | Verify Stripe config in `.env`; for old payments, process manual refund |
| Reservation double-booking | Auto-accept enabled without capacity check | Disable auto-accept or review capacity settings |
| Allergen tags not showing | Item saved without allergen data | Edit item → select applicable allergens → Save |
| Modifier price not applied | Modifier's `price_adjustment` is 0 | Edit modifier item → set correct price adjustment |
| Revenue report shows £0 | No completed orders in selected date range | Adjust date range filter; ensure orders have `status = 'completed'` |
| Kitchen display blank | `kitchen_display_enabled` is `false` | Enable in Settings → Kitchen Display |
| Waitlist not auto-calculating wait time | No historical table turn data | System needs 7+ days of order data to estimate accurately |

## Security & Permissions

| Action | super_admin | admin | manager | staff | customer |
|---|---|---|---|---|---|
| View menu | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create/Edit menu items | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete menu items | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage categories | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage modifiers | ✅ | ✅ | ✅ | ❌ | ❌ |
| View orders | ✅ | ✅ | ✅ | ✅ | ❌ |
| Cancel orders | ✅ | ✅ | ✅ | ❌ | ❌ |
| Process refunds | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage tables | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update table status | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage reservations | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage waitlist | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit restaurant settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| View revenue reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export report data | ✅ | ✅ | ❌ | ❌ | ❌ |

## Related Modules

| Module | Relationship | Link |
|---|---|---|
| User Management | Staff assignments, customer account linking | [user-management.md](./user-management.md) |
| Inventory Management | Menu items link to inventory stock levels | [inventory-management.md](./inventory-management.md) |
| Gift Cards | Gift cards can be used as payment for orders | [gift-cards.md](./gift-cards.md) |
| Loyalty Management | Orders earn loyalty points; points redeemable on orders | [loyalty-management.md](./loyalty-management.md) |
| Housekeeping | Room service orders trigger housekeeping tasks | [housekeeping.md](./housekeeping.md) |
| Payments | Stripe integration for order payments and refunds | System payments module |
| Notifications | Order status changes trigger push/email notifications | System notifications module |

## Feature Coverage Summary

| Category | Total Features | Implemented | Partial | Not Started |
|---|---|---|---|---|
| Menu Categories CRUD | 4 | 4 | 0 | 0 |
| Menu Items CRUD | 4 | 4 | 0 | 0 |
| Item Media & Tags | 3 | 3 | 0 | 0 |
| Modifiers Management | 3 | 3 | 0 | 0 |
| Table Management | 5 | 5 | 0 | 0 |
| Order Management | 4 | 4 | 0 | 0 |
| Reservations | 2 | 2 | 0 | 0 |
| Waitlist | 1 | 1 | 0 | 0 |
| Settings & Config | 3 | 3 | 0 | 0 |
| Reporting | 1 | 1 | 0 | 0 |
| **Total** | **30** | **30** | **0** | **0** |
