# System Cascades
## Documentation of All Action → Effect Chains

**Version:** 1.0  
**Created:** February 2, 2026  
**Purpose:** Document every cascade triggered by actions, including immediate, delayed, and eventual effects

---

## 📋 Cascade Documentation Format

Each cascade includes:
- **Trigger:** The action that initiates the cascade
- **Immediate Effects:** Changes within 100ms (same request)
- **Delayed Effects:** Changes within seconds/minutes (background jobs, webhooks)
- **Eventual Effects:** Changes over hours/days (reports, analytics, scheduled tasks)
- **Dependent Actors:** Other actors affected by this cascade

---

# 🔄 BOOKING CASCADES

## C001: New Booking Created
**Trigger:** `POST /api/v1/bookings` (Guest creates reservation)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Booking record created | `bookings` | New row with status='confirmed' |
| Room inventory deducted | `room_inventory` | Available count reduced |
| Folio created | `folios` | Guest folio initialized |
| Guest record updated | `guests` | Last booking date updated |
| Loyalty points calculated | `loyalty_transactions` | Points earned for stay value |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Confirmation email sent | Email Service | Booking webhook |
| SMS confirmation | SMS Gateway | If opted in |
| Channel manager sync | Channel Manager | Availability update |
| Revenue forecast updated | Revenue Service | Booking data |
| Pre-arrival journey started | Marketing Automation | Journey trigger |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Occupancy report updated | Reporting | Nightly rollup |
| Demand forecast adjusted | Revenue AI | Daily recalculation |
| Pickup report reflects booking | Revenue | Real-time + nightly |
| Guest segment membership | Marketing | Daily recalculation |
| Rate recommendations updated | Revenue AI | On significant changes |

### Dependent Actors Affected
- **Housekeeping Manager:** Room appears in future arrivals
- **Front Desk:** Guest appears in arrivals list
- **Revenue Manager:** Occupancy metrics change
- **Marketing:** Guest enters pre-arrival journey

---

## C002: Booking Cancelled
**Trigger:** `DELETE /api/v1/bookings/:id` (Guest cancels)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Booking status changed | `bookings` | status='cancelled' |
| Room inventory restored | `room_inventory` | Available count increased |
| Cancellation fee calculated | `folio_charges` | Per policy |
| Refund initiated | `payments` | If applicable |
| Loyalty points reversed | `loyalty_transactions` | Pending points removed |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Cancellation email sent | Email Service | Booking webhook |
| Refund processed | Payment Gateway | Async |
| Channel manager sync | Channel Manager | Availability restored |
| Waitlist processing | Booking Service | Dates now available |
| Revenue alert (high-value) | Revenue Manager | If booking > threshold |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Cancellation report | Reporting | Nightly |
| Revenue forecast adjusted | Revenue AI | Daily |
| Lead time analysis | Analytics | Weekly |
| Cancellation rate metrics | Dashboard | Real-time |

### Dependent Actors Affected
- **Housekeeping Manager:** Room removed from arrivals
- **Revenue Manager:** Cancellation alert, rate adjustment opportunity
- **Guest on Waitlist:** May receive availability notification
- **Marketing:** Exit journey triggered, win-back campaign

---

## C003: Guest Check-In
**Trigger:** `POST /api/v1/checkin` (Front desk processes check-in)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Booking status changed | `bookings` | status='checked_in' |
| Room status changed | `rooms` | status='occupied' |
| Guest status updated | `guests` | in_house=true |
| Key record created | `room_keys` | Key issued |
| Folio activated | `folios` | Ready for charges |
| Deposit captured | `payments` | If not prepaid |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Welcome email/SMS | Messaging | Check-in webhook |
| Digital key push | Mobile App | If mobile check-in |
| IoT room setup | IoT Service | Temperature, lights |
| Housekeeping notified | Housekeeping | If room was dirty |
| VIP alert | Front Office | If loyalty tier >= Gold |
| Loyalty welcome back | Loyalty Service | Returning guest |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Occupancy calculated | Reporting | Real-time |
| In-house guest report | Reporting | Continuous |
| Arrival time analytics | Analytics | Daily aggregation |
| Check-in efficiency metrics | Dashboard | Real-time |

