# Phase 3: Complete Staff-Facing API Endpoints

> Generated from exhaustive reading of ALL route files in `backend/src/`
> Base URL: `http://localhost:3005/api/v1`
> Auth flow: `GET /api/csrf-token` → `POST /api/v1/auth/login` with `{email, password, _csrf}` → `data.tokens.accessToken`

## Staff Test Accounts

| Role | Email | Password | Use For |
|------|-------|----------|---------|
| Restaurant Staff | restaurant.staff@v2resort.com | staff123 | Restaurant order management |
| Snack Staff | snack.staff@v2resort.com | staff123 | Snack bar order management |
| Chalet Staff | chalet.staff@v2resort.com | staff123 | Chalet booking management |
| Pool Staff | pool.staff@v2resort.com | staff123 | Pool ticket/entry management |
| Restaurant Admin | restaurant.admin@v2resort.com | admin123 | Restaurant admin + staff ops |
| Chalet Admin | chalet.admin@v2resort.com | admin123 | Chalet admin + staff ops |
| Pool Admin | pool.admin@v2resort.com | admin123 | Pool admin + staff ops |
| Super Admin | admin@v2resort.com | admin123 | Everything |

---

## 1. STAFF MODULE — `/api/v1/staff/...`
**Source:** `modules/staff/staff.routes.ts`
**Auth:** All routes require `authenticate`. Roles listed per-endpoint.

### Shifts Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 1 | GET | `/staff/shifts/me` | Any authenticated staff | — | Get my shifts |
| 2 | GET | `/staff/shifts` | admin, super_admin, manager | `?date=`, `?staffId=` | Get all shifts |
| 3 | GET | `/staff/shifts/staff/:staffId` | admin, super_admin, manager | `:staffId` (UUID) | Get shifts for specific staff member |
| 4 | POST | `/staff/shifts` | admin, super_admin, manager | `{staffId, date, startTime, endTime, department}` | Create a shift |
| 5 | PUT | `/staff/shifts/:id` | admin, super_admin, manager | `{date, startTime, endTime, department}` | Update a shift |
| 6 | DELETE | `/staff/shifts/:id` | admin, super_admin, manager | — | Delete a shift |
| 7 | POST | `/staff/shifts/:id/clock-in` | Any staff role | — | Clock in to shift |
| 8 | POST | `/staff/shifts/:id/clock-out` | Any staff role | — | Clock out of shift |

### Assignments

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 9 | GET | `/staff/assignments` | admin, super_admin, manager | `?department=` | Get staff assignments |
| 10 | GET | `/staff/assignments/me` | Any authenticated | — | Get my current assignment |
| 11 | PUT | `/staff/staff/:staffId/assignments` | admin, super_admin, manager | `{area, tasks}` | Update staff assignments |
| 12 | POST | `/staff/assignments/bulk` | admin, super_admin, manager | `{assignments: [{staffId, area}]}` | Bulk assign staff |

### Shift Swap Workflow

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 13 | POST | `/staff/shifts/swap` | Any staff role | `{shiftId, targetStaffId, reason}` | Request shift swap |
| 14 | GET | `/staff/shifts/swap/me` | Any authenticated | — | Get my swap requests |
| 15 | GET | `/staff/shifts/swap` | admin, super_admin, manager | — | Get all swap requests |
| 16 | PUT | `/staff/shifts/swap/:id/respond` | Any staff role | `{response: 'accept'|'decline'}` | Accept/decline swap |
| 17 | PUT | `/staff/shifts/swap/:id/approve` | admin, super_admin, manager | `{approved: true|false}` | Manager approve/reject swap |
| 18 | DELETE | `/staff/shifts/swap/:id` | Any staff role | — | Cancel my swap request |

### Time Tracking

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 19 | GET | `/staff/time-tracking` | admin, super_admin, manager | `?startDate=&endDate=&staffId=` | Get time tracking report |
| 20 | POST | `/staff/shifts/:shiftId/adjustments` | admin, super_admin, manager | `{adjustmentMinutes, reason}` | Add time adjustment |

---

## 2. MODULE STAFF (Dynamic) — `/api/v1/staff/modules/:slug/...`
**Source:** `modules/staff/module-staff.routes.ts`
**Auth:** All require `authenticate` + staff roles (admin, super_admin, manager, hotel_staff, restaurant_staff, pool_staff, housekeeping)

### Menu Service Orders (slug = `restaurant`, `snack-bar`, etc.)

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 21 | GET | `/staff/modules/:slug/orders` | staffRoles | `?status=pending,confirmed&page=1&limit=50` | Get orders for module |
| 22 | GET | `/staff/modules/:slug/orders/live` | staffRoles | — | Get live/active orders |
| 23 | PUT | `/staff/modules/:slug/orders/:orderId/status` | staffRoles | `{status: 'confirmed'|'preparing'|'ready'|'completed'|'cancelled'}` | Update order status |
| 24 | PATCH | `/staff/modules/:slug/orders/:orderId/status` | staffRoles | Same as above | Update order status (alt) |

### Multi-Day Bookings (slug = `chalets`, `villas`, etc.)

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 25 | GET | `/staff/modules/:slug/bookings` | staffRoles | `?date=&status=&page=1&limit=50` | Get bookings for module |
| 26 | PUT | `/staff/modules/:slug/bookings/:bookingId/status` | staffRoles | `{status: 'checked_in'|'checked_out'|'cancelled'}` | Update booking status |
| 27 | PATCH | `/staff/modules/:slug/bookings/:bookingId/status` | staffRoles | Same as above | Update booking status (alt) |

