# Admin Guide: Module Builder

> Module: ADM-MOD | Features: 25 | Role: super_admin | Updated: 2026-02-08

## Overview

The Module Builder is the core extensibility engine of V2 Resort. It allows administrators to create, configure, and manage custom service modules — such as Spa, Restaurant, Pool, Mini-Golf, Kayak Rentals, Snack Bar, Gym, and any other resort service — that dynamically appear as fully functional customer-facing pages at `/{slug}`. Each module can be independently configured with its own menu/items, pricing, schedules, booking or ordering capabilities, and analytics.

When an admin creates a module (e.g., slug `kayak`), the system automatically:
1. Creates a dynamic route at `/kayak` on the Next.js 14 frontend
2. Registers the module in the sidebar navigation
3. Creates the corresponding admin management pages at `/admin/modules/{id}`
4. Sets up database tables/rows for the module's items, schedules, and orders
5. Enables the module for coupon/promotion scoping, reviews, and reporting

All module data is stored in the Supabase PostgreSQL tables `modules`, `module_items`, `module_schedules`, `module_settings`, and `module_analytics`. Changes propagate in real-time via Socket.IO to all connected admin and customer clients.

## Prerequisites

- **Role**: `super_admin` (module creation/deletion restricted to super_admin only)
- **Login**: Navigate to `/admin/login` and authenticate (admin@v2resort.com / admin123)
- **Backend**: Express.js running on `localhost:3005`
- **Frontend**: Next.js 14 running on `localhost:3000`
- **Database**: Supabase PostgreSQL connected and migrated
- **File Storage**: Supabase Storage configured for module icons/images
- **Redis**: Connected for module configuration caching

## Features Covered

| ID | Feature Name | Type | Impact | Status |
|---|---|---|---|---|
| ADM-MOD-001 | Create Module | CRUD | Critical | ✅ Implemented |
| ADM-MOD-002 | List All Modules | CRUD | Medium | ✅ Implemented |
| ADM-MOD-003 | Edit Module Details | CRUD | High | ✅ Implemented |
| ADM-MOD-004 | Delete Module | CRUD | Critical | ✅ Implemented |
| ADM-MOD-005 | Module Name Configuration | Config | High | ✅ Implemented |
| ADM-MOD-006 | Module Slug Configuration | Config | High | ✅ Implemented |
| ADM-MOD-007 | Module Icon/Image Upload | Config | Medium | ✅ Implemented |
| ADM-MOD-008 | Module Description (Rich Text) | Config | Medium | ✅ Implemented |
| ADM-MOD-009 | Module Type: Ordering | Config | High | ✅ Implemented |
| ADM-MOD-010 | Module Type: Booking | Config | High | ✅ Implemented |
| ADM-MOD-011 | Module Type: Information | Config | Medium | ✅ Implemented |
| ADM-MOD-012 | Display Order / Sort Priority | Config | Medium | ✅ Implemented |
| ADM-MOD-013 | Menu / Items Management | CRUD | High | ✅ Implemented |
| ADM-MOD-014 | Item Categories | Config | Medium | ✅ Implemented |
| ADM-MOD-015 | Item Pricing Rules | Config | High | ✅ Implemented |
| ADM-MOD-016 | Item Availability Toggle | Config | Medium | ✅ Implemented |
| ADM-MOD-017 | Schedule Configuration | Config | High | ✅ Implemented |
| ADM-MOD-018 | Operating Hours | Config | High | ✅ Implemented |
| ADM-MOD-019 | Seasonal Schedule Overrides | Config | Medium | ✅ Implemented |
| ADM-MOD-020 | Pricing Rules (Peak/Off-Peak) | Config | High | ✅ Implemented |
| ADM-MOD-021 | Enable/Disable Module Toggle | Config | High | ✅ Implemented |
| ADM-MOD-022 | Module Analytics Dashboard | Analytics | Medium | ✅ Implemented |
| ADM-MOD-023 | Module Customization Options | Config | Medium | ✅ Implemented |
| ADM-MOD-024 | Multi-Language Module Content | i18n | High | ✅ Implemented |
| ADM-MOD-025 | Module Theme Customization | Config | Medium | ✅ Implemented |

