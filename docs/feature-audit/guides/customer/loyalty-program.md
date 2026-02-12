# Customer Guide: Loyalty Program

> **Module:** CUS-LOY
> **Features:** 6 features
> **Last Updated:** 2026-02-08

---

## Overview

The V2 Resort loyalty program rewards you for every purchase throughout the resort — from restaurant meals and chalet bookings to pool tickets and snack bar orders. Accumulate points, unlock tier benefits, and redeem points for discounts. The loyalty dashboard gives you full visibility into your balance, tier status, benefits, and complete transaction history.

## Prerequisites

- Must be logged in to view your loyalty dashboard
- Must be enrolled in the loyalty program (free enrollment available from the dashboard)
- Points are earned automatically on eligible purchases after enrollment
- Tier upgrades happen automatically when you reach point thresholds

## Features Covered

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-LOY-001 | View loyalty dashboard | ✅ Implemented |
| CUS-LOY-002 | View points balance | ✅ Implemented |
| CUS-LOY-003 | View tier status | ✅ Implemented |
| CUS-LOY-004 | View transaction history | ✅ Implemented |
| CUS-LOY-005 | Enroll in loyalty program | ✅ Implemented |
| CUS-LOY-006 | View tier benefits | ✅ Implemented |

## How-To Guides

### 1. Enroll in the Loyalty Program

**What it does:** Signs you up for the V2 Resort loyalty program so you can start earning points on all resort purchases.

**Steps:**
1. Navigate to `/account/loyalty` from the account menu or resort homepage.
2. If you're not yet enrolled, a welcome banner appears with program highlights:
   - "Earn points on every purchase"
   - "Unlock exclusive tier benefits"
   - "Redeem points for discounts"
3. Click the **Enroll Now** or **Join Loyalty Program** button.
4. A brief enrollment form may appear confirming your details (name and email from your profile).
5. Click **Confirm Enrollment**.
6. You're now enrolled! Your loyalty dashboard activates immediately.
7. You start at the base tier (e.g., "Bronze" or "Member") with 0 points.

**What you'll see:**
- A promotional banner explaining program benefits before enrollment
- One-click enrollment process (no separate registration)
- Immediate activation of the loyalty dashboard after enrollment
- A welcome message confirming your enrollment and starting tier

**Tips:**
- Enrollment is completely free — there are no fees or charges.
- Points begin accruing on purchases made after enrollment. Past purchases are not retroactively credited.
- You only need to enroll once; the program is linked to your account permanently.

---

### 2. View Your Loyalty Dashboard

**What it does:** Provides a comprehensive overview of your loyalty status, including points balance, tier, and recent activity.

**Steps:**
1. Navigate to `/account/loyalty` from your account menu.
2. The dashboard displays:
   - **Points Balance** — Your current available points shown prominently (e.g., "2,450 points")
   - **Tier Status** — Your current tier with a visual indicator (e.g., "Gold Member" with a gold badge)
   - **Progress to Next Tier** — A progress bar showing how many points until your next tier upgrade (e.g., "550 points to Platinum")
   - **Recent Transactions** — The last 5 point-earning and point-redemption transactions
   - **Quick Actions** — Links to "View Benefits", "Transaction History", and "Redeem Points"

**What you'll see:**
- A visually rich dashboard with your balance, tier badge, and progress bar
- Color-coded tier indicator matching the tier level
- Summary cards for key metrics
- Navigation to detailed views

**Tips:**
- The dashboard is your home base for everything loyalty-related.
- Check here before making a purchase to see how many points you have available for redemption.

---

### 3. View Points Balance

**What it does:** Shows your exact current points balance, including pending points from recent transactions.

**Steps:**
1. On the loyalty dashboard (`/account/loyalty`), your points balance is displayed at the top.
2. The balance may show two values:
   - **Available Points** — Points you can redeem right now
   - **Pending Points** — Points from recent purchases that are being processed (typically available within 24 hours)
3. Below the balance, a brief summary shows:
   - Points earned this month
   - Points redeemed this month
   - Net points change

**What you'll see:**
- Large, bold points balance number
- Pending points noted separately (if any)
- Monthly summary of earnings and redemptions

**Tips:**
- Points typically become available within 24 hours of the purchase.
- Cancelled or refunded orders will have their points reversed.
- Points may have an expiry — check the tier benefits section for details on point validity.

---

### 4. View Tier Status and Benefits

**What it does:** Shows your current loyalty tier, the benefits it unlocks, and what higher tiers offer so you know what to aim for.