### Dependent Actors Affected
- **Housekeeping:** Room marked occupied, no cleaning needed
- **Concierge:** Guest appears in in-house list
- **F&B Staff:** Guest can charge to room
- **Spa Staff:** Guest can book services
- **Pool Lifeguard:** Guest has pool access

---

## C004: Guest Check-Out
**Trigger:** `POST /api/v1/checkout` (Guest checks out)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Booking status changed | `bookings` | status='checked_out' |
| Room status changed | `rooms` | status='dirty' |
| Guest status updated | `guests` | in_house=false, last_checkout |
| Folio finalized | `folios` | status='closed' |
| Final payment processed | `payments` | Balance settled |
| Keys deactivated | `room_keys` | All keys for room |
| Loyalty points finalized | `loyalty_transactions` | Stay points awarded |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Checkout email with invoice | Email Service | Checkout webhook |
| Housekeeping task created | Housekeeping | Room now dirty |
| Room added to cleaning queue | Housekeeping | Priority by next arrival |
| Post-stay survey scheduled | Marketing | 24hr delay |
| Review request scheduled | Reviews | 48hr delay |
| Loyalty tier recalculation | Loyalty | Points threshold check |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Revenue reported | Finance | Daily close |
| Guest history updated | CRM | Immediate |
| Segment membership recalculated | Marketing | Daily |
| LTV updated | Analytics | Weekly |
| Departure report | Reporting | Daily |

### Dependent Actors Affected
- **Housekeeping Staff:** Room appears in cleaning queue (priority based on next arrival)
- **Front Desk:** Room can be reassigned once clean
- **Revenue Manager:** Room available for sale
- **Marketing:** Guest enters post-stay journey

---

# 🍽️ F&B CASCADES

## C005: Restaurant Order Placed
**Trigger:** `POST /api/v1/restaurants/:id/orders` (Guest places order)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Order created | `orders` | status='pending' |
| Order items created | `order_items` | Each menu item |
| Kitchen ticket generated | KDS | Sent via WebSocket |
| Server assigned | `orders` | server_id set |
| Table status updated | `tables` | status='ordering' |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Kitchen display updated | KDS | WebSocket real-time |
| Prep time calculated | Kitchen AI | Order complexity |
| Inventory reserved | Inventory | Ingredient check |
| Low stock alert | Inventory | If threshold reached |
| Allergen verification | Kitchen | If dietary flags |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Revenue tracked | F&B Reporting | Real-time |
| Popular items updated | Analytics | Hourly |
| Kitchen performance | Reporting | Daily |
| Food cost calculated | Finance | Daily |
| Menu optimization data | Analytics | Weekly |

### Dependent Actors Affected
- **Kitchen Staff:** Order appears on KDS, must prepare
- **Server:** Responsible for delivery
- **F&B Manager:** Live order count visible
- **Inventory Manager:** Stock levels change

---

## C006: Order Item Ready
**Trigger:** `POST /api/v1/kitchen/orders/:id/items/:itemId/ready` (Kitchen marks item ready)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Item status changed | `order_items` | status='ready' |
| Ready timestamp set | `order_items` | ready_at |
| Prep time recorded | `order_items` | Duration calculated |

### Delayed Effects (< 1 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Server notified | WebSocket | Real-time push |
| Expo display updated | KDS | Item in expo queue |
| Wait time updated | Analytics | Continuous |
| Quality timer started | Kitchen | Max wait before quality degrades |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Prep time analytics | Reporting | Daily aggregation |
| Kitchen efficiency | Dashboard | Real-time |
| Staff performance | HR Reporting | Weekly |

### Dependent Actors Affected
- **Server:** Must collect and deliver item
- **Guest:** Waiting for food
- **Expo Staff:** Item ready for plating/delivery

