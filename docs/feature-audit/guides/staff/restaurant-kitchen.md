# Staff Guide: Restaurant & Kitchen Operations

**Module:** STF-REST | **Features:** 6 | **Last Updated:** 2026-02-08

---

## Overview

The Restaurant & Kitchen Operations module provides a real-time Kanban-style order management board for kitchen and floor staff. Orders flow through five status columns—Pending, Preparing, Ready, Served, and Completed—with instant WebSocket notifications ensuring the kitchen never misses an incoming order. Staff can advance orders via drag-and-drop or status buttons, view full order details including modifiers and special dietary instructions, and filter the board by status.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Login URL** | `http://localhost:3000/staff/login` |
| **Credentials** | `staff@v2resort.com` / `staff123` |
| **Browser** | Chrome, Firefox, or Edge (latest) |
| **Hardware** | Kitchen display screen (tablet or monitor), mouse or touchscreen |
| **Network** | Stable connection required for real-time WebSocket updates |

---

## Features Covered

| ID | Feature Name | Type | Status |
|---|---|---|---|
| STF-REST-001 | Kanban Order Board | Core Display | ✅ Implemented |
| STF-REST-002 | Order Status Filters | Filter | ✅ Implemented |
| STF-REST-003 | Advance Order Status | Action | ✅ Implemented |
| STF-REST-004 | Order Detail Modal | Detail View | ✅ Implemented |
| STF-REST-005 | Real-time New Order Notifications | WebSocket | ✅ Implemented |
| STF-REST-006 | Special Instructions Display | Detail View | ✅ Implemented |

---

## Daily Workflow

### Opening Shift

1. **Log in** at `/staff/login` with your staff credentials.
2. Navigate to **Restaurant** from the sidebar or go directly to `/staff/restaurant`.
3. Verify the Kanban board loads with all five columns visible: **Pending → Preparing → Ready → Served → Completed**.
4. Check that no orders are stuck from the previous shift—any orders still in "Preparing" or "Ready" should be investigated and resolved.
5. Confirm the WebSocket connection indicator (top-right) shows a green dot, meaning real-time updates are active.

### During Shift

1. **Monitor incoming orders** — new orders appear in the **Pending** column with an audible notification and a brief toast alert.
2. **Accept an order** by clicking the order card or dragging it from **Pending** to **Preparing**. This signals the kitchen has started working on the order.
3. **View order details** by clicking any order card to open the detail modal. Review items, quantities, modifiers (e.g., "no onions," "extra cheese"), and special instructions (e.g., "nut allergy—use separate prep area").
4. **Advance orders** through the pipeline:
   - **Preparing → Ready**: When the dish is plated and ready for pickup.
   - **Ready → Served**: When floor staff delivers the order to the guest's table.
   - **Served → Completed**: After the guest finishes and the table is cleared or the order is closed out.
5. **Filter the board** using the status filter buttons above the columns to focus on a specific stage (e.g., show only "Preparing" orders during a rush).
6. Handle **high-priority orders** (marked with a red badge) first—these may include VIP guests or orders with long wait times.

### Closing Shift

1. Ensure all orders are in **Completed** status. Any remaining open orders must be resolved or escalated to the shift manager.
2. Review the day's order count displayed at the top of the board for the handover notes.
3. Log out from the staff menu.

---

## Feature Details

### STF-REST-001: Kanban Order Board

The board is divided into five drag-and-drop columns representing the order lifecycle.

**Steps to use:**
1. Navigate to `/staff/restaurant`. The board loads automatically via `GET /restaurant/staff/orders`.
2. Each column header shows the count of orders in that status.
3. Order cards display: order number, table number, item count, time since order was placed, and a priority badge if applicable.
4. Drag a card from one column to the next to advance its status. The system calls `PATCH /restaurant/staff/orders/:id/status` with the new status.
5. The board auto-refreshes via WebSocket—no manual reload needed.

**Column definitions:**
- **Pending**: Order received from POS or guest app, not yet acknowledged by kitchen.
- **Preparing**: Kitchen is actively working on the order.
- **Ready**: Food is prepared and waiting for pickup/delivery to table.
- **Served**: Floor staff has delivered the order to the guest.
- **Completed**: Order is finished—payment received or cleared.

### STF-REST-002: Order Status Filters

**Steps to use:**
1. Above the Kanban columns, locate the filter bar with buttons: **All**, **Pending**, **Preparing**, **Ready**, **Served**, **Completed**.
2. Click a filter button to show only orders matching that status. The board view updates instantly.
3. Click **All** to return to the full five-column view.
4. Filters persist during the session but reset on page reload.

### STF-REST-003: Advance Order Status

