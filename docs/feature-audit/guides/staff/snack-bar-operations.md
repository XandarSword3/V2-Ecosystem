# Staff Guide: Snack Bar Operations

**Module:** STF-SNCK | **Features:** 10 | **Last Updated:** 2026-02-08

---

## Overview

The Snack Bar Operations module provides a streamlined order management interface for snack bar staff. It covers the full order lifecycle—from receiving pending orders to marking them complete—along with revenue tracking, popular item analysis, quick order creation for walk-up customers, and stock alert monitoring. The interface is optimized for fast-paced counter service with clear visual indicators and configurable notification sounds.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Login URL** | `http://localhost:3000/staff/login` |
| **Credentials** | `staff@v2resort.com` / `staff123` |
| **Browser** | Chrome, Firefox, or Edge (latest) |
| **Hardware** | Tablet or POS terminal at the snack bar counter |
| **Network** | Stable WiFi for real-time order reception |
| **Audio** | Speakers or tablet audio enabled for notification sounds |

---

## Features Covered

| ID | Feature Name | Type | Status |
|---|---|---|---|
| STF-SNCK-001 | Pending Orders View | Display | ✅ Implemented |
| STF-SNCK-002 | Order Detail Display | Detail View | ✅ Implemented |
| STF-SNCK-003 | Update Order Status | Action | ✅ Implemented |
| STF-SNCK-004 | Mark Order Complete | Action | ✅ Implemented |
| STF-SNCK-005 | Order History | Display | ✅ Implemented |
| STF-SNCK-006 | Revenue Stats | Analytics | ✅ Implemented |
| STF-SNCK-007 | Popular Items Display | Analytics | ✅ Implemented |
| STF-SNCK-008 | Quick Order Creation | Create | ✅ Implemented |
| STF-SNCK-009 | Stock Alerts | Notification | ✅ Implemented |
| STF-SNCK-010 | Notification Sound Settings | Settings | ✅ Implemented |

---

## Daily Workflow

### Opening Shift

1. **Log in** at `/staff/login` with your staff credentials.
2. Navigate to **Snack Bar** from the sidebar or go directly to `/staff/snack-bar`.
3. Verify the pending orders queue is empty or only has pre-orders for the day.
4. Check **Stock Alerts** — review any items flagged as low stock and report them to the manager if supplies need ordering.
5. Test the **notification sound** by checking the settings icon—ensure the device volume is up and the correct sound is selected.
6. Confirm the WebSocket connection indicator shows green.

### During Shift

1. **Monitor the Pending Orders queue**: New orders (from guest app, kiosk, or pool area) appear automatically with an audible notification.
2. **Start preparing an order**: Click the order to view full details. Click **Start Preparing** to move it from Pending to In Progress.
3. **Complete orders**: When food/drinks are ready, click **Mark Complete**. This notifies the guest that their order is ready for pickup.
4. **Handle walk-up customers**: Use **Quick Order Creation** for guests ordering directly at the counter.
5. **Watch for stock alerts**: If an item runs out, a red badge appears on the Stock Alerts icon. You can mark items as out-of-stock, which removes them from the ordering menu until restocked.
6. **Review stats**: During quieter periods, check the Revenue Stats and Popular Items sections to understand sales trends.

### Closing Shift

1. Process any remaining pending orders or cancel them if the snack bar is closing.
2. Review the **Order History** — ensure all orders are either completed or cancelled.
3. Check **Revenue Stats** for the day's total and compare with cash/card totals.
4. Note any items that are low in stock for the morning team.
5. Log out from the staff menu.

---

## Feature Details

### STF-SNCK-001: Pending Orders View

**Steps to use:**
1. Navigate to `/staff/snack-bar`. The main view shows the **Pending Orders** queue, loaded via `GET /snack/staff/orders`.
2. Orders are displayed as cards sorted by submission time (oldest first—FIFO).
3. Each card shows: order number, time placed, number of items, total price, and source (App, Kiosk, Counter).
4. A badge at the top indicates the count of pending orders.
5. New orders animate in at the top of the queue with a highlight effect.