### Session Access (slug = `pool`, `spa`, etc.)

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 28 | GET | `/staff/modules/:slug/sessions` | staffRoles | — | Get sessions for module |
| 29 | POST | `/staff/modules/:slug/validate-ticket` | staffRoles | `{ticketId, ticketCode}` | Validate a ticket |

---

## 3. RESTAURANT MODULE — `/api/v1/restaurant/...`
**Source:** `modules/restaurant/restaurant.routes.ts`
**Staff roles:** staff, restaurant_staff, restaurant_admin, snack_bar_staff, snack_bar_admin, chalet_staff, chalet_admin, pool_staff, pool_admin, super_admin

### Staff Order Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 30 | GET | `/restaurant/staff/orders` | staffRoles | `?status=&page=&limit=` | Get all staff orders |
| 31 | GET | `/restaurant/staff/orders/live` | staffRoles | — | Get live orders (active) |
| 32 | PATCH | `/restaurant/staff/orders/:id/status` | staffRoles | `{status: 'confirmed'|'preparing'|'ready'|'completed'|'cancelled'}` | Update order status |
| 33 | PUT | `/restaurant/staff/orders/:id/status` | staffRoles | Same as above | Update order status (alt) |

### Staff Table Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 34 | GET | `/restaurant/staff/tables` | staffRoles | — | Get all tables |
| 35 | PATCH | `/restaurant/staff/tables/:id` | staffRoles | `{status: 'available'|'occupied'|'reserved', section}` | Update table status |

### Reservations (Staff)

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 36 | GET | `/restaurant/reservations` | staffRoles | `?date=&status=&table_id=` | Get all reservations |
| 37 | GET | `/restaurant/reservations/:id` | staffRoles | — | Get single reservation |
| 38 | PATCH | `/restaurant/reservations/:id` | staffRoles | `{status: 'CONFIRMED'|'SEATED'|'COMPLETED'|'CANCELLED'|'NO_SHOW'}` | Update reservation status |
| 39 | POST | `/restaurant/reservations/:id/assign-table` | staffRoles | `{table_id: 'uuid'}` | Assign table to reservation |

### Admin Menu Management (also staff-testable)

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 40 | POST | `/restaurant/admin/categories` | adminRoles | `{name, description, sort_order}` | Create menu category |
| 41 | PUT | `/restaurant/admin/categories/:id` | adminRoles | `{name, description}` | Update category |
| 42 | DELETE | `/restaurant/admin/categories/:id` | adminRoles | — | Delete category |
| 43 | POST | `/restaurant/admin/items` | adminRoles | `{name, categoryId, price, description}` | Create menu item |
| 44 | PUT | `/restaurant/admin/items/:id` | adminRoles | `{name, price, description}` | Update menu item |
| 45 | DELETE | `/restaurant/admin/items/:id` | adminRoles | — | Delete menu item |
| 46 | PATCH | `/restaurant/admin/items/:id/availability` | adminRoles | `{available: boolean}` | Toggle item availability |
| 47 | GET | `/restaurant/admin/orders` | adminRoles | `?status=&page=&limit=` | Admin orders view |
| 48 | PUT | `/restaurant/admin/orders/:id/status` | adminRoles | `{status}` | Admin update order status |
| 49 | POST | `/restaurant/admin/tables` | adminRoles | `{number, section, capacity}` | Create table |
| 50 | DELETE | `/restaurant/admin/tables/:id` | adminRoles | — | Delete table |
| 51 | GET | `/restaurant/admin/reports/daily` | adminRoles | `?date=` | Daily report |
| 52 | GET | `/restaurant/admin/reports/sales` | adminRoles | `?startDate=&endDate=` | Sales report |

### Admin Modifier Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 53 | GET | `/restaurant/admin/modifiers/groups` | adminRoles | — | Get modifier groups |
| 54 | POST | `/restaurant/admin/modifiers/groups` | adminRoles | `{name, required, min_selections, max_selections}` | Create modifier group |
| 55 | PUT | `/restaurant/admin/modifiers/groups/:id` | adminRoles | Same as above | Update modifier group |
| 56 | DELETE | `/restaurant/admin/modifiers/groups/:id` | adminRoles | — | Delete modifier group |
| 57 | POST | `/restaurant/admin/modifiers/groups/:groupId/options` | adminRoles | `{name, price_adjustment}` | Create modifier option |
| 58 | PUT | `/restaurant/admin/modifiers/options/:optionId` | adminRoles | `{name, price_adjustment}` | Update option |
| 59 | DELETE | `/restaurant/admin/modifiers/options/:optionId` | adminRoles | — | Delete option |
| 60 | GET | `/restaurant/admin/items/:menuItemId/modifiers` | adminRoles | — | Get item modifiers |
| 61 | POST | `/restaurant/admin/items/:menuItemId/modifiers` | adminRoles | `{modifierGroupIds: []}` | Set item modifiers |
| 62 | GET | `/restaurant/admin/modifiers/inventory-items` | adminRoles | — | Get linkable inventory items |

---

## 4. RESTAURANT WAITLIST — `/api/v1/restaurant/waitlist/...`
**Source:** `modules/restaurant/waitlist.routes.ts`

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 63 | PATCH | `/restaurant/waitlist/:id/status` | staff, admin, manager | `{status: 'seated'|'cancelled'|'no_show'}` | Update waitlist status |
| 64 | POST | `/restaurant/waitlist/:id/notify` | staff, admin, manager | — | Notify waitlist entry |
| 65 | DELETE | `/restaurant/waitlist/:id` | staff, admin, manager | — | Delete waitlist entry |

