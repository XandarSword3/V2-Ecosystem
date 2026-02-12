# Admin Guide: Gift Cards

> Module: ADM-GFT | Features: 10 | Role: super_admin | Updated: 2026-02-08

## Overview

The Gift Cards module manages the resort's digital gift card program. Administrators create card templates, set denominations and custom amount limits, track redemption history, void or deactivate cards, generate bulk batches for promotions, and monitor revenue. Gift cards are stored as unique codes with balances in the system and processed through Stripe for purchases and redemptions.

Data is stored in Supabase PostgreSQL tables: `gift_card_templates`, `gift_cards`, `gift_card_transactions`, and `gift_card_settings`. The Express.js backend (localhost:3005) provides APIs under `/api/admin/giftcards/*`. Each gift card has a unique 16-character alphanumeric code (format: `XXXX-XXXX-XXXX-XXXX`) and a balance that decrements on use.

## Prerequisites

| Requirement | Details |
|---|---|
| Admin Access | Login at `/admin/login` with `admin@v2resort.com` / `admin123` |
| Role Required | `super_admin` or `admin` |
| Browser | Chrome 90+, Firefox 88+, Edge 90+ |
| Backend Running | Express.js API on `localhost:3005` |
| Frontend Running | Next.js 14 dev server on `localhost:3000` |
| Database | Supabase PostgreSQL with gift card tables |
| Stripe | Configured for gift card purchase processing |

## Features Covered

| # | Feature ID | Feature Name | Description | Status |
|---|---|---|---|---|
| 1 | GFT-001 | Template List | View all gift card templates with designs and denominations | ✅ Implemented |
| 2 | GFT-002 | Create Template | Design gift card template with image, message, denominations | ✅ Implemented |
| 3 | GFT-003 | Edit Template | Update template design, pricing, availability | ✅ Implemented |
| 4 | GFT-004 | Delete Template | Remove template (active cards remain valid) | ✅ Implemented |
| 5 | GFT-005 | Redemption History | View all gift card transactions with filters | ✅ Implemented |
| 6 | GFT-006 | Void Gift Card | Permanently deactivate a specific card (balance forfeited) | ✅ Implemented |
| 7 | GFT-007 | Deactivate Gift Card | Temporarily suspend a card (balance preserved) | ✅ Implemented |
| 8 | GFT-008 | Revenue Report | Gift card sales, redemptions, outstanding balances, breakage | ✅ Implemented |
| 9 | GFT-009 | Amount Limits | Configure min/max card values and custom amount rules | ✅ Implemented |
| 10 | GFT-010 | Bulk Generation | Generate batches of gift cards for corporate/promotional use | ✅ Implemented |

## Dashboard Overview

**URL:** `http://localhost:3000/admin/giftcards`

**API Base:** `http://localhost:3005/api/admin/giftcards`

### Key Metrics (Top Cards)

| Metric | Description | API Endpoint |
|---|---|---|
| Total Cards Issued | Count of all gift cards ever generated | `GET /api/admin/giftcards/stats` |
| Active Cards | Cards with `status = 'active'` and balance > 0 | `GET /api/admin/giftcards/stats` |
| Outstanding Balance | Sum of remaining balances across all active cards (£) | `GET /api/admin/giftcards/stats` |
| Revenue This Month | Total gift card purchase revenue in current month | `GET /api/admin/giftcards/stats` |
| Redemptions This Month | Total value redeemed in current month | `GET /api/admin/giftcards/stats` |
| Breakage Rate | Percentage of sold value that expires unredeemed | `GET /api/admin/giftcards/stats` |

### Quick Actions

- **+ Create Template** → Opens template design form
- **Generate Bulk Cards** → Opens bulk generation wizard
- **Look Up Card** → Search by card code to view balance and history
- **Export Report** → Download revenue report CSV

### Navigation

| Link | URL | Description |
|---|---|---|
| Overview | `/admin/giftcards` | Dashboard with KPIs |
| Templates | `/admin/giftcards/templates` | Template management |
| Cards | `/admin/giftcards/cards` | All issued cards list |
| Transactions | `/admin/giftcards/transactions` | Redemption/purchase history |
| Bulk | `/admin/giftcards/bulk` | Bulk generation management |
| Reports | `/admin/giftcards/reports` | Revenue and analytics |
| Settings | `/admin/giftcards/settings` | Amount limits and configuration |

## CRUD Operations

### Gift Card Templates

#### Create Template

**URL:** `/admin/giftcards/templates/create`

**API:** `POST /api/admin/giftcards/templates`

