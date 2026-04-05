# 6. Staff Operations

## Objective

Test the complete staff workflow for each engine type, processing the customer transactions created in the previous phase.

---

## 6.1 Restaurant Staff — Order Lifecycle

**Staff Account:** restaurant.staff@v2resort.com / staff123  
**Order:** Maria Rossi's Bruschetta order #R-260309-9466917q6o

### Portal Overview

| Feature | Details |
|---------|---------|
| Dashboard | Staff Portal with quick action tiles for all modules |
| URL | `/staff/restaurant` |
| Interface | Dark-themed Kanban board |
| Columns | Pending → Confirmed → Preparing → Ready → Served |

### Lifecycle Flow

| Step | Action | Status Change | Toast Message | Status |
|------|--------|---------------|---------------|--------|
| 1 | Found order in Pending column | — | — | ✅ |
| 2 | Clicked "Confirm" | Pending → Confirmed | "Successfully updated" | ✅ |
| 3 | Clicked "Start Preparing" | Confirmed → Preparing | "Successfully updated" | ✅ |
| 4 | Clicked "Mark Ready" | Preparing → Ready | "Successfully updated" | ✅ |
| 5 | Clicked "Mark Served" | Ready → Served | "Successfully updated" | ✅ |
| 6 | Clicked "Complete" | Served → Completed | "Successfully updated" | ✅ |

### Checklist

- [x] Login as restaurant.staff@v2resort.com
- [x] Staff Portal dashboard loads with quick action tiles
- [x] Kitchen Orders Kanban board at `/staff/restaurant`
- [x] 5 columns visible (Pending, Confirmed, Preparing, Ready, Served)
- [x] Maria Rossi's order found in Pending column
- [x] Order card shows: customer name, item count, amount, time
- [x] Confirm action: Pending → Confirmed
- [x] Start Preparing action: Confirmed → Preparing
- [x] Mark Ready action: Preparing → Ready
- [x] Mark Served action: Ready → Served
- [x] Complete action: Served → Completed
- [x] Toast notifications for each status change
- [x] Order moves between columns correctly

---

## 6.2 Chalets Staff — Booking Check-in/Check-out

**Staff Account:** chalet.staff@v2resort.com / staff123  
**Booking:** Family Suite #C-260309-125

### Portal Overview

| Feature | Details |
|---------|---------|
| Dashboard | Chalets Management page |
| URL | `/staff/chalets` |
| Stats | Today's Check-ins, Check-outs, Currently Occupied |

### Permission Model

> **Important:** Staff accounts are module-scoped. The `restaurant.staff` account CANNOT access chalet booking APIs. A separate `chalet.staff` account was required.

### Lifecycle Flow

| Step | Action | Status Change | Counter Change | Status |
|------|--------|---------------|----------------|--------|
| 1 | Found booking via "All Bookings" search | — | — | ✅ |
| 2 | Clicked "Confirm" | Pending → Confirmed | — | ✅ |
| 3 | Clicked "Check In" | Confirmed → Checked In | Currently Occupied: 0→1 | ✅ |
| 4 | Clicked "Check Out" | Checked In → Checked Out | Currently Occupied: 1→0 | ✅ |

### Booking Detail Dialog

| Field | Value | Status |
|-------|-------|--------|
| Booking Number | #C-260309-125 | ✅ |
| Unit | Family Suite | ✅ |
| Dates | 3/14/2026 – 3/18/2026 (4 Nights) | ✅ |
| Guests | 4 | ✅ |
| Base Rate | $720 | ✅ |
| Add-ons | $110 | ✅ |
| Total | $830.00 | ✅ |

### Checklist

- [x] Login as chalet.staff@v2resort.com
- [x] Chalets Management page at `/staff/chalets`
- [x] Dashboard stats visible (Check-ins, Check-outs, Currently Occupied)
- [x] "All Bookings" view accessible
- [x] Search functionality works (searched "C-260309")
- [x] Booking found with correct details
- [x] Booking detail dialog shows all information
- [x] Confirm booking: Pending → Confirmed
- [x] Check In: Confirmed → Checked In, Currently Occupied increments
- [x] Check Out: Checked In → Checked Out, Currently Occupied decrements
- [x] Toast notifications for each action

---

## 6.3 Pool Staff — Ticket Validation

**Staff Account:** pool.staff@v2resort.com / staff123  
**Ticket:** #P-260309-6070

### Portal Overview

| Feature | Details |
|---------|---------|
| Dashboard | Pool Management page |
| URL | `/staff/pool` |
| Features | Customer Lookup, Pool, Ticket Scanner |
| Stats | Total Today, Pending, In Pool Now, Completed |

### Lifecycle Flow

| Step | Action | Status Change | Stats Change | Status |
|------|--------|---------------|--------------|--------|
| 1 | Found ticket P-260309-6070 | Status: Valid | Total Today: 1 | ✅ |
| 2 | Clicked "Record Entry" | Valid → Active | In Pool Now: 0→1/100 | ✅ |
| 3 | Clicked "Record Exit" | Active → Used | In Pool Now: 1→0, Completed: 0→1 | ✅ |

### Entry/Exit Details

| Event | Time | Toast Message |
|-------|------|---------------|
| Entry | 15:41:10 | "🏊 Entry recorded!" |
| Exit | 15:41:30 | "👋 Exit recorded!" |
| Duration | ~20 seconds (test) | Displayed: "In: 15:41:10 → Out: 15:41:30" |

### Checklist

- [x] Login as pool.staff@v2resort.com
- [x] Pool Management page at `/staff/pool`
- [x] Sidebar shows Customer Lookup, Pool, Ticket Scanner
- [x] Dashboard stats visible (Total Today, Pending, In Pool Now, Completed)
- [x] Ticket P-260309-6070 found with "Valid" status
- [x] "Record Entry" button visible and functional
- [x] Entry recorded: status Active, In Pool Now increments
- [x] "Record Exit" button visible and functional
- [x] Exit recorded: status Used, In Pool Now decrements, Completed increments
- [x] Entry/exit times displayed correctly
- [x] Toast notifications with emojis (🏊, 👋)

---

## Issues Found During Staff Testing

| Issue | Severity | Description |
|-------|----------|-------------|
| Permission model | Info | Staff accounts are strictly module-scoped — restaurant.staff cannot access chalet APIs |
| Dialog close issues | Low | Booking detail dialogs wouldn't close with X button or Escape key |
| i18n missing keys | Low | Untranslated keys: `staff.chalets.checkInAction`, `staff.statuses.checked_in`, etc. |