---

## 5. SNACK BAR MODULE — `/api/v1/snack/...`
**Source:** `modules/snack/snack.routes.ts`

### Staff Order Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 66 | GET | `/snack/staff/orders` | snack_bar_staff, snack_bar_admin, super_admin | `?status=&page=&limit=` | Get staff orders |
| 67 | GET | `/snack/staff/orders/live` | snack_bar_staff, snack_bar_admin, super_admin | — | Get live orders |
| 68 | PATCH | `/snack/staff/orders/:id/status` | snack_bar_staff, snack_bar_admin, super_admin | `{status}` | Update order status |
| 69 | PUT | `/snack/staff/orders/:id/status` | snack_bar_staff, snack_bar_admin, super_admin | `{status}` | Update order status (alt) |

### Admin Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 70 | POST | `/snack/admin/categories` | snack_bar_admin, super_admin | `{name, description}` | Create category |
| 71 | PUT | `/snack/admin/categories/:id` | snack_bar_admin, super_admin | `{name, description}` | Update category |
| 72 | DELETE | `/snack/admin/categories/:id` | snack_bar_admin, super_admin | — | Delete category |
| 73 | POST | `/snack/admin/items` | snack_bar_admin, super_admin | `{name, categoryId, price, description}` | Create item |
| 74 | PUT | `/snack/admin/items/:id` | snack_bar_admin, super_admin | `{name, price}` | Update item |
| 75 | DELETE | `/snack/admin/items/:id` | snack_bar_admin, super_admin | — | Delete item |
| 76 | PATCH | `/snack/admin/items/:id/availability` | snack_bar_admin, super_admin | `{available: boolean}` | Toggle availability |

---

## 6. CHALETS MODULE — `/api/v1/chalets/...`
**Source:** `modules/chalets/chalet.routes.ts`

### Staff Booking Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 77 | GET | `/chalets/staff/bookings` | staff, chalet_staff, chalet_admin, super_admin | `?status=&date=` | Get staff bookings |
| 78 | GET | `/chalets/staff/bookings/today` | staff, chalet_staff, chalet_admin, super_admin | — | Get today's bookings |
| 79 | PATCH | `/chalets/staff/bookings/:id/check-in` | staff, chalet_staff, chalet_admin, super_admin | — | Check in guest |
| 80 | PATCH | `/chalets/staff/bookings/:id/check-out` | staff, chalet_staff, chalet_admin, super_admin | — | Check out guest |
| 81 | PATCH | `/chalets/staff/bookings/:id/status` | staff, chalet_staff, chalet_admin, super_admin | `{status}` | Update booking status |

### Admin Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 82 | GET | `/chalets/admin/add-ons` | chalet_admin, super_admin | — | Get admin add-ons |
| 83 | POST | `/chalets/admin/chalets` | chalet_admin, super_admin | `{name, capacity, price, description}` | Create chalet |
| 84 | PUT | `/chalets/admin/chalets/:id` | chalet_admin, super_admin | `{name, capacity, price}` | Update chalet |
| 85 | DELETE | `/chalets/admin/chalets/:id` | chalet_admin, super_admin | — | Delete chalet |
| 86 | POST | `/chalets/admin/add-ons` | chalet_admin, super_admin | `{name, price, description}` | Create add-on |
| 87 | PUT | `/chalets/admin/add-ons/:id` | chalet_admin, super_admin | `{name, price}` | Update add-on |
| 88 | DELETE | `/chalets/admin/add-ons/:id` | chalet_admin, super_admin | — | Delete add-on |
| 89 | GET | `/chalets/admin/price-rules` | chalet_admin, super_admin | — | Get price rules |
| 90 | POST | `/chalets/admin/price-rules` | chalet_admin, super_admin | `{name, type, value, conditions}` | Create price rule |
| 91 | PUT | `/chalets/admin/price-rules/:id` | chalet_admin, super_admin | Same | Update price rule |
| 92 | DELETE | `/chalets/admin/price-rules/:id` | chalet_admin, super_admin | — | Delete price rule |
| 93 | GET | `/chalets/admin/settings` | chalet_admin, super_admin | — | Get chalet settings |
| 94 | PUT | `/chalets/admin/settings` | chalet_admin, super_admin | `{...settings}` | Update chalet settings |

---

## 7. POOL MODULE — `/api/v1/pool/...`
**Source:** `modules/pool/pool.routes.ts`

### Staff Operations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 95 | POST | `/pool/staff/validate` | staff, pool_staff, pool_admin, super_admin | `{ticketId}` or `{ticketCode}` | Validate ticket |
| 96 | POST | `/pool/tickets/:id/entry` | staff, pool_staff, pool_admin, super_admin | — | Record pool entry |
| 97 | POST | `/pool/tickets/:id/exit` | staff, pool_staff, pool_admin, super_admin | — | Record pool exit |
| 98 | GET | `/pool/staff/capacity` | staff, pool_staff, pool_admin, super_admin | — | Get current pool capacity |
| 99 | GET | `/pool/staff/tickets/today` | staff, pool_staff, pool_admin, super_admin | — | Get today's tickets |
| 100 | GET | `/pool/staff/maintenance` | staff, pool_staff, pool_admin, super_admin | — | Get maintenance logs |
| 101 | POST | `/pool/staff/maintenance` | staff, pool_staff, pool_admin, super_admin | `{type, description, status}` | Create maintenance log |