**Steps:**
1. On the loyalty dashboard, click **View Benefits** or scroll to the **Tier Status** section.
2. The tier overview displays all available tiers in order:

| Tier | Points Required | Key Benefits |
|---|---|---|
| **Bronze** | 0 | Base earning rate (1 point per $1 spent), member-only promotions |
| **Silver** | 1,000 | 1.25× earning rate, 5% discount on snack bar, priority waitlist |
| **Gold** | 5,000 | 1.5× earning rate, 10% discount on restaurant, free pool session/month |
| **Platinum** | 15,000 | 2× earning rate, 15% discount resort-wide, free chalet upgrade (subject to availability), dedicated support |

3. Your current tier is highlighted with a badge and checkmark.
4. A progress bar below shows how many points remain until the next tier.
5. Click on any tier to expand its full list of benefits.

**What you'll see:**
- Tier ladder visualization with your current position marked
- Progress bar with exact numbers (e.g., "Gold — 3,450 / 5,000 points")
- Expandable benefit details for each tier
- Icons representing each benefit category

**Tips:**
- Tier status is evaluated continuously — as soon as you hit the threshold, you're upgraded immediately.
- Tiers are maintained for the calendar year. Points earned carry over; tier status may reset annually based on program rules.
- Higher tiers are worth pursuing — the earning rate multiplier compounds over time.

---

### 5. View Transaction History

**What it does:** Provides a complete log of all loyalty point transactions — earned, redeemed, and adjusted.

**Steps:**
1. On the loyalty dashboard, click **Transaction History** or **View All Transactions**.
2. The history page shows a chronological list of all transactions:
   - **Date and time** of the transaction
   - **Description** (e.g., "Restaurant Order #ORD-2026-00312", "Loyalty Redemption — Pool Ticket", "Tier Bonus — Gold Upgrade")
   - **Points earned** (positive, shown in green)
   - **Points redeemed** (negative, shown in red)
   - **Running balance** after the transaction
3. Use **filters** to narrow the list:
   - Date range picker
   - Transaction type: Earned, Redeemed, Adjusted, Bonus
   - Module: Restaurant, Snack Bar, Pool, Chalets
4. Use **pagination** or scroll to load more entries.

**What you'll see:**
- A table or list with sortable columns
- Color-coded point values (green for earned, red for redeemed)
- Filter controls at the top
- Running balance column showing your balance after each transaction
- Export option (if available) to download history as CSV

**Tips:**
- Check the transaction history to verify that points from a recent purchase have been credited.
- If a transaction appears incorrect, note the order number and contact support.
- Reversed transactions (from cancellations/refunds) are clearly labeled as "Adjustment" or "Reversal."

---

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Points not appearing after a purchase | Points may be in "Pending" status (up to 24-hour processing) | Wait 24 hours. Check the "Pending Points" indicator on your dashboard. |
| Tier didn't upgrade after reaching the threshold | Points may still be processing, or the threshold wasn't met yet | Verify your exact point total. Pending points don't count toward tier qualification until confirmed. |
| Cannot enroll — "Already enrolled" message | You've previously enrolled with this account | Navigate directly to `/account/loyalty` to access your existing dashboard. |
| Points disappeared or balance decreased unexpectedly | A previous order may have been cancelled/refunded, causing a point reversal | Check the transaction history for "Adjustment" or "Reversal" entries. |
| Redeemed points but discount not applied to order | Redemption may not have been confirmed at checkout | Ensure you toggled "Use Loyalty Points" during the checkout process and the discount appeared in the order summary. |
| Transaction history is empty | No transactions since enrollment, or date filter is too narrow | Clear any active filters. If recently enrolled, make your first purchase to see a transaction. |

## Related Modules

- [Restaurant Ordering](restaurant-ordering.md) — Earn and redeem loyalty points on restaurant orders
- [Snack Bar](snack-bar.md) — Earn points on snack bar purchases
- [Pool Tickets](pool-tickets.md) — Earn points on pool ticket purchases
- [Chalet Booking](chalet-booking.md) — Earn points on chalet bookings
- [Account & Profile](account-and-profile.md) — Manage your loyalty enrollment and account settings
- [Gift Cards](gift-cards.md) — Gift cards and loyalty points can be combined at checkout

## Feature Coverage Summary

| Metric | Value |
|---|---|
| Total Features | 6 |
| Implemented | 6 |
| Pending | 0 |
| Coverage | 100% |
| Key Endpoints | `GET /loyalty/me`, `GET /loyalty/tiers`, `GET /loyalty/transactions`, `POST /loyalty/enroll` |
| Primary URL | `/account/loyalty` |