### STF-SNCK-002: Order Detail Display

**Steps to use:**
1. Click any order card to expand the detail view (inline or as a modal depending on screen size).
2. Details shown:
   - **Order number** and **timestamp**.
   - **Guest name** (if available) and **pickup location** (Counter, Pool Area, Chalet Number).
   - **Items ordered**: Each item with quantity, customizations (e.g., "no ice," "extra ketchup"), and individual price.
   - **Order total** and **payment status** (Paid, Pending, Room Charge).
3. Special requests are highlighted in a yellow box.
4. Click **Close** or press `Esc` to return to the queue.

### STF-SNCK-003: Update Order Status

**Steps to use:**
1. Open the order detail view.
2. Click the status button to advance the order:
   - **Pending → Preparing**: Click **Start Preparing**. The order card moves to the "In Progress" section.
   - **Preparing → Ready**: Click **Mark Ready**. The guest is notified that their order is ready for pickup.
3. Each status change calls `PATCH /snack/staff/orders/:id/status` with the new status value.
4. Status changes are reflected in real-time for all staff viewing the snack bar interface.

### STF-SNCK-004: Mark Order Complete

**Steps to use:**
1. When a guest picks up their order (or it has been delivered), find the order in the "Ready" section.
2. Click **Mark Complete**. 
3. The order is removed from the active queue and moved to Order History.
4. The revenue stats update to include this order's total.
5. If a guest doesn't pick up their order within 15 minutes of it being "Ready," a warning badge appears on the order card.

### STF-SNCK-005: Order History

**Steps to use:**
1. Click the **History** tab at the top of the snack bar view.
2. A chronological list of all orders for the current day appears, newest first.
3. Each entry shows: order number, time, items summary, total, status (Completed / Cancelled), and staff member who processed it.
4. Use the search bar to find a specific order by number or guest name.
5. Click any historical order to see the full detail view.
6. Order history is useful for resolving guest disputes and reconciling end-of-day revenue.

### STF-SNCK-006: Revenue Stats

**Steps to use:**
1. The revenue panel is visible in the analytics sidebar (or click the **Analytics** tab on smaller screens).
2. Key metrics displayed:
   - **Today's Revenue**: Total sales amount.
   - **Orders Completed**: Number of orders fulfilled.
   - **Average Order Value**: Revenue divided by completed orders.
   - **Comparison**: Percentage change vs. yesterday and the weekly/monthly average.
3. Revenue is broken down by payment method: Cash, Card, Room Charge.
4. Stats update in real-time as orders are completed.

### STF-SNCK-007: Popular Items Display

**Steps to use:**
1. In the analytics section, scroll to **Popular Items**.
2. A ranked list shows the top-selling items today with sale counts.
3. Items are listed in descending order of quantity sold.
4. Use this information to anticipate demand and pre-prepare popular items during rush periods.
5. If a popular item is running low, proactively flag it via Stock Alerts.

### STF-SNCK-008: Quick Order Creation

**Steps to use:**
1. Click the **+ Quick Order** button at the top of the pending orders queue.
2. The order form opens:
   - **Browse items** by category (Drinks, Snacks, Meals, Combos) or search by name.
   - Click items to add them to the order. Adjust quantities with +/- buttons.
   - Add **customizations** by clicking the modifier icon next to each item (e.g., "no ice," "gluten-free bun").
   - Select **payment method**: Cash, Card, Room Charge (enter room/chalet number).