### Bracelet Management (Staff)

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 102 | POST | `/pool/tickets/:id/bracelet` | pool staff roles | `{braceletNumber}` | Assign bracelet to ticket |
| 103 | DELETE | `/pool/tickets/:id/bracelet` | pool staff roles | — | Return bracelet |
| 104 | GET | `/pool/staff/bracelets/active` | pool staff roles | — | Get active bracelets |
| 105 | GET | `/pool/staff/bracelets/search` | pool staff roles | `?braceletNumber=` | Search by bracelet |

### Admin Operations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 106 | PUT | `/pool/admin/settings` | pool_admin, super_admin | `{maxCapacity, ...settings}` | Update pool settings |
| 107 | POST | `/pool/admin/reset-occupancy` | pool_admin, super_admin | — | Reset occupancy count |
| 108 | POST | `/pool/admin/sessions` | pool_admin, super_admin | `{name, startTime, endTime, maxCapacity}` | Create session |
| 109 | PUT | `/pool/admin/sessions/:id` | pool_admin, super_admin | Same | Update session |
| 110 | DELETE | `/pool/admin/sessions/:id` | pool_admin, super_admin | — | Delete session |
| 111 | GET | `/pool/admin/reports/daily` | pool_admin, super_admin | `?date=` | Daily pool report |

---

## 8. HOUSEKEEPING MODULE — `/api/v1/housekeeping/...`
**Source:** `modules/housekeeping/housekeeping.routes.ts`

### Staff Task Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 112 | GET | `/housekeeping/task-types` | Any authenticated | — | Get task types |
| 113 | GET | `/housekeeping/my-tasks` | staff, admin, super_admin | — | Get my assigned tasks |
| 114 | POST | `/housekeeping/tasks/:id/start` | staff, admin, super_admin | — | Start a task |
| 115 | POST | `/housekeeping/tasks/:id/complete` | staff, admin, super_admin | `{notes}` | Complete a task |
| 116 | POST | `/housekeeping/tasks/:id/issue` | staff, admin, super_admin | `{description, severity}` | Report an issue |
| 117 | GET | `/housekeeping/tasks/:id` | staff, admin, super_admin | — | Get single task |

### Admin Task Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 118 | GET | `/housekeeping/tasks` | admin, super_admin | `?status=&assignee=&date=` | Get all tasks |
| 119 | POST | `/housekeeping/tasks` | admin, super_admin | `{title, type, priority, roomId}` | Create task |
| 120 | PUT | `/housekeeping/tasks/:id` | admin, super_admin | `{title, status, priority}` | Update task |
| 121 | POST | `/housekeeping/tasks/:id/assign` | admin, super_admin | `{staffId}` | Assign task to staff |

### Admin Schedules

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 122 | GET | `/housekeeping/schedules` | admin, super_admin | — | Get schedules |
| 123 | POST | `/housekeeping/schedules` | admin, super_admin | `{name, frequency, tasks}` | Create schedule |
| 124 | PUT | `/housekeeping/schedules/:id` | admin, super_admin | Same | Update schedule |
| 125 | DELETE | `/housekeeping/schedules/:id` | admin, super_admin | — | Delete schedule |

### Admin Staff & Stats

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 126 | GET | `/housekeeping/staff` | admin, super_admin | — | Get available staff |
| 127 | GET | `/housekeeping/stats` | admin, super_admin | — | Get housekeeping stats |
| 128 | POST | `/housekeeping/generate-scheduled` | admin, super_admin | — | Generate scheduled tasks |

---

## 9. INVENTORY MODULE — `/api/v1/inventory/...`
**Source:** `modules/inventory/inventory.routes.ts`
**Staff auth:** authenticate + authorize('staff', 'admin', 'super_admin')

### Staff Operations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 129 | GET | `/inventory/categories` | staff, admin, super_admin | — | Get categories |
| 130 | GET | `/inventory/items` | staff, admin, super_admin | `?category=&lowStock=` | Get items |
| 131 | GET | `/inventory/items/:id` | staff, admin, super_admin | — | Get single item |
| 132 | GET | `/inventory/transactions` | staff, admin, super_admin | `?itemId=&type=` | Get transactions |
| 133 | POST | `/inventory/transactions` | staff, admin, super_admin | `{itemId, type, quantity, notes}` | Record transaction |
| 134 | GET | `/inventory/alerts` | staff, admin, super_admin | — | Get inventory alerts |
| 135 | POST | `/inventory/alerts/:id/resolve` | staff, admin, super_admin | `{notes}` | Resolve alert |
| 136 | GET | `/inventory/items/recipe/:menuItemId` | staff, admin, super_admin | — | Get recipe/BOM |

### Admin Operations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 137 | POST | `/inventory/categories` | admin, super_admin | `{name, description}` | Create category |
| 138 | PUT | `/inventory/categories/:id` | admin, super_admin | `{name}` | Update category |
| 139 | DELETE | `/inventory/categories/:id` | admin, super_admin | — | Delete category |
| 140 | POST | `/inventory/items` | admin, super_admin | `{name, sku, categoryId, unit, minStock}` | Create item |
| 141 | PUT | `/inventory/items/:id` | admin, super_admin | Same | Update item |
| 142 | DELETE | `/inventory/items/:id` | admin, super_admin | — | Delete item |
| 143 | POST | `/inventory/items/:itemId/link-menu` | admin, super_admin | `{menuItemId}` | Link to menu item |
| 144 | POST | `/inventory/transactions/bulk` | admin, super_admin | `{transactions: [...]}` | Bulk transaction |
| 145 | GET | `/inventory/stats` | admin, super_admin | — | Get inventory stats |
| 146 | GET | `/inventory/report` | admin, super_admin | `?startDate=&endDate=` | Generate report |
| 147 | POST | `/inventory/check-expiring` | admin, super_admin | — | Check expiring items |
| 148 | POST | `/inventory/items/recipe/:menuItemId` | admin, super_admin | `{ingredients: [...]}` | Create recipe/BOM |