---

## C007: Order Completed & Paid
**Trigger:** `POST /api/v1/restaurants/orders/:id/pay` (Payment processed)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Order status changed | `orders` | status='completed' |
| Payment recorded | `payments` | Payment method, amount |
| Tip recorded | `tips` | If included |
| Table status changed | `tables` | status='clearing' |
| Revenue recognized | `daily_revenue` | Real-time tracking |
| Loyalty points earned | `loyalty_transactions` | F&B spend points |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Receipt emailed | Email | If email on file |
| Table turnover calculated | Analytics | Duration tracked |
| Server stats updated | Staff Performance | Revenue, tips |
| Inventory consumed | Inventory | Final deduction |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Daily F&B revenue | Reporting | Nightly close |
| Cover count | Analytics | Continuous |
| Average check size | Dashboard | Real-time |
| Server performance | HR | Weekly |
| Menu profitability | Finance | Weekly |

### Dependent Actors Affected
- **Server:** Table available for next guest
- **Busser:** Table needs clearing
- **Host:** Table entering turnover
- **F&B Manager:** Revenue metrics update

---

## C008: Menu Item Marked Unavailable (86'd)
**Trigger:** `POST /api/v1/menu/items/:id/unavailable` (Kitchen 86s item)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Item status changed | `menu_items` | available=false |
| Live menu updated | Menu Cache | Immediate |

### Delayed Effects (< 1 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| All servers notified | WebSocket | Broadcast |
| POS systems updated | POS | Real-time sync |
| Guest app updated | Mobile App | Push refresh |
| Room service menu updated | Room Service | Sync |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| 86 report | F&B Reporting | Daily |
| Inventory analysis | Analytics | Daily |
| Lost revenue calculation | Finance | Weekly |
| Purchasing adjustment | Procurement | Weekly |

### Dependent Actors Affected
- **All Servers:** Cannot offer item
- **Guests:** Cannot order item
- **F&B Manager:** Alert on high-value item
- **Purchasing:** Reorder triggered

---

# 🛏️ HOUSEKEEPING CASCADES

## C009: Room Cleaning Completed
**Trigger:** `POST /api/v1/housekeeping/rooms/:id/complete` (Staff marks clean)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Room status changed | `rooms` | status='clean' |
| Task completed | `housekeeping_tasks` | completed_at set |
| Cleaning time recorded | `housekeeping_tasks` | Duration calculated |
| Staff workload updated | `staff_assignments` | Room count adjusted |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Front desk notified | WebSocket | Room now available |
| Arrivals list updated | Front Desk | Room assignable |
| QA task created | Housekeeping | If QA policy enabled |
| Supervisor notified | Mobile | If VIP room |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Cleaning time analytics | Reporting | Daily |
| Staff productivity | HR | Weekly |
| Room turnaround KPI | Dashboard | Real-time |
| Supplies consumption | Inventory | Daily |

### Dependent Actors Affected
- **Front Desk:** Can assign room to arriving guest
- **Guest (arriving):** Room ready for check-in
- **Housekeeping Manager:** Workload metrics
- **Supervisor:** QA inspection queue

---

## C010: Maintenance Issue Reported
**Trigger:** `POST /api/v1/maintenance/issues` (Staff/Guest reports issue)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Issue ticket created | `maintenance_tickets` | priority based on severity |
| Room flagged | `rooms` | maintenance_flag=true |
| Assigned to engineer | `maintenance_tickets` | Based on skill/availability |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Engineer notified | Mobile Push | Assignment alert |
| Supervisor notified | WebSocket | If high priority |
| Inventory check | Inventory | Parts availability |
| Room reassignment triggered | Front Desk | If room unusable |
| Guest notification | Messaging | ETA for fix |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Maintenance report | Reporting | Daily |
| Equipment lifecycle | Assets | Continuous |
| Cost tracking | Finance | Per ticket |
| Vendor notification | Procurement | If external needed |