**Steps:**
1. Click **+ Create Template** from the templates page
2. Fill in the template form:

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | Text input | 1–60 characters, unique (e.g., "Birthday Celebration") | ✅ |
| `design_image` | File upload | JPEG/PNG/WebP, 1200×800px recommended, max 3MB | ✅ |
| `description` | Textarea | Max 200 characters, shown on card preview | ❌ |
| `default_message` | Textarea | Max 300 characters, pre-filled message for gift sender | ❌ |
| `denominations` | Multi-input | Predefined amounts (e.g., £25, £50, £100, £150, £200) | ✅ |
| `allow_custom_amount` | Toggle | Allow buyer to enter custom amount | ✅ |
| `min_amount` | Number input | Decimal ≥ 5.00 (when custom amount enabled) | Conditional |
| `max_amount` | Number input | Decimal ≤ 1000.00 (when custom amount enabled) | Conditional |
| `category` | Select | Birthday, Anniversary, Holiday, Thank You, Corporate, General | ✅ |
| `valid_days` | Number input | Integer 1–730, days until card expires from purchase date | ✅ |
| `is_active` | Toggle | Template available for purchase | ✅ |
| `delivery_methods` | Multi-select | Email, SMS, Print-at-Home, Physical Mail | ✅ |

3. **Preview** section shows live card preview as fields are filled
4. Click **Save Template**
5. On success: toast "Template created", appears in template grid

**Request Body Example:**
```json
{
  "name": "Birthday Celebration",
  "description": "Make their birthday special with a V2 Resort gift card",
  "default_message": "Happy Birthday! Enjoy a wonderful experience at V2 Resort.",
  "denominations": [25, 50, 100, 150, 200],
  "allow_custom_amount": true,
  "min_amount": 10.00,
  "max_amount": 500.00,
  "category": "Birthday",
  "valid_days": 365,
  "is_active": true,
  "delivery_methods": ["email", "print"]
}
```

#### Read / List Templates

**URL:** `/admin/giftcards/templates`

**API:** `GET /api/admin/giftcards/templates?page=1&limit=12&category=&status=&sort=created_at&order=desc`

Templates displayed as a card grid (not table) showing:
- Design image thumbnail
- Template name
- Category badge
- Denominations list
- Active/inactive status
- Cards issued count
- Total revenue generated
- Edit / Deactivate / Delete actions

#### Edit Template

**API:** `PUT /api/admin/giftcards/templates/:id`

1. Click **Edit** on template card
2. All fields editable — same validation as Create
3. **Note:** Changing denominations does not affect already-issued cards
4. Changing `valid_days` only affects newly issued cards
5. Click **Save Changes**

#### Delete Template

**API:** `DELETE /api/admin/giftcards/templates/:id`

1. Click **Delete** on template card
2. Confirmation: "Delete template '{name}'? Already-issued cards using this template will remain valid."
3. Template soft-deleted (`deleted_at` set)
4. Existing cards retain the template design data (snapshot stored on card)
5. Template no longer appears in purchase flow

### Gift Card Operations

#### View All Cards

**URL:** `/admin/giftcards/cards`

**API:** `GET /api/admin/giftcards/cards?page=1&limit=25&search=&status=&template=&sort=created_at&order=desc`

**Table Columns:**
| Column | Sortable | Description |
|---|---|---|
| Card Code | ✅ | 16-char code (XXXX-XXXX-XXXX-XXXX), partially masked in list |
| Template | ✅ | Template name and thumbnail |
| Original Value | ✅ | Initial loaded amount (£) |
| Balance | ✅ | Current remaining balance (£) |
| Status | ✅ | Active (green), Redeemed (blue), Expired (grey), Voided (red), Suspended (orange) |
| Purchased By | ✅ | Buyer name/email |
| Recipient | ✅ | Recipient name/email |
| Purchase Date | ✅ | When the card was bought |
| Expiry Date | ✅ | When the card expires |
| Actions | — | View Details / Void / Deactivate / Reactivate |

**Filters:**
- **Status:** All / Active / Fully Redeemed / Expired / Voided / Suspended
- **Template:** Filter by template name
- **Search:** Card code, buyer email, or recipient email
- **Date Range:** Purchase date range
- **Balance Range:** Min/max remaining balance

#### Card Detail View

Click a card code to view full details:
- Full card code (unmasked for admin)
- Card design preview
- Buyer and recipient information
- Delivery method and delivery status
- Personal message
- Complete transaction history (purchases and redemptions with timestamps)
- Remaining balance with visual progress bar