3. The running total updates as items are added.
4. Click **Place Order**. The order enters the Pending queue (or directly into Preparing if you're about to make it).
5. For immediate counter service, you can place the order and immediately advance it to Preparing.

### STF-SNCK-009: Stock Alerts

**Steps to use:**
1. A bell/alert icon in the toolbar shows a red badge when items are low in stock.
2. Click the icon to view the stock alerts panel:
   - Items below the low-stock threshold are listed with current quantity and threshold.
   - Items at zero stock are highlighted in red.
3. For items at zero stock, you can click **Mark Unavailable** to temporarily remove them from the ordering menu. Guests will see these items as "Sold Out."
4. To restore an item when restocked, click **Mark Available** in the same panel.
5. Stock alert thresholds are set by the manager and cannot be modified by staff.

### STF-SNCK-010: Notification Sound Settings

**Steps to use:**
1. Click the **Settings** gear icon in the snack bar toolbar.
2. Under **Notification Sounds**, configure:
   - **New Order Sound**: Toggle on/off and select from available tones (Chime, Bell, Beep, Alert).
   - **Volume**: Adjust the notification volume slider.
   - **Repeat**: Set whether the sound repeats until acknowledged (useful in noisy environments).
3. Click **Save Settings**. Changes apply immediately.
4. Settings are saved per-device (browser local storage), so each terminal can have different sound preferences.
5. Keep sounds enabled during operating hours to avoid missing orders.

---

## Real-time Updates (WebSocket)

| Event | Trigger | Effect on Interface |
|---|---|---|
| `snack:order_new` | Guest places a snack bar order | New order card appears in Pending queue; notification sound plays |
| `snack:order_status_changed` | Another staff member updates order status | Order card moves to new section |
| `snack:order_cancelled` | Guest or manager cancels an order | Order removed from queue with strikethrough animation |
| `snack:stock_alert` | Inventory system detects low stock | Red badge appears on stock alerts icon |

---

## Escalation Points

| Situation | Action | Escalate To |
|---|---|---|
| Item out of stock but orders still coming in | Mark item unavailable; inform waiting guests | Shift Manager (for resupply) |
| Guest complains about food quality | Apologize; offer replacement; log the complaint | Duty Manager |
| Payment terminal not working | Accept cash or switch to Room Charge; note the issue | IT Support + Manager |
| Order volume overwhelming (long queue) | Focus on FIFO; communicate wait times to guests | Shift Manager (for additional staffing) |
| Guest claims order is missing items | Check order detail; provide missing items; log issue | Shift Manager |
| Equipment malfunction (blender, coffee machine) | Report maintenance; remove affected items from menu | Maintenance + Manager |
| Guest with severe allergy asks about ingredients | Do not guess; refer to ingredient list or kitchen manager | Kitchen Manager |

---

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| No notification sound for new orders | Browser audio permissions blocked | Click anywhere on the page to enable audio; check browser site permissions |
| Pending orders not appearing | WebSocket disconnection or API error | Refresh page; check connection indicator; verify network |
| Quick Order form shows empty menu | Menu items not loaded or all items unavailable | Refresh page; check if items were accidentally marked unavailable |
| Revenue stats don't match register | Walk-up cash orders not entered in system | Ensure all counter sales are entered via Quick Order |
| Order stuck in "Preparing" | Staff forgot to advance it | Click the order and update status to Ready or Complete |
| Stock alerts not showing despite low stock | Threshold not configured for that item | Ask manager to set stock thresholds in admin panel |
| Guest can't find their order for pickup | Order might be under different name or number | Search order history by time or items ordered |

---

## Related Modules

- [Restaurant & Kitchen Operations](restaurant-kitchen.md) — Full restaurant order management (similar workflow)
- [Pool Management](pool-management.md) — Pool-area snack orders may originate here
- [Bookings & Navigation](bookings-management.md) — Staff dashboard and navigation
- [Manager: Dashboard & Analytics](../manager/manager-dashboard.md) — Snack bar revenue in overall analytics

---

## Feature Coverage Summary

| Category | Count | Percentage |
|---|---|---|
| Implemented | 10 | 100% |
| Partially Implemented | 0 | 0% |
| Not Implemented | 0 | 0% |
| **Total** | **10** | **100%** |