**Steps to use:**
1. **Drag-and-drop method**: Click and hold an order card, drag it to the next column, and release. A confirmation toast appears ("Order #142 moved to Preparing").
2. **Button method**: Click the order card to open the detail modal, then click the **Advance Status** button at the bottom. The order moves to the next logical status.
3. The API call (`PATCH /restaurant/staff/orders/:id/status`) fires immediately. If the network request fails, the card snaps back to its original column and an error toast appears.
4. Orders can only move forward—you cannot drag an order backward (e.g., from Ready back to Preparing). If a correction is needed, contact the shift manager.

### STF-REST-004: Order Detail Modal

**Steps to use:**
1. Click any order card on the Kanban board. The detail modal slides in from the right.
2. The modal displays:
   - **Order number** and **timestamp** (when the order was placed)
   - **Table number** and **guest count**
   - **Ordered items** with quantities, individual prices, and modifiers (e.g., "Burger × 2 — no pickles, add bacon")
   - **Special instructions** highlighted in a yellow box (e.g., "Gluten-free bun required")
   - **Order total** and **payment status**
3. Use the **Advance Status** button at the bottom to move the order forward without returning to the board.
4. Click **Close** or press `Esc` to dismiss the modal.

### STF-REST-005: Real-time New Order Notifications

**Steps to use:**
1. When a new order is placed (from POS, guest app, or kiosk), the WebSocket connection pushes the order to the board instantly.
2. A **notification sound** plays (configurable in staff settings) and a toast appears: "New order #153 — Table 7".
3. The new order card appears in the **Pending** column with a brief highlight animation.
4. If the WebSocket connection drops, the status indicator in the top-right turns red. The board falls back to polling every 10 seconds. Reconnection is automatic.

### STF-REST-006: Special Instructions Display

**Steps to use:**
1. Special instructions are visible in two places:
   - **On the order card**: A small icon (⚠️) indicates special instructions exist. Hover to see a preview.
   - **In the detail modal**: Full text displayed in a highlighted yellow box below the item list.
2. Common instruction types: dietary restrictions, allergies, cooking preferences, and guest notes.
3. Always read special instructions before starting food preparation to avoid allergen incidents.

---

## Real-time Updates (WebSocket)

| Event | Trigger | Effect on Board |
|---|---|---|
| `order:new` | Guest places an order | New card appears in Pending column |
| `order:status_changed` | Another staff member advances an order | Card moves to updated column |
| `order:cancelled` | Manager cancels an order | Card removed from board with strikethrough animation |
| `order:modified` | Guest modifies order (before preparing) | Card content updates, blue flash highlight |

**Connection management:**
- WebSocket connects automatically on page load via Socket.IO to the Express backend at `localhost:3005`.
- Connection status indicator: 🟢 Connected | 🔴 Disconnected.
- On disconnect, the system attempts reconnection every 5 seconds with exponential backoff.

---

## Escalation Points

| Situation | Action | Escalate To |
|---|---|---|
| Order stuck in Pending > 10 minutes | Check kitchen availability | Shift Manager |
| Allergen concern in special instructions | Verify with guest before preparing | Floor Manager + Guest |
| System shows disconnected (red dot) | Refresh page; check WiFi | IT Support / Manager |
| Order needs to be reversed to previous status | Cannot be done by staff | Shift Manager (manual override) |
| Guest complaint about order | Note details in order modal | Floor Manager |
| Bulk orders during rush hour | Prioritize by timestamp | Kitchen Lead |

---

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Board is empty / no orders showing | Filter is active or API error | Click "All" filter; refresh page; check network |
| Drag-and-drop not working | Touch device compatibility or browser issue | Use the "Advance Status" button in the detail modal instead |
| Notification sound not playing | Browser has blocked audio autoplay | Click anywhere on the page first to enable audio; check browser permissions |
| Order card snaps back after dragging | Network request failed | Check connection indicator; try again; refresh if persistent |
| Duplicate order cards appearing | WebSocket delivered event twice | Refresh the page; duplicates will resolve |
| Detail modal not opening | JavaScript error | Clear browser cache and reload |

---

## Related Modules

- [Snack Bar Operations](snack-bar-operations.md) — Similar order management for snack bar
- [Bookings & Navigation](bookings-management.md) — Staff dashboard and navigation context
- [Manager: Approvals & Oversight](../manager/approvals-oversight.md) — Escalation path for order issues

---

## Feature Coverage Summary

| Category | Count | Percentage |
|---|---|---|
| Implemented | 6 | 100% |
| Partially Implemented | 0 | 0% |
| Not Implemented | 0 | 0% |
| **Total** | **6** | **100%** |