---

## 10. POS HARDWARE — `/api/v1/pos/...`
**Source:** `modules/pos/pos-hardware.routes.ts`
**Roles:** admin, super_admin, manager, staff

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 149 | POST | `/pos/terminal/connection-token` | posRoles | — | Create Stripe Terminal connection token |
| 150 | POST | `/pos/terminal/payment-intent` | posRoles | `{amount, currency, orderId}` | Create terminal payment intent |
| 151 | POST | `/pos/terminal/capture` | posRoles | `{paymentIntentId}` | Capture terminal payment |
| 152 | POST | `/pos/terminal/cancel` | posRoles | `{paymentIntentId}` | Cancel terminal payment |
| 153 | GET | `/pos/terminal/readers` | posRoles | — | List card readers |
| 154 | POST | `/pos/terminal/readers` | admin, super_admin | `{registrationCode, label}` | Register reader |
| 155 | POST | `/pos/terminal/location` | admin, super_admin | `{displayName, address}` | Get/create location |
| 156 | POST | `/pos/print` | posRoles | `{printerIp, data, type}` | Print to network printer |
| 157 | POST | `/pos/open-drawer` | posRoles | `{printerIp}` | Open cash drawer |
| 158 | GET | `/pos/printer/status` | posRoles | `?printerIp=` | Get printer status |
| 159 | POST | `/pos/printer/config` | admin, super_admin | `{receiptPrinter, kitchenPrinter}` | Save printer config |
| 160 | GET | `/pos/printer/config` | posRoles | — | Get printer config |

---

## 11. PAYMENTS MODULE — `/api/v1/payments/...`
**Source:** `modules/payments/payment.routes.ts`

### Staff Payment Operations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 161 | POST | `/payments/record-cash` | All staff roles | `{orderId, amount, orderType}` | Record cash payment |
| 162 | POST | `/payments/record-manual` | All staff roles | `{orderId, amount, method, reference}` | Record manual payment |

### Admin Payment Operations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 163 | GET | `/payments/transactions` | super_admin | `?page=&limit=&status=` | List all transactions |
| 164 | GET | `/payments/transactions/:id` | super_admin | — | Get transaction detail |
| 165 | POST | `/payments/transactions/:id/refund` | super_admin | `{amount, reason}` | Refund payment |

---

## 12. FINANCE (Cash Drawer) — `/api/v1/finance/...`
**Source:** `modules/finance/finance.routes.ts`

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 166 | POST | `/finance/open` | Any authenticated | `{openingBalance, location}` | Open cash drawer |
| 167 | POST | `/finance/close` | Any authenticated | `{closingBalance, notes}` | Close cash drawer |
| 168 | POST | `/finance/transaction` | Any authenticated | `{amount, type, description}` | Record cash transaction |
| 169 | GET | `/finance/` | admin, super_admin, manager, accountant | — | Get all drawers |

---

## 13. MANAGER MODULE — `/api/v1/manager/...`
**Source:** `modules/manager/manager.routes.ts`

### Approvals

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 170 | POST | `/manager/approvals` | Any authenticated | `{type, description, amount}` | Create approval request |
| 171 | GET | `/manager/approvals/pending` | admin, super_admin, manager, *_manager | — | Get pending approvals |
| 172 | GET | `/manager/approvals` | admin, super_admin, manager, *_manager | `?status=` | Get all approvals |
| 173 | GET | `/manager/approvals/stats` | admin, super_admin, manager | — | Get approval stats |
| 174 | PUT | `/manager/approvals/:id/review` | admin, super_admin, manager, *_manager | `{decision: 'approved'|'rejected', notes}` | Review approval |

### Manager Shifts

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 175 | GET | `/manager/shifts/my` | Any authenticated | — | Get my shifts |
| 176 | GET | `/manager/shifts/current` | Any authenticated | — | Get current shift |
| 177 | POST | `/manager/shifts/:id/clock-in` | Any authenticated | — | Clock in |
| 178 | POST | `/manager/shifts/:id/clock-out` | Any authenticated | — | Clock out |
| 179 | GET | `/manager/shifts` | admin, super_admin, manager, *_manager | `?date=&department=` | Get all shifts |
| 180 | GET | `/manager/shifts/today` | admin, super_admin, manager, *_manager | — | Get today's schedule |
| 181 | POST | `/manager/shifts` | admin, super_admin, manager | `{staffId, date, startTime, endTime}` | Create shift |
| 182 | PUT | `/manager/shifts/:id` | admin, super_admin, manager | `{date, startTime, endTime}` | Update shift |
| 183 | DELETE | `/manager/shifts/:id` | admin, super_admin, manager | — | Delete shift |

---

## 14. KIOSK MODULE — `/api/v1/kiosk/...`
**Source:** `modules/kiosk/kiosk.routes.ts`

### Device Management (Staff)

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 184 | POST | `/kiosk/devices/:propertyId` | admin, manager | `{name, type, location}` | Register kiosk device |
| 185 | GET | `/kiosk/devices/:deviceId` | admin, manager, front_desk | — | Get device |
| 186 | GET | `/kiosk/devices/property/:propertyId` | admin, manager, front_desk | — | Get property devices |
| 187 | PATCH | `/kiosk/devices/:deviceId/config` | admin, manager | `{config}` | Update device config |
| 188 | POST | `/kiosk/devices/:deviceId/maintenance` | admin, manager | `{reason}` | Set maintenance mode |
| 189 | DELETE | `/kiosk/devices/:deviceId` | admin, manager | — | Deactivate device |

