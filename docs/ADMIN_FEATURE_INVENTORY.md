# V2 Resort — Admin Feature Inventory (Micro-Level)

> **Generated from source code analysis of all 52+ admin page.tsx files**  
> **Format:** FEATURE / PAGE / FILE / TYPE / DESCRIPTION

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Orders](#2-orders)
3. [Inventory](#3-inventory)
4. [Housekeeping](#4-housekeeping)
5. [Channels](#5-channels)
6. [Properties](#6-properties)
7. [Reviews](#7-reviews)
8. [Audit Log](#8-audit-log)
9. [Customizations](#9-customizations)
10. [Terminology](#10-terminology)
11. [Loyalty](#11-loyalty)
12. [Gift Cards](#12-gift-cards)
13. [Coupons](#13-coupons)
14. [Users — Customers/Staff/Admins](#14-users--customerstaffadmins)
15. [Users — Roles](#15-users--roles)
16. [Users — Create](#16-users--create)
17. [Users — Detail/Edit](#17-users--detailedit)
18. [Users — Live](#18-users--live)
19. [Modules](#19-modules)
20. [Module Builder](#20-module-builder)
21. [Kiosk](#21-kiosk)
22. [Reports — Overview](#22-reports--overview)
23. [Reports — Analytics](#23-reports--analytics)
24. [Reports — Scheduled](#24-reports--scheduled)
25. [Settings — General](#25-settings--general)
26. [Settings — Appearance](#26-settings--appearance)
27. [Settings — Navbar](#27-settings--navbar)
28. [Settings — Homepage](#28-settings--homepage)
29. [Settings — Footer](#29-settings--footer)
30. [Settings — Translations](#30-settings--translations)
31. [Settings — Payments](#31-settings--payments)
32. [Settings — Tax](#32-settings--tax)
33. [Settings — Notifications](#33-settings--notifications)
34. [Settings — Backups](#34-settings--backups)
35. [Integrations — QuickBooks](#35-integrations--quickbooks)
36. [Dynamic Module Dashboard](#36-dynamic-module-dashboard)
37. [Dynamic Module — Menu](#37-dynamic-module--menu)
38. [Dynamic Module — Categories](#38-dynamic-module--categories)
39. [Dynamic Module — Orders](#39-dynamic-module--orders)
40. [Dynamic Module — Tables](#40-dynamic-module--tables)
41. [Dynamic Module — Reservations](#41-dynamic-module--reservations)
42. [Dynamic Module — Waitlist](#42-dynamic-module--waitlist)
43. [Dynamic Module — Modifiers](#43-dynamic-module--modifiers)
44. [Dynamic Module — Bookings](#44-dynamic-module--bookings)
45. [Dynamic Module — Pricing](#45-dynamic-module--pricing)
46. [Dynamic Module — Add-ons](#46-dynamic-module--addons)
47. [Dynamic Module — Sessions](#47-dynamic-module--sessions)
48. [Dynamic Module — Tickets](#48-dynamic-module--tickets)
49. [Dynamic Module — Capacity](#49-dynamic-module--capacity)

---

## 1. Dashboard
**Page:** `/admin` | **File:** `src/app/admin/page.tsx` (571 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 1 | Refresh Dashboard | Button | Refetches all dashboard stats, orders, and chart data |
| 2 | View Online Users Stat | Display | Real-time count of online users via socket |
| 3 | View Total Orders Stat | Display | Today's order count |
| 4 | View Revenue Stat | Display | Today's total revenue |
| 5 | View Bookings Stat | Display | Today's total bookings |
| 6 | Revenue-by-Module Bar Chart | Visualization | Bar chart showing revenue breakdown per active module |
| 7 | View Recent Orders List | Display | Last 5 orders with order number, customer, amount, status |
| 8 | Click Order to Navigate | Navigation | Clicking a recent order navigates to `/admin/orders` |
| 9 | Quick Action Links | Navigation | Dynamic quick-action cards for each active module (menu, bookings, sessions) |
| 10 | Navigate to Reports | Navigation | Quick link to `/admin/reports` |
| 11 | Real-time Socket Updates | Background | Socket listeners for `stats:update`, `order:new`, `order:updated` |

---

## 2. Orders
**Page:** `/admin/orders` | **File:** `src/app/admin/orders/page.tsx` (578 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 12 | Refresh Orders | Button | Refetches all order data |
| 13 | Search Orders | Input | Search by order ID, customer name, or table number |
| 14 | Filter by Source | Dropdown | Filter orders by source: All / Restaurant / Snack Bar |
| 15 | Filter by Status | Buttons | 7-option status filter: All / Pending / Confirmed / Preparing / Ready / Delivered / Cancelled |
| 16 | Confirm Order | Button | Progress pending order to confirmed |
| 17 | Start Preparing Order | Button | Progress confirmed order to preparing |
| 18 | Mark Order Ready | Button | Progress preparing order to ready |
| 19 | Deliver Order | Button | Progress ready order to delivered |
| 20 | Complete Order | Button | Progress delivered order to completed |
| 21 | View Order Detail | Modal | Click order to open detail modal showing items, customer, notes, timestamps |
| 22 | Real-time Order Updates | Background | Socket listeners for new/updated orders with toast notifications |

---

## 3. Inventory
**Page:** `/admin/inventory` | **File:** `src/app/admin/inventory/page.tsx` (1321 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 23 | Tabs: Items / Transactions / Alerts | Navigation | Three-tab layout for inventory management |
| 24 | Search Items | Input | Search inventory items by name |
| 25 | Filter by Category | Dropdown | Filter items by category |
| 26 | Filter by Stock Status | Dropdown | Filter by stock status (in-stock, low, out-of-stock) |
| 27 | Create Inventory Item | Modal | 13-field form: name, nameAr, sku, category, unit, stockQuantity, minStock, maxStock, costPerUnit, supplier, location, notes, moduleId |
| 28 | Edit Inventory Item | Modal | Edit all 13 fields of an existing item |
| 29 | Delete Inventory Item | Action | Delete item with confirmation |
| 30 | Create Category | Modal | Create new inventory category |
| 31 | Delete Category | Action | Delete category with confirmation |
| 32 | Record Transaction | Modal | Record stock transaction: type (purchase/sale/adjustment/waste/transfer), quantity, notes |
| 33 | Export Items to CSV | Button | Export inventory items list as CSV file |
| 34 | Resolve Alert | Action | Mark a stock alert as resolved |
| 35 | View 4 Stat Cards | Display | Total items, low stock count, out of stock count, total value |

---

## 4. Housekeeping
**Page:** `/admin/housekeeping` | **File:** `src/app/admin/housekeeping/page.tsx` (717 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 36 | Tabs: Tasks / Staff / Stats | Navigation | Three-tab layout |
| 37 | Refresh Housekeeping | Button | Refetch all task/staff data |
| 38 | Create New Task | Modal | Form: chaletId, taskTypeId, priority, notes, assignedTo, scheduledFor |
| 39 | Assign Task | Modal | Assign/reassign a task to a staff member |
| 40 | Start Task | Button | Update task status from pending to in-progress |
| 41 | Complete Task | Button | Update task status from in-progress to completed |
| 42 | Filter by Status | Dropdown | Filter tasks by status |
| 43 | Filter by Priority | Dropdown | Filter tasks by priority |
| 44 | Filter by Assigned Staff | Dropdown | Filter tasks by assigned staff member |
| 45 | View 6 Stat Cards | Display | Total tasks, pending, in-progress, completed, staff on duty, avg completion time |

---

## 5. Channels
**Page:** `/admin/channels` | **File:** `src/app/admin/channels/page.tsx` (577 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 46 | Sync All Channels | Button | Trigger synchronization for all connected channels |
| 47 | Connect Channel | Modal | Connect new channel: type, hotelId, apiKey |
| 48 | Sync Individual Channel | Button | Trigger sync for a single channel |
| 49 | Channel Settings | Button | Open settings for a connected channel |
| 50 | Retry Channel Connection | Button | Retry a failed channel connection |
| 51 | Disconnect Channel | Button | Disconnect a channel with confirmation |
| 52 | View 4 Stat Cards | Display | Total channels, connected, syncing, errors |

---

## 6. Properties
**Page:** `/admin/properties` | **File:** `src/app/admin/properties/page.tsx` (632 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 53 | Add Property | Modal | Create new property with details |
| 54 | Search Properties | Input | Search properties by name |
| 55 | Switch to Property | Button | Switch active property context |
| 56 | Property Settings | Button | Open settings for a specific property |
| 57 | More Options | Dropdown | Additional property management options |
| 58 | View 6 Stat Cards | Display | Property statistics |

---

## 7. Reviews
**Page:** `/admin/reviews` | **File:** `src/app/admin/reviews/page.tsx` (435 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 59 | Refresh Reviews | Button | Refetch all review data |
| 60 | Search Reviews | Input | Search reviews by text content |
| 61 | Filter by Status | Dropdown | Filter: All / Pending / Approved |
| 62 | Filter by Service | Dropdown | Filter: General / Restaurant / Chalets / Pool / Snack Bar |
| 63 | Approve Review | Button | Approve a pending review |
| 64 | Reject Review | Button | Reject a pending review |
| 65 | Delete Review | Button | Delete a review |
| 66 | View 3 Stat Cards | Display | Total reviews, pending, average rating |

---

## 8. Audit Log
**Page:** `/admin/audit` | **File:** `src/app/admin/audit/page.tsx` (468 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 67 | Refresh Audit Log | Button | Refetch audit log entries |
| 68 | Search Audit Log | Input | Search audit entries |
| 69 | Filter by Action | Dropdown | Filter by action type (dynamically populated) |
| 70 | Filter by Entity | Dropdown | Filter by entity type (dynamically populated) |
| 71 | View Log Detail | Modal | Click entry to open detail modal with full metadata |
| 72 | View 4 Stat Cards | Display | Total events, today's events, unique users, unique entities |
| 73 | Timeline View | Display | Chronological timeline of audit events |

---

## 9. Customizations
**Page:** `/admin/customizations` | **File:** `src/app/admin/customizations/page.tsx` (1271 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 74 | Tabs: Groups / Metrics / Migration | Navigation | Three-tab layout |
| 75 | Refresh Customizations | Button | Refetch all customization data |
| 76 | Create New Group | Button | Create new customization option group |
| 77 | Search Groups | Input | Search customization groups |
| 78 | Create Option Group | Modal | Create group with name and settings |
| 79 | Update Option Group | Modal | Edit existing group |
| 80 | Delete Option Group | Action | Delete group with confirmation |
| 81 | Create Customization Option | Modal | Add option within a group |
| 82 | Update Customization Option | Modal | Edit existing option |
| 83 | Delete Customization Option | Action | Delete option with confirmation |
| 84 | Expand/Collapse Group | Toggle | Expand or collapse group to show/hide options |
| 85 | Migrate Data | Action | Run data migration for customization options |
| 86 | View 4 Stat Cards | Display | Total groups, total options, active groups, migration status |

---

## 10. Terminology
**Page:** `/admin/terminology` | **File:** `src/app/admin/terminology/page.tsx` (~130 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 87 | Select Business Type | Dropdown | Choose: Resort / Hotel / Restaurant / Villa — preloads default terms |
| 88 | Override Term: Room | Input | Custom label for "Room" concept |
| 89 | Override Term: Booking | Input | Custom label for "Booking" concept |
| 90 | Override Term: Guest | Input | Custom label for "Guest" concept |
| 91 | Override Term: Check-in | Input | Custom label for "Check-in" concept |
| 92 | Override Term: Check-out | Input | Custom label for "Check-out" concept |
| 93 | Override Term: Property | Input | Custom label for "Property" concept |
| 94 | Reset Terminology | Button | Reset all terms to business-type defaults |
| 95 | Save Terminology Changes | Button | Persist custom term overrides |

---

## 11. Loyalty
**Page:** `/admin/loyalty` | **File:** `src/app/admin/loyalty/page.tsx` (890 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 96 | Tabs: Overview / Members / Tiers / Settings | Navigation | Four-tab layout |
| 97 | Refresh Loyalty Data | Button | Refetch loyalty stats, members, tiers |
| 98 | Search Members | Input | Search loyalty members by name |
| 99 | Adjust Points | Modal | Manually adjust a member's loyalty points (add/subtract with reason) |
| 100 | Add Tier | Modal | Create new loyalty tier with name, min points, benefits |
| 101 | Edit Tier | Modal | Edit existing loyalty tier |
| 102 | Delete Tier | Action | Delete loyalty tier with confirmation |
| 103 | Edit Points Per Currency | Input | Set how many points earned per currency unit spent |
| 104 | Edit Points Per Booking | Input | Set bonus points per booking |
| 105 | Edit Referral Bonus | Input | Set points awarded for referrals |
| 106 | Edit Minimum Redeem | Input | Set minimum points needed to redeem |
| 107 | Save Loyalty Settings | Button | Persist loyalty program configuration |
| 108 | Members Data Table | Display | Table of loyalty members with points, tier, joined date |

---

## 12. Gift Cards
**Page:** `/admin/giftcards` | **File:** `src/app/admin/giftcards/page.tsx` (~600 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 109 | Tabs: Cards / Templates | Navigation | Two-tab layout |
| 110 | Refresh Gift Cards | Button | Refetch gift card data |
| 111 | Create Gift Card | Modal | Form: value, recipientName, recipientEmail, message |
| 112 | Search Gift Cards | Input | Search by code, recipient, or value |
| 113 | Filter by Status | Dropdown | Filter: All / Active / Redeemed / Expired / Disabled |
| 114 | Toggle Code Visibility | Button | Show/hide gift card code |
| 115 | Copy Gift Card Code | Button | Copy code to clipboard |
| 116 | Disable Gift Card | Button | Deactivate an active gift card |
| 117 | View Gift Card Details | Modal | Open full detail view of a gift card |
| 118 | Browse Templates | Grid | View available gift card design templates |
| 119 | View 5 Stat Cards | Display | Total cards, active, redeemed, expired, total value |

---

## 13. Coupons
**Page:** `/admin/coupons` | **File:** `src/app/admin/coupons/page.tsx` (666 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 120 | Refresh Coupons | Button | Refetch coupon data |
| 121 | Create Coupon | Modal | 14+ field form: code, discountType, discountValue, minOrder, maxUses, validFrom/To, applicableModules, description, etc. |
| 122 | Generate Random Code | Button | Auto-generate a coupon code |
| 123 | Edit Coupon | Modal | Edit all coupon fields |
| 124 | Delete Coupon | Action | Delete coupon with confirmation |
| 125 | Toggle Active/Inactive | Switch | Enable or disable a coupon |
| 126 | Copy Coupon Code | Button | Copy coupon code to clipboard |
| 127 | Search Coupons | Input | Search coupons by code or description |
| 128 | Filter by Status | Dropdown | Filter by active/inactive/expired |
| 129 | View 4 Stat Cards | Display | Total coupons, active, total uses, total discount given |

---

## 14. Users — Customers/Staff/Admins
**Pages:** `/admin/users/customers`, `/admin/users/staff`, `/admin/users/admins`  
**Files:** `customers/page.tsx`, `staff/page.tsx`, `admins/page.tsx` → delegate to `components/admin/users/UserList.tsx`

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 130 | Search Users | Input | Search by name, email across user list |
| 131 | View User Data Table | Display | Table: name, status (online badge), roles, joined date, actions |
| 132 | Create User | Navigation | Button navigates to `/admin/users/create` |
| 133 | Edit User | Navigation | Button navigates to `/admin/users/[id]` |
| 134 | Delete User | Action | Delete user with confirmation dialog |
| 135 | Click Row to View Detail | Navigation | Click user row to navigate to user detail page |
| 136 | Auto-Refresh Online Status | Background | Polls every 10 seconds for online/offline status |

---

## 15. Users — Roles
**Page:** `/admin/users/roles` | **File:** `src/app/admin/users/roles/page.tsx` (~300 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 137 | Create Role | Modal | Create new role with name and description |
| 138 | Edit Permissions | Modal | Open permissions editor for a role |
| 139 | Toggle Permission Checkbox | Checkbox | Grant/revoke individual permissions (grouped by module) |
| 140 | Save Permissions | Button | Persist permission changes for a role |
| 141 | Cancel Permissions Edit | Button | Discard permission changes |
| 142 | Login/Retry Auth | Button | Handle authentication errors |

---

## 16. Users — Create
**Page:** `/admin/users/create` | **File:** `src/app/admin/users/create/page.tsx` (~250 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 143 | Back Button | Navigation | Navigate back to users list |
| 144 | Email Input | Input | Email with format validation |
| 145 | Full Name Input | Input | User's full name |
| 146 | Phone Input | Input | Phone number |
| 147 | Role Selector | Dropdown | 11 roles: customer, admin, super_admin, restaurant_staff/admin, chalet_staff/admin, pool_staff/admin, snack_bar_staff/admin |
| 148 | Password Input | Input | Password with complexity validation |
| 149 | Confirm Password Input | Input | Must match password |
| 150 | Create User Submit | Button | Submit form to create new user |
| 151 | Cancel | Button | Discard form and navigate back |

---

## 17. Users — Detail/Edit
**Page:** `/admin/users/[id]` | **File:** `src/app/admin/users/[id]/page.tsx` (434 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 152 | Back to Users | Navigation | Navigate back to users list |
| 153 | Edit Profile | Modal | Edit full_name, email, phone, is_active toggle |
| 154 | Toggle User Active | Switch | Enable/disable user account |
| 155 | Manage Roles | Modal | Checkbox list of all available roles to assign/remove |
| 156 | View Permission Overrides | Section | Per-module permission list with current state |
| 157 | Grant Permission Override | Button | Grant a specific permission to this user |
| 158 | Deny Permission Override | Button | Deny a specific permission for this user |
| 159 | Reset Permission Override | Button | Remove override, revert to role-based permission |
| 160 | Save Permission Overrides | Button | Persist all permission override changes |
| 161 | View Account Status | Display | Show active/inactive and online/offline status |

---

## 18. Users — Live
**Page:** `/admin/users/live` | **File:** `src/app/admin/users/live/page.tsx` (498 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 162 | Auto-Refresh Toggle | Switch | Enable/disable automatic real-time refresh |
| 163 | Manual Refresh | Button | Manually refresh live user data |
| 164 | View 5 Stat Cards | Display | Unique users, admins online, staff online, customers online, guests online |
| 165 | View Users Grouped by Role | Display | Users displayed in role-based groups |
| 166 | Real-time Socket Updates | Background | Socket listeners for user connect/disconnect events |

---

## 19. Modules
**Page:** `/admin/modules` | **File:** `src/app/admin/modules/page.tsx` (464 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 167 | Add Module | Modal | Create new module with all configuration |
| 168 | Module Name Input | Input | Module display name |
| 169 | Auto-Generated Slug | Display | Slug auto-generated from name |
| 170 | Module Description | Textarea | Module description text |
| 171 | Template Type Selector | Dropdown | Choose: menu_service / multi_day_booking / session_access |
| 172 | Is Active Checkbox | Checkbox | Toggle module active status |
| 173 | Show in Main Checkbox | Checkbox | Toggle module visibility on main site |
| 174 | Header Color Picker | Color Input | Set module header color |
| 175 | Accent Color Picker | Color Input | Set module accent color |
| 176 | Show in Nav Toggle | Switch | Toggle module in navigation bar |
| 177 | Icon Field | Input | Set module icon identifier |
| 178 | Edit Module | Modal | Edit all module fields |
| 179 | Open Module Builder | Navigation | Navigate to `/admin/modules/builder/[id]` |
| 180 | Delete Module | Action | Type "Delete" to confirm, force delete option |

---

## 20. Module Builder
**Page:** `/admin/modules/builder/[id]` | **File:** `src/app/admin/modules/builder/[id]/page.tsx` (~180 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 181 | Back to Modules | Navigation | Navigate back to modules list |
| 182 | Undo | Button | Undo last builder action |
| 183 | Redo | Button | Redo last undone action |
| 184 | Zoom In | Button | Increase canvas zoom (up to 150%) |
| 185 | Zoom Out | Button | Decrease canvas zoom (down to 50%) |
| 186 | Toggle Preview/Edit Mode | Button | Switch between visual preview and edit mode |
| 187 | Save Layout | Button | Persist current layout configuration |
| 188 | Drag & Drop Components | Interaction | DndContext for drag-and-drop component placement |
| 189 | Builder Canvas | Panel | Main visual editing area |
| 190 | Property Panel | Panel | Right sidebar for selected component properties |
| 191 | Component Toolbar | Panel | Bottom bar with draggable component types |
| 192 | Dynamic Module Renderer | Preview | Live preview of module page rendering |

---

## 21. Kiosk
**Page:** `/admin/kiosk` | **File:** `src/app/admin/kiosk/page.tsx` (~400 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 193 | Add Kiosk | Modal | Create kiosk: name, location, capabilities checkboxes |
| 194 | Capability: ID Scanner | Checkbox | Toggle ID scanner capability |
| 195 | Capability: Card Reader | Checkbox | Toggle card reader capability |
| 196 | Capability: Key Encoder | Checkbox | Toggle key encoder capability |
| 197 | Capability: Receipt Printer | Checkbox | Toggle receipt printer capability |
| 198 | Capability: Camera | Checkbox | Toggle camera capability |
| 199 | Kiosk Settings | Button | Open settings for a specific kiosk |
| 200 | Toggle Maintenance Mode | Switch | Enable/disable kiosk maintenance mode |
| 201 | Deactivate Kiosk | Button | Deactivate a kiosk device |
| 202 | Refill Keys | Button | Add 50 keys to kiosk key stock |
| 203 | View 4 Stat Cards | Display | Total kiosks, online, maintenance, errors |
| 204 | Kiosk Data Table | Display | Table of all kiosks with status and capabilities |

---

## 22. Reports — Overview
**Page:** `/admin/reports` | **File:** `src/app/admin/reports/page.tsx` (681 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 205 | Refresh Reports | Button | Refetch all report data |
| 206 | Select Date Range | Dropdown | Choose: Week / Month / Year |
| 207 | Export Restaurant CSV | Button | Export restaurant report as CSV |
| 208 | Export Chalets CSV | Button | Export chalets report as CSV |
| 209 | Export Pool CSV | Button | Export pool report as CSV |
| 210 | Export Snack Bar CSV | Button | Export snack bar report as CSV |
| 211 | Export Users CSV | Button | Export users report as CSV |
| 212 | Navigate to Scheduled Reports | Link | Link to `/admin/reports/scheduled` |
| 213 | View 4 KPI Cards | Display | Revenue, orders, bookings, users (with % change) |
| 214 | Revenue by Service Breakdown | Display | Revenue split by service module |
| 215 | Revenue by Month Chart | Visualization | Monthly revenue line/bar chart |
| 216 | Top Items List | Display | Best-selling items ranking |

---

## 23. Reports — Analytics
**Page:** `/admin/reports/analytics` | **File:** `src/app/admin/reports/analytics/page.tsx` (743 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 217 | Select Start Date | Date Input | Start date for analytics range |
| 218 | Select End Date | Date Input | End date for analytics range |
| 219 | Refresh Analytics | Button | Refetch analytics data |
| 220 | Export All (CSV) | Button | Export all analytics as CSV |
| 221 | Export All (JSON) | Button | Export all analytics as JSON |
| 222 | Executive Overview Category | Card | Click to load executive summary data |
| 223 | Sales & Revenue Category | Card | Click to load sales/revenue analytics |
| 224 | Order Flow Category | Card | Click to load order flow analytics |
| 225 | Customer Intelligence Category | Card | Click to load customer analytics |
| 226 | Product & Menu Performance Category | Card | Click to load product analytics |
| 227 | Payments & Finance Category | Card | Click to load payment analytics |
| 228 | Capacity & Utilization Category | Card | Click to load capacity analytics |
| 229 | Staff & System Performance Category | Card | Click to load staff analytics |
| 230 | Comparative & Trends Category | Card | Click to load trend analytics |
| 231 | Export & Audit Category | Card | Click to load export/audit analytics |
| 232 | View 4 Executive KPI Cards | Display | Top-level KPI metrics |

---

## 24. Reports — Scheduled
**Page:** `/admin/reports/scheduled` | **File:** `src/app/admin/reports/scheduled/page.tsx` (506 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 233 | Back to Reports | Link | Navigate back to reports overview |
| 234 | Create Scheduled Report | Modal | Form: name, schedule (daily/weekly/monthly), reportType (overview/revenue/occupancy/orders/customers), recipients email list, enabled toggle |
| 235 | Edit Scheduled Report | Modal | Edit all report schedule fields |
| 236 | Delete Scheduled Report | Action | Delete with confirmation |
| 237 | Toggle Report Enabled | Switch | Enable/disable a scheduled report |
| 238 | Send Report Now | Button | Immediately trigger report generation and email |
| 239 | View Report Status Badges | Display | Status badges showing last run status |

---

## 25. Settings — General
**Page:** `/admin/settings` | **File:** `src/app/admin/settings/page.tsx` (622 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 240 | Tab: General | Navigation | Resort name, tagline, description fields |
| 241 | Edit Resort Name | Input | Site/resort display name |
| 242 | Edit Tagline | Input | Short tagline text |
| 243 | Edit Description | Textarea | Full site description |
| 244 | Tab: Modules | Navigation | Per-module display name and hours configuration |
| 245 | Edit Module Display Name | Input | Override display name per active module |
| 246 | Edit Module Hours | Input | Operating hours per module |
| 247 | Tab: Contact | Navigation | Contact information section |
| 248 | Edit Phone | Input | Business phone number |
| 249 | Edit Email | Input | Business email address |
| 250 | Edit Address | Input | Business physical address |
| 251 | Tab: Business Hours | Navigation | Operating hours section |
| 252 | Edit Pool Hours | Input | Pool opening/closing hours |
| 253 | Edit Restaurant Hours | Input | Restaurant opening/closing hours |
| 254 | Edit Reception Hours | Input | Reception desk hours |
| 255 | Tab: Legal Pages | Navigation | Legal text section |
| 256 | Edit Privacy Policy | Textarea | Privacy policy content |
| 257 | Edit Terms of Service | Textarea | Terms of service content |
| 258 | Edit Refund Policy | Textarea | Refund policy content |
| 259 | Dynamic Module Tabs | Navigation | Extra tabs for multi_day_booking and session_access modules with module-specific settings |
| 260 | Save General Settings | Button | Persist all settings changes |

---

## 26. Settings — Appearance
**Page:** `/admin/settings/appearance` | **File:** `src/app/admin/settings/appearance/page.tsx` (585 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 261 | Save Appearance | Button | Persist all appearance changes |
| 262 | Reset Appearance | Button | Reset to default appearance settings |
| 263 | Select Preset Theme | Grid | Click to apply a preset resort theme (grid with checkmark) |
| 264 | Toggle Custom Colors | Switch | Enable/disable custom color overrides |
| 265 | Primary Color Picker | Color Input | Set primary brand color |
| 266 | Secondary Color Picker | Color Input | Set secondary brand color |
| 267 | Accent Color Picker | Color Input | Set accent color |
| 268 | Background Color Picker | Color Input | Set page background color |
| 269 | Surface Color Picker | Color Input | Set card/surface color |
| 270 | Text Color Picker | Color Input | Set primary text color |
| 271 | Text Muted Color Picker | Color Input | Set secondary/muted text color |
| 272 | Toggle Weather Widget | Switch | Enable/disable weather widget on frontend |
| 273 | Weather Location Input | Input | Set location for weather data |
| 274 | Weather Effect Selector | Dropdown | Choose effect: Auto / Sunny / Cloudy / Rainy / Snowy |
| 275 | Toggle Animations | Switch | Enable/disable page animations |
| 276 | Toggle Reduced Motion | Switch | Enable/disable reduced motion mode |
| 277 | Toggle Sound Effects | Switch | Enable/disable UI sound effects |

---

## 27. Settings — Navbar
**Page:** `/admin/settings/navbar` | **File:** `src/app/admin/settings/navbar/page.tsx` (~400 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 278 | Save Navbar Settings | Button | Persist navbar configuration |
| 279 | Toggle Sticky Header | Switch | Enable/disable sticky header behavior |
| 280 | Toggle Cart Button | Switch | Show/hide cart button in navbar |
| 281 | Toggle Language Switcher | Switch | Show/hide language switcher |
| 282 | Toggle Theme Toggle | Switch | Show/hide dark/light mode toggle |
| 283 | Toggle Currency Switcher | Switch | Show/hide currency switcher |
| 284 | Toggle User Preferences | Switch | Show/hide user preferences button |
| 285 | Add Navigation Link | Button | Add new link to navbar |
| 286 | Set Link Type | Dropdown | Choose: Internal / External / Module |
| 287 | Set Link Label | Input | Display text for nav link |
| 288 | Set Link URL/Path | Input | Destination URL or path |
| 289 | Select Link Icon | Dropdown | Choose icon for nav link |
| 290 | Delete Navigation Link | Button | Remove a nav link |
| 291 | Select Module for Link | Dropdown | Choose module when link type is "module" |

---

## 28. Settings — Homepage
**Page:** `/admin/settings/homepage` | **File:** `src/app/admin/settings/homepage/page.tsx` (565 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 292 | Save Homepage | Button | Persist homepage configuration |
| 293 | Tab: Hero Slides | Navigation | Manage hero slider content |
| 294 | Add Hero Slide | Button | Create new hero slide |
| 295 | Toggle Slide Enabled | Switch | Enable/disable individual slide |
| 296 | Delete Hero Slide | Button | Remove a hero slide |
| 297 | Edit Slide Title | Input | Hero slide main title |
| 298 | Edit Slide Subtitle | Input | Hero slide subtitle text |
| 299 | Edit Slide Button Text | Input | CTA button label |
| 300 | Edit Slide Button Link | Input | CTA button destination URL |
| 301 | Upload Slide Image | File Upload | Upload hero background image with preview |
| 302 | Remove Slide Image | Button | Remove uploaded image |
| 303 | Tab: Sections | Navigation | Manage homepage sections |
| 304 | Toggle Section Enabled | Switch | Enable/disable: services, features, stats, testimonials, map, cta |
| 305 | Move Section Up | Button | Reorder section upward |
| 306 | Move Section Down | Button | Reorder section downward |
| 307 | Tab: CTA | Navigation | Manage call-to-action block |
| 308 | Edit CTA Title | Input | CTA section title |
| 309 | Edit CTA Subtitle | Input | CTA section subtitle |
| 310 | Edit CTA Button Text | Input | CTA button label |
| 311 | Edit CTA Button Link | Input | CTA button destination |

---

## 29. Settings — Footer
**Page:** `/admin/settings/footer` | **File:** `src/app/admin/settings/footer/page.tsx` (461 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 312 | Save Footer Settings | Button | Persist footer configuration |
| 313 | Edit Logo Text | Input | Footer logo/brand text |
| 314 | Toggle Show Icon | Switch | Show/hide footer brand icon |
| 315 | Edit Description | Textarea | Footer description paragraph |
| 316 | Toggle Show Address | Switch | Show/hide physical address |
| 317 | Toggle Show Phone | Switch | Show/hide phone number |
| 318 | Toggle Show Email | Switch | Show/hide email address |
| 319 | Edit Copyright Text | Input | Copyright notice text |
| 320 | Add Social Media Link | Button | Add new social media profile |
| 321 | Select Social Platform | Dropdown | Choose: Facebook / Instagram / Twitter / YouTube / TikTok |
| 322 | Edit Social URL | Input | Social media profile URL |
| 323 | Remove Social Link | Button | Delete a social media link |
| 324 | Add Footer Column | Button | Add new navigation column to footer |
| 325 | Edit Column Title | Input | Footer column heading |
| 326 | Add Link to Column | Button | Add navigation link within a column |
| 327 | Remove Link from Column | Button | Delete a link from a column |
| 328 | Remove Footer Column | Button | Delete entire footer column |

---

## 30. Settings — Translations
**Page:** `/admin/settings/translations` | **File:** `src/app/admin/settings/translations/page.tsx` (1074 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 329 | Tab: Database Translations | Navigation | Manage database record translations |
| 330 | View Translation Stats | Display | Overview of missing translations per table |
| 331 | Expand Table Group | Toggle | Expand table to see missing translation entries |
| 332 | Inline Edit Translation | Input | Edit translation value inline |
| 333 | Auto-Translate Single Item | Button | AI auto-translate one database record |
| 334 | Batch Auto-Translate Table | Button | AI auto-translate all missing entries for a table |
| 335 | Tab: Frontend Translations | Navigation | Manage UI string translations |
| 336 | View Frontend Comparison Stats | Display | Statistics comparing translation completeness |
| 337 | Expand Language Group | Toggle | See missing keys for a language |
| 338 | Edit Frontend Translation Key | Input | Edit UI translation string |
| 339 | Tab: Languages | Navigation | Manage available languages |
| 340 | Add New Language | Modal | Form: code, name, nativeName, direction (LTR/RTL), isActive |
| 341 | Delete Language | Action | Delete language (cannot delete English) |
| 342 | Toggle Language Active | Switch | Enable/disable a language |
| 343 | Refresh All Translations | Button | Refetch all translation data |
| 344 | View Service Status | Display | Translation service connectivity status |

---

## 31. Settings — Payments
**Page:** `/admin/settings/payments` | **File:** `src/app/admin/settings/payments/page.tsx` (637 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 345 | Tab: Transactions | Navigation | View payment transactions |
| 346 | Refresh Transactions | Button | Refetch transaction data |
| 347 | Export Transactions CSV | Button | Export transactions as CSV |
| 348 | Search Transactions | Input | Search by transaction ID or reference |
| 349 | Filter by Status | Dropdown | Filter: All / Completed / Pending / Failed / Refunded |
| 350 | Filter by Method | Dropdown | Filter: All / Cash / Card / Stripe |
| 351 | Toggle Sort Order | Button | Switch ascending/descending sort |
| 352 | Issue Refund | Button | Refund a transaction (with reason prompt) |
| 353 | View 4 Transaction Stats | Display | Total today, completed, pending, transaction count |
| 354 | Real-time Payment Updates | Background | Socket listener for payment events |
| 355 | Tab: Settings | Navigation | Payment provider configuration |
| 356 | Stripe Public Key | Input | Set Stripe publishable key |
| 357 | Stripe Secret Key | Input | Set Stripe secret key |
| 358 | Stripe Webhook Secret | Input | Set Stripe webhook secret |
| 359 | Stripe Mode | Dropdown | Toggle: Test / Live |
| 360 | Currency Selector | Dropdown | Set default currency |
| 361 | Save Payment Settings | Button | Persist Stripe provider configuration |

---

## 32. Settings — Tax
**Page:** `/admin/settings/tax` | **File:** `src/app/admin/settings/tax/page.tsx` (707 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 362 | Save Tax Settings | Button | Persist all tax configuration changes |
| 363 | Edit Tax Display Name | Input | Customize the label for tax (e.g., "VAT", "Sales Tax") |
| 364 | Edit Tax Registration Number | Input | Business tax registration/ID number |
| 365 | Edit Default Tax Rate | Input | Default tax percentage |
| 366 | Select Rounding Method | Dropdown | Choose: Round / Floor / Ceil |
| 367 | Select Decimal Places | Dropdown | Choose: 0 / 2 / 3 |
| 368 | Toggle Tax Included in Price | Checkbox | Whether prices include tax or tax is additive |
| 369 | Toggle Show Tax Breakdown | Checkbox | Whether to display itemized tax on receipts |
| 370 | Add Tax Rate | Modal | Create rate: name, rate%, type (vat/sales/service/tourism/custom), appliesTo (multi-select categories), isDefault, isCompound, description |
| 371 | Edit Tax Rate | Modal | Edit all tax rate fields |
| 372 | Delete Tax Rate | Action | Delete rate (cannot delete default rate) |
| 373 | Set Rate as Default | Button | Designate a tax rate as the default |

---

## 33. Settings — Notifications
**Page:** `/admin/settings/notifications` | **File:** `src/app/admin/settings/notifications/page.tsx` (1174 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 374 | Tab: Notifications | Navigation | View and manage notifications |
| 375 | Filter by Type | Dropdown | Filter: info / success / warning / error |
| 376 | Filter by Priority | Dropdown | Filter: low / normal / high / urgent |
| 377 | Select Multiple Notifications | Checkbox | Multi-select for bulk operations |
| 378 | Bulk Delete Notifications | Button | Delete all selected notifications |
| 379 | Create Notification | Modal | Form: title, message, type (info/success/warning/error), targetType (all/customer/staff/admin), priority (low/normal/high/urgent), scheduledFor datetime, action buttons (label/url/style) |
| 380 | Tab: Templates | Navigation | Manage notification templates |
| 381 | Create Template | Modal | Form: name, title, message, type, target, priority, variables, actions, isActive |
| 382 | Edit Template | Modal | Edit all template fields |
| 383 | Delete Template | Action | Delete notification template |
| 384 | Send from Template | Button | Create notification pre-filled from template |
| 385 | Use Template | Button | Start new notification using template as base |
| 386 | Tab: Broadcasts | Navigation | View broadcast notifications |
| 387 | Send Broadcast Now | Button | Immediately send a broadcast notification |
| 388 | Delete Broadcast | Action | Delete a broadcast entry |
| 389 | Real-time Notification Updates | Background | Socket listener for notification events |

---

## 34. Settings — Backups
**Page:** `/admin/settings/backups` | **File:** `src/app/admin/settings/backups/page.tsx` (529 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 390 | Create Backup | Button | Trigger manual database backup creation |
| 391 | Restore from File | Button | Upload JSON backup file to restore database |
| 392 | File Upload Validation | Logic | Validates .json extension, max 100MB, backup structure |
| 393 | Confirm Restore | Modal | Confirmation dialog before executing restore |
| 394 | Cancel Restore | Button | Cancel pending restore operation |
| 395 | Download Backup | Button | Download a backup file as JSON |
| 396 | Delete Backup | Action | Delete a backup with confirmation |
| 397 | Refresh Backup List | Button | Refetch list of available backups |
| 398 | View System Health Card | Display | Total backups count, storage usage, retention policy info |
| 399 | View Backup History Table | Display | Table: filename, metadata (size, date, creator), status, actions |

---

## 35. Integrations — QuickBooks
**Page:** `/admin/integrations/quickbooks` | **File:** `src/app/admin/integrations/quickbooks/page.tsx` (~480 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 400 | Connect QuickBooks | Button | Initiate OAuth flow to connect QuickBooks Online account |
| 401 | Disconnect QuickBooks | Button | Disconnect linked QuickBooks account with confirmation |
| 402 | Sync Now | Button | Trigger manual sync of sales data to QuickBooks |
| 403 | Toggle Automatic Daily Sync | Switch | Enable/disable automatic daily sync at 2 AM |
| 404 | Tab: Overview | Navigation | View what gets synced and sync schedule |
| 405 | Tab: Account Mappings | Navigation | Map V2 revenue categories to QuickBooks accounts |
| 406 | Save Account Mapping | Dropdown | Select QuickBooks account for each V2 category |
| 407 | Tab: Sync History | Navigation | View past sync operations |
| 408 | View Connection Status | Display | Connected company name, ID, last sync time, last sync status |
| 409 | View Sync History Table | Display | List of sync operations with records processed/synced/failed |

---

## 36. Dynamic Module Dashboard
**Page:** `/admin/[slug]` | **File:** `src/app/admin/[slug]/page.tsx` (~160 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 410 | Navigate to Menu (menu_service) | Card Link | Link to `[slug]/menu` |
| 411 | Navigate to Categories (menu_service) | Card Link | Link to `[slug]/categories` |
| 412 | Navigate to Orders (menu_service) | Card Link | Link to `[slug]/orders` |
| 413 | Navigate to Bookings (multi_day_booking) | Card Link | Link to `[slug]/bookings` |
| 414 | Navigate to Pricing (multi_day_booking) | Card Link | Link to `[slug]/pricing` |
| 415 | Navigate to Sessions (session_access) | Card Link | Link to `[slug]/sessions` |
| 416 | Navigate to Tickets (session_access) | Card Link | Link to `[slug]/tickets` |

---

## 37. Dynamic Module — Menu
**Page:** `/admin/[slug]/menu` | **File:** `src/app/admin/[slug]/menu/page.tsx` (913 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 417 | Refresh Menu | Button | Refetch all menu items, categories, ingredients, customization groups |
| 418 | Add Menu Item | Modal | Create item with tabs: Details (name, nameAr, description, descriptionAr, price, category, isAvailable, isFeatured, isVegetarian, isSpicy, preparationTime), Recipe (link ingredients with quantity/unit), Customizations (select customization groups) |
| 419 | Edit Menu Item | Modal | Edit all menu item fields |
| 420 | Delete Menu Item | Action | Delete with confirmation |
| 421 | Toggle Item Availability | Button | Show/hide menu item (toggle is_available) |
| 422 | Search Menu Items | Input | Search by item name |
| 423 | Filter by Category | Dropdown | Filter items by category |
| 424 | Add Recipe Ingredient | Button | Add ingredient row to recipe (select ingredient, set quantity) |
| 425 | Update Recipe Ingredient | Input | Change ingredient ID, quantity, or unit |
| 426 | Remove Recipe Ingredient | Button | Remove ingredient from recipe |
| 427 | Toggle Customization Group | Checkbox | Link/unlink customization groups to item |
| 428 | View 4 Stat Cards | Display | Total items, available, featured, categories count |

---

## 38. Dynamic Module — Categories
**Page:** `/admin/[slug]/categories` | **File:** `src/app/admin/[slug]/categories/page.tsx` (~280 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 429 | Refresh Categories | Button | Refetch category data |
| 430 | Add Category | Modal | Create: name, description |
| 431 | Edit Category | Modal | Edit name and description |
| 432 | Delete Category | Action | Delete with confirmation |
| 433 | View Category Cards | Display | Grid of categories with item count |

---

## 39. Dynamic Module — Orders
**Page:** `/admin/[slug]/orders` | **File:** `src/app/admin/[slug]/orders/page.tsx` (~320 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 434 | Refresh Orders | Button | Refetch module-specific orders |
| 435 | Search Orders | Input | Search by order # or customer name |
| 436 | Filter by Status | Buttons | 7-option: All/Pending/Confirmed/Preparing/Ready/Delivered/Cancelled |
| 437 | Accept Order | Button | Confirm a pending order |
| 438 | Reject Order | Button | Cancel a pending order |
| 439 | Start Preparing | Button | Progress confirmed → preparing |
| 440 | Mark Ready | Button | Progress preparing → ready |
| 441 | Mark Delivered | Button | Progress ready → delivered |
| 442 | Real-time Order Updates | Background | Socket for `order:new` and `order:updated` per module |
| 443 | View Order Cards | Display | Grid of order cards with items, total, status, customer |

---

## 40. Dynamic Module — Tables
**Page:** `/admin/[slug]/tables` | **File:** `src/app/admin/[slug]/tables/page.tsx` (~350 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 444 | Refresh Tables | Button | Refetch table data |
| 445 | Add Table | Modal | Create: tableNumber, capacity, location |
| 446 | Edit Table | Modal | Edit table number, capacity, location |
| 447 | Delete Table | Action | Delete with confirmation |
| 448 | Toggle Table Availability | Button | Mark occupied ↔ available |
| 449 | View QR Code | Modal | Display table's QR code for customer ordering |
| 450 | Download QR Code | Button | Download QR code image file |
| 451 | View Table Grid | Display | Visual grid of all tables with status colors (green=available, red=occupied) |
| 452 | View Available/Occupied Count | Display | Summary of available vs occupied tables |

---

## 41. Dynamic Module — Reservations
**Page:** `/admin/[slug]/reservations` | **File:** `src/app/admin/[slug]/reservations/page.tsx` (446 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 453 | New Reservation | Button | Create new reservation (placeholder) |
| 454 | Navigate Date Forward | Button | Move to next day |
| 455 | Navigate Date Backward | Button | Move to previous day |
| 456 | Select Date | Date Input | Pick specific date for reservation view |
| 457 | Jump to Today | Button | Reset date to current day |
| 458 | Search Reservations | Input | Search by guest name, phone, or email |
| 459 | Filter by Status | Dropdown | Filter: All/Pending/Confirmed/Seated/Completed/Cancelled/No Show |
| 460 | Confirm Reservation | Button | Confirm a pending reservation |
| 461 | Seat Guest | Button | Open assign table modal |
| 462 | Complete Reservation | Button | Mark seated reservation as completed |
| 463 | Mark No Show | Button | Mark reservation as no-show |
| 464 | Cancel Reservation | Button | Cancel a reservation |
| 465 | Assign Table | Modal | Select available table for reservation, filtered by capacity |
| 466 | View 5 Stat Cards | Display | Total, pending, confirmed, seated, total guests |
| 467 | Timeline View | Display | Reservations grouped by time slot |

---

## 42. Dynamic Module — Waitlist
**Page:** `/admin/[slug]/waitlist` | **File:** `src/app/admin/[slug]/waitlist/page.tsx` (487 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 468 | Refresh Waitlist | Button | Manual refetch (also auto-refreshes every 15s) |
| 469 | Add Guest to Waitlist | Modal | Form: name, phone, partySize, notes |
| 470 | Notify Guest (SMS) | Button | Send notification to waiting guest |
| 471 | Seat Guest | Button | Update status to seated |
| 472 | Mark No Show | Button | Update status to no-show |
| 473 | Remove from Waitlist | Button | Delete entry with confirmation |
| 474 | Update Waitlist Status | Action | Change status: waiting → notified → seated |
| 475 | Search Waitlist | Input | Search by guest name or phone |
| 476 | View 4 Stat Cards | Display | Waiting count, notified count, seated today, average wait time |
| 477 | View Active Waitlist | Display | Ordered list of waiting/notified guests with position numbers |
| 478 | View Recent Activity | Display | Last 10 seated/cancelled/no-show entries |
| 479 | Auto-Refresh | Background | Auto-refetch every 15 seconds |

---

## 43. Dynamic Module — Modifiers
**Page:** `/admin/[slug]/modifiers` | **File:** `src/app/admin/[slug]/modifiers/page.tsx` (714 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 480 | Refresh Modifiers | Button | Refetch modifier groups and options |
| 481 | Create Modifier Group | Modal | Form: name, nameAr, description, minSelections, maxSelections, isRequired, allowMultipleSame |
| 482 | Edit Modifier Group | Modal | Edit all group fields |
| 483 | Delete Modifier Group | Action | Delete group and all options with confirmation |
| 484 | Create Modifier Option | Modal | Form: name, nameAr, priceAdjustment, modifierType (add/remove/swap), maxQuantity, isDefault, isAvailable |
| 485 | Edit Modifier Option | Modal | Edit all option fields |
| 486 | Delete Modifier Option | Action | Delete option with confirmation |
| 487 | Search Modifier Groups | Input | Search groups by name (EN/AR) |
| 488 | Expand/Collapse Group | Toggle | Show/hide options within a group |
| 489 | View Group Metadata | Display | Required badge, selection range, option count per group |

---

## 44. Dynamic Module — Bookings
**Page:** `/admin/[slug]/bookings` | **File:** `src/app/admin/[slug]/bookings/page.tsx` (424 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 490 | Refresh Bookings | Button | Refetch booking data |
| 491 | Search Bookings | Input | Search by booking number, unit name, or guest name |
| 492 | Filter by Status | Dropdown | Filter: All/Pending/Confirmed/Checked In/Checked Out/Cancelled |
| 493 | Confirm Booking | Button | Confirm a pending booking |
| 494 | Cancel Booking | Button | Cancel a booking |
| 495 | Check In | Button | Progress confirmed → checked_in |
| 496 | Check Out | Button | Progress checked_in → checked_out |
| 497 | View Booking Detail | Modal | Full detail modal: booking number, unit, status, dates, guest info, email, phone, notes, amount |
| 498 | View 4 Stat Cards | Display | Total, confirmed, checked in, pending |
| 499 | Bookings Data Table | Display | Table: booking#, unit, guest, dates, amount, status, actions |

---

## 45. Dynamic Module — Pricing
**Page:** `/admin/[slug]/pricing` | **File:** `src/app/admin/[slug]/pricing/page.tsx` (~400 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 500 | Refresh Pricing Rules | Button | Refetch pricing data |
| 501 | Add Pricing Rule | Modal | Form: name, basePrice, weekendPrice, holidayPrice, perGuestPrice, minGuests, maxGuests, startDate, endDate, isActive |
| 502 | Edit Pricing Rule | Modal | Edit all pricing rule fields |
| 503 | Delete Pricing Rule | Action | Delete with confirmation |
| 504 | Toggle Rule Active | Checkbox | Enable/disable pricing rule |
| 505 | View 2 Stat Cards | Display | Total rules, active rules |
| 506 | View Pricing Rule Cards | Display | Cards showing base/weekend/holiday prices and guest range |

---

## 46. Dynamic Module — Add-ons
**Page:** `/admin/[slug]/addons` | **File:** `src/app/admin/[slug]/addons/page.tsx` (~400 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 507 | Refresh Add-ons | Button | Refetch add-on data |
| 508 | Add Add-on | Modal | Form: name, nameAr, description, price, isAvailable, imageUrl |
| 509 | Edit Add-on | Modal | Edit all add-on fields |
| 510 | Delete Add-on | Action | Delete with confirmation |
| 511 | Toggle Add-on Availability | Button | Show/hide add-on (toggle is_available) |
| 512 | View 2 Stat Cards | Display | Total add-ons, available add-ons |
| 513 | View Add-on Cards | Display | Grid of add-on cards with price, status, actions |

---

## 47. Dynamic Module — Sessions
**Page:** `/admin/[slug]/sessions` | **File:** `src/app/admin/[slug]/sessions/page.tsx` (480 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 514 | Refresh Sessions | Button | Refetch session data |
| 515 | Add Session | Modal | Form: name, nameAr, startTime, endTime, adultPrice, childPrice, maxCapacity, isActive, dayOfWeek (multi-select M-S) |
| 516 | Edit Session | Modal | Edit all session fields |
| 517 | Delete Session | Action | Delete with confirmation |
| 518 | Toggle Session Active | Button | Activate/deactivate session |
| 519 | Toggle Day of Week | Checkbox | Enable/disable session for specific days |
| 520 | Search Sessions | Input | Search by session name |
| 521 | View 4 Stat Cards | Display | Total sessions, active, total capacity, average price |
| 522 | View Session Cards | Display | Cards with time range, adult/child prices, capacity bar, day-of-week indicators |

---

## 48. Dynamic Module — Tickets
**Page:** `/admin/[slug]/tickets` | **File:** `src/app/admin/[slug]/tickets/page.tsx` (~350 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 523 | Refresh Tickets | Button | Refetch today's ticket data |
| 524 | Filter by Status | Dropdown | Filter: All/Pending/Active/Valid/Used/Expired/Cancelled |
| 525 | Filter by Type | Dropdown | Filter: All/Adult/Child/Family/VIP |
| 526 | Cancel Ticket | Button | Cancel an active ticket |
| 527 | View Ticket Detail | Modal | Full detail: ticket number, type, status, customer, price, QR code image |
| 528 | View 4 Stat Cards | Display | Total tickets, active, pending, today's revenue |
| 529 | Tickets Data Table | Display | Table: ticket#, type badge, customer, price, status, actions |

---

## 49. Dynamic Module — Capacity
**Page:** `/admin/[slug]/capacity` | **File:** `src/app/admin/[slug]/capacity/page.tsx` (~230 lines)

| # | FEATURE | TYPE | DESCRIPTION |
|---|---------|------|-------------|
| 530 | Refresh Capacity | Button | Refetch capacity settings |
| 531 | Edit Maximum Capacity | Input | Set total allowed guests |
| 532 | Edit Current Capacity | Input | Manually adjust current guest count |
| 533 | Edit Warning Threshold | Input | Set percentage at which warning appears (0-100) |
| 534 | Reset Current Count | Button | Reset current capacity to zero |
| 535 | Save Capacity Settings | Button | Persist capacity configuration |
| 536 | View Current Status | Display | Occupancy bar with percentage, color-coded (green/yellow/red) |
| 537 | View Status Badge | Display | Available / Near Capacity / Full badge |

---

## Summary Statistics

| Category | Features |
|----------|----------|
| Dashboard | 11 |
| Orders (global) | 11 |
| Inventory | 13 |
| Housekeeping | 10 |
| Channels | 7 |
| Properties | 6 |
| Reviews | 8 |
| Audit Log | 7 |
| Customizations | 13 |
| Terminology | 9 |
| Loyalty | 13 |
| Gift Cards | 11 |
| Coupons | 10 |
| Users (lists) | 7 |
| Users (roles) | 6 |
| Users (create) | 9 |
| Users (detail) | 10 |
| Users (live) | 5 |
| Modules | 14 |
| Module Builder | 12 |
| Kiosk | 12 |
| Reports (overview) | 12 |
| Reports (analytics) | 16 |
| Reports (scheduled) | 7 |
| Settings (general) | 21 |
| Settings (appearance) | 17 |
| Settings (navbar) | 14 |
| Settings (homepage) | 20 |
| Settings (footer) | 17 |
| Settings (translations) | 16 |
| Settings (payments) | 17 |
| Settings (tax) | 12 |
| Settings (notifications) | 16 |
| Settings (backups) | 10 |
| Integrations (QuickBooks) | 10 |
| Dynamic Module Dashboard | 7 |
| Dynamic Module — Menu | 12 |
| Dynamic Module — Categories | 5 |
| Dynamic Module — Orders | 10 |
| Dynamic Module — Tables | 9 |
| Dynamic Module — Reservations | 15 |
| Dynamic Module — Waitlist | 12 |
| Dynamic Module — Modifiers | 10 |
| Dynamic Module — Bookings | 10 |
| Dynamic Module — Pricing | 7 |
| Dynamic Module — Add-ons | 7 |
| Dynamic Module — Sessions | 9 |
| Dynamic Module — Tickets | 7 |
| Dynamic Module — Capacity | 8 |
| **TOTAL** | **537** |

---

> **Note:** Each dynamic module page (37–49) is instantiated **per active module**. A resort with 4 active modules (Restaurant, Snack Bar, Chalets, Pool) would multiply those features across all instances, yielding a significantly higher effective feature count.