#### Void Gift Card

**API:** `POST /api/admin/giftcards/cards/:id/void`

1. Open card detail or click **Void** on card row
2. Confirmation modal: "Void card {code}? This is permanent. Remaining balance of £{balance} will be forfeited."
3. Enter reason (required):
   - Fraud suspected
   - Duplicate issued
   - Customer request
   - Chargeback
   - Other (free text)
4. Click **Void Card**
5. Card status → `voided`; balance set to £0.00
6. Transaction record created: type `void`, noting previous balance
7. Action is irreversible

#### Deactivate (Suspend) Gift Card

**API:** `POST /api/admin/giftcards/cards/:id/deactivate`

1. Click **Suspend** on card row
2. Confirmation: "Suspend card {code}? The balance of £{balance} will be preserved but card cannot be used until reactivated."
3. Enter reason (required)
4. Click **Suspend Card**
5. Card status → `suspended`; balance preserved
6. Card rejected at POS/checkout with message "This gift card is currently suspended"

#### Reactivate Gift Card

**API:** `POST /api/admin/giftcards/cards/:id/reactivate`

1. Click **Reactivate** on suspended card
2. Confirmation: "Reactivate card {code} with balance £{balance}?"
3. Click **Reactivate**
4. Status → `active`; balance available for use again

### Redemption History

**URL:** `/admin/giftcards/transactions`

**API:** `GET /api/admin/giftcards/transactions?page=1&limit=25&type=&card_code=&date_from=&date_to=`

**Table Columns:**
| Column | Sortable | Description |
|---|---|---|
| Transaction ID | ✅ | Unique transaction reference |
| Card Code | ✅ | Gift card used |
| Type | ✅ | Purchase, Redemption, Void, Refund, Adjustment |
| Amount | ✅ | Transaction amount (£) |
| Balance After | — | Card balance after this transaction |
| Location | ✅ | Where redeemed (Restaurant, Spa, Booking, POS) |
| Date | ✅ | Transaction timestamp |
| Processed By | ✅ | Staff/system that processed |

### Bulk Generation

**URL:** `/admin/giftcards/bulk`

**API:** `POST /api/admin/giftcards/bulk/generate`

**Steps:**
1. Click **Generate Bulk Cards**
2. Fill in batch form:

| Field | Type | Validation | Required |
|---|---|---|---|
| `template_id` | Select | Must be an active template | ✅ |
| `quantity` | Number input | Integer 1–1000 per batch | ✅ |
| `amount` | Number input | Decimal, must be in template's denominations or custom range | ✅ |
| `batch_name` | Text input | 1–60 characters (e.g., "Corporate Holiday 2026") | ✅ |
| `valid_days` | Number input | Override template default if needed | ❌ |
| `auto_activate` | Toggle | Cards active immediately vs. require manual activation | ✅ |
| `prefix` | Text input | Optional 4-char prefix for card codes (e.g., "CORP") | ❌ |

3. Click **Generate**
4. System generates cards asynchronously (progress bar for large batches)
5. On completion: toast "Generated {N} gift cards in batch '{name}'"
6. Download batch CSV with all card codes and activation URLs

**Batch CSV Columns:** Card Code, Amount, Status, Activation URL, Expiry Date

**Batch Management:**
- View all batches: `/admin/giftcards/bulk`
- Each batch shows: Name, Quantity, Amount per card, Total value, Created date, Cards used/remaining
- Void entire batch: Voids all unredeemed cards in batch

### Revenue Report

**URL:** `/admin/giftcards/reports`

**API:** `GET /api/admin/giftcards/reports?period=monthly&date_from=&date_to=`

**Report Sections:**
| Section | Metrics |
|---|---|
| Sales Summary | Cards sold, total sold value, average card value |
| Redemption Summary | Cards redeemed (partial + full), total redeemed value, average redemption |
| Outstanding Liability | Active cards count, total outstanding balance |
| Breakage | Expired cards, forfeited value, breakage rate (%) |
| Revenue by Template | Cards sold and revenue per template |
| Revenue by Period | Daily/weekly/monthly trend chart |
| Top Redemption Locations | Where cards are most frequently used |

**Export Options:** CSV, PDF

## Configuration Settings