### Key Stock (Staff)

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 190 | GET | `/kiosk/key-stock/:kioskId` | admin, manager, front_desk | — | Get key stock |
| 191 | POST | `/kiosk/key-stock/:kioskId/refill` | admin, manager, front_desk | `{quantity}` | Refill key stock |

### Hardware Events

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 192 | POST | `/kiosk/hardware-events/:eventId/resolve` | admin, manager, maintenance | `{resolution}` | Resolve hardware event |
| 193 | GET | `/kiosk/hardware-events` | admin, manager, front_desk, maintenance | — | Get unresolved events |

### Analytics

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 194 | GET | `/kiosk/analytics/:propertyId` | admin, manager | — | Get kiosk analytics |

---

## 15. MESSAGING MODULE — `/api/v1/messaging/...`
**Source:** `modules/messaging/messaging.routes.ts`

### Channel Configuration

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 195 | POST | `/messaging/channels/:propertyId` | admin, manager | `{channelType, config}` | Configure channel |
| 196 | GET | `/messaging/channels/:propertyId/:channelType` | admin, manager | — | Get channel config |
| 197 | POST | `/messaging/channels/:channelId/verify` | admin, manager | — | Verify channel |

### Guest Preferences

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 198 | PUT | `/messaging/preferences/:guestId/:propertyId` | admin, manager, front_desk | `{preferences}` | Update guest preferences |
| 199 | GET | `/messaging/preferences/:guestId/:propertyId` | admin, manager, front_desk | — | Get guest preferences |

### Conversations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 200 | POST | `/messaging/conversations/:propertyId` | admin, manager, front_desk, concierge | `{guestId, channelType, subject}` | Create conversation |
| 201 | GET | `/messaging/conversations/:conversationId` | admin, manager, front_desk, concierge | — | Get conversation |
| 202 | GET | `/messaging/conversations/property/:propertyId` | admin, manager, front_desk, concierge | `?status=&assigned=` | Get property conversations |
| 203 | POST | `/messaging/conversations/:conversationId/assign` | admin, manager, front_desk | `{staffId}` | Assign conversation |
| 204 | PATCH | `/messaging/conversations/:conversationId/priority` | admin, manager, front_desk | `{priority}` | Update priority |
| 205 | POST | `/messaging/conversations/:conversationId/resolve` | admin, manager, front_desk, concierge | — | Resolve conversation |
| 206 | POST | `/messaging/conversations/:conversationId/reopen` | admin, manager, front_desk | — | Reopen conversation |
| 207 | POST | `/messaging/conversations/:conversationId/read` | admin, manager, front_desk, concierge | — | Mark as read |

### Messages

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 208 | POST | `/messaging/conversations/:conversationId/messages` | admin, manager, front_desk, concierge | `{content, channelType}` | Send message |
| 209 | GET | `/messaging/conversations/:conversationId/messages` | admin, manager, front_desk, concierge | — | Get messages |

### Templates & Canned Responses

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 210 | POST | `/messaging/templates/:propertyId` | admin, manager | `{name, content, variables}` | Create template |
| 211 | GET | `/messaging/templates/:templateId` | admin, manager, front_desk, concierge | — | Get template |
| 212 | GET | `/messaging/templates/property/:propertyId` | admin, manager, front_desk, concierge | — | Get property templates |
| 213 | POST | `/messaging/templates/:templateId/render` | admin, manager, front_desk, concierge | `{variables}` | Render template |
| 214 | POST | `/messaging/canned-responses/:propertyId` | admin, manager | `{title, content, category}` | Create canned response |
| 215 | GET | `/messaging/canned-responses/:propertyId` | admin, manager, front_desk, concierge | — | Get canned responses |
| 216 | POST | `/messaging/canned-responses/:responseId/use` | admin, manager, front_desk, concierge | — | Use canned response |

### Analytics

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 217 | GET | `/messaging/analytics/:propertyId` | admin, manager | — | Get messaging analytics |

---

## 16. MOBILE CHECK-IN — `/api/v1/mobile-checkin/...`
**Source:** `modules/mobile-checkin/mobile-checkin.routes.ts`

### Staff Registration Management

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 218 | POST | `/mobile-checkin/registrations/booking/:bookingId` | admin, manager, front_desk | — | Create registration for booking |
| 219 | POST | `/mobile-checkin/registrations/:registrationId/approve` | admin, manager, front_desk | — | Approve registration |
| 220 | POST | `/mobile-checkin/registrations/:registrationId/reject` | admin, manager, front_desk | `{reason}` | Reject registration |
| 221 | GET | `/mobile-checkin/registrations/pending/:propertyId` | admin, manager, front_desk | — | Get pending registrations |

### Document Verification

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 222 | POST | `/mobile-checkin/documents/:documentId/verify` | admin, manager, front_desk | `{verified: boolean, notes}` | Verify document |
| 223 | GET | `/mobile-checkin/guests/:guestId/documents` | admin, manager, front_desk | — | Get guest documents |

### Mobile Keys

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 224 | DELETE | `/mobile-checkin/keys/:keyId` | admin, manager, front_desk | — | Revoke mobile key |

### Push Notifications

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 225 | POST | `/mobile-checkin/push/reminder/:bookingId` | admin, manager, front_desk | — | Send check-in reminder |
| 226 | POST | `/mobile-checkin/push/room-ready/:bookingId` | admin, manager, front_desk, housekeeping | — | Send room ready notification |