## Dashboard Overview

### Module List

- **URL**: `http://localhost:3000/admin/modules`
- **Layout**: Card grid (default) or table list view (toggle)
- **Key Metrics per Card**:
  - Module name + icon
  - Status badge: `Active` (green), `Disabled` (gray), `Draft` (yellow)
  - Module type badge: `Ordering`, `Booking`, `Info`
  - Item count (e.g., "24 items")
  - Today's orders/bookings count
  - Revenue today
- **Quick Actions**:
  - **+ Create Module** button (top-right)
  - **Reorder** button → enter drag-and-drop mode for display order
  - **Filter** by status, type
  - **Search** by module name

### Module Detail

- **URL**: `http://localhost:3000/admin/modules/{id}`
- **Tabs**: General, Items, Schedule, Pricing, Analytics, Settings
- **Breadcrumb**: Admin → Modules → {Module Name}

## CRUD Operations

### Create Module (ADM-MOD-001)

1. Navigate to `/admin/modules`
2. Click **+ Create Module**
3. **Step 1 — Basic Information**:

| Field | Type | Required | Validation Rules | Default |
|---|---|---|---|---|
| `name` | text | Yes | 2-50 chars, unique across all modules | — |
| `slug` | text | Auto | Auto-generated from name; 2-30 chars, lowercase, alphanumeric + hyphens, unique; editable | Auto from name |
| `description` | rich text | No | Max 2000 chars, supports Markdown | — |
| `short_description` | text | No | Max 150 chars, used in cards/previews | — |
| `icon` | file upload | No | SVG, PNG, or JPG; max 2MB; recommended 128×128px | Default icon |
| `cover_image` | file upload | No | JPG or PNG; max 5MB; recommended 1920×600px | Default cover |
| `module_type` | select | Yes | `ordering` (food/products), `booking` (time-slot services), `information` (display-only) | `ordering` |

4. **Step 2 — Configuration** (varies by module_type):

**For `ordering` type:**

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `enable_cart` | toggle | No | — | `true` |
| `min_order_amount` | number | No | 0-99999.99 | `0` |
| `max_order_amount` | number | No | 0-99999.99 | No limit |
| `order_prep_time_min` | number | No | 0-480 (minutes) | `15` |
| `allow_special_requests` | toggle | No | — | `true` |
| `require_table_number` | toggle | No | — | `false` |
| `enable_tips` | toggle | No | — | `false` |

**For `booking` type:**

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `slot_duration_min` | number | Yes | 15-480 (minutes) | `60` |
| `max_advance_booking_days` | number | No | 1-365 | `30` |
| `min_advance_booking_hours` | number | No | 0-72 | `1` |
| `max_guests_per_slot` | number | No | 1-100 | `10` |
| `allow_cancellation` | toggle | No | — | `true` |
| `cancellation_window_hours` | number | No | 0-168 | `24` |
| `require_deposit` | toggle | No | — | `false` |
| `deposit_percentage` | number | Conditional | 1-100, required if deposit enabled | `50` |

**For `information` type:**

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `content_blocks` | rich text array | No | Max 10 blocks, each max 5000 chars | — |
| `gallery_images` | file upload array | No | Max 20 images, each max 5MB | — |
| `contact_info` | object | No | Phone, email, location fields | — |
| `external_link` | URL | No | Valid URL | — |

5. **Step 3 — Display Settings**:

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `display_order` | number | No | 1-999 | Next available |
| `show_in_navigation` | toggle | No | — | `true` |
| `show_in_homepage` | toggle | No | — | `true` |
| `featured` | toggle | No | — | `false` |
| `theme_override` | select | No | One of 6 configured themes or "inherit" | `inherit` |
| `primary_color` | color picker | No | Valid hex color | Resort default |  

