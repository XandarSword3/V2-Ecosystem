# Admin Guide: Loyalty Management

> Module: ADM-LOY | Features: 12 | Role: super_admin | Updated: 2026-02-08

## Overview

The Loyalty Management module controls the resort's customer loyalty program, including tier configuration, point earning and redemption rules, member management, analytics, and promotional multipliers. The program incentivizes repeat visits and spending through tiered rewards that unlock escalating benefits. Administrators define the program structure, monitor member engagement, and run point promotions.

Data is stored in Supabase PostgreSQL tables: `loyalty_tiers`, `loyalty_rules`, `loyalty_members`, `loyalty_transactions`, `loyalty_promotions`, and `loyalty_settings`. The Express.js backend (localhost:3005) provides APIs under `/api/admin/loyalty/*`. Points are calculated in real-time by the backend on qualifying transactions and cached in Redis for fast balance lookups.

## Prerequisites

| Requirement | Details |
|---|---|
| Admin Access | Login at `/admin/login` with `admin@v2resort.com` / `admin123` |
| Role Required | `super_admin` or `admin` |
| Browser | Chrome 90+, Firefox 88+, Edge 90+ |
| Backend Running | Express.js API on `localhost:3005` |
| Frontend Running | Next.js 14 dev server on `localhost:3000` |
| Database | Supabase PostgreSQL with loyalty tables |
| Redis | Running for point balance caching |
| Stripe | Active for tracking qualifying purchase transactions |

## Features Covered

| # | Feature ID | Feature Name | Description | Status |
|---|---|---|---|---|
| 1 | LOY-001 | Tier Configuration | Define loyalty tiers with thresholds and benefits | ✅ Implemented |
| 2 | LOY-002 | Earning Rules | Configure how points are earned (per £ spent, per booking, etc.) | ✅ Implemented |
| 3 | LOY-003 | Redemption Rules | Define what points can be redeemed for and exchange rates | ✅ Implemented |
| 4 | LOY-004 | Member List | View all loyalty members with tier, points, and activity | ✅ Implemented |
| 5 | LOY-005 | Member Detail | View individual member history, transactions, tier progress | ✅ Implemented |
| 6 | LOY-006 | Manual Point Adjustment | Add or deduct points manually with reason | ✅ Implemented |
| 7 | LOY-007 | Analytics Dashboard | Program-wide metrics: enrollment, redemption rate, ROI | ✅ Implemented |
| 8 | LOY-008 | Tier Analytics | Per-tier breakdown of members, spending, engagement | ✅ Implemented |
| 9 | LOY-009 | Promotional Multipliers | Time-limited point multiplier campaigns (e.g., 2× weekends) | ✅ Implemented |
| 10 | LOY-010 | Program Toggle | Enable/disable the entire loyalty program | ✅ Implemented |
| 11 | LOY-011 | Point Expiry Config | Set point expiration rules (e.g., expire after 12 months) | ✅ Implemented |
| 12 | LOY-012 | Member Search & Filter | Search by name/email, filter by tier/status/points range | ✅ Implemented |

## Dashboard Overview

**URL:** `http://localhost:3000/admin/loyalty`

**API Base:** `http://localhost:3005/api/admin/loyalty`

### Key Metrics (Top Cards)

| Metric | Description | API Endpoint |
|---|---|---|
| Total Members | Count of enrolled loyalty members | `GET /api/admin/loyalty/stats` |
| Active Members | Members with activity in last 90 days | `GET /api/admin/loyalty/stats` |
| Points Outstanding | Total unredeemed points across all members | `GET /api/admin/loyalty/stats` |
| Points Liability | Monetary value of outstanding points (£) | `GET /api/admin/loyalty/stats` |
| Redemption Rate | Percentage of earned points that have been redeemed | `GET /api/admin/loyalty/stats` |
| New Enrollments (Month) | Members enrolled in current month | `GET /api/admin/loyalty/stats` |

### Quick Actions

- **Edit Tiers** → Opens tier configuration page
- **Adjust Points** → Quick point adjustment modal
- **New Promotion** → Create promotional multiplier
- **Export Members** → Download member list CSV

### Navigation