---

## 17. LOYALTY MODULE — `/api/v1/loyalty/...`
**Source:** `modules/loyalty/loyalty.routes.ts`

### Staff Operations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 227 | GET | `/loyalty/accounts/:userId` | admin, super_admin, staff | — | Get user's loyalty account |
| 228 | GET | `/loyalty/accounts/:userId/transactions` | admin, super_admin, staff | — | Get user's transactions |
| 229 | POST | `/loyalty/earn` | admin, super_admin, staff | `{userId, points, reason, orderId}` | Award points |
| 230 | POST | `/loyalty/redeem` | admin, super_admin, staff | `{userId, points, reason}` | Redeem points |

### Admin Operations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 231 | GET | `/loyalty/accounts` | admin, super_admin | — | Get all loyalty accounts |
| 232 | GET | `/loyalty/stats` | admin, super_admin | — | Get loyalty stats |
| 233 | POST | `/loyalty/adjust` | admin, super_admin | `{userId, points, reason}` | Adjust points |
| 234 | POST | `/loyalty/accounts/:accountId/adjust` | admin, super_admin | `{points, reason}` | Adjust by account ID |
| 235 | PUT | `/loyalty/settings` | admin, super_admin | `{pointsPerCurrency, ...}` | Update settings |
| 236 | PUT | `/loyalty/tiers/:tierId` | admin, super_admin | `{name, minPoints, benefits}` | Update tier |
| 237 | POST | `/loyalty/tiers` | admin, super_admin | `{name, minPoints, benefits}` | Create tier |
| 238 | DELETE | `/loyalty/tiers/:tierId` | admin, super_admin | — | Delete tier |

---

## 18. CUSTOMIZATION SYSTEM — `/api/v1/customizations/...`
**Source:** `modules/customization/routes/customization.routes.ts`

### Staff/Admin Operations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 239 | POST | `/customizations/groups` | admin, manager | `{name, module, type}` | Create customization group |
| 240 | PUT | `/customizations/groups/:id` | admin, manager | `{name}` | Update group |
| 241 | DELETE | `/customizations/groups/:id` | admin, manager | — | Delete group |
| 242 | POST | `/customizations/options` | admin, manager | `{groupId, name, priceAdjustment}` | Create option |
| 243 | PUT | `/customizations/options/:id` | admin, manager | `{name, priceAdjustment}` | Update option |
| 244 | DELETE | `/customizations/options/:id` | admin, manager | — | Delete option |
| 245 | POST | `/customizations/entity-links` | admin, manager | `{groupId, entityType, entityId}` | Link to entity |
| 246 | PUT | `/customizations/entity-links/:id` | admin, manager | — | Update link |
| 247 | DELETE | `/customizations/entity-links/:id` | admin, manager | — | Remove link |
| 248 | POST | `/customizations/orders/snapshot` | admin, manager, staff | `{orderId, orderType, items}` | Create order snapshot |
| 249 | POST | `/customizations/orders/reverse` | admin, manager | `{orderId, orderType, itemId}` | Reverse inventory |

---

## 19. REPORTING MODULE — `/api/v1/reporting/...`
**Source:** `modules/reporting/reporting.routes.ts`
**Auth:** All require `authenticate`. Most read ops open to any staff.

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 250 | GET | `/reporting/templates` | Any authenticated | — | Get report templates |
| 251 | POST | `/reporting/templates` | admin, manager | `{name, type, config}` | Create template |
| 252 | POST | `/reporting/execute/:templateId` | Any authenticated | `{parameters}` | Execute report |
| 253 | POST | `/reporting/export/:templateId` | Any authenticated | `{format, parameters}` | Export report |
| 254 | GET | `/reporting/kpis` | Any authenticated | — | Get KPIs |
| 255 | GET | `/reporting/financial/revenue` | Any authenticated | `?startDate=&endDate=` | Revenue report |
| 256 | GET | `/reporting/financial/occupancy` | Any authenticated | `?startDate=&endDate=` | Occupancy report |
| 257 | GET | `/reporting/operational/housekeeping` | Any authenticated | — | Housekeeping report |

---

## 20. REVENUE MANAGEMENT — `/api/v1/revenue/...`
**Source:** `modules/revenue/revenue.routes.ts`
**Auth:** All require `authenticate`.

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 258 | POST | `/revenue/forecasts/generate` | admin, manager | `{roomTypeId, dateRange}` | Generate forecasts |
| 259 | GET | `/revenue/forecasts` | Any authenticated | `?roomTypeId=&dateRange=` | Get forecasts |
| 260 | GET | `/revenue/rules` | Any authenticated | — | Get pricing rules |
| 261 | POST | `/revenue/rules` | admin, manager | `{name, type, conditions, adjustment}` | Create pricing rule |
| 262 | GET | `/revenue/calculate-rate` | Any authenticated | `?roomTypeId=&date=` | Calculate rate |
| 263 | GET | `/revenue/calendar` | Any authenticated | `?roomTypeId=&month=` | Pricing calendar |

---

## 21. ADMIN MODULE — `/api/v1/admin/...` (Manager-accessible subset)
**Source:** `modules/admin/admin.routes.ts`
**Note:** MANAGEMENT_ROLES = restaurant_manager, restaurant_admin, pool_admin, chalet_manager, chalet_admin, snack_bar_admin