6. Click **Create Module** → POST `/api/admin/modules`
7. System creates the module, generates the dynamic route `/{slug}`, and broadcasts via Socket.IO

**API Request**:
```
POST http://localhost:3005/api/admin/modules
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data

{
  "name": "Kayak Rentals",
  "slug": "kayak",
  "description": "Rent kayaks for lake adventures...",
  "short_description": "Explore the lake by kayak",
  "module_type": "booking",
  "slot_duration_min": 60,
  "max_advance_booking_days": 14,
  "max_guests_per_slot": 4,
  "allow_cancellation": true,
  "cancellation_window_hours": 12,
  "display_order": 8,
  "show_in_navigation": true,
  "icon": [binary file],
  "cover_image": [binary file]
}
```

### List All Modules (ADM-MOD-002)

- **URL**: `/admin/modules`
- **Sort**: Display order (default), name (alpha), created date, revenue
- **Filter**: Status (Active/Disabled/Draft), Type (Ordering/Booking/Info)
- **Search**: By module name (debounced 300ms)
- **API**: `GET /api/admin/modules?status=active&type=ordering&sort=display_order&order=asc`

### Edit Module Details (ADM-MOD-003)

1. Navigate to `/admin/modules/{id}` → **General** tab
2. All creation fields are editable
3. **Slug change warning**: Changing the slug updates the customer-facing URL; a redirect from the old slug is automatically created for 90 days
4. Changes trigger audit log entry with `changed_fields` diff
5. Click **Save Changes** → PUT `/api/admin/modules/{id}`
6. Socket.IO broadcasts module update to all connected clients

### Delete Module (ADM-MOD-004)

1. Navigate to `/admin/modules/{id}` → **Settings** tab
2. Click **Delete Module** (red button at bottom)
3. System checks for:
   - Active orders/bookings → blocks deletion, suggests disabling instead
   - Historical data → offers archive option
4. If no blockers, confirmation modal: "Permanently delete {Module Name}? This removes the module, all its items, schedules, and the customer page at /{slug}."
5. Type the module name to confirm (safety measure)
6. Click **Delete** → DELETE `/api/admin/modules/{id}`
7. System removes: dynamic route, navigation entry, all associated items/schedules
8. Audit log records the deletion with full module snapshot for recovery

### Menu / Items Management (ADM-MOD-013)

- **URL**: `/admin/modules/{id}` → **Items** tab

#### Add Item

1. Click **+ Add Item**
2. Fill in the item form:

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `name` | text | Yes | 2-100 chars | — |
| `description` | text | No | Max 500 chars | — |
| `category_id` | select | No | From module's categories | Uncategorized |
| `price` | number | Yes | 0.01-99999.99 | — |
| `compare_at_price` | number | No | Must be > `price` (shows strikethrough) | — |
| `image` | file upload | No | JPG/PNG, max 2MB | Placeholder |
| `sku` | text | No | Unique within module | Auto-generated |
| `is_available` | toggle | No | — | `true` |
| `preparation_time_min` | number | No | 0-240 (ordering type only) | Module default |
| `max_quantity_per_order` | number | No | 1-100 | `10` |
| `allergens` | multi-select | No | Predefined list (gluten, dairy, nuts, etc.) | — |
| `dietary_tags` | multi-select | No | Vegetarian, Vegan, Halal, Gluten-Free | — |
| `sort_order` | number | No | 1-999 | Next available |

3. Click **Save Item** → POST `/api/admin/modules/{module_id}/items`

#### Item Categories (ADM-MOD-014)

1. On the Items tab, click **Manage Categories**
2. Add/edit/delete/reorder categories:

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | text | Yes | 2-50 chars, unique within module |
| `description` | text | No | Max 200 chars |
| `sort_order` | number | No | 1-999 |
| `is_visible` | toggle | No | Defaults to true |

