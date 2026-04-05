# PHASE 2: COMPLETE VERIFICATION PROGRAM

> **Purpose**: Executable verification program for the V2 Resort Management System.  
> **Foundation**: Phase 1 System Map (12 sections), Frontend & Workflows (7 sections), Inventory A (Failure Paths), Inventory B (Automated Processes), Frontend Page Inventory (107 pages).  
> **Standard**: Every journey is specified to the precision required for unambiguous pass/fail determination.  
> **Date**: March 2026

---

## Table of Contents

- [Part 1: Admin Setup Sequence](#part-1-admin-setup-sequence)
- [Part 2: Complete Journey Library](#part-2-complete-journey-library)
- [Part 3: Concurrency & Race Condition Journeys](#part-3-concurrency--race-condition-journeys)
- [Part 4: Cross-Engine Invariant Journeys](#part-4-cross-engine-invariant-journeys)
- [Part 5: Stress Scenarios](#part-5-stress-scenarios)
- [Coverage Matrix](#coverage-matrix)

---

# Part 1: Admin Setup Sequence

This sequence takes the system from a blank state to a fully operational resort platform. Every journey in Parts 2–5 assumes this setup has been completed successfully. Steps are ordered by dependency — each step may depend on prior steps but never on later ones.

## Notation

- **API**: The HTTP call made. All under `http://localhost:3005/api/v1/` unless noted.
- **Auth**: Who must be authenticated. `SA` = super_admin. `A` = admin.
- **Verify**: What to check after the step completes.
- **If Skipped**: What breaks downstream.

---

## Setup Step 1: Super Admin Authentication

**What**: Authenticate as the seed super_admin account.

**Action**:
```
POST /auth/login
Body: { "email": "admin@v2resort.com", "password": "admin123" }
```

**Response must contain**:
- `accessToken` — JWT string
- `refreshToken` — JWT string
- `user.role` = `"super_admin"`
- `user.email` = `"admin@v2resort.com"`
- `requiresTwoFactor` = `false` (seed account has no 2FA)

**System state after**: Authenticated session with super_admin privileges. All subsequent API calls use `Authorization: Bearer <accessToken>`.

**If skipped**: Every subsequent step fails with 401 Unauthorized.

---

## Setup Step 2: System Identity — General Settings

**What**: Configure the business identity that appears in all customer-facing pages, emails, and receipts.

**Action**:
```
PUT /admin/settings
Body: {
  "key": "general",
  "value": {
    "resortName": "V2 Test Resort",
    "tagline": "Verification Resort Platform",
    "description": "A fully configured resort for verification testing"
  }
}
```

**Verify**:
- `GET /admin/settings` returns a row where `key = 'general'` and `value.resortName = 'V2 Test Resort'`
- Homepage (`/`) renders "V2 Test Resort" in the header/hero

**If skipped**: All customer-facing pages show stale or placeholder branding. Does not block functional operations.

---

## Setup Step 3: Contact Information

**Action**:
```
PUT /admin/settings
Body: {
  "key": "contact",
  "value": {
    "phone": "+1-555-TEST",
    "email": "test@v2resort.com",
    "address": "1 Test Boulevard, Verification City"
  }
}
```

**Verify**: `GET /admin/settings` returns `contact.phone = "+1-555-TEST"`.

**If skipped**: Support emails reference wrong address. Non-blocking.

---

## Setup Step 4: Payment Configuration (CRITICAL)

**What**: Configure Stripe keys and currency. Without this, no card payment can be processed.

**Action**:
```
PUT /admin/settings
Body: {
  "key": "payments",
  "value": {
    "stripeSecretKey": "sk_test_XXXXXXXXXXXXXXXXXXXXXXXX",
    "stripeWebhookSecret": "whsec_XXXXXXXXXXXXXXXXXXXXXXXX",
    "currency": "usd"
  }
}
```

**Verify**:
- `GET /admin/settings` returns `payments.currency = "usd"`
- `payments.stripeSecretKey` exists and starts with `"sk_test_"`

**System state after**: Stripe PaymentIntent creation and webhook verification will work.

**If skipped**: `POST /payments/create-intent` fails. All card payments fail. Cash payments still work. Webhook signature verification fails → all Stripe events rejected.

---

## Setup Step 5: Tax Configuration (CRITICAL)

**What**: Set the global tax rate and any per-module overrides. Affects every financial calculation in the system.

**Action**:
```
PUT /admin/tax/configuration
Body: {
  "global_rate": 0.11,
  "modules": {}
}
```

**Verify**:
- `GET /admin/tax/configuration` returns `global_rate = 0.11`
- Tax calculation: a $100 subtotal produces $11.00 tax

**System state after**: Tax rate = 11%. The pricing pipeline (`pricing-pipeline.ts`) uses `TaxService.getTaxRate(moduleId)` which reads this setting.

**If skipped**: Tax defaults to 0.11 (Lebanon VAT) from hardcoded default in `tax.service.ts` line 5. Orders will use the default, but the admin has no visibility into what rate is being applied.

---

## Setup Step 6: Order Configuration — Service Charge & Delivery Fee

**What**: Set the service charge rate (dine-in) and flat delivery fee.

**Action**:
```
PUT /admin/settings
Body: {
  "key": "order_configuration",
  "value": {
    "serviceChargeRate": 0.10,
    "deliveryFee": 5.00
  }
}
```

**Verify**:
- A dine-in order of $100 subtotal includes $10.00 service charge
- A delivery order of any subtotal includes $5.00 delivery fee
- Takeaway orders have neither

**System state after**: Service charge = 10%, delivery fee = $5.00.

**If skipped**: Defaults apply (10% service charge, $5 delivery fee) from `order-config.service.ts` lines 6–7. Functionally identical to explicit configuration but admin cannot verify the rate in settings UI.

---

## Setup Step 7: Currency Configuration

**Action**:
```
PUT /admin/settings
Body: {
  "key": "default_currency",
  "value": "USD"
}
```

**Verify**: All price displays show `$` symbol. Stripe intents created with `currency: 'usd'`.

**If skipped**: Stripe falls back to `payments.currency`. Display currency may be inconsistent.

---

## Setup Step 8: Create Restaurant Module (Engine A)

**What**: Create the first `menu_service` module. This is Engine A — instant transactions (orders).

**Action**:
```
POST /admin/modules
Body: {
  "name": "Restaurant",
  "slug": "restaurant",
  "description": "Full-service dining",
  "template_type": "menu_service",
  "is_active": true,
  "show_in_main": true,
  "settings": {
    "header_color": "#0ea5e9",
    "accent_color": "#6366f1",
    "show_in_nav": true,
    "icon": "utensils"
  }
}
```

**Verify**:
- `GET /modules` returns module with `slug = "restaurant"`, `is_active = true`, `template_type = "menu_service"`
- Note the returned `id` — this is `RESTAURANT_MODULE_ID` for all subsequent references
- `/restaurant` route renders the menu page
- `/admin/restaurant` sidebar items appear: Menu Items, Categories, Orders, Tables, Reservations, Waitlist, Modifiers

**If skipped**: No restaurant module exists. All restaurant orders, menu items, and kitchen display fail. Engine A cannot be tested.

---

## Setup Step 9: Create Restaurant Menu Categories

**What**: Create categories to organize menu items.

**Actions** (execute in order):
```
POST /restaurant/admin/categories
Body: { "name": "Appetizers", "module_id": "<RESTAURANT_MODULE_ID>", "display_order": 1 }

POST /restaurant/admin/categories
Body: { "name": "Main Courses", "module_id": "<RESTAURANT_MODULE_ID>", "display_order": 2 }

POST /restaurant/admin/categories  
Body: { "name": "Desserts", "module_id": "<RESTAURANT_MODULE_ID>", "display_order": 3 }

POST /restaurant/admin/categories
Body: { "name": "Beverages", "module_id": "<RESTAURANT_MODULE_ID>", "display_order": 4 }
```

**Verify**:
- `GET /restaurant/menu?moduleId=<RESTAURANT_MODULE_ID>` returns 4 categories
- Note category IDs: `APPETIZERS_CAT_ID`, `MAINS_CAT_ID`, `DESSERTS_CAT_ID`, `BEVERAGES_CAT_ID`

**If skipped**: Cannot create menu items (category_id is required).

---

## Setup Step 10: Create Restaurant Menu Items

**What**: Create menu items with varying prices, dietary tags, and one featured item.

**Actions**:
```
POST /restaurant/admin/menu
Body: {
  "name": "Bruschetta",
  "category_id": "<APPETIZERS_CAT_ID>",
  "price": 12.50,
  "description": "Toasted bread with tomatoes",
  "module_id": "<RESTAURANT_MODULE_ID>",
  "is_available": true,
  "is_vegetarian": true,
  "is_vegan": true,
  "is_gluten_free": false,
  "is_featured": true
}

POST /restaurant/admin/menu
Body: {
  "name": "Grilled Salmon",
  "category_id": "<MAINS_CAT_ID>",
  "price": 28.00,
  "description": "Atlantic salmon with herbs",
  "module_id": "<RESTAURANT_MODULE_ID>",
  "is_available": true,
  "is_gluten_free": true
}

POST /restaurant/admin/menu
Body: {
  "name": "Chocolate Cake",
  "category_id": "<DESSERTS_CAT_ID>",
  "price": 9.50,
  "description": "Rich chocolate layer cake",
  "module_id": "<RESTAURANT_MODULE_ID>",
  "is_available": true,
  "is_vegetarian": true
}

POST /restaurant/admin/menu
Body: {
  "name": "Espresso",
  "category_id": "<BEVERAGES_CAT_ID>",
  "price": 4.00,
  "description": "Double shot espresso",
  "module_id": "<RESTAURANT_MODULE_ID>",
  "is_available": true,
  "is_vegan": true,
  "is_vegetarian": true,
  "is_gluten_free": true
}

POST /restaurant/admin/menu
Body: {
  "name": "Wagyu Steak",
  "category_id": "<MAINS_CAT_ID>",
  "price": 85.00,
  "description": "A5 Wagyu",
  "module_id": "<RESTAURANT_MODULE_ID>",
  "is_available": true
}
```

**Verify**:
- `GET /restaurant/menu?moduleId=<RESTAURANT_MODULE_ID>` returns 5 items across 4 categories
- Note IDs: `BRUSCHETTA_ID`, `SALMON_ID`, `CAKE_ID`, `ESPRESSO_ID`, `WAGYU_ID`
- `/restaurant` page shows all 5 items with correct prices and dietary badges

**If skipped**: No items to order. All restaurant ordering journeys fail.

---

## Setup Step 11: Create Modifier Groups for Restaurant

**What**: Create modifier groups that allow customization of menu items.

**Actions**:
```
POST /restaurant/admin/modifiers/groups
Body: {
  "name": "Steak Temperature",
  "min_selections": 1,
  "max_selections": 1,
  "is_required": true,
  "module_id": "<RESTAURANT_MODULE_ID>",
  "options": [
    { "name": "Rare", "price": 0, "is_available": true },
    { "name": "Medium Rare", "price": 0, "is_available": true },
    { "name": "Medium", "price": 0, "is_available": true },
    { "name": "Well Done", "price": 0, "is_available": true }
  ]
}

POST /restaurant/admin/modifiers/groups
Body: {
  "name": "Side Dish",
  "min_selections": 0,
  "max_selections": 2,
  "is_required": false,
  "module_id": "<RESTAURANT_MODULE_ID>",
  "options": [
    { "name": "French Fries", "price": 3.50, "is_available": true },
    { "name": "Caesar Salad", "price": 4.00, "is_available": true },
    { "name": "Mashed Potatoes", "price": 3.00, "is_available": true }
  ]
}
```

**Verify**:
- Note IDs: `TEMP_GROUP_ID`, `SIDE_GROUP_ID` and each option's ID
- Link modifiers to Wagyu Steak: `PUT /restaurant/admin/items/<WAGYU_ID>/modifiers` with `{ "modifierGroupIds": [{ "groupId": "<TEMP_GROUP_ID>", "sortOrder": 0 }, { "groupId": "<SIDE_GROUP_ID>", "sortOrder": 1 }] }`
- `GET /restaurant/menu` → Wagyu Steak has 2 modifier groups attached

**If skipped**: Wagyu Steak has no modifiers. Modifier pricing tests fail.

---

## Setup Step 12: Create Restaurant Tables

**What**: Create tables for dine-in functionality.

**Actions**:
```
POST /restaurant/admin/tables
Body: { "table_number": "1", "capacity": 4, "section": "indoor", "module_id": "<RESTAURANT_MODULE_ID>" }

POST /restaurant/admin/tables
Body: { "table_number": "2", "capacity": 6, "section": "indoor", "module_id": "<RESTAURANT_MODULE_ID>" }

POST /restaurant/admin/tables
Body: { "table_number": "T1", "capacity": 8, "section": "terrace", "module_id": "<RESTAURANT_MODULE_ID>" }
```

**Verify**: `GET /restaurant/tables?moduleId=<RESTAURANT_MODULE_ID>` returns 3 tables.

**If skipped**: Dine-in orders can still specify a table number as free text, but table management and status tracking are unavailable.

---

## Setup Step 13: Create Chalets Module (Engine B)

**What**: Create the `multi_day_booking` module. This is Engine B — time-exclusive reservations.

**Action**:
```
POST /admin/modules
Body: {
  "name": "Chalets",
  "slug": "chalets",
  "description": "Private chalet accommodations",
  "template_type": "multi_day_booking",
  "is_active": true,
  "show_in_main": true,
  "settings": {
    "header_color": "#10b981",
    "accent_color": "#059669",
    "show_in_nav": true,
    "icon": "home"
  }
}
```

**Verify**:
- Module returned with `template_type = "multi_day_booking"`, `is_active = true`
- Note `CHALETS_MODULE_ID`
- Admin sidebar shows Chalets → All Units, Bookings, Pricing Rules, Add-ons

**If skipped**: No chalet module. All booking journeys fail. Engine B untested.

---

## Setup Step 14: Chalet Configuration — Deposit & Check-in Times

**Action**:
```
PUT /admin/settings
Body: {
  "key": "chalets",
  "value": {
    "checkIn": "15:00",
    "checkOut": "11:00",
    "depositPercent": 30,
    "chaletDepositType": "percentage",
    "chaletDeposit": 30,
    "cancellationPolicy": "Full refund if cancelled 72 hours before check-in. 50% refund 24-72 hours. No refund within 24 hours."
  }
}
```

**Verify**:
- `GET /admin/settings` → `chalets.chaletDepositType = "percentage"`, `chalets.chaletDeposit = 30`
- Booking a chalet for $200/night × 2 nights = $400 total produces deposit of $120 (30%)

**If skipped**: Deposit defaults to 30% from controller default. Functionally works but cancellation policy is undefined.

---

## Setup Step 15: Create Chalet Units

**What**: Create physical chalet units with varying capacity and pricing.

**Actions**:
```
POST /chalets
Body: {
  "name": "Mountain View A",
  "description": "Luxury chalet with mountain views",
  "capacity": 4,
  "base_price": 200.00,
  "weekend_price": 250.00,
  "images": [],
  "is_active": true,
  "module_id": "<CHALETS_MODULE_ID>"
}

POST /chalets
Body: {
  "name": "Lakeside B",
  "description": "Chalet overlooking the lake",
  "capacity": 6,
  "base_price": 300.00,
  "weekend_price": 350.00,
  "images": [],
  "is_active": true,
  "module_id": "<CHALETS_MODULE_ID>"
}

POST /chalets
Body: {
  "name": "Garden C",
  "description": "Cozy garden chalet",
  "capacity": 2,
  "base_price": 150.00,
  "weekend_price": 180.00,
  "images": [],
  "is_active": true,
  "module_id": "<CHALETS_MODULE_ID>"
}
```

**Verify**:
- `GET /chalets` returns 3 chalets with correct names and prices
- Note IDs: `CHALET_A_ID` (Mountain View), `CHALET_B_ID` (Lakeside), `CHALET_C_ID` (Garden)

**If skipped**: No chalets to book. All booking journeys fail.

---

## Setup Step 16: Create Chalet Pricing Rules (Seasonal)

**What**: Create a seasonal pricing rule for a high-season period.

**Action**:
```
POST /chalets/admin/price-rules
Body: {
  "chalet_id": null,
  "name": "Summer Peak Season",
  "start_date": "2026-06-01",
  "end_date": "2026-08-31",
  "price_multiplier": 1.5,
  "priority": 10,
  "is_active": true
}

POST /chalets/admin/price-rules
Body: {
  "chalet_id": "<CHALET_A_ID>",
  "name": "Mountain View Premium",
  "start_date": "2026-03-01",
  "end_date": "2026-12-31",
  "price": 220.00,
  "priority": 5,
  "is_active": true
}
```

**Verify**:
- Booking Mountain View A on a weekday in March: price = $220/night (rule priority 5 applies)
- Booking Mountain View A on a weekday in July: price = $330/night (base $220 × 1.5 multiplier from priority 10 rule)
- Booking Lakeside B on a weekday in March: price = $300/night (no matching rule → base_price)

**If skipped**: All bookings use base_price/weekend_price only. Seasonal pricing journeys fail.

---

## Setup Step 17: Create Chalet Add-ons

**Actions**:
```
POST /chalets/admin/add-ons
Body: {
  "name": "BBQ Equipment",
  "description": "Charcoal grill and utensils",
  "price": 25.00,
  "price_type": "per_night",
  "is_active": true
}

POST /chalets/admin/add-ons
Body: {
  "name": "Welcome Basket",
  "description": "Fruit, wine, and cheese basket",
  "price": 45.00,
  "price_type": "one_time",
  "is_active": true
}

POST /chalets/admin/add-ons
Body: {
  "name": "Extra Bedding Set",
  "description": "Additional pillows and blankets",
  "price": 15.00,
  "price_type": "per_night",
  "is_active": true
}
```

**Verify**:
- `GET /chalets/add-ons?moduleId=<CHALETS_MODULE_ID>` returns 3 add-ons
- Note IDs: `BBQ_ADDON_ID`, `BASKET_ADDON_ID`, `BEDDING_ADDON_ID`
- A 2-night booking with BBQ Equipment costs: $25 × 2 = $50 add-on total
- A 2-night booking with Welcome Basket costs: $45 × 1 = $45 add-on total

**If skipped**: Add-on selection is empty. Add-on pricing journeys fail.

---

## Setup Step 18: Create Pool Module (Engine C)

**What**: Create the `session_access` module. This is Engine C — shared capacity access.

**Action**:
```
POST /admin/modules
Body: {
  "name": "Pool",
  "slug": "pool",
  "description": "Resort swimming pool",
  "template_type": "session_access",
  "is_active": true,
  "show_in_main": true,
  "settings": {
    "header_color": "#3b82f6",
    "accent_color": "#2563eb",
    "show_in_nav": true,
    "icon": "waves"
  }
}
```

**Verify**:
- Module returned with `template_type = "session_access"`, `is_active = true`
- Note `POOL_MODULE_ID`
- Admin sidebar shows Pool → Sessions, Tickets, Capacity

**If skipped**: No pool module. All pool ticket journeys fail. Engine C untested.

---

## Setup Step 19: Create Pool Sessions

**What**: Create time-windowed pool sessions with defined capacity.

**Actions**:
```
POST /pool/admin/sessions (via RPC insert_pool_session)
Body: {
  "name": "Morning Swim",
  "start_time": "08:00",
  "end_time": "12:00",
  "max_capacity": 50,
  "adult_price": 15.00,
  "child_price": 8.00,
  "module_id": "<POOL_MODULE_ID>",
  "gender_restriction": "mixed"
}

POST /pool/admin/sessions
Body: {
  "name": "Afternoon Swim",
  "start_time": "13:00",
  "end_time": "17:00",
  "max_capacity": 50,
  "adult_price": 15.00,
  "child_price": 8.00,
  "module_id": "<POOL_MODULE_ID>",
  "gender_restriction": "mixed"
}

POST /pool/admin/sessions
Body: {
  "name": "Evening Swim",
  "start_time": "18:00",
  "end_time": "21:00",
  "max_capacity": 30,
  "adult_price": 20.00,
  "child_price": 10.00,
  "module_id": "<POOL_MODULE_ID>",
  "gender_restriction": "mixed"
}
```

**Verify**:
- `GET /pool/sessions?moduleId=<POOL_MODULE_ID>` returns 3 sessions
- Note IDs: `MORNING_SESSION_ID`, `AFTERNOON_SESSION_ID`, `EVENING_SESSION_ID`
- Morning/Afternoon: 50 capacity, $15/$8. Evening: 30 capacity, $20/$10.

**If skipped**: No sessions. Pool ticket purchase fails.

---

## Setup Step 20: Pool Settings

**Action**:
```
PUT /admin/settings
Body: {
  "key": "pool",
  "value": {
    "adultPrice": 15.00,
    "childPrice": 8.00,
    "infantPrice": 0,
    "capacity": 100
  }
}
```

**Verify**: `GET /admin/settings` returns `pool.capacity = 100`.

---

## Setup Step 21: Create Snack Bar Module (Engine A, second instance)

**Action**:
```
POST /admin/modules
Body: {
  "name": "Snack Bar",
  "slug": "snack-bar",
  "description": "Poolside snacks and drinks",
  "template_type": "menu_service",
  "is_active": true,
  "show_in_main": true,
  "settings": {
    "header_color": "#f59e0b",
    "accent_color": "#d97706",
    "show_in_nav": true,
    "icon": "coffee"
  }
}
```

**Verify**: Note `SNACK_MODULE_ID`. Admin sidebar shows Snack Bar submenu.

---

## Setup Step 22: Snack Bar Menu Setup

**Actions**: Create 1 category ("Snacks") and 2 items.

```
POST /restaurant/admin/categories
Body: { "name": "Snacks", "module_id": "<SNACK_MODULE_ID>", "display_order": 1 }

POST /restaurant/admin/menu
Body: { "name": "Club Sandwich", "category_id": "<SNACKS_CAT_ID>", "price": 10.00, "module_id": "<SNACK_MODULE_ID>", "is_available": true }

POST /restaurant/admin/menu
Body: { "name": "Fresh Juice", "category_id": "<SNACKS_CAT_ID>", "price": 6.00, "module_id": "<SNACK_MODULE_ID>", "is_available": true }
```

**Verify**: `GET /restaurant/menu?moduleId=<SNACK_MODULE_ID>` returns 2 items.

---

## Setup Step 23: Create Staff Accounts

**What**: Create staff accounts for each module with correct roles.

**Actions**:
```
POST /admin/users
Body: {
  "name": "Kitchen Staff 1",
  "email": "kitchen1@v2resort.com",
  "phone": "+1-555-0101",
  "password": "Staff123!",
  "role": "restaurant_staff"
}

POST /admin/users
Body: {
  "name": "Pool Staff 1",
  "email": "pool1@v2resort.com",
  "phone": "+1-555-0102",
  "password": "Staff123!",
  "role": "pool_staff"
}

POST /admin/users
Body: {
  "name": "Chalet Staff 1",
  "email": "chalet1@v2resort.com",
  "phone": "+1-555-0103",
  "password": "Staff123!",
  "role": "chalet_staff"
}

POST /admin/users
Body: {
  "name": "Housekeeping Staff 1",
  "email": "hk1@v2resort.com",
  "phone": "+1-555-0104",
  "password": "Staff123!",
  "role": "housekeeping_staff"
}

POST /admin/users
Body: {
  "name": "Resort Manager",
  "email": "manager@v2resort.com",
  "phone": "+1-555-0105",
  "password": "Manager123!",
  "role": "manager"
}
```

**Verify**:
- `GET /admin/users?type=staff` returns all 5 staff accounts
- Each can authenticate: `POST /auth/login` with their credentials
- Note IDs: `KITCHEN_STAFF_ID`, `POOL_STAFF_ID`, `CHALET_STAFF_ID`, `HK_STAFF_ID`, `MANAGER_ID`

**If skipped**: No staff can process orders, validate tickets, or check in bookings. Staff workflow journeys all fail.

---

## Setup Step 24: Create Test Customer Accounts

**What**: Create customer accounts with varying characteristics.

**Actions**:
```
POST /auth/register
Body: {
  "firstName": "Alice",
  "lastName": "Johnson",
  "email": "alice@test.com",
  "password": "Customer123!",
  "phone": "+1-555-1001"
}

POST /auth/register
Body: {
  "firstName": "Bob",
  "lastName": "Smith",
  "email": "bob@test.com",
  "password": "Customer123!",
  "phone": "+1-555-1002"
}

POST /auth/register
Body: {
  "firstName": "Carol",
  "lastName": "Williams",
  "email": "carol@test.com",
  "password": "Customer123!",
  "phone": "+1-555-1003"
}
```

**Verify**:
- All 3 return 201
- Each can log in via `POST /auth/login`
- Note IDs: `ALICE_ID`, `BOB_ID`, `CAROL_ID`

**If skipped**: Customer journeys that require authentication (loyalty, profile, booking cancellation) cannot run.

---

## Setup Step 25: Loyalty Program Configuration

**What**: Configure the loyalty engine — points earning rate, redemption value, tiers.

**Actions**:
```
PUT /loyalty/settings
Body: {
  "pointsPerDollar": 10,
  "redemptionRate": 0.01,
  "minRedemption": 100,
  "pointsExpiryDays": 365,
  "signupBonus": 50,
  "birthdayBonus": 100,
  "isEnabled": true
}
```

Then create tiers:
```
POST /loyalty/tiers
Body: {
  "name": "Bronze",
  "min_points": 0,
  "points_multiplier": 1.0,
  "color": "#CD7F32",
  "benefits": { "discount": "5%", "priority_seating": false },
  "is_active": true
}

POST /loyalty/tiers
Body: {
  "name": "Silver",
  "min_points": 500,
  "points_multiplier": 1.5,
  "color": "#C0C0C0",
  "benefits": { "discount": "10%", "priority_seating": true },
  "is_active": true
}

POST /loyalty/tiers
Body: {
  "name": "Gold",
  "min_points": 2000,
  "points_multiplier": 2.0,
  "color": "#FFD700",
  "benefits": { "discount": "15%", "priority_seating": true, "free_pool": true },
  "is_active": true
}
```

Enroll Alice in loyalty:
```
POST /loyalty/members (as Alice)
Body: {}
```

**Verify**:
- `GET /loyalty/settings` returns `pointsPerDollar = 10`, `redemptionRate = 0.01`, `minRedemption = 100`
- `GET /loyalty/tiers` returns 3 tiers ordered by min_points
- `GET /loyalty/members/me` (as Alice) returns account with 50 points (signup bonus), tier = Bronze
- Note `ALICE_LOYALTY_ID`

**Expected loyalty math**:
- Alice places a $100 order → earns 10 × $100 = 1,000 points (× 1.0 Bronze multiplier = 1,000)
- After earning 1,000 points, Alice totals 1,050 → still Bronze (< 500 Silver threshold since 500 is for Silver)
  - Wait — 1,050 > 500 → Alice upgrades to Silver tier
- Redemption: 100 points minimum, each point = $0.01, so 100 points = $1.00

**If skipped**: Loyalty earning/redemption tests fail. Cross-engine invariant journeys that verify loyalty cannot execute.

---

## Setup Step 26: Create Coupons

**What**: Create test coupons for verification.

**Actions**:
```
POST /coupons
Body: {
  "code": "WELCOME10",
  "name": "Welcome 10% Off",
  "description": "10% off first order",
  "discount_type": "percentage",
  "discount_value": 10,
  "min_order_amount": 20.00,
  "max_discount_amount": 50.00,
  "applies_to": "all",
  "max_uses": 100,
  "per_user_limit": 1,
  "valid_from": "2026-01-01T00:00:00Z",
  "valid_until": "2026-12-31T23:59:59Z",
  "first_order_only": true,
  "is_active": true
}

POST /coupons
Body: {
  "code": "FIXED5",
  "name": "$5 Off Any Order",
  "description": "Flat $5 discount",
  "discount_type": "fixed",
  "discount_value": 5.00,
  "min_order_amount": 10.00,
  "applies_to": "all",
  "max_uses": 1000,
  "per_user_limit": 5,
  "valid_from": "2026-01-01T00:00:00Z",
  "valid_until": "2026-12-31T23:59:59Z",
  "first_order_only": false,
  "is_active": true
}

POST /coupons
Body: {
  "code": "POOLONLY",
  "name": "Pool Module Only",
  "description": "15% off pool tickets",
  "discount_type": "percentage",
  "discount_value": 15,
  "applies_to": "pool",
  "max_uses": 50,
  "valid_from": "2026-01-01T00:00:00Z",
  "valid_until": "2026-12-31T23:59:59Z",
  "is_active": true
}

POST /coupons
Body: {
  "code": "EXPIRED1",
  "name": "Expired Coupon",
  "discount_type": "percentage",
  "discount_value": 50,
  "applies_to": "all",
  "valid_from": "2025-01-01T00:00:00Z",
  "valid_until": "2025-12-31T23:59:59Z",
  "is_active": true
}
```

**Verify**:
- `GET /coupons` returns 4 coupons
- `POST /coupons/validate` with `{ "code": "WELCOME10", "orderTotal": 50 }` → valid, 10% discount
- `POST /coupons/validate` with `{ "code": "EXPIRED1", "orderTotal": 50 }` → invalid (expired)
- `POST /coupons/validate` with `{ "code": "POOLONLY", "orderTotal": 50, "moduleSlug": "restaurant" }` → invalid (wrong module)

**If skipped**: Coupon tests fail. Discount calculation tests incomplete.

---

## Setup Step 27: Create Gift Cards

**Actions**:
```
POST /giftcards
Body: {
  "amount": 50.00,
  "recipient_name": "Bob Smith",
  "recipient_email": "bob@test.com",
  "sender_name": "Admin",
  "message": "Test gift card"
}

POST /giftcards
Body: {
  "amount": 100.00,
  "recipient_name": "Alice Johnson",
  "recipient_email": "alice@test.com",
  "sender_name": "Admin",
  "message": "High-value test gift card"
}
```

**Verify**:
- 2 gift cards created, each with unique code
- Note codes: `GC_BOB_CODE` (balance $50), `GC_ALICE_CODE` (balance $100)
- `GET /giftcards/<GC_BOB_CODE>` returns `balance = 50.00`, `status = "active"`

**If skipped**: Gift card redemption journeys cannot run.

---

## Setup Step 28: Housekeeping Task Types

**Action**:
```
POST /housekeeping/task-types
Body: { "name": "Standard Cleaning", "description": "Regular cleaning after checkout" }

POST /housekeeping/task-types
Body: { "name": "Deep Clean", "description": "Thorough deep cleaning" }
```

**Verify**: `GET /housekeeping/task-types` returns 2 types. Note IDs.

---

## Setup Step 29: Notification Templates (if email configured)

**Action**: Configure notification templates for booking confirmation, order confirmation, and booking reminder.

```
PUT /admin/settings
Body: {
  "key": "notifications",
  "value": {
    "orderConfirmation": true,
    "bookingConfirmation": true,
    "bookingReminder": true,
    "paymentReceipt": true
  }
}
```

**Verify**: Settings saved. (Email delivery depends on SMTP configuration.)

---

## Setup Step 30: Appearance & Homepage Configuration

**Actions**:
```
PUT /admin/settings
Body: {
  "key": "appearance",
  "value": {
    "theme": "luxury",
    "animationsEnabled": true,
    "soundEnabled": true,
    "showWeatherWidget": false
  }
}
```

**Verify**: Homepage renders with luxury theme. All active modules appear in services grid.

---

## Setup Verification Checkpoint

After completing all 30 steps, verify the complete system state:

| Component | Expected State |
|---|---|
| Active modules | 4 (Restaurant, Chalets, Pool, Snack Bar) |
| Restaurant menu items | 5 items across 4 categories |
| Restaurant modifier groups | 2 groups (Temperature, Side Dish) |
| Restaurant tables | 3 tables |
| Chalets | 3 units (Mountain View, Lakeside, Garden) |
| Chalet pricing rules | 2 rules (Summer Peak global, Mountain View premium) |
| Chalet add-ons | 3 (BBQ, Basket, Bedding) |
| Pool sessions | 3 (Morning, Afternoon, Evening) |
| Staff accounts | 5 (kitchen, pool, chalet, housekeeping, manager) |
| Customer accounts | 3 (Alice, Bob, Carol) |
| Loyalty tiers | 3 (Bronze, Silver, Gold) |
| Loyalty members | 1 (Alice with 50 signup points) |
| Coupons | 4 (WELCOME10, FIXED5, POOLONLY, EXPIRED1) |
| Gift cards | 2 ($50 for Bob, $100 for Alice) |
| Tax rate | 11% global |
| Service charge | 10% (dine-in only) |
| Delivery fee | $5.00 (delivery only) |
| Chalet deposit | 30% of total |

---

# Part 2: Complete Journey Library

Each journey specifies: scenario, preconditions, complete action sequence, precise assertions, and failure branches.

---

## Journey J-01: Restaurant Dine-In Order — Cash Payment (Happy Path)

### Scenario

Alice, an authenticated customer with a Bronze loyalty tier and 50 existing points, places a dine-in restaurant order for 2× Bruschetta and 1× Wagyu Steak (Medium Rare, with French Fries side), pays with cash. Kitchen staff confirms and processes the order through to completion.

### Preconditions

- Setup Steps 1–30 completed
- Alice authenticated (`POST /auth/login` → token)
- Kitchen Staff 1 authenticated in a separate session
- Alice's loyalty balance = 50 points (signup bonus)

### Action Sequence

| # | Actor | Action | API Call |
|---|---|---|---|
| 1 | Alice | Browse restaurant menu | `GET /restaurant/menu?moduleId=<RESTAURANT_MODULE_ID>` |
| 2 | Alice | Add 2× Bruschetta to cart | Frontend: `useCartStore.addToRestaurant({ id: BRUSCHETTA_ID, quantity: 2 })` |
| 3 | Alice | Add 1× Wagyu Steak with Medium Rare + French Fries | Frontend: `useCartStore.addToRestaurant({ id: WAGYU_ID, quantity: 1, selectedModifiers: [{groupId: TEMP_GROUP_ID, optionId: MEDIUM_RARE_ID}, {groupId: SIDE_GROUP_ID, optionId: FRIES_ID}], modifierTotal: 3.50 })` |
| 4 | Alice | Navigate to cart | Navigate to `/restaurant/cart` |
| 5 | Alice | Enter details | Step 2: name = "Alice Johnson", phone = "+1-555-1001", orderType = "dine_in", tableNumber = "1" |
| 6 | Alice | Select cash payment | Step 3: paymentMethod = "cash" |
| 7 | Alice | Place order | `POST /restaurant/orders` with full payload |
| 8 | System | Process order | Backend creates order, deducts inventory, emits Socket.io `order:new` |
| 9 | Kitchen Staff | Receive notification | Socket.io `order:new` fires. Order appears in Pending column. Audio notification plays. |
| 10 | Kitchen Staff | Confirm order | `PATCH /restaurant/staff/orders/<ORDER_ID>/status` → `{ "status": "confirmed" }` |
| 11 | Kitchen Staff | Start preparing | `PATCH /restaurant/staff/orders/<ORDER_ID>/status` → `{ "status": "preparing" }` |
| 12 | Kitchen Staff | Mark ready | `PATCH /restaurant/staff/orders/<ORDER_ID>/status` → `{ "status": "ready" }` |
| 13 | Kitchen Staff | Serve | `PATCH /restaurant/staff/orders/<ORDER_ID>/status` → `{ "status": "delivered" }` |
| 14 | Kitchen Staff | Complete | `PATCH /restaurant/staff/orders/<ORDER_ID>/status` → `{ "status": "completed" }` |

### Pricing Assertions

```
Item: 2× Bruschetta @ $12.50         = $25.00
Item: 1× Wagyu Steak @ $85.00        = $85.00
Modifier: French Fries @ $3.50       =  $3.50
                                 Subtotal = $113.50
Tax (11% of $113.50)                      =  $12.49 (rounded)
Service charge (10% of $113.50, dine-in)  =  $11.35
Delivery fee                              =   $0.00 (not delivery)
                                    Total = $137.34
```

### Assertion Checklist

| # | Assertion | Expected Value |
|---|---|---|
| A1 | `order.subtotal` | `113.50` |
| A2 | `order.tax_amount` | `12.49` (11% of 113.50 = 12.485, rounded to 2dp) |
| A3 | `order.service_charge` | `11.35` |
| A4 | `order.delivery_fee` | `0.00` |
| A5 | `order.total_amount` | `137.34` |
| A6 | `order.status` after step 14 | `"completed"` |
| A7 | `order.payment_status` after step 14 | `"paid"` |
| A8 | `order.order_type` | `"dine_in"` |
| A9 | `order.payment_method` | `"cash"` |
| A10 | `order.items` length | `2` (Bruschetta, Wagyu) |
| A11 | Wagyu item modifiers | `["Medium Rare", "French Fries"]` |
| A12 | `restaurant_order_status_history` entries | 6 entries (pending→confirmed→preparing→ready→delivered→completed) |
| A13 | Socket.io event count | 1× `order:new` + 5× `order:updated` |
| A14 | Alice's loyalty points (after completion) | `50 (existing) + (113.50 × 10 pts/$ × 1.0 Bronze multiplier) = 50 + 1135 = 1185` |
| A15 | Alice's loyalty tier | Silver (1185 ≥ 500 Silver threshold) |
| A16 | Alice's order in profile | `GET /profile` → Orders tab shows this order |

### Failure Branches

| Branch | Trigger | Verify |
|---|---|---|
| F1 | Alice adds unavailable item | `is_available = false` → Add button disabled on frontend |
| F2 | Network error on order submit | `toast.error()` displayed, no order created |
| F3 | Status update to invalid state (e.g., pending → ready) | Backend rejects with `StateMachineError`, 400 response |
| F4 | Double-submit order | Backend should process only one (no idempotency → **ground truth: may create 2 orders**) |

---

## Journey J-02: Restaurant Dine-In Order — Card Payment with Coupon

### Scenario

Bob, an authenticated customer, places a dine-in order for 1× Grilled Salmon + 1× Espresso, applies the FIXED5 coupon ($5 off), and pays by card. The Stripe webhook processes successfully.

### Preconditions

- Setup complete. Bob authenticated.
- FIXED5 coupon exists, is active, usage_count < max_uses
- Stripe test mode configured

### Action Sequence

| # | Actor | Action |
|---|---|---|
| 1 | Bob | Add 1× Salmon ($28) + 1× Espresso ($4) to cart |
| 2 | Bob | Enter details: dine_in, table "2" |
| 3 | Bob | Apply coupon FIXED5 → `POST /coupons/validate` → $5 discount validated |
| 4 | Bob | Select card payment |
| 5 | Bob | Place order → `POST /restaurant/orders` with `couponCode: "FIXED5"` |
| 6 | System | Create order (status: pending), apply coupon atomically via `apply_coupon_atomic` RPC |
| 7 | System | Create PaymentIntent → `POST /payments/create-intent` |
| 8 | Bob | Complete Stripe payment form |
| 9 | Stripe | Send `payment_intent.succeeded` webhook → `POST /payments/webhook/stripe` |
| 10 | System | Webhook handler: create `payment_ledger` entry, create `payments` record, update `payment_status` |
| 11 | System | Award loyalty points via `awardLoyaltyPointsForPayment()` |

### Pricing Assertions

```
Subtotal: $28.00 + $4.00                = $32.00
Coupon FIXED5 (pre-tax discount)        = -$5.00
Taxable amount: $32.00 - $5.00          = $27.00
Tax (11% of $27.00)                     =  $2.97
Service charge (10% of $32.00, dine-in) =  $3.20
Total = $32.00 - $5.00 + $2.97 + $3.20 = $33.17
```

**Note**: The exact tax computation depends on whether coupon is pre-tax (reduces taxable amount) or post-tax. Per `pricing-pipeline.ts` lines 133–150, coupon is a pre-tax discount if `supportsCoupons` is true, so tax is on ($32.00 - $5.00) = $27.00.

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | `order.subtotal` | `32.00` |
| A2 | `order.total_discount` | `5.00` |
| A3 | `order.tax_amount` | `2.97` |
| A4 | `order.service_charge` | `3.20` |
| A5 | `order.total_amount` | `33.17` |
| A6 | `order.payment_method` | `"card"` |
| A7 | `order.payment_status` (after webhook) | `"paid"` |
| A8 | `payment_ledger` entry exists | `transaction_type = "charge"`, `total_amount = 33.17` |
| A9 | `payments` table entry exists | `amount = 33.17`, `method = "card"`, `status = "completed"` |
| A10 | Coupon FIXED5 `times_used` incremented | Previous count + 1 |
| A11 | Stripe PaymentIntent amount | `3317` (cents) |
| A12 | Stripe PaymentIntent metadata | `{ referenceType: "order", referenceId: "<ORDER_ID>" }` |
| A13 | Ledger invariant | `|total_amount - max(0, subtotal + tax + serviceCharge + deliveryFee - totalDiscount)| ≤ 0.02` |

### Failure Branches

| Branch | Trigger | Verify |
|---|---|---|
| F1 | Coupon EXPIRED1 used | `POST /coupons/validate` returns error "Coupon expired" |
| F2 | Coupon POOLONLY used on restaurant order | Validation returns "Coupon does not apply to this module" |
| F3 | WELCOME10 used by Bob (not first order) | If Bob has prior orders: "First order only" error |
| F4 | Stripe payment declined | Stripe form shows error, order remains `payment_status: pending` |
| F5 | Webhook fails on `updateReferencePaymentStatus()` | **Ground truth test (H3)**: Payment ledger and payments row exist, but `order.payment_status` stays `"pending"`. Webhook retry hits idempotency → returns 200. Status is NEVER updated. |

---

## Journey J-03: Chalet Booking — Weekend with Add-ons, Cash Deposit

### Scenario

Alice books Mountain View A chalet for a Friday-to-Sunday stay (2 nights: Fri + Sat = both weekend nights), selects BBQ Equipment (per_night) and Welcome Basket (one_time), pays cash deposit.

### Preconditions

- Setup complete. Alice authenticated.
- Mountain View A exists with `weekend_price = $250`, pricing rule "Mountain View Premium" with `price = $220` only applies as base override (priority 5) but the weekend_price is used for Fri/Sat.
- **Pricing rule clarification**: The Mountain View Premium rule sets `price = $220` (an absolute override). On Fri/Sat, the system uses `weekend_price` from the chalet itself UNLESS the rule explicitly has a weekend override. Per controller logic (lines 281–306): if rule has `price` field, that overrides both weekday and weekend. So Mountain View premium applies $220/night even on weekends.
  - Actually need to recheck: the rule may apply as weekday override while weekend still uses chalet's `weekend_price`. This depends on implementation — the journey will verify which behavior is correct.

### Expected Pricing (two scenarios to test against)

**If pricing rule $220 overrides both weekday and weekend**:
```
Night 1 (Fri): $220 (rule price)
Night 2 (Sat): $220 (rule price)
Base accommodation: $440
BBQ Equipment: $25 × 2 nights = $50
Welcome Basket: $45 × 1 = $45
                       Subtotal: $535.00
Deposit (30%): $160.50
```

**If pricing rule $220 applies to weekday only, weekend uses chalet's weekend_price $250**:
```
Night 1 (Fri): $250 (weekend)
Night 2 (Sat): $250 (weekend)
Base accommodation: $500
BBQ Equipment: $25 × 2 = $50
Welcome Basket: $45 × 1 = $45
                       Subtotal: $595.00
Deposit (30%): $178.50
```

### Action Sequence

| # | Actor | Action |
|---|---|---|
| 1 | Alice | Browse chalets → `GET /chalets` |
| 2 | Alice | Select Mountain View A → `GET /chalets/<CHALET_A_ID>` |
| 3 | Alice | Check availability → `GET /chalets/<CHALET_A_ID>/availability` |
| 4 | Alice | Select Fri Mar 6 → Sun Mar 8, 2026 (2 nights) |
| 5 | Alice | Set guests = 3 (within capacity 4) |
| 6 | Alice | Toggle BBQ Equipment ON, Welcome Basket ON |
| 7 | Alice | Enter: name = "Alice Johnson", email = "alice@test.com", phone = "+1-555-1001" |
| 8 | Alice | Click "Book Now" → `POST /chalets/bookings` |
| 9 | System | Acquire Redis lock: `booking:lock:<CHALET_A_ID>:2026-03-06-2026-03-08` |
| 10 | System | Validate no overlap, calculate pricing, create booking |
| 11 | System | Create booking add-on records |
| 12 | System | Emit `booking:new` via Socket.io |
| 13 | System | Release Redis lock |
| 14 | Alice | Redirected to `/chalets/booking-confirmation` |

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | `booking.status` | `"pending"` |
| A2 | `booking.booking_number` format | `C-YYMMDD-NNN` (e.g., `C-260306-001`) |
| A3 | `booking.check_in_date` | `"2026-03-06"` |
| A4 | `booking.check_out_date` | `"2026-03-08"` |
| A5 | `booking.number_of_guests` | `3` |
| A6 | `booking.total_amount` | One of: `$535.00` or `$595.00` (verify which pricing model is correct) |
| A7 | `booking.deposit_amount` | 30% of total_amount |
| A8 | Booking add-ons | 2 records: BBQ (per_night, qty 2, $50), Basket (one_time, qty 1, $45) |
| A9 | `GET /chalets/<CHALET_A_ID>/availability` | Check-in to check-out dates now blocked |
| A10 | Audit log entry exists | Action = booking creation |
| A11 | Alice's profile → Bookings tab | Shows this booking |

### Failure Branches

| Branch | Trigger | Verify |
|---|---|---|
| F1 | Double-book same dates | Second `POST /chalets/bookings` → 409 "Chalet is already booked for these dates" |
| F2 | Guests exceed capacity | `number_of_guests: 5` (capacity 4) → 400 error |
| F3 | Redis lock timeout | If another booking locks the same chalet+dates for >10s → 503 or falls back to in-memory lock |
| F4 | Check-in date in the past | Backend rejects with validation error |

---

## Journey J-04: Pool Ticket Purchase — Multiple Guests with Tax

### Scenario

Bob purchases pool tickets for the Afternoon session (13:00-17:00) for 2 adults and 1 child on today's date.

### Action Sequence

| # | Actor | Action |
|---|---|---|
| 1 | Bob | Navigate to `/pool` |
| 2 | Bob | Select today's date |
| 3 | Bob | See availability → `GET /pool/availability?date=2026-03-03&moduleId=<POOL_MODULE_ID>` |
| 4 | Bob | Select Afternoon session ($15/adult, $8/child) |
| 5 | Bob | Set adults = 2, children = 1, name = "Bob Smith", phone = "+1-555-1002" |
| 6 | Bob | Purchase → `POST /pool/tickets` |

### Pricing Assertions

```
2 adults × $15.00 = $30.00
1 child  ×  $8.00 =  $8.00
                Subtotal = $38.00
Tax (11%)                =  $4.18
                   Total = $42.18
```

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | `ticket.number_of_guests` | `3` |
| A2 | `ticket.subtotal` | `38.00` |
| A3 | `ticket.tax_amount` | `4.18` |
| A4 | `ticket.total_amount` | `42.18` |
| A5 | `ticket.status` | `"valid"` |
| A6 | `ticket.ticket_number` format | `P-260303-NNNN` |
| A7 | `ticket.qr_code` | Non-empty string (base64 data URL) |
| A8 | `ticket.session_id` | `<AFTERNOON_SESSION_ID>` |
| A9 | Afternoon session available count | Previous available - 3 |
| A10 | Socket.io `pool:ticket:new` emitted | Pool staff receive notification |

---

## Journey J-05: Pool Entry/Exit — Staff Validates and Tracks Capacity

### Scenario

Pool staff validates Bob's ticket via QR scan, records entry, monitors capacity, then records exit when Bob leaves.

### Preconditions

- Journey J-04 completed (Bob has valid ticket)
- Pool Staff 1 authenticated

### Action Sequence

| # | Actor | Action |
|---|---|---|
| 1 | Pool Staff | Navigate to `/staff/pool` |
| 2 | Pool Staff | See Bob's ticket in today's list (status: valid) |
| 3 | Pool Staff | Scan QR → `POST /pool/staff/validate` with `{ "code": "<ticket_qr>" }` |
| 4 | System | Validates ticket: correct date, valid status, session active |
| 5 | Pool Staff | Click "Record Entry" → `POST /pool/tickets/<TICKET_ID>/entry` |
| 6 | System | Update ticket status: `valid → active`, increment occupancy, emit `pool:entry` |
| 7 | Pool Staff | Capacity bar shows: 3 / 50 (Morning was 0, this is Afternoon) |
| 8 | — | (Time passes, Bob enjoys pool) |
| 9 | Pool Staff | Select Bob's ticket → "Record Exit" → `POST /pool/tickets/<TICKET_ID>/exit` |
| 10 | System | Update ticket status: `active → used`, decrement occupancy, emit `pool:exit` |

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | Ticket status after step 5 | `"active"` |
| A2 | Pool occupancy after step 5 | Previous + 3 (Bob's party of 3) |
| A3 | Socket.io `pool:entry` emitted | With ticket details |
| A4 | Ticket status after step 9 | `"used"` |
| A5 | Pool occupancy after step 9 | Previous - 3 (back to baseline) |
| A6 | Socket.io `pool:exit` emitted | With ticket details |
| A7 | State transition `active → active` | Rejected (cannot re-enter) |
| A8 | State transition `used → active` | Rejected (cannot re-use) |

### Failure Branches

| Branch | Trigger | Verify |
|---|---|---|
| F1 | Scan ticket for wrong date | "Ticket not valid for today" |
| F2 | Scan already-used ticket | "Ticket already redeemed" |
| F3 | Entry when at max capacity | "Pool is at maximum capacity" — entry rejected |

---

## Journey J-06: Chalet Check-in Through Check-out with Housekeeping

### Scenario

Admin confirms Alice's booking (from J-03). On check-in day, chalet staff checks Alice in. After her stay, chalet staff checks her out, which automatically triggers a housekeeping task. Housekeeping staff completes the task.

### Preconditions

- Journey J-03 completed (Alice has pending booking)
- Chalet Staff 1 authenticated
- HK Staff 1 authenticated

### Action Sequence

| # | Actor | Action |
|---|---|---|
| 1 | Admin | Confirm booking → `PATCH /chalets/staff/bookings/<BOOKING_ID>/status` → `{ "status": "confirmed" }` |
| 2 | System | Status: `pending → confirmed`, emit `chalet:booking:updated` |
| 3 | Chalet Staff | On check-in day, see booking in today's check-ins |
| 4 | Chalet Staff | Click "Check In" → `PATCH /chalets/staff/bookings/<BOOKING_ID>/status` → `{ "status": "checked_in" }` |
| 5 | System | Status: `confirmed → checked_in`, emit Socket.io |
| 6 | — | (Guest stay — 2 nights) |
| 7 | Chalet Staff | Click "Check Out" → `PATCH /chalets/staff/bookings/<BOOKING_ID>/status` → `{ "status": "checked_out" }` |
| 8 | System | Status: `checked_in → checked_out`, **create housekeeping task** (status: pending), emit Socket.io |
| 9 | HK Staff | See new task assigned (Mountain View A, Standard Cleaning) |
| 10 | HK Staff | Start task → `POST /housekeeping/tasks/<TASK_ID>/start` |
| 11 | HK Staff | Complete task → `POST /housekeeping/tasks/<TASK_ID>/complete` |

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | Booking status after step 1 | `"confirmed"` |
| A2 | Booking status after step 4 | `"checked_in"` |
| A3 | Booking status after step 7 | `"checked_out"` |
| A4 | Housekeeping task created at step 8 | Exists with `status: "pending"`, linked to Mountain View A |
| A5 | Housekeeping task after step 10 | `status: "in_progress"`, `started_at` is set |
| A6 | Housekeeping task after step 11 | `status: "completed"`, `completed_at` is set |
| A7 | Mountain View A availability | Check-in/check-out dates released (available for new bookings) |
| A8 | Audit log entries | 4 entries: booking confirmed, checked_in, checked_out, housekeeping completed |

### Failure Branches

| Branch | Trigger | Verify |
|---|---|---|
| F1 | Check-in already checked-in booking | Rejected by state machine |
| F2 | Check-out from confirmed (skip check-in) | `confirmed → checked_out` not a valid transition |
| F3 | Mark no-show on checked-in booking | `checked_in → no_show` not a valid transition |

---

## Journey J-07: Loyalty Earn + Redeem Across Engines

### Scenario

Alice (now Silver tier with 1,185 points from J-01) places a restaurant order using loyalty points, verifying cross-engine point arithmetic.

### Preconditions

- J-01 completed: Alice has 1,185 loyalty points, Silver tier
- Loyalty settings: 10 pts/$, $0.01/pt redemption, min 100 pts

### Action Sequence

| # | Actor | Action |
|---|---|---|
| 1 | Alice | Check loyalty balance → `GET /loyalty/members/me` |
| 2 | Alice | Add 2× Espresso ($4 × 2 = $8) to cart |
| 3 | Alice | Checkout: dine-in, table "1", cash |
| 4 | Alice | Redeem 500 loyalty points ($5.00 value) |
| 5 | Alice | Place order → `POST /restaurant/orders` with `loyaltyPointsToRedeem: 500, loyaltyPointsDollarValue: 5.00` |

### Pricing Assertions

```
Subtotal: $8.00
Loyalty discount (500 pts × $0.01): -$5.00
Taxable amount: $8.00 - $5.00 = $3.00
Tax (11% of $3.00): $0.33
Service charge (10% of $8.00): $0.80
Total = $8.00 - $5.00 + $0.33 + $0.80 = $4.13
```

**Note**: Whether loyalty is pre-tax or post-tax depends on `pricing-pipeline.ts`. Per lines 200–239, gift cards and loyalty are **post-tax discounts** (applied after tax calculation). Recalculating:

```
Subtotal: $8.00
Tax (11% of $8.00): $0.88
Service charge (10% of $8.00): $0.80
Pre-discount total: $8.00 + $0.88 + $0.80 = $9.68
Loyalty discount: -$5.00
Total = $9.68 - $5.00 = $4.68
```

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | Alice loyalty before order | 1,185 points, Silver tier |
| A2 | `order.total_amount` | $4.68 |
| A3 | `order.total_discount` | $5.00 |
| A4 | `order.loyalty_points_redeemed` | 500 |
| A5 | Alice loyalty after order | Points deducted: 1,185 - 500 = 685 |
| A6 | Loyalty points earned on this order | $8.00 × 10 pts/$ × 1.5 (Silver multiplier) = 120 pts |
| A7 | Alice final loyalty balance | 685 + 120 = 805 points |
| A8 | Alice tier | Still Silver (805 ≥ 500) |
| A9 | Loyalty transaction records | 2 entries: -500 (redemption), +120 (earn) |
| A10 | Ledger invariant holds | `|totalAmount - max(0, subtotal + tax + serviceCharge - totalDiscount)| ≤ 0.02` |

### Failure Branches

| Branch | Trigger | Verify |
|---|---|---|
| F1 | Redeem more points than balance | Capped at available balance |
| F2 | Redeem below minimum (50 pts) | "Minimum 100 points required" |
| F3 | Redeem 999 pts ($9.99 value, > order total $9.68) | Capped at order total — effective discount = $9.68, points deducted proportionally |

---

## Journey J-08: Gift Card + Coupon Stacking

### Scenario

Bob uses his $50 gift card AND the FIXED5 coupon on a restaurant order ($85 Wagyu Steak), paying the remainder by cash.

### Preconditions

- Gift card GC_BOB_CODE exists, balance = $50
- FIXED5 coupon active

### Action Sequence

1. Bob adds 1× Wagyu Steak ($85) + 1× Espresso ($4) = $89 subtotal
2. Applies FIXED5 coupon (pre-tax $5 discount)
3. Applies GC_BOB_CODE gift card (post-tax discount)
4. Places order with cash for remainder

### Pricing Assertions

```
Subtotal: $89.00
FIXED5 coupon (pre-tax): -$5.00
Taxable: $89.00 - $5.00 = $84.00
Tax (11%): $9.24
Service charge (10% of $89.00): $8.90
Pre-gift-card total: $84.00 + $9.24 + $8.90 = $102.14

Wait — recompute with the invariant formula:
total = subtotal + tax + serviceCharge + deliveryFee - totalDiscount
     = $89.00 + $9.24 + $8.90 + $0 - ($5.00 + $50.00)
     = $107.14 - $55.00
     = $52.14

But gift card is post-tax (lines 200-239):
preDiscountTotal = $89.00 + $9.24 + $8.90 = $107.14
After coupon pre-tax: preDiscountTotal = ($89 - $5) + 11%×($84) + 10%×$89 = $84 + $9.24 + $8.90 = $102.14
After gift card post-tax: $102.14 - $50.00 = $52.14
```

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | `order.subtotal` | `89.00` |
| A2 | `order.total_discount` | `55.00` ($5 coupon + $50 gift card) |
| A3 | `order.total_amount` | `52.14` |
| A4 | Gift card GC_BOB_CODE balance after | `$0.00` (fully redeemed) |
| A5 | Gift card status | `"redeemed"` (balance = 0 triggers status change) |
| A6 | Coupon FIXED5 usage incremented | +1 |
| A7 | Ledger `discount_breakdown` | 2 entries: `[{type: "coupon", amount: 5.00}, {type: "giftcard", amount: 50.00}]` |

---

## Journey J-09: Booking Cancellation and Refund

### Scenario

Carol books Garden C chalet, pays by card, then cancels 48 hours before check-in (partial refund zone per policy: full refund if >72h, 50% if 24-72h, 0% if <24h).

### Action Sequence

1. Carol books Garden C for 2 weekday nights ($150/night × 2 = $300, deposit $90)
2. Card payment via Stripe → webhook processes
3. Carol cancels 48 hours before check-in → `POST /chalets/bookings/<BOOKING_ID>/cancel`
4. System calculates 50% refund (within 24-72h window)
5. System initiates Stripe refund for 50% of paid amount
6. Webhook `charge.refunded` processes

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | Booking status after cancel | `"cancelled"` |
| A2 | Refund amount | 50% of deposit ($45.00) or 50% of total ($150.00) — depends on cancellation policy scope |
| A3 | `payments` table | Refund record with `status: "refunded"` |
| A4 | `payment_ledger` | Refund entry with negative `total_amount` |
| A5 | Chalet availability | Dates released (bookable again) |
| A6 | Audit log | Cancellation + refund entries |

---

## Journey J-10: Registration, 2FA Setup, Full Usage, GDPR Deletion

### Scenario

New user registers, sets up 2FA, places orders across multiple engines, then requests GDPR data deletion.

### Action Sequence

| # | Actor | Action |
|---|---|---|
| 1 | New User | Register → `POST /auth/register` |
| 2 | New User | Login → `POST /auth/login` |
| 3 | New User | Setup 2FA → `POST /auth/2fa/setup` → receives TOTP secret |
| 4 | New User | Verify 2FA → `POST /auth/2fa/verify` → 2FA enabled |
| 5 | New User | Logout → `POST /auth/logout` |
| 6 | New User | Re-login → `POST /auth/login` → receives `requiresTwoFactor: true` |
| 7 | New User | Submit TOTP code → `POST /auth/2fa/verify` → receives tokens |
| 8 | New User | Place restaurant order (creates order record) |
| 9 | New User | Book chalet (creates booking record) |
| 10 | New User | Purchase pool ticket (creates ticket record) |
| 11 | New User | Request GDPR deletion → `DELETE /gdpr/data` or equivalent |
| 12 | System | Soft-delete user, anonymize PII, retain financial records |

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | 2FA setup returns | TOTP secret + backup codes |
| A2 | Login without 2FA code | Returns `requiresTwoFactor: true`, no tokens |
| A3 | After GDPR deletion: user re-login | 401 Unauthorized |
| A4 | After GDPR deletion: orders exist | Records retained but user info anonymized |
| A5 | After GDPR deletion: booking exists | Record retained, PII anonymized |
| A6 | After GDPR deletion: audit log | GDPR deletion logged |
| A7 | After GDPR deletion: loyalty account | Points zeroed or account removed |

---

## Journey J-11: Admin Module Creation — Dynamic Module End-to-End

### Scenario

Admin creates a new "Gym" module (session_access type), configures sessions, and a customer purchases a ticket — verifying the full dynamic module pipeline.

### Action Sequence

| # | Actor | Action |
|---|---|---|
| 1 | Admin | Create module → `POST /admin/modules` with `{ name: "Gym", slug: "gym", template_type: "session_access", is_active: true }` |
| 2 | Admin | Create session → `POST /pool/admin/sessions` with `{ name: "Open Gym", start_time: "06:00", end_time: "22:00", max_capacity: 30, adult_price: 10.00, child_price: 5.00, module_id: "<GYM_MODULE_ID>" }` |
| 3 | Customer | Navigate to `/gym` → sees session list |
| 4 | Customer | Purchase ticket for "Open Gym" |
| 5 | Staff | Validate ticket via QR scan |
| 6 | Staff | Record entry → capacity updates |

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | Module created with correct slug | `slug = "gym"`, `template_type = "session_access"` |
| A2 | Admin sidebar shows "Gym" with Sessions/Tickets/Capacity sub-items | Visible in sidebar |
| A3 | `/gym` route renders session list | Open Gym session visible |
| A4 | Ticket created | `status = "valid"`, correct module_id |
| A5 | Entry recorded | Ticket → `active`, capacity incremented |

---

## Journey J-12: Full Guest Stay — Cross-Engine Grand Journey

### Scenario

Alice arrives for a 2-night chalet stay. During her stay, she orders room service via the restaurant, uses the pool, earns loyalty points across all interactions, and uses a gift card for one payment. This journey touches Engine A (restaurant), Engine B (chalets), Engine C (pool), the loyalty engine, the payment engine, and the housekeeping system — all in one continuous experience.

### Preconditions

- Alice has Silver loyalty tier, 805 points (from J-01 + J-07)
- Alice has gift card GC_ALICE_CODE with $100 balance
- Mountain View A available for target dates
- All staff accounts active

### Action Sequence

| # | Actor | Action | Engine |
|---|---|---|---|
| 1 | Alice | Book Mountain View A, 2 nights (Mon-Wed), BBQ addon | B |
| 2 | Admin | Confirm booking | B |
| 3 | Chalet Staff | Check Alice in | B |
| 4 | Alice | Order dinner: 1× Salmon ($28) + 1× Cake ($9.50), dine-in, table 1, cash | A |
| 5 | Kitchen Staff | Process order to completion | A |
| 6 | Alice | Purchase pool ticket (Morning, 1 adult) for tomorrow | C |
| 7 | Pool Staff | Record entry next morning | C |
| 8 | Pool Staff | Record exit | C |
| 9 | Alice | Order lunch from Snack Bar: 1× Club Sandwich ($10) + 1× Fresh Juice ($6), pay with gift card | A |
| 10 | Kitchen Staff (Snack) | Process snack order to completion | A |
| 11 | Chalet Staff | Check Alice out | B |
| 12 | HK Staff | Complete housekeeping task | — |

### Cross-Engine Assertions (after all steps)

| # | Assertion | Expected |
|---|---|---|
| A1 | **Booking status** | `"checked_out"` |
| A2 | **Restaurant order status** | `"completed"` |
| A3 | **Pool ticket status** | `"used"` |
| A4 | **Snack bar order status** | `"completed"` |
| A5 | **Housekeeping task** | `"completed"` |
| A6 | **Alice loyalty earnings** | Dinner: $37.50 × 10 × 1.5 = 562 pts. Pool: $15 × 10 × 1.5 = 225 pts. Snack (after gift card): depends on total. Total new points ≈ 800+ |
| A7 | **Alice loyalty total** | 805 + new points earned across all engines |
| A8 | **Gift card balance** | $100 - snack order total |
| A9 | **Pool occupancy** | Net zero (entry + exit) |
| A10 | **Chalet availability** | Dates released |
| A11 | **Financial ledger** | 4 separate entries (booking, dinner, pool, snack) all with correct `engine_type` |
| A12 | **Audit log** | Complete trail: booking create → confirm → check-in → dinner order → pool ticket → entry → exit → snack order → check-out → housekeeping |

---

## Journey J-13: Admin Financial Reports Verification

### Scenario

Admin generates reports after Journeys J-01 through J-12 to verify that all financial data is consistently reported.

### Action Sequence

1. Admin → `GET /admin/reports/overview?range=today`
2. Admin → `GET /admin/reports/export?type=restaurant&range=today`
3. Admin → `GET /admin/reports/export?type=chalets&range=today`
4. Admin → `GET /admin/reports/export?type=pool&range=today`

### Assertion Checklist

| # | Assertion | Expected |
|---|---|---|
| A1 | Total revenue matches | Sum of all `total_amount` from orders + bookings + tickets = reported revenue |
| A2 | Order count matches | Count of completed orders = reported order count |
| A3 | Booking count matches | Count of bookings = reported booking count |
| A4 | CSV export contains all records | Each export has correct row count and column values |
| A5 | Revenue by module | Restaurant total, Chalets total, Pool total, Snack total all match individual sums |

---

## Journey J-14: Staff Role Authorization Boundaries

### Scenario

Verify that each staff role can access only their authorized resources and is blocked from others.

### Test Matrix

| Staff Role | Can Access | Cannot Access |
|---|---|---|
| `restaurant_staff` | `GET /restaurant/staff/orders`, `PATCH /restaurant/staff/orders/:id/status` | `GET /pool/staff/tickets`, `GET /chalets/staff/bookings`, `GET /admin/dashboard` |
| `pool_staff` | `GET /pool/staff/tickets`, `POST /pool/tickets/:id/entry` | `GET /restaurant/staff/orders`, `GET /admin/dashboard` |
| `chalet_staff` | `GET /chalets/staff/bookings`, `PATCH /chalets/staff/bookings/:id/status` | `GET /pool/staff/tickets`, `GET /admin/dashboard` |
| `housekeeping_staff` | `GET /housekeeping/tasks`, `POST /housekeeping/tasks/:id/start` | `GET /restaurant/staff/orders`, `GET /admin/dashboard` |
| `manager` | `GET /admin/dashboard`, `GET /admin/reports` | `DELETE /admin/modules/:id`, `POST /admin/users` (may vary) |
| `customer` | `POST /restaurant/orders`, `POST /chalets/bookings` | `GET /admin/dashboard`, `PATCH /restaurant/staff/orders/:id/status` |

### Assertion per cell

For each "Can Access": Expect 200 OK.
For each "Cannot Access": Expect 401 or 403.

---

## Journey J-15: Ghost Role Verification (Ground Truth — Known Broken)

### Scenario

Test that ghost roles (defined in route `authorize()` calls but absent from `RolePermissions`) exhibit their documented behavior.

### Ground Truth Tests

| # | Test | Expected Behavior (broken but documented) |
|---|---|---|
| GT1 | Create user with role `chef` → access kitchen routes (which use `authorize('chef')`) | Request passes `authorize()` check (role is in allowed list) |
| GT2 | Same `chef` user → route that also calls `requirePermission('restaurant:read')` | **FAILS**: `chef` has no entry in `RolePermissions` → 403 Forbidden |
| GT3 | Create user with role `front_desk` → access mobile check-in routes | Passes `authorize()` check |
| GT4 | Same `front_desk` user → route with `requirePermission('admin:read')` | **FAILS**: `front_desk` has no permissions → 403 |
| GT5 | Create user with role `staff` (generic) → access restaurant staff routes | Passes `authorize()` (listed in restaurant staff roles) |
| GT6 | Same `staff` user → `requirePermission()` check | **FAILS** if using in-memory permission check |

**Purpose**: Establish the exact current behavior before any fixes. After fixing ghost roles, re-run these tests — GT2/GT4/GT6 should now pass.

---

# Part 3: Concurrency & Race Condition Journeys

These journeys deliberately trigger every race condition and concurrency risk identified in the Phase 1 risk register.

---

## Race R-01: Gift Card Over-Redemption (H1)

### Risk

The direct gift card redemption endpoint (`redeemGiftCard()` in `giftcard.controller.ts`) does `SELECT balance → UPDATE balance` as two separate queries with no locking. Two concurrent requests can both read the same balance and both succeed.

### Setup

- Create gift card with balance = $100 (`GC_RACE_CODE`)
- Prepare 2 concurrent HTTP clients (Client A, Client B)

### Trigger Sequence

```
T=0ms: Client A → POST /giftcards/<GC_RACE_CODE>/redeem  { amount: 80 }
T=0ms: Client B → POST /giftcards/<GC_RACE_CODE>/redeem  { amount: 80 }
```

Both requests fire simultaneously.

### Expected Behavior (if correctly protected)

- One request succeeds (balance: $100 → $20)
- Other request fails ("Insufficient balance" — $20 < $80)
- Final balance: $20

### Actual Behavior (ground truth — known broken)

- Both requests read balance = $100
- Both requests pass the `balance >= amount` check
- Both requests update balance = $100 - $80 = $20
- **Final balance: $20** (but $160 was redeemed from a $100 card — $60 over-redeemed)
- **OR**: Both succeed but second overwrite creates `balance = -60` (depends on UPDATE timing)

### Verification Query

```sql
SELECT balance FROM giftcards WHERE code = '<GC_RACE_CODE>';
-- If balance < 0 or two successful redemption records exist: RACE CONDITION CONFIRMED
```

### Damage Assessment

- Over-redemption of `$60` — direct financial loss
- This contrasts with the engine pipeline which uses `redeem_giftcard_atomic` RPC and is safe

---

## Race R-02: Pool Capacity Breach (H2)

### Risk

Pool capacity check (COUNT tickets) and ticket creation are separate queries with no lock. Concurrent purchases can exceed `max_capacity`.

### Setup

- Evening session: `max_capacity = 30`
- Pre-fill 28 tickets (28 guests occupying capacity)
- Remaining capacity: 2 guests

### Trigger Sequence

```
T=0ms: Client A → POST /pool/tickets { sessionId: EVENING, numberOfGuests: 2 }
T=0ms: Client B → POST /pool/tickets { sessionId: EVENING, numberOfGuests: 2 }
```

### Expected Behavior (if protected)

- One request succeeds (capacity: 28 → 30)
- Other request fails ("Session is full")
- Final ticket guest count: 30

### Actual Behavior (ground truth — known broken)

- Both requests count existing guests = 28
- Both requests check: 28 + 2 ≤ 30 → true
- Both requests create tickets
- **Final ticket guest count: 32** (exceeds max_capacity by 2)

### Verification

```sql
SELECT SUM(number_of_guests) FROM pool_tickets 
WHERE session_id = '<EVENING_SESSION_ID>' 
  AND ticket_date = '2026-03-03' 
  AND status IN ('valid', 'used');
-- If > 30: CAPACITY BREACH CONFIRMED
```

### Damage Assessment

- 2 excess guests in pool — safety and liability issue
- Capacity bar on staff UI shows > 100%

---

## Race R-03: Payment Webhook Partial Failure (H3)

### Risk

If `updateReferencePaymentStatus()` fails after the ledger and payments records are created, retries hit the idempotency check (ledger webhook_id already exists) and return 200 — the status is **never updated**.

### Setup

- Create a restaurant order via card payment
- Stripe successfully charges the card
- **Inject failure**: Make `updateReferencePaymentStatus()` throw an error on first call

### Trigger Sequence

```
T=0: Stripe sends payment_intent.succeeded webhook
T=0: Handler creates payment_ledger entry (SUCCESS)
T=0: Handler creates payments record (SUCCESS)
T=0: Handler calls updateReferencePaymentStatus() (FAILS — injected error)
T=0: Handler returns 500 to Stripe

T=60s: Stripe retry #1 → same webhook_id
T=60s: Handler checks payment_ledger → webhook_id exists → returns 200 (IDEMPOTENT)
T=60s: updateReferencePaymentStatus() is NEVER called on retries
```

### Expected Behavior (ground truth — known broken)

| Record | State |
|---|---|
| `payment_ledger` | Entry exists, `amount = correct` |
| `payments` | Record exists, `status = "completed"` |
| `restaurant_orders` | `payment_status = "pending"` ← **STALE** |

### Verification

```sql
-- Check for orders with completed payment but pending payment_status
SELECT o.id, o.payment_status, p.status as payment_record_status
FROM restaurant_orders o
JOIN payments p ON p.reference_id = o.id::text
WHERE o.payment_status = 'pending' AND p.status = 'completed';
-- Any rows = ORPHAN STATE CONFIRMED
```

### Damage Assessment

- Customer charged but order shows unpaid
- No automatic reconciliation exists
- Staff may demand cash payment for an already-paid order

---

## Race R-04: Chalet Double-Booking (Redis Lock Bypass)

### Risk

The Redis distributed lock has a 30-second TTL and 10-second spin-wait. If Redis is unavailable, the system falls back to an in-memory lock (single-process only inadequate in multi-instance deployment).

### Setup

- Chalet B (Lakeside) available for target dates
- Two clients attempt simultaneous booking

### Test Case A: Redis healthy

```
T=0ms: Client A → POST /chalets/bookings (Lakeside, Mar 15-17)
T=0ms: Client B → POST /chalets/bookings (Lakeside, Mar 15-17)
```

**Expected**: Client A acquires lock, creates booking. Client B spins for up to 10s → lock released → Client B tries → overlap check fails → 409.

### Test Case B: Redis unavailable (fallback)

```
T=0ms: (Redis connection down)
T=0ms: Client A → POST /chalets/bookings (Lakeside, Mar 15-17) → acquires in-memory lock
T=0ms: Client B → POST /chalets/bookings (Lakeside, Mar 15-17) → acquires SEPARATE in-memory lock (if multi-process)
```

**Expected in single-process**: In-memory lock works identically. 
**Expected in multi-process/multi-instance**: Both processes have independent locks → **double booking possible**.

### Verification

```sql
SELECT COUNT(*) FROM chalet_bookings 
WHERE chalet_id = '<LAKESIDE_ID>' 
  AND check_in_date = '2026-03-15' 
  AND status NOT IN ('cancelled', 'no_show');
-- If > 1: DOUBLE BOOKING
```

---

## Race R-05: Coupon Usage Consumed Without Discount (M4)

### Risk

`apply_coupon_atomic` RPC atomically increments `times_used`, but the subsequent order table update with the coupon discount is a separate query. If the order update fails, coupon usage is consumed but discount not applied.

### Setup

- Coupon "SINGLEUSE" with `max_uses: 1`, `times_used: 0`
- Create order with this coupon, but inject failure on the order's coupon_discount field update

### Expected behavior (ground truth)

- Coupon `times_used` incremented from 0 → 1 (via atomic RPC)
- Order update fails → order has no discount applied
- Customer pays full price but coupon is "used up"
- Subsequent attempts to use "SINGLEUSE" → "Usage limit reached"
- **Coupon wasted without benefit**

### Verification

```sql
SELECT times_used FROM coupons WHERE code = 'SINGLEUSE';
-- If times_used = 1 but no order has coupon_discount with this coupon: RACE CONFIRMED
```

---

## Race R-06: Cash Payment Double-Record (M7)

### Risk

No idempotency on `POST /payments/record-cash`. Accidental double-tap creates duplicate payment.

### Trigger

```
T=0ms: Staff → POST /payments/record-cash { referenceType: "order", referenceId: ORDER_ID, amount: 50 }
T=50ms: Staff → POST /payments/record-cash { referenceType: "order", referenceId: ORDER_ID, amount: 50 }
```

### Expected behavior (ground truth — known broken)

- Both requests succeed
- Two `payments` records created for the same order
- Order shows as "paid" (first request updated status)
- Ledger has two charge entries for the same order
- **Financial ledger over-states revenue by $50**

### Verification

```sql
SELECT COUNT(*) FROM payments WHERE reference_id = '<ORDER_ID>' AND reference_type = 'order';
-- If > 1: DUPLICATE PAYMENT CONFIRMED
```

---

## Race R-07: Booking Add-on Orphan (M3)

### Risk

Booking row created first, then add-ons inserted in a loop with no transaction. Server crash between steps = orphan booking without add-ons.

### Setup

- Book a chalet with 3 add-ons
- Inject network/DB failure after booking row is created but before add-on loop

### Expected behavior (ground truth)

- Booking record exists in DB
- 0 add-on records exist for this booking
- Customer sees booking with no add-ons listed
- Pricing may be incorrect (add-on cost included in total but no add-on records)

### Verification

```sql
SELECT b.id, b.total_amount, COUNT(a.id) as addon_count
FROM chalet_bookings b
LEFT JOIN chalet_booking_add_ons a ON a.booking_id = b.id
WHERE b.id = '<BOOKING_ID>'
GROUP BY b.id, b.total_amount;
-- If addon_count = 0 but total_amount includes add-on pricing: ORPHAN CONFIRMED
```

---

# Part 4: Cross-Engine Invariant Journeys

These journeys verify that when multiple engines fire in the same customer experience, all invariants hold simultaneously.

---

## Invariant I-01: Financial Ledger Balances Across All Engines

### Scenario

After a complete day of operations (Journeys J-01 through J-12), verify that the financial ledger is internally consistent across all engine types.

### Invariant Formula

For every entry in `engine_financial_ledger`:
```
|total_amount - max(0, subtotal + tax_amount + service_charge + delivery_fee - total_discount)| ≤ 0.02
AND total_amount ≥ 0
```

### Verification Query

```sql
SELECT id, entity_id, engine_type, total_amount, subtotal, tax_amount, 
       service_charge, delivery_fee, total_discount,
       ABS(total_amount - GREATEST(0, subtotal + tax_amount + service_charge + delivery_fee - total_discount)) as drift
FROM engine_financial_ledger
WHERE transaction_type NOT IN ('refund', 'void')
  AND ABS(total_amount - GREATEST(0, subtotal + tax_amount + service_charge + delivery_fee - total_discount)) > 0.02;
-- Must return 0 rows
```

### Cross-Engine Totals

```sql
SELECT engine_type,
       SUM(CASE WHEN transaction_type = 'charge' THEN total_amount ELSE 0 END) as total_charges,
       SUM(CASE WHEN transaction_type = 'refund' THEN total_amount ELSE 0 END) as total_refunds,
       SUM(CASE WHEN transaction_type = 'charge' THEN total_amount ELSE 0 END) - 
       ABS(SUM(CASE WHEN transaction_type = 'refund' THEN total_amount ELSE 0 END)) as net_revenue
FROM engine_financial_ledger
GROUP BY engine_type;
-- Net revenue per engine must match the admin dashboard's revenue breakdown
```

---

## Invariant I-02: Loyalty Points Consistency Across Engines

### Scenario

After all journeys, verify that every loyalty point earned, redeemed, and adjusted across all engines sums to the exact current balance.

### Invariant

```
current_points = signup_bonus + Σ(earned from all orders/bookings/tickets) - Σ(redeemed) + Σ(manual adjustments)
```

### Verification Query

```sql
SELECT la.user_id, la.total_points as current_balance,
       la.signup_bonus,
       COALESCE(earn.total_earned, 0) as total_earned,
       COALESCE(redeem.total_redeemed, 0) as total_redeemed,
       COALESCE(adj.total_adjusted, 0) as total_adjusted,
       (la.signup_bonus + COALESCE(earn.total_earned, 0) - COALESCE(redeem.total_redeemed, 0) + COALESCE(adj.total_adjusted, 0)) as expected_balance
FROM loyalty_accounts la
LEFT JOIN (SELECT user_id, SUM(points) as total_earned FROM loyalty_transactions WHERE type = 'earn' GROUP BY user_id) earn ON earn.user_id = la.user_id
LEFT JOIN (SELECT user_id, SUM(points) as total_redeemed FROM loyalty_transactions WHERE type = 'redeem' GROUP BY user_id) redeem ON redeem.user_id = la.user_id
LEFT JOIN (SELECT user_id, SUM(points) as total_adjusted FROM loyalty_transactions WHERE type = 'adjust' GROUP BY user_id) adj ON adj.user_id = la.user_id
WHERE la.total_points != (la.signup_bonus + COALESCE(earn.total_earned, 0) - COALESCE(redeem.total_redeemed, 0) + COALESCE(adj.total_adjusted, 0));
-- Must return 0 rows
```

---

## Invariant I-03: Pool Capacity Accuracy

### Scenario

After all pool entry/exit operations, verify pool occupancy counter matches actual current state.

### Invariant

```
current_occupancy = COUNT(pool_tickets WHERE status = 'active' AND ticket_date = today)
```

### Verification Query

```sql
SELECT 
  (SELECT current_setting FROM pool_settings WHERE key = 'current_occupancy')::int as reported_occupancy,
  (SELECT COUNT(*) FROM pool_tickets WHERE status = 'active' AND ticket_date = CURRENT_DATE) as actual_occupancy;
-- reported_occupancy must equal actual_occupancy
```

If they diverge, occupancy counter has drifted — may be due to:
- Missing exit records
- Pool ticket expiry not running
- Race condition from R-02

---

## Invariant I-04: Chalet Availability Consistency

### Scenario

Verify that no two non-cancelled bookings overlap on the same chalet.

### Verification Query

```sql
SELECT a.id as booking_a, b.id as booking_b, a.chalet_id,
       a.check_in_date as a_checkin, a.check_out_date as a_checkout,
       b.check_in_date as b_checkin, b.check_out_date as b_checkout
FROM chalet_bookings a
JOIN chalet_bookings b ON a.chalet_id = b.chalet_id AND a.id < b.id
WHERE a.status NOT IN ('cancelled', 'no_show')
  AND b.status NOT IN ('cancelled', 'no_show')
  AND a.check_in_date < b.check_out_date
  AND b.check_in_date < a.check_out_date;
-- Must return 0 rows (no overlaps)
```

---

## Invariant I-05: Coupon Usage Integrity

### Scenario

Verify that coupon `times_used` matches actual order records that claimed the coupon.

### Verification Query

```sql
SELECT c.code, c.times_used as reported_uses,
       COUNT(DISTINCT o.id) as actual_order_uses
FROM coupons c
LEFT JOIN restaurant_orders o ON o.coupon_code = c.code AND o.status != 'cancelled'
LEFT JOIN snack_orders so ON so.coupon_code = c.code AND so.status != 'cancelled'
GROUP BY c.code, c.times_used
HAVING c.times_used != COUNT(DISTINCT o.id) + COUNT(DISTINCT so.id);
-- If rows returned: coupon usage count has drifted (R-05 confirmed)
```

---

## Invariant I-06: Audit Log Completeness

### Scenario

Verify that every state transition across all engines produced an audit log entry.

### Verification (per engine)

**Engine A (Orders)**:
```sql
SELECT o.id, COUNT(h.id) as history_count
FROM restaurant_orders o
LEFT JOIN restaurant_order_status_history h ON h.order_id = o.id
GROUP BY o.id
HAVING COUNT(h.id) = 0;
-- Must return 0 rows (every order has at least 1 status history entry)
```

**Engine B (Bookings)**:
```sql
SELECT b.id, b.status
FROM chalet_bookings b
LEFT JOIN audit_logs a ON a.entity_id = b.id::text AND a.entity_type = 'chalet_booking'
GROUP BY b.id, b.status
HAVING COUNT(a.id) = 0;
-- Must return 0 rows
```

---

## Invariant I-07: Payment Record — Order Status Consistency

### Scenario

Verify that every order/booking with a `payments` record has a matching `payment_status`.

### Verification Query

```sql
-- Orders with completed payments but pending payment_status (H3 orphan state)
SELECT o.id, o.payment_status, p.status as payment_record
FROM restaurant_orders o
JOIN payments p ON p.reference_id = o.id::text AND p.reference_type = 'order'
WHERE p.status = 'completed' AND o.payment_status = 'pending';
-- If rows returned: WEBHOOK PARTIAL FAILURE (H3) confirmed
```

---

# Part 5: Stress Scenarios

---

## Stress S-01: Concurrent Pool Ticket Purchases

### Objective

Determine the maximum number of concurrent ticket purchases before capacity breach occurs.

### Setup

- Evening session with `max_capacity = 30`
- 0 existing tickets

### Load Parameters

| Parameter | Value |
|---|---|
| Concurrent clients | 35 |
| Guests per ticket | 1 |
| Execution | All 35 fire simultaneously |

### Expected Outcome (if system is correct)

- Exactly 30 tickets created
- 5 requests rejected with "Session is full"

### Monitoring

```sql
-- Run after all requests complete
SELECT 
  COUNT(*) as tickets_created,
  SUM(number_of_guests) as total_guests,
  (SELECT max_capacity FROM pool_sessions WHERE id = '<EVENING_SESSION_ID>') as max_capacity
FROM pool_tickets 
WHERE session_id = '<EVENING_SESSION_ID>' 
  AND ticket_date = CURRENT_DATE
  AND status IN ('valid', 'active', 'used');
```

### Failure Threshold

- `total_guests > max_capacity` → **FAIL** (capacity breach under load)
- Document by how many the breach occurred

---

## Stress S-02: Concurrent Gift Card Redemptions

### Setup

- Gift card with $1,000 balance
- 20 concurrent clients, each redeeming $100

### Expected (if correct)

- 10 succeed (total redeemed: $1,000)
- 10 fail (insufficient balance)
- Final balance: $0

### Monitoring

```sql
SELECT balance, 
       (SELECT SUM(amount) FROM giftcard_transactions WHERE giftcard_id = '<ID>') as total_redeemed
FROM giftcards WHERE id = '<ID>';
-- If balance < 0 or total_redeemed > 1000: OVER-REDEMPTION
```

---

## Stress S-03: Concurrent Chalet Booking — Same Dates

### Setup

- Lakeside B chalet, target dates: Mar 20-22, 2026
- 10 concurrent booking requests

### Expected

- Exactly 1 booking created
- 9 requests get 409 (conflict) or lock timeout

### Monitoring

```sql
SELECT COUNT(*) FROM chalet_bookings 
WHERE chalet_id = '<LAKESIDE_ID>' 
  AND check_in_date = '2026-03-20' 
  AND status NOT IN ('cancelled', 'no_show');
-- Must be exactly 1
```

---

## Stress S-04: Rapid Order Placement — Kitchen Display Sync

### Setup

- 20 orders placed within 5 seconds
- Kitchen staff connected via Socket.io

### Monitoring

- Count `order:new` socket events received by kitchen client
- Must equal 20
- All 20 orders visible in kitchen display within 10 seconds

### Failure Threshold

- Missed socket events (received < 20) → Socket.io reliability issue
- Orders visible in kitchen > 10 seconds → latency issue

---

## Stress S-05: Webhook Flood — Sequential Payment Processing

### Setup

- Create 50 orders with card payment
- Fire 50 Stripe webhook events rapidly (1ms apart)

### Monitoring

- All 50 `payment_ledger` entries created (no duplicates via idempotency)
- All 50 `payments` records created
- All 50 orders have `payment_status = 'paid'`

### Failure Threshold

- Any duplicate `payment_ledger` entry → idempotency failure
- Any order with `payment_status = 'pending'` after completed payment → H3 orphan state
- Document count of orphan states under load

---

# Coverage Matrix

This matrix maps every item from the Phase 1 System Map to at least one journey in this verification program.

## System Map Section → Journey Mapping

| Phase 1 Section | Item | Covered By |
|---|---|---|
| **§1 Architecture** | Express middleware chain | All journeys (every API call passes through chain) |
| | Rate limiting | S-01, S-02, S-03 (stress tests exercise rate limits) |
| | Engine A (menu_service) | J-01, J-02, J-07, J-08, J-12 |
| | Engine B (multi_day_booking) | J-03, J-06, J-09, J-12 |
| | Engine C (session_access) | J-04, J-05, J-11, J-12 |
| | Engine D (subscription) | Not covered — Engine D is planned, not implemented |
| **§2 Routes** | Auth routes (20+) | J-10 (register, login, 2FA, logout), J-14 (role checks) |
| | Payment routes (18+) | J-02, J-09 (card payment, refund), R-03, R-06, S-05 |
| | Chalet routes (20+) | J-03, J-06, J-09, R-04, R-07, S-03 |
| | Pool routes (30+) | J-04, J-05, J-11, R-02, S-01 |
| | Restaurant routes (40+) | J-01, J-02, J-07, J-08, J-12, S-04 |
| | Loyalty routes (18) | J-07, J-12, I-02 |
| | Coupon routes (10) | J-02, J-08, R-05, I-05 |
| | Gift card routes (16) | J-08, R-01, S-02 |
| | Housekeeping routes (17) | J-06 (auto-created task), Setup Step 28 |
| | Admin routes (60+) | Setup Steps 1-30, J-11, J-13, J-14, J-15 |
| | Modules route | J-11, Setup Steps 8, 13, 18, 21 |
| | Staff routes (25+) | J-14 (authorization matrix) |
| | Reporting routes (30+) | J-13 |
| | GDPR routes (18) | J-10 |
| | Kiosk routes (25) | Not directly covered — kiosk is a frontend mode serving same APIs |
| | Kitchen Display routes (8+) | J-01 (order progression) |
| | Table routes (10+) | Setup Step 12 |
| | Reservation routes (8+) | Not directly covered with a journey — reservation is table-management adjacent |
| | Tab routes (10+) | Not directly covered — tab system is restaurant floor management |
| | POS routes (12) | Not directly covered — POS is a staff frontend serving same APIs |
| | Channel routes (17) | Not covered — placeholder system |
| | Marketing routes (30+) | Not covered — marketing automation is dead code (M1) |
| **§3 Roles** | 16 formal roles | J-14 (role matrix), J-15 (ghost roles) |
| | 7 ghost roles | J-15 (ground truth tests) |
| | 53 permissions | J-14 (cross-role access), J-15 |
| | Dual requirePermission | J-15 (GT2, GT4, GT6 test both implementations) |
| **§4 State machines** | Engine A states (7) | J-01 (all transitions pending→completed), Failure branch F3 |
| | Engine B states (6) | J-06 (pending→confirmed→checked_in→checked_out), J-09 (→cancelled) |
| | Engine C states (4) | J-05 (valid→active→used), J-04 (valid state) |
| | Housekeeping states (3) | J-06 (pending→in_progress→completed) |
| | Table states | Not directly covered |
| | Reservation states | Not directly covered |
| | Gift card states | J-08 (active→redeemed on zero balance) |
| **§5 Side effects** | Order creation (6 effects) | J-01 (inventory, socket, loyalty), J-02 (same) |
| | Order status change (6 effects) | J-01 (status history, socket, payment_status on complete) |
| | Booking side effects (8) | J-03 (email, audit, socket), J-06 (housekeeping on checkout) |
| | Pool ticket side effects (6) | J-04 (socket), J-05 (capacity increment/decrement) |
| | Payment side effects (3) | J-02 (ledger, loyalty via webhook) |
| | Table/reservation effects (4) | Not directly covered |
| | Tab effects (5) | Not directly covered |
| | Push notification (2) | Not directly covered (FCM needs device) |
| | Audit/security (3) | I-06 (audit completeness check) |
| **§6 Failure paths** | Payment webhook failure | R-03 (ground truth), S-05 |
| | PaymentIntent creation failure | J-02 branch F4 |
| | Manual refund failure | J-09 |
| | Cash payment failure | R-06 |
| | Module-level errors | Every journey's failure branches |
| **§7 Concurrency** | Gift card over-redemption (H1) | R-01 |
| | Pool capacity breach (H2) | R-02, S-01 |
| | Payment webhook partial failure (H3) | R-03, S-05 |
| | No DB transactions (H4) | R-07 (booking add-on orphan) |
| | Ghost role gap (H5) | J-15 |
| | Dual requirePermission (H6) | J-15 |
| | Booking add-on orphan (M3) | R-07 |
| | Coupon usage consumed (M4) | R-05 |
| | Cash double-record (M7) | R-06 |
| | Redis lock (PROTECTED) | R-04, S-03 |
| | Loyalty atomic ops (PROTECTED) | J-07 (earn + redeem in one journey) |
| | Coupon atomic RPC (PROTECTED) | J-02 (apply coupon) |
| **§8 Idempotency** | Payment webhook idempotency | R-03, S-05 |
| | Engine idempotency guard | Not directly tested (engines not confirmed active in controller paths) |
| | Cash payment no idempotency | R-06 |
| **§9 Automated processes** | Daily backup | Not directly tested (3 AM cron) — verify by checking Supabase Storage bucket |
| | Pool ticket expiry | Verify via: create ticket for yesterday → run expiry → check `status = 'expired'` |
| | Session cleanup | Verify via: check sessions table after 4 AM for old session removal |
| | Booking reminders | Verify via: create booking for tomorrow → run reminder job → check `reminder_sent = true` |
| | Report delivery | J-13 (manual export), scheduled delivery not tested (needs scheduler) |
| | Dashboard metric push | Verify via: Socket.io admin client receives `dashboard:metrics` event within 30s |
| **§10 Dead code** | Marketing automation | Verify: `marketing.service.ts` `startBackgroundProcessing()` is never called |
| | Webhook retry | Verify: `webhook-retry.service.ts` `startBackgroundProcessing()` is never called |
| | Idempotency cleanup | Verify: no cron job calls `cleanupExpired()` |
| | Generic webhook idempotency | Verify: `processWithIdempotency()` has zero imports |
| | Circuit breaker | Verify: `circuit-breaker.ts` has zero production imports |
| **§11 Risk register** | H1 Gift card | R-01 |
| | H2 Pool capacity | R-02, S-01 |
| | H3 Webhook partial failure | R-03, S-05 |
| | H4 No DB transactions | R-07 |
| | H5 Ghost roles | J-15 |
| | H6 Dual requirePermission | J-15 |
| | M1 Marketing never fires | Dead code verification |
| | M2 Webhook retry never fires | Dead code verification |
| | M3 Booking add-ons | R-07 |
| | M4 Coupon usage | R-05 |
| | M5 Unhandled rejections | Process-level test (inject rejection, verify no shutdown) |
| | M6 Server before DB ready | Startup sequence test (send request during init) |
| | M7 Cash double-record | R-06 |
| | L1 Idempotency cleanup | Dead code verification |
| | L2 Soft-delete purge | Not covered — no purge job exists |
| | L3 Circuit breaker unused | Dead code verification |
| | L4 Generic webhook unused | Dead code verification |
| | L5 Inventory non-fatal | J-01 A10 (verify inventory deduction or over-sell) |
| | L6 Kitchen non-fatal | J-01 A13 (verify socket event count) |

## Gaps — Items Not Covered By Any Journey

| Item | Reason |
|---|---|
| **Engine D (subscription)** | Not implemented. Planned feature. No code to verify. |
| **Tab system** | Restaurant tab open/close/transfer/merge is a floor-management workflow. Could be added as J-16. |
| **Table status lifecycle** | Table AVAILABLE→RESERVED→OCCUPIED→CLEANING cycle is operational. Could be added as J-17. |
| **Reservation lifecycle** | PENDING→CONFIRMED→SEATED→COMPLETED flow. Could be added as J-18. |
| **POS interface** | POS uses the same APIs — no separate verification needed beyond API-level tests. |
| **Kiosk mode** | Kiosk is a frontend presentation mode using same backend APIs. |
| **Channel manager (OTA)** | Placeholder system — no functional implementation to verify. |
| **Multi-property management** | Placeholder system — no functional implementation to verify. |
| **Marketing automation** | Dead code (M1). Verified as dead. No functional behavior to test. |
| **Push notifications (FCM)** | Requires physical device/emulator. Can be verified via unit test of `sendPushNotification()`. |
| **RTL/i18n rendering** | Frontend rendering concern. Verify via Playwright screenshot comparison in `ar` locale. |
| **Soft-delete filter integrity** | Could add I-08: verify no query returns soft-deleted records. |
| **WebAuthn biometric auth** | Requires hardware security key. Can be verified via protocol-level test. |

---

## Execution Order

Journeys MUST be executed in this order due to state dependencies:

```
1. Setup Steps 1-30 (system configuration)
2. J-01 (Restaurant order — cash, establishes Alice's loyalty points)
3. J-02 (Restaurant order — card + coupon)
4. J-03 (Chalet booking — establishes booking for J-06)
5. J-04 (Pool ticket — establishes ticket for J-05)
6. J-05 (Pool entry/exit — uses J-04 ticket)
7. J-06 (Chalet check-in/out — uses J-03 booking)
8. J-07 (Loyalty earn + redeem — uses J-01 loyalty balance)
9. J-08 (Gift card + coupon stacking)
10. J-09 (Booking cancellation + refund)
11. J-10 (Registration through GDPR deletion — independent)
12. J-11 (Dynamic module creation — independent)
13. J-12 (Full guest stay — cross-engine grand journey)
14. J-13 (Financial reports — verifies all prior journey data)
15. J-14 (Role authorization — independent)
16. J-15 (Ghost role ground truth — independent)

Race condition journeys (R-01 through R-07) — independent, can run in any order
Invariant journeys (I-01 through I-07) — run AFTER all J-journeys complete
Stress scenarios (S-01 through S-05) — run LAST, in isolated environment
```

---

*End of Phase 2 Verification Program. This document, combined with the Phase 1 System Map and companion documents, constitutes the complete verification foundation for the V2 Resort Management System.*