### Dependent Actors Affected
- **Maintenance Engineer:** New work order
- **Guest:** May need room change
- **Front Desk:** Room availability changed
- **Housekeeping Manager:** Room out of rotation

---

## C011: Room Marked Out of Order (OOO)
**Trigger:** `POST /api/v1/rooms/:id/ooo` (Manager marks OOO)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Room status changed | `rooms` | status='out_of_order' |
| Inventory removed | `room_inventory` | Not available for sale |
| Existing bookings flagged | `bookings` | Need relocation |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Channel manager sync | Channel Manager | Room unavailable |
| Revenue manager alert | Revenue | Lost inventory |
| Front desk alert | WebSocket | Affected bookings |
| Guest relocation workflow | Booking Service | Auto-triggered |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| OOO report | Reporting | Daily |
| Revenue impact | Finance | Daily |
| Repair cost tracking | Finance | Per incident |
| Availability forecast | Revenue | Adjusted |

### Dependent Actors Affected
- **Revenue Manager:** Lost room night revenue
- **Front Desk:** Relocate affected guests
- **Housekeeping:** Room removed from rotation
- **Maintenance:** Priority repair work

---

# 💳 PAYMENT CASCADES

## C012: Payment Processed
**Trigger:** `POST /api/v1/payments/process` (Any payment)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Payment record created | `payments` | Amount, method, status |
| Folio balance updated | `folios` | Balance reduced |
| Transaction logged | `payment_transactions` | Gateway response |
| Loyalty points earned | `loyalty_transactions` | If applicable |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Receipt emailed | Email | If requested |
| Gateway settlement | Payment Gateway | Batch |
| Fraud check | Fraud Service | High-value |
| Accounting entry | Finance | Auto-post |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Daily reconciliation | Finance | Nightly |
| Revenue recognition | Accounting | Daily close |
| Payment method analytics | Reporting | Weekly |
| Chargeback monitoring | Finance | Continuous |

### Dependent Actors Affected
- **Finance:** Reconciliation queue
- **Guest:** Receipt received
- **Night Auditor:** Daily close

---

## C013: Refund Issued
**Trigger:** `POST /api/v1/refunds` (Refund processed)

### Immediate Effects (< 100ms)
| Effect | Table/Service | Description |
|--------|---------------|-------------|
| Refund record created | `refunds` | Amount, reason, approval |
| Original payment linked | `payments` | refund_reference |
| Folio adjusted | `folios` | Balance updated |
| Loyalty points reversed | `loyalty_transactions` | If applicable |

### Delayed Effects (< 5 min)
| Effect | Service | Trigger |
|--------|---------|---------|
| Refund to card | Payment Gateway | Async |
| Confirmation email | Email | Refund processed |
| Manager notified | WebSocket | If over threshold |
| Accounting reversal | Finance | Auto-post |

### Eventual Effects (hours/days)
| Effect | Service | Timing |
|--------|---------|--------|
| Refund report | Reporting | Daily |
| Reason analysis | Analytics | Weekly |
| Policy impact | Revenue | Monthly |
| Staff training flags | HR | If pattern detected |

### Dependent Actors Affected
- **Guest:** Funds returned
- **Manager:** Approval/notification
- **Finance:** Reconciliation adjusted
- **Revenue Manager:** Revenue reversed

---

# 📊 ADDITIONAL CASCADES

## C014: Loyalty Tier Upgrade
**Trigger:** Automatic (Points threshold reached)

### Immediate Effects
- Tier status changed in `loyalty_members`
- Benefits unlocked in `loyalty_benefits`
- Welcome kit triggered

### Delayed Effects
- Upgrade email sent
- Front desk notified for current stay
- Special amenities scheduled

### Eventual Effects
- Segment membership updated
- Lifetime value recalculated
- Upgrade campaign success tracked

---

## C015: Rate Change Published
**Trigger:** `PUT /api/v1/rates` (Revenue manager updates)

### Immediate Effects
- Rate record updated in `rates`
- Booking engine live immediately
- Cache invalidated