3. Drag-and-drop to reorder categories
4. Deleting a category moves items to "Uncategorized"

#### Item Pricing Rules (ADM-MOD-015)

1. On an item's edit form, click **Pricing Rules** section
2. Configure dynamic pricing:

| Rule Type | Fields | Description |
|---|---|---|
| Time-based | `start_time`, `end_time`, `modifier` (% or fixed) | Happy hour pricing |
| Day-based | `days_of_week[]`, `modifier` | Weekend surcharge |
| Seasonal | `start_date`, `end_date`, `modifier` | Peak season pricing |
| Quantity | `min_qty`, `max_qty`, `unit_price` | Bulk discount tiers |
| Guest count | `min_guests`, `modifier` | Group booking discount |

3. Rules stack: base price → time modifier → day modifier → seasonal modifier → quantity discount
4. **API**: POST `/api/admin/modules/{module_id}/items/{item_id}/pricing-rules`

### Schedule Configuration (ADM-MOD-017, ADM-MOD-018, ADM-MOD-019)

- **URL**: `/admin/modules/{id}` → **Schedule** tab

#### Operating Hours (ADM-MOD-018)

1. Weekly schedule grid displayed:

| Day | Open Time | Close Time | Status |
|---|---|---|---|
| Monday | 09:00 | 18:00 | Open |
| Tuesday | 09:00 | 18:00 | Open |
| Wednesday | 09:00 | 18:00 | Open |
| Thursday | 09:00 | 18:00 | Open |
| Friday | 09:00 | 20:00 | Open |
| Saturday | 08:00 | 22:00 | Open |
| Sunday | 08:00 | 20:00 | Open |

2. Click any row to edit open/close times
3. Toggle a day to "Closed" to disable that day entirely
4. Support for split hours (e.g., 09:00-12:00, 15:00-20:00 with lunch break)
5. **API**: PUT `/api/admin/modules/{module_id}/schedule`

#### Seasonal Schedule Overrides (ADM-MOD-019)

1. Click **+ Add Override** below the weekly grid
2. Configure override:

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | text | Yes | e.g., "Summer Hours", "Holiday Closure" |
| `start_date` | date | Yes | Future or current date |
| `end_date` | date | Yes | Must be ≥ start_date |
| `schedule` | weekly grid | Yes | Same format as regular operating hours |
| `is_closed` | toggle | No | Marks entire period as closed |

3. Overrides take priority over the regular weekly schedule during their active dates
4. Multiple overrides can exist; most specific date range wins conflicts

### Enable/Disable Module Toggle (ADM-MOD-021)

1. On the module list, use the toggle switch on each module card
2. Or in module detail → Settings tab → **Module Status** toggle
3. **Disabled** modules:
   - Customer route `/{slug}` shows "Currently Unavailable" page
   - Module removed from navigation menu
   - Existing orders/bookings continue processing
   - Admin can still access management pages
4. **API**: PATCH `/api/admin/modules/{id}` with `{ "is_active": false }`

### Module Analytics (ADM-MOD-022)

- **URL**: `/admin/modules/{id}` → **Analytics** tab
- **Metrics**:
  - Revenue: Today, this week, this month, all-time
  - Orders/Bookings: Count and trend chart
  - Average order value
  - Popular items: Top 10 by order volume
  - Peak hours: Heatmap of activity by hour-of-day
  - Customer demographics: New vs returning
  - Rating: Average review rating for this module
- **Time range picker**: 7d, 30d, 90d, 1y, custom

### Multi-Language Module Content (ADM-MOD-024)

1. In any text field (name, description, item names, etc.), click the **🌐 Translate** icon
2. Translation panel opens with tabs for all 5 configured locales:
   - **EN** (English) — primary/default
   - **AR** (Arabic) — RTL layout
   - **FR** (French)
   - **DE** (German)
   - **IT** (Italian)