### Dashboard & Reports (Manager-accessible)

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 264 | GET | `/admin/dashboard` | MANAGEMENT_ROLES | — | Get dashboard |
| 265 | GET | `/admin/dashboard/revenue` | MANAGEMENT_ROLES | — | Get revenue stats |
| 266 | GET | `/admin/reports/overview` | MANAGEMENT_ROLES | — | Overview report |
| 267 | GET | `/admin/reports/occupancy` | MANAGEMENT_ROLES | — | Occupancy report |
| 268 | GET | `/admin/reports/customers` | MANAGEMENT_ROLES | — | Customer analytics |
| 269 | GET | `/admin/notifications` | MANAGEMENT_ROLES | — | Get notifications |
| 270 | PUT | `/admin/notifications/:id/read` | MANAGEMENT_ROLES | — | Mark notification read |
| 271 | POST | `/admin/notifications/broadcast` | MANAGEMENT_ROLES | `{message, type, priority}` | Broadcast notification |

### User Management (Manager-accessible)

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 272 | GET | `/admin/users` | MANAGEMENT_ROLES | `?type=customer|staff` | List users |
| 273 | POST | `/admin/users` | MANAGEMENT_ROLES | `{email, fullName, role, password}` | Create user |
| 274 | GET | `/admin/users/:id` | MANAGEMENT_ROLES | — | Get user details |
| 275 | PUT | `/admin/users/:id` | MANAGEMENT_ROLES | `{fullName, phone, ...}` | Update user |

---

## 22. AUTH MODULE — `/api/v1/auth/...`
**Source:** `modules/auth/auth.routes.ts`
**Note:** Essential for staff login flow.

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 276 | POST | `/auth/login` | Public | `{email, password, _csrf}` | Login (returns tokens + user) |
| 277 | GET | `/auth/me` | Any authenticated | — | Get current user (role info) |
| 278 | POST | `/auth/logout` | Any authenticated | — | Logout |
| 279 | POST | `/auth/refresh` | Public | `{refreshToken}` | Refresh access token |

---

## 23. GDPR MODULE — `/api/v1/gdpr/...`
**Source:** `modules/gdpr/gdpr.routes.ts`

### Admin GDPR Operations

| # | Method | Path | Roles | Body/Params | Description |
|---|--------|------|-------|-------------|-------------|
| 280 | GET | `/gdpr/admin/retention-policies` | admin, super_admin | — | Get retention policies |
| 281 | PUT | `/gdpr/admin/retention-policies/:policyId` | admin, super_admin | `{retentionDays}` | Update retention |
| 282 | GET | `/gdpr/admin/deletion-requests` | admin, super_admin | — | List deletion requests |
| 283 | POST | `/gdpr/admin/deletion-requests/:requestId/approve` | admin, super_admin | — | Approve deletion |
| 284 | POST | `/gdpr/admin/deletion-requests/:requestId/reject` | admin, super_admin | `{reason}` | Reject deletion |

---

## ENDPOINT COUNT SUMMARY

| Module | Staff Endpoints | Admin Endpoints | Total |
|--------|----------------|-----------------|-------|
| Staff Core (shifts/assignments/swaps) | 14 | 6 | 20 |
| Module Staff (dynamic) | 9 | 0 | 9 |
| Restaurant | 6 | 23 | 29 |
| Restaurant Waitlist | 3 | 0 | 3 |
| Snack Bar | 4 | 7 | 11 |
| Chalets | 5 | 13 | 18 |
| Pool | 11 | 6 | 17 |
| Housekeeping | 5 | 12 | 17 |
| Inventory | 8 | 12 | 20 |
| POS Hardware | 9 | 3 | 12 |
| Payments | 2 | 3 | 5 |
| Finance | 3 | 1 | 4 |
| Manager | 9 | 5 | 14 |
| Kiosk | 0 | 11 | 11 |
| Messaging | 0 | 23 | 23 |
| Mobile Check-in | 0 | 9 | 9 |
| Loyalty | 4 | 8 | 12 |
| Customization | 1 | 10 | 11 |
| Reporting | 7 | 1 | 8 |
| Revenue | 4 | 4 | 8 |
| Admin (mgr-facing) | 0 | 12 | 12 |
| Auth | 4 | 0 | 4 |
| GDPR Admin | 0 | 5 | 5 |
| **TOTAL** | **~108** | **~174** | **~282** |

---

## PRIORITY E2E TEST GROUPS (Staff Focus)

### P0 — Core Staff Workflows (test immediately)
1. **Restaurant Staff Orders:** Login → GET live orders → PATCH order status through `pending→confirmed→preparing→ready→completed`
2. **Snack Staff Orders:** Same flow for snack bar
3. **Chalet Staff Bookings:** Login → GET today bookings → PATCH check-in → PATCH check-out
4. **Pool Staff Tickets:** Login → GET today tickets → POST validate → POST entry → POST exit → GET capacity
5. **Staff Shifts:** Login → GET my shifts → POST clock-in → POST clock-out

### P1 — Secondary Staff Workflows
6. **Pool Bracelets:** POST assign → GET active → GET search → DELETE return
7. **Restaurant Reservations:** GET reservations → PATCH status → POST assign-table
8. **Restaurant Waitlist:** PATCH status → POST notify → DELETE entry
9. **Housekeeping Tasks:** GET my-tasks → POST start → POST complete → POST issue
10. **Inventory Ops:** GET items → POST transaction → GET alerts → POST resolve

### P2 — Management/Admin Workflows
11. **Manager Approvals:** POST create → GET pending → PUT review
12. **Payment Recording:** POST record-cash → POST record-manual
13. **Finance/Cash Drawer:** POST open → POST transaction → POST close
14. **Pool Maintenance:** GET logs → POST create log
15. **Admin Dashboard:** GET dashboard → GET revenue stats → GET reports