### Delayed Effects
- Channel manager pushes to OTAs
- Rate parity monitoring scheduled
- Competitor rate check triggered

### Eventual Effects
- Rate optimization analytics
- Revenue impact report
- Demand elasticity analysis

---

## C016: Marketing Campaign Sent
**Trigger:** `POST /api/v1/marketing/campaigns/:id/send`

### Immediate Effects
- Campaign status = 'sending'
- Recipients queued
- Sends logged

### Delayed Effects
- Emails delivered (minutes to hours)
- Opens tracked
- Clicks tracked
- Unsubscribes processed

### Eventual Effects
- Conversion tracking (bookings)
- Revenue attribution
- Campaign ROI
- Segment performance

---

## C017: GDPR Data Export Requested
**Trigger:** `POST /api/v1/gdpr/export`

### Immediate Effects
- Request record created
- Status = 'pending'
- Verification sent

### Delayed Effects
- Data compilation started (background)
- Multiple systems queried
- Export file generated
- Download link emailed (within 30 days max)

### Eventual Effects
- Compliance audit trail
- Request volume reporting
- Process efficiency metrics

---

## C018: Inventory Threshold Breached
**Trigger:** Automatic (Stock falls below par)

### Immediate Effects
- Alert created
- Item flagged

### Delayed Effects
- Purchasing notified
- Auto-reorder (if configured)
- Menu item warning (if critical)

### Eventual Effects
- Stockout prevention
- Purchase order report
- Supplier performance

---

## C019: Group Contract Signed
**Trigger:** `POST /api/v1/groups/:id/contracts/sign`

### Immediate Effects
- Contract status = 'signed'
- Room block confirmed
- Deposit invoice generated

### Delayed Effects
- Confirmation to organizer
- Room block inventory locked
- Event coordinator assigned
- BEO creation triggered

### Eventual Effects
- Group revenue forecast
- Event calendar updated
- Staffing requirements calculated

---

## C020: Guest Review Submitted
**Trigger:** `POST /api/v1/reviews`

### Immediate Effects
- Review record created
- Overall rating captured
- Category scores stored

### Delayed Effects
- Manager notification (negative)
- Response workflow started
- NPS calculation updated

### Eventual Effects
- Review aggregation (OTAs)
- Reputation score
- Staff recognition (positive mentions)
- Training needs (negative patterns)

---

# 📊 CASCADE SUMMARY

| Category | Cascade Count | Key Triggers |
|----------|---------------|--------------|
| Booking | 4 | Create, Cancel, Check-in, Check-out |
| F&B | 4 | Order, Item Ready, Payment, 86 |
| Housekeeping | 3 | Clean Complete, Maintenance, OOO |
| Payment | 2 | Process, Refund |
| Other | 7 | Loyalty, Rates, Marketing, GDPR, Inventory, Groups, Reviews |
| **TOTAL** | **20** | **Core Cascades Documented** |

---

## 🔗 Cascade Dependency Graph

```
Guest Creates Booking (C001)
├── Inventory Updated
│   └── Channel Manager Sync
│       └── OTA Availability Updated
├── Revenue Forecast Updated
│   └── Rate Recommendations
│       └── Dynamic Pricing Adjustment (C015)
├── Loyalty Points Calculated
│   └── Tier Check
│       └── Potential Upgrade (C014)
└── Pre-Arrival Journey Started
    └── Marketing Campaign (C016)
        └── Conversion Tracking
            └── Revenue Attribution

Guest Checks Out (C004)
├── Housekeeping Task Created
│   └── Room Cleaned (C009)
│       └── Room Available for Sale
│           └── Arrivals List Updated
├── Post-Stay Journey Started
│   └── Review Request
│       └── Review Submitted (C020)
│           └── Reputation Updated
└── Loyalty Points Finalized
    └── Tier Recalculation
        └── Segment Updated
            └── Future Marketing
```

---

*Document created: February 2, 2026*