3. Enter translations for each locale or click **Auto-Translate** (uses i18n service)
4. Translations stored in `module_translations` table with `module_id`, `field`, `locale`, `value`
5. Customer-facing pages render the appropriate locale based on user language preference

### Module Theme Customization (ADM-MOD-025)

1. Module detail → **Settings** tab → **Appearance** section
2. Options:

| Setting | Type | Options | Default |
|---|---|---|---|
| `theme` | select | 6 resort themes (Default, Ocean, Forest, Desert, Mountain, Tropical) or "Inherit" | Inherit |
| `primary_color` | color picker | Any hex color | From theme |
| `accent_color` | color picker | Any hex color | From theme |
| `card_style` | select | `rounded`, `sharp`, `minimal` | `rounded` |
| `layout` | select | `grid`, `list`, `masonry` | `grid` |
| `items_per_row` | number | 2, 3, 4 | `3` |

3. Preview panel shows live preview of customer-facing page with selected theme

## Configuration Settings

| Setting | Default | Options | Impact |
|---|---|---|---|
| `modules.max_modules` | `50` | 1-100 | Maximum number of modules that can be created |
| `modules.max_items_per_module` | `500` | 10-5000 | Max items per module |
| `modules.max_categories_per_module` | `50` | 5-100 | Max categories per module |
| `modules.default_currency` | `EUR` | From configured currencies | Default currency for new module items |
| `modules.image_max_size_mb` | `5` | 1-20 | Max upload size for module images |
| `modules.slug_redirect_days` | `90` | 0-365 | Days to maintain redirect when slug changes |
| `modules.cache_ttl_seconds` | `300` | 60-3600 | Redis cache TTL for module data |
| `modules.enable_seo_fields` | `true` | true/false | Show SEO meta fields in module editor |
| `modules.default_module_type` | `ordering` | ordering/booking/information | Pre-selected type in creation form |
| `modules.auto_generate_sitemap` | `true` | true/false | Include module pages in sitemap.xml |

## Reports & Analytics

### Module Performance Reports

1. **Individual Module Report** (`/admin/modules/{id}/analytics`):
   - Revenue breakdown by item/category
   - Order/booking volume trends
   - Peak activity hours heatmap
   - Customer satisfaction (review ratings)
   - Item performance ranking

2. **Cross-Module Comparison** (`/admin/reports/modules`):
   - Side-by-side revenue comparison across modules
   - Market share (% of total resort revenue per module)
   - Customer overlap analysis (users who book/order from multiple modules)
   - Seasonal performance patterns

3. **Module Health Report** (`/admin/reports/module-health`):
   - Modules with declining orders (30-day trend)
   - Items with zero orders in last 30 days
   - Schedule conflicts or gaps
   - Missing translations per locale

## Integration Points