| Setting | Location | Default | Description |
|---|---|---|---|
| `giftcards.min_amount` | `/admin/giftcards/settings` | `5.00` | Minimum gift card purchase amount (£) |
| `giftcards.max_amount` | `/admin/giftcards/settings` | `1000.00` | Maximum gift card purchase amount (£) |
| `giftcards.default_valid_days` | `/admin/giftcards/settings` | `365` | Default validity period (days) |
| `giftcards.code_format` | `/admin/giftcards/settings` | `XXXX-XXXX-XXXX-XXXX` | Card code format pattern |
| `giftcards.allow_partial_redemption` | `/admin/giftcards/settings` | `true` | Allow using part of the balance |
| `giftcards.send_balance_reminders` | `/admin/giftcards/settings` | `true` | Email reminder when balance unused for 90 days |
| `giftcards.expiry_reminder_days` | `/admin/giftcards/settings` | `30` | Days before expiry to send reminder |
| `giftcards.max_bulk_quantity` | `/admin/giftcards/settings` | `1000` | Maximum cards per bulk generation batch |
| `giftcards.require_recipient_email` | `/admin/giftcards/settings` | `true` | Require recipient email (for digital delivery) |
| `giftcards.refund_policy` | `/admin/giftcards/settings` | `unused_only` | Refund: unused_only, partial_balance, no_refunds |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Card code "not found" at checkout | Code mistyped or card was voided | Verify exact code in admin; check card status |
| "Insufficient balance" but card has funds | Card is suspended or partial redemption is disabled | Check card status; enable `allow_partial_redemption` in settings |
| Bulk generation stuck at progress bar | Large batch (500+) processing asynchronously | Wait 2–5 minutes; check `/admin/giftcards/bulk` for batch status |
| Gift card email not delivered | Recipient email invalid or SMTP misconfigured | Verify email address; check Supabase email service configuration |
| Revenue report shows negative breakage | More redeemed than sold (manual top-ups) | Filter by source to exclude manual adjustments; review adjustment history |
| "Cannot void" error | Card has already been fully redeemed | Fully redeemed cards have £0 balance; status is already `redeemed` |
| Template image not uploading | File exceeds 3MB or wrong format | Resize image to under 3MB; use JPEG, PNG, or WebP |
| Expired card still showing as active | Expiry cron job hasn't run | Expiry runs daily at 00:00 UTC; manually expire via card detail page |
| Duplicate card codes generated | Extremely rare — UUID collision | System auto-regenerates on collision; report if persistent |
| Bulk CSV download empty | Generation still in progress | Wait for "Generation Complete" notification before downloading |

## Security & Permissions

| Action | super_admin | admin | manager | staff | customer |
|---|---|---|---|---|---|
| View gift card dashboard | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create/edit templates | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete templates | ✅ | ✅ | ❌ | ❌ | ❌ |
| View all cards | ✅ | ✅ | ✅ | ❌ | ❌ |
| View card details (unmasked code) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Void gift card | ✅ | ✅ | ❌ | ❌ | ❌ |
| Suspend/reactivate card | ✅ | ✅ | ✅ | ❌ | ❌ |
| View redemption history | ✅ | ✅ | ✅ | ✅ | ❌ |
| Generate bulk cards | ✅ | ✅ | ❌ | ❌ | ❌ |
| View revenue reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export report data | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Process redemption at POS | ✅ | ✅ | ✅ | ✅ | ❌ |

**Audit Trail:** All void, suspend, and reactivate actions are logged to `gift_card_transactions` with `admin_user_id`, `card_id`, `action`, `reason`, and `timestamp`.

## Related Modules

| Module | Relationship | Link |
|---|---|---|
| User Management | Buyer and recipient accounts linked to gift cards | [user-management.md](./user-management.md) |
| Restaurant Management | Gift cards accepted as payment for restaurant orders | [restaurant-management.md](./restaurant-management.md) |
| Loyalty Management | Gift card purchases earn loyalty points; points convertible to gift credit | [loyalty-management.md](./loyalty-management.md) |
| Payments | Stripe processes gift card purchases and tracks redemptions | System payments module |
| POS | Front-desk and POS terminals accept gift card payments | System POS module |
| Notifications | Purchase confirmations, delivery, and expiry reminders via email/SMS | System notifications module |

## Feature Coverage Summary

| Category | Total Features | Implemented | Partial | Not Started |
|---|---|---|---|---|
| Template CRUD | 4 | 4 | 0 | 0 |
| Card Operations | 2 | 2 | 0 | 0 |
| History & Tracking | 1 | 1 | 0 | 0 |
| Reporting | 1 | 1 | 0 | 0 |
| Configuration | 1 | 1 | 0 | 0 |
| Bulk Operations | 1 | 1 | 0 | 0 |
| **Total** | **10** | **10** | **0** | **0** |