| Link | URL | Description |
|---|---|---|
| Overview | `/admin/loyalty` | Dashboard with program KPIs |
| Members | `/admin/loyalty/members` | Member list and management |
| Tiers | `/admin/loyalty/tiers` | Tier configuration |
| Rules | `/admin/loyalty/rules` | Earning and redemption rules |
| Promotions | `/admin/loyalty/promotions` | Promotional multiplier campaigns |
| Analytics | `/admin/loyalty/analytics` | Detailed program analytics |
| Settings | `/admin/loyalty/settings` | Program settings and toggle |

## CRUD Operations

### Tier Configuration

**URL:** `/admin/loyalty/tiers`

**API:** `GET/POST/PUT/DELETE /api/admin/loyalty/tiers`

**Steps:**
1. Navigate to `/admin/loyalty/tiers`
2. Existing tiers displayed in ascending order by `min_points`
3. Click **+ Add Tier** or edit existing:

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | Text input | 1–30 characters, unique (e.g., "Bronze", "Silver", "Gold", "Platinum") | ✅ |
| `min_points` | Number input | Integer ≥ 0, must not overlap with other tiers | ✅ |
| `color` | Color picker | Hex color for UI badge (e.g., #CD7F32 for Bronze) | ✅ |
| `icon` | Select | Tier icon from icon library | ❌ |
| `earning_multiplier` | Number input | Decimal ≥ 1.0 (e.g., 1.0 = standard, 1.5 = 50% bonus) | ✅ |
| `benefits` | Textarea (rich text) | Description of tier benefits shown to members | ✅ |
| `discount_percent` | Number input | Decimal 0–50, automatic discount on eligible purchases | ❌ |
| `free_upgrades` | Toggle | Enable complimentary room/chalet upgrades | ❌ |
| `priority_booking` | Toggle | Enable priority booking access | ❌ |
| `welcome_bonus_points` | Number input | Integer ≥ 0, bonus points awarded on reaching this tier | ❌ |

4. Click **Save Tier**
5. Tiers re-sort automatically by `min_points`

**Default Tier Structure:**
| Tier | Min Points | Multiplier | Discount | Key Benefits |
|---|---|---|---|---|
| Bronze | 0 | 1.0× | 0% | Basic program access, birthday bonus |
| Silver | 500 | 1.25× | 5% | Early check-in, welcome drink |
| Gold | 2,000 | 1.5× | 10% | Room upgrade, spa discount, priority booking |
| Platinum | 5,000 | 2.0× | 15% | Suite upgrade, free breakfast, dedicated concierge |

**Tier Deletion Rules:**
- Cannot delete if members are currently in the tier
- Must reassign members to another tier first, or merge tiers
- System requires at least one tier (base tier) to exist

### Earning Rules

**URL:** `/admin/loyalty/rules?type=earning`

**API:** `POST /api/admin/loyalty/rules`

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | Text input | 1–60 characters (e.g., "Restaurant Spend") | ✅ |
| `type` | Constant | `earning` | ✅ |
| `trigger` | Select | per_pound_spent, per_booking, per_visit, per_referral, signup, birthday | ✅ |
| `category` | Select | All, Accommodation, Restaurant, Spa, Activities, Shop | ✅ |
| `points_value` | Number input | Integer ≥ 1 (points awarded per trigger event) | ✅ |
| `min_transaction` | Number input | Decimal ≥ 0, minimum spend to qualify | ❌ |
| `max_points_per_day` | Number input | Integer ≥ 0, daily cap per member (0 = no cap) | ❌ |
| `is_active` | Toggle | Enable/disable this rule | ✅ |

**Example Earning Rules:**
| Rule Name | Trigger | Points | Category | Notes |
|---|---|---|---|---|
| General Spend | per_pound_spent | 1 | All | 1 point per £1 across all categories |
| Restaurant Bonus | per_pound_spent | 2 | Restaurant | 2 points per £1 in restaurant |
| Booking Bonus | per_booking | 50 | Accommodation | 50 bonus points per completed booking |
| Signup Reward | signup | 100 | All | 100 welcome points on registration |
| Birthday Bonus | birthday | 200 | All | 200 points on member's birthday |
| Referral Reward | per_referral | 250 | All | 250 points when referred friend books |

### Redemption Rules

**URL:** `/admin/loyalty/rules?type=redemption`

**API:** `POST /api/admin/loyalty/rules`

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | Text input | 1–60 characters (e.g., "Discount Voucher") | ✅ |
| `type` | Constant | `redemption` | ✅ |
| `redemption_type` | Select | discount, free_item, upgrade, experience, gift_card_credit | ✅ |
| `points_required` | Number input | Integer ≥ 1 | ✅ |
| `value` | Number input | Monetary value in £ (for discount/credit types) | Conditional |
| `description` | Textarea | What the member receives (shown in redemption catalog) | ✅ |
| `min_tier` | Select | Minimum tier required to redeem | ❌ |
| `max_redemptions_per_member` | Number input | 0 = unlimited | ❌ |
| `is_active` | Toggle | Enable/disable redemption option | ✅ |

**Example Redemptions:**
| Redemption | Points | Value | Min Tier |
|---|---|---|---|
| £5 Dining Voucher | 500 | £5.00 | Bronze |
| £10 Spa Credit | 1,000 | £10.00 | Silver |
| Free Dessert | 200 | — | Bronze |
| Room Upgrade | 2,000 | — | Gold |
| Complimentary Breakfast | 300 | — | Silver |

### Member Management

#### Member List

**URL:** `/admin/loyalty/members`

**API:** `GET /api/admin/loyalty/members?page=1&limit=25&search=&tier=&status=&sort=points&order=desc`

**Table Columns:**
| Column | Sortable | Description |
|---|---|---|
| Name | ✅ | Member name (linked to user account) |
| Email | ✅ | Account email |
| Tier | ✅ | Current tier badge (color-coded) |
| Points Balance | ✅ | Current available points |
| Lifetime Points | ✅ | Total points ever earned |
| Points to Next Tier | — | Points needed for tier upgrade |
| Member Since | ✅ | Enrollment date |
| Last Activity | ✅ | Most recent point transaction date |
| Status | ✅ | Active / Inactive / Suspended |
| Actions | — | View / Adjust Points / Suspend |

#### Manual Point Adjustment

**API:** `POST /api/admin/loyalty/members/:id/adjust`

**Steps:**
1. Find member in list → Click **Adjust Points** (or open member detail)
2. Point adjustment modal opens showing:
   - Current balance
   - Current tier
   - Points to next tier
3. Fill in:

| Field | Type | Validation | Required |
|---|---|---|---|
| `adjustment_type` | Radio | Add Points / Deduct Points | ✅ |
| `amount` | Number input | Integer ≥ 1, max 100,000 per adjustment | ✅ |
| `reason` | Select + text | Goodwill gesture, Error correction, Promotional award, Complaint resolution, Other (free text) | ✅ |
| `notes` | Textarea | Max 200 characters, internal notes | ❌ |

4. Click **Confirm Adjustment**
5. On success: toast "{+/-}{amount} points applied to {name}"
6. Transaction logged to `loyalty_transactions` with `source = 'manual'` and admin user ID
7. If new balance crosses tier threshold, member is automatically upgraded/downgraded

### Promotional Multipliers

**URL:** `/admin/loyalty/promotions`

**API:** `POST /api/admin/loyalty/promotions`

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | Text input | 1–60 characters (e.g., "Summer Double Points") | ✅ |
| `multiplier` | Number input | Decimal 1.5–10.0 (e.g., 2.0 = double points) | ✅ |
| `start_date` | Date + time picker | Must be now or future | ✅ |
| `end_date` | Date + time picker | Must be after `start_date` | ✅ |
| `applies_to` | Multi-select | All, Accommodation, Restaurant, Spa, Activities, Shop | ✅ |
| `eligible_tiers` | Multi-select | Which tiers benefit (default: all) | ✅ |
| `description` | Textarea | Customer-facing description | ❌ |
| `is_stackable` | Toggle | Whether this stacks with tier multipliers | ✅ |
| `is_active` | Toggle | Enable/disable promotion | ✅ |

**Example:** "Weekend Double Points" — 2.0× multiplier, Fri 18:00 to Sun 23:59, all categories, all tiers, stackable with tier multiplier (Gold member gets 2.0 × 1.5 = 3.0× during promotion).

### Program Toggle

**URL:** `/admin/loyalty/settings`

**API:** `PUT /api/admin/loyalty/settings`

1. Navigate to `/admin/loyalty/settings`
2. **Program Status** toggle: ON / OFF
3. When toggling OFF:
   - Confirmation modal: "Disabling the loyalty program will: Stop all point earning, Hide loyalty UI from customers, Freeze all point balances, Active promotions will be paused"
   - Existing points and member data are preserved (not deleted)
4. When toggling ON:
   - Program resumes immediately
   - Paused promotions resume if still within date range

## Configuration Settings

| Setting | Location | Default | Description |
|---|---|---|---|
| `loyalty.program_enabled` | `/admin/loyalty/settings` | `true` | Master toggle for loyalty program |
| `loyalty.program_name` | `/admin/loyalty/settings` | `V2 Rewards` | Customer-facing program name |
| `loyalty.points_expiry_months` | `/admin/loyalty/settings` | `12` | Months before unused points expire (0 = never) |
| `loyalty.expiry_warning_days` | `/admin/loyalty/settings` | `30` | Days before expiry to notify members |
| `loyalty.min_redemption_points` | `/admin/loyalty/settings` | `100` | Minimum points required for any redemption |
| `loyalty.auto_enroll` | `/admin/loyalty/settings` | `true` | Auto-enroll new customers in loyalty program |
| `loyalty.tier_downgrade_enabled` | `/admin/loyalty/settings` | `true` | Allow tier downgrade on inactivity |
| `loyalty.tier_review_period_months` | `/admin/loyalty/settings` | `12` | Period for tier recalculation |
| `loyalty.show_points_on_receipt` | `/admin/loyalty/settings` | `true` | Display points earned on order receipts |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Points not earning on purchases | Program disabled or no active earning rule for category | Check program toggle is ON; verify earning rules cover the purchase category |
| Member not upgrading tier | Points balance below tier threshold | Check `min_points` on target tier; note: lifetime points or current balance may be used (check setting) |
| Promotion multiplier not applying | Promotion dates haven't started or have ended | Verify `start_date` and `end_date`; check promotion is active |
| "Cannot delete tier" error | Members currently in the tier | Reassign members to another tier first, then delete |
| Points balance shows stale value | Redis cache not updated | Force refresh: edit member → save (triggers cache update); or wait for TTL |
| Redemption fails for member | Insufficient points or below minimum tier | Check member's balance and tier against redemption requirements |
| Point expiry processed incorrectly | Timezone mismatch in expiry calculation | Verify server timezone matches business timezone in settings |
| Manual adjustment exceeds cap | Amount > 100,000 per adjustment | Split into multiple adjustments if legitimately needed |
| Analytics show £0 liability | No outstanding points or point value not configured | Set monetary value per point in settings (e.g., 1 point = £0.01) |

## Security & Permissions

| Action | super_admin | admin | manager | staff | customer |
|---|---|---|---|---|---|
| View loyalty dashboard | ✅ | ✅ | ✅ | ❌ | ❌ |
| Configure tiers | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configure rules | ✅ | ✅ | ❌ | ❌ | ❌ |
| View member list | ✅ | ✅ | ✅ | ❌ | ❌ |
| View member detail | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manual point adjustment | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create/edit promotions | ✅ | ✅ | ❌ | ❌ | ❌ |
| Toggle program on/off | ✅ | ❌ | ❌ | ❌ | ❌ |
| View analytics | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export member data | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change settings | ✅ | ✅ | ❌ | ❌ | ❌ |

**Audit Trail:** All manual point adjustments are logged with `admin_user_id`, `member_id`, `amount`, `reason`, `notes`, and `timestamp` in `loyalty_transactions` with `source = 'manual_admin'`.

## Related Modules

| Module | Relationship | Link |
|---|---|---|
| User Management | Members linked to user accounts; enrollment requires active user | [user-management.md](./user-management.md) |
| Restaurant Management | Restaurant orders earn points; points redeemable on dining | [restaurant-management.md](./restaurant-management.md) |
| Gift Cards | Gift card purchases can earn points; points can convert to gift card credit | [gift-cards.md](./gift-cards.md) |
| Bookings | Accommodation bookings earn points based on spend | System bookings module |
| Payments | Stripe transactions trigger point calculations | System payments module |
| Notifications | Tier upgrades, point expiry warnings sent via email/push | System notifications module |

## Feature Coverage Summary

| Category | Total Features | Implemented | Partial | Not Started |
|---|---|---|---|---|
| Tier Management | 1 | 1 | 0 | 0 |
| Rules Configuration | 2 | 2 | 0 | 0 |
| Member Management | 3 | 3 | 0 | 0 |
| Analytics | 2 | 2 | 0 | 0 |
| Promotions | 1 | 1 | 0 | 0 |
| Program Control | 2 | 2 | 0 | 0 |
| Search & Filter | 1 | 1 | 0 | 0 |
| **Total** | **12** | **12** | **0** | **0** |