| System | Direction | Data | Trigger |
|---|---|---|---|
| Next.js Dynamic Routes | Outbound | Module slug → customer page at `/{slug}` | Module created/updated/deleted |
| Navigation System | Outbound | Module name + icon + display order | Module list changes |
| Coupons & Promotions | Bidirectional | Module IDs for scoping discounts | Coupon/promotion creation |
| Reviews & Feedback | Inbound | Reviews linked to module_id | Customer submits review |
| Booking System | Bidirectional | Module type `booking` → booking slots | Module schedule updates |
| Order System | Bidirectional | Module type `ordering` → cart/checkout | Item added to cart |
| Stripe Payments | Outbound | Item prices for payment processing | Customer checkout |
| Socket.IO | Outbound | Real-time module state changes | Any module CRUD operation |
| Redis Cache | Bidirectional | Module config + items cached | Module data access |
| Supabase Storage | Outbound | Icon + cover image + item images | Image upload |
| i18n System | Bidirectional | Translations for 5 locales | Content creation/update |
| Reporting System | Outbound | Revenue, orders, bookings data | Analytics queries |
| SEO System | Outbound | Meta tags, sitemap entries | Module published |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Module page returns 404 at `/{slug}` | Slug not propagated to Next.js routes; or module is disabled | Verify module `is_active` = true; restart Next.js dev server if in development; check `modules` table for slug value |
| "Slug already in use" error on creation | Another module (possibly archived) uses the same slug | Choose a different slug; or delete/rename the conflicting module |
| Module icon not displaying | Image upload failed or wrong format | Re-upload as SVG/PNG, max 2MB; check Supabase Storage bucket `module-assets` |
| Items not appearing on customer page | Items marked as `is_available = false` or category hidden | Check item availability toggles and category visibility |
| Schedule shows wrong times to customer | Timezone mismatch between server and display | Verify resort timezone in `/admin/settings/general`; all times stored as UTC |
| Drag-and-drop reorder not saving | WebSocket connection dropped during reorder | Refresh page and try again; check Socket.IO connection status |
| Pricing rules not applying | Rules have conflicting date ranges or conditions | Review pricing rules in order of priority; check date ranges for overlaps |
| Translations missing on customer page | Translation not entered for customer's locale | Open translate panel and add missing locale content; untranslated fields fall back to EN |
| Module analytics showing zero | Module is new and has no completed orders yet | Allow time for orders to accumulate; verify the analytics cron job is running |
| Cannot delete module | Active orders or bookings exist | Disable the module instead; or wait for all orders/bookings to complete, then delete |
| Performance slow with many items | Module has 500+ items with full images | Enable pagination on the customer page; optimize images; increase Redis cache TTL |

## Security & Permissions

| Action | Required Role | Additional Notes |
|---|---|---|
| View module list | `admin`, `super_admin` | Read-only for base `admin` |
| Create module | `super_admin` | Module creation is critical infrastructure |
| Edit module details | `super_admin` | Or `admin` with `modules.edit` permission |
| Delete module | `super_admin` | Requires typing module name to confirm |
| Manage module items | `admin`, `super_admin` | `admin` can manage items for assigned modules |
| Manage schedule | `admin`, `super_admin` | `admin` can manage schedule for assigned modules |
| Configure pricing rules | `super_admin` | Pricing changes affect revenue |
| Enable/disable module | `super_admin` | Affects customer-facing availability |
| View module analytics | `admin`, `super_admin` | Read-only |
| Theme customization | `super_admin` | Visual changes to customer experience |
| Manage translations | `admin`, `super_admin` | `admin` can edit translations for assigned modules |

All module CRUD operations are recorded in `audit_logs` with full before/after snapshots for critical fields (name, slug, status, pricing).

## Related Modules

### Admin Guides
- [Coupons & Promotions](./coupons-promotions.md) — Module-specific discount scoping
- [Reviews & Feedback](./reviews-feedback.md) — Reviews attached to modules
- [Reports & Analytics](./reports-analytics.md) — Module revenue in consolidated reports
- [Settings & Configuration](./settings-configuration.md) — Default module settings, currencies, themes

### Customer Guides
- [Browsing Modules](../customer/modules.md) — Customer-facing module pages at `/{slug}`
- [Ordering Flow](../customer/ordering.md) — Ordering-type module customer experience
- [Booking Flow](../customer/bookings.md) — Booking-type module customer experience

## Feature Coverage Summary

| Category | Total Features | Implemented | Tested | Documented |
|---|---|---|---|---|
| Module CRUD | 4 | 4 | 4 | 4 |
| Module Configuration | 8 | 8 | 8 | 8 |
| Items Management | 4 | 4 | 4 | 4 |
| Schedule Management | 3 | 3 | 3 | 3 |
| Pricing | 2 | 2 | 2 | 2 |
| Analytics | 1 | 1 | 1 | 1 |
| Customization & i18n | 3 | 3 | 3 | 3 |
| **Total** | **25** | **25** | **25** | **25** |
