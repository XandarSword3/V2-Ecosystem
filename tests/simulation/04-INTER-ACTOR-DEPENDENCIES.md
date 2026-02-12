# Inter-Actor Dependencies
## How Actors Create Work for Each Other

**Version:** 1.0  
**Created:** February 2, 2026  
**Purpose:** Document all dependencies and interactions between actor types

---

## 📋 Dependency Documentation Format

Each dependency includes:
- **Trigger Actor:** Who initiates the interaction
- **Affected Actor:** Who must respond
- **Trigger Action:** What creates the work
- **Required Response:** What the affected actor must do
- **Response Time:** Expected time to respond
- **Cascade Effects:** What happens if response is delayed

---

# 🔄 GUEST → STAFF DEPENDENCIES

## GS01: Guest Check-In → Front Desk Agent
```
┌─────────────────┐         ┌─────────────────┐
│     GUEST       │ ──────▶ │   FRONT DESK    │
│  Arrives for    │         │  Must process   │
│   check-in      │         │   check-in      │
└─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Guest arrives at desk or initiates mobile check-in |
| Required Response | Verify identity, assign room, issue key |
| Response Time | < 5 minutes for VIP, < 10 minutes standard |
| Workload Impact | 5-15 minutes per check-in |
| Peak Period | 15:00-18:00 |
| Cascade if Delayed | Guest frustration, queue buildup, negative first impression |

### Queue Dynamics
```javascript
// When guests arrive faster than processing
if (arrivalRate > processRate) {
  queueGrows()
  waitTimes.increase()
  guestSatisfaction.decrease()
  
  // Trigger response
  if (queueLength > 5) {
    callBackupStaff()
    offerExpressCheckIn()
  }
}
```

---

## GS02: Guest Order → Kitchen Staff
```
┌─────────────────┐         ┌─────────────────┐
│     GUEST       │ ──────▶ │    KITCHEN      │
│  Places order   │         │  Must prepare   │
└─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Guest places F&B order (restaurant, room service, bar) |
| Required Response | Prepare food/beverage to specification |
| Response Time | 15-30 min (restaurant), 30-45 min (room service) |
| Workload Impact | 5-20 minutes per item |
| Peak Period | 12:00-14:00, 19:00-21:00 |
| Cascade if Delayed | Guest complaint, food quality issues, table turnover delay |

### Kitchen Capacity Model
```javascript
const kitchenCapacity = {
  maxConcurrentOrders: 20,
  avgPrepTime: 12, // minutes per item
  staffCount: 3,
  
  calculateWaitTime(currentOrders) {
    const ordersBehind = currentOrders.length
    const effectiveRate = this.staffCount * (60 / this.avgPrepTime)
    return (ordersBehind / effectiveRate) * 60 // minutes
  }
}
```

---

## GS03: Guest Checkout → Housekeeping
```
┌─────────────────┐         ┌─────────────────┐
│     GUEST       │ ──────▶ │  HOUSEKEEPING   │
│  Checks out     │         │  Must clean     │
│                 │         │     room        │
└─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Guest checks out (room becomes dirty) |
| Required Response | Clean room to standard |
| Response Time | Before next guest arrival (priority-based) |
| Workload Impact | 30-45 min per room |
| Peak Period | 10:00-14:00 (checkout rush) |
| Cascade if Delayed | Next guest can't check in, room shortage, overbooking |

### Priority Queue Logic
```javascript
function prioritizeRooms(dirtyRooms) {
  return dirtyRooms.sort((a, b) => {
    // VIP arrivals first
    if (a.nextArrival.isVIP && !b.nextArrival.isVIP) return -1
    
    // Then by arrival time
    const aUrgency = a.nextArrival.time - now()
    const bUrgency = b.nextArrival.time - now()
    return aUrgency - bUrgency
  })
}
```

---

## GS04: Guest Complaint → Staff/Manager Escalation
```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     GUEST       │ ──────▶ │     STAFF       │ ──────▶ │    MANAGER      │
│   Complains     │         │  Tries resolve  │         │  Escalation     │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Guest expresses dissatisfaction |
| Required Response | Acknowledge, attempt resolution, escalate if needed |
| Response Time | Immediate acknowledgment, resolution within 15-30 min |
| Escalation Criteria | Staff cannot resolve, guest demands manager, comp needed |
| Cascade if Mishandled | Negative review, lost loyalty, social media complaints |

### Escalation Decision Tree
```javascript
function handleComplaint(complaint, staff) {
  staff.acknowledge(complaint)
  
  const canResolve = 
    complaint.severity < 3 &&
    staff.hasAuthority(complaint.resolution) &&
    !complaint.guestDemandsManager
  
  if (canResolve) {
    return staff.resolve(complaint)
  } else {
    return escalateToManager(complaint)
  }
}
```

---

## GS05: Guest Spa Booking → Spa Therapist
```
┌─────────────────┐         ┌─────────────────┐
│     GUEST       │ ──────▶ │  SPA THERAPIST  │
│ Books treatment │         │  Must deliver   │
└─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Guest books spa appointment |
| Required Response | Prepare room, deliver treatment |
| Response Time | Treatment at scheduled time |
| Workload Impact | Treatment duration + 15 min setup/cleanup |
| Cascade if Unavailable | Guest disappointment, rebooking, lost revenue |

---

# 🔄 STAFF → STAFF DEPENDENCIES

## SS01: Kitchen Ready → Server Delivery
```
┌─────────────────┐         ┌─────────────────┐
│    KITCHEN      │ ──────▶ │     SERVER      │
│  Item ready     │         │  Must deliver   │
└─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Kitchen marks item ready |
| Required Response | Collect and deliver to guest |
| Response Time | < 2 minutes (food quality window) |
| Workload Impact | 2-5 minutes per delivery |
| Cascade if Delayed | Cold food, quality complaints, comp requests |

### WebSocket Notification
```javascript
// Kitchen emits
socket.emit('orderItemReady', {
  orderId: order.id,
  itemId: item.id,
  tableNumber: order.table,
  serverId: order.assignedServer
})

// Server receives
socket.on('orderItemReady', (data) => {
  if (data.serverId === myId) {
    notifyServerApp('Food ready for table ' + data.tableNumber)
    addToDeliveryQueue(data)
  }
})
```

---

## SS02: Front Desk → Housekeeping Priority
```
┌─────────────────┐         ┌─────────────────┐
│   FRONT DESK    │ ──────▶ │  HOUSEKEEPING   │
│  Early arrival  │         │  Priority clean │
└─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Front desk flags room as priority (early arrival, VIP) |
| Required Response | Reprioritize cleaning queue |
| Response Time | Bump room to top of queue |
| Communication | Real-time app notification |
| Cascade if Delayed | Guest waiting, front desk pressure |

---

## SS03: Housekeeping → Front Desk (Room Ready)
```
┌─────────────────┐         ┌─────────────────┐
│  HOUSEKEEPING   │ ──────▶ │   FRONT DESK    │
│  Room cleaned   │         │  Can assign     │
└─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Housekeeping marks room clean |
| Required Response | Update availability, notify waiting guests |
| Response Time | Automatic (system update) |
| Communication | WebSocket push |
| Guest Impact | Can now check in |

---

## SS04: Night Auditor → Day Staff (Handover)
```
┌─────────────────┐         ┌─────────────────┐
│  NIGHT AUDITOR  │ ──────▶ │   DAY STAFF     │
│  Daily close    │         │  Receive reports│
└─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Night auditor completes daily close |
| Required Response | Review discrepancies, follow up on issues |
| Response Time | Start of day shift |
| Information Passed | No-shows, arrivals, issues, revenue |
| Cascade if Issues | Day starts with unresolved problems |

---

# 🔄 MANAGER DEPENDENCIES

## MS01: Staff Issue → Manager Intervention
```
┌─────────────────┐         ┌─────────────────┐
│     STAFF       │ ──────▶ │    MANAGER      │
│ Cannot resolve  │         │  Must decide    │
└─────────────────┘         └─────────────────┘
```

| Common Triggers |
|-----------------|
| Guest demands compensation beyond staff authority |
| Room upgrade request (no availability) |
| Complaint about another staff member |
| VIP special request |
| Payment dispute |
| Overbooking situation |

| Response Requirements |
|----------------------|
| Available during operational hours |
| Decision-making authority |
| Comp/refund authorization |
| Direct guest communication |

---

## MS02: System Alert → Revenue Manager
```
┌─────────────────┐         ┌─────────────────┐
│     SYSTEM      │ ──────▶ │ REVENUE MANAGER │
│  Parity alert   │         │  Must resolve   │
└─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Rate parity violation detected |
| Required Response | Investigate, contact OTA, adjust if needed |
| Response Time | Within 4 hours |
| Cascade if Ignored | Lost bookings, contract violations |

---

## MS03: Escalated Complaint → Duty Manager
```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     GUEST       │ ──────▶ │     STAFF       │ ──────▶ │  DUTY MANAGER   │
│   Major issue   │         │  Cannot handle  │         │  Final decision │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

| Escalation Scenarios |
|---------------------|
| Threat of bad review |
| Demand for refund > $100 |
| Room unsatisfactory after 2nd attempt |
| Safety/security concern |
| Confrontational guest |

---

# 🔄 ADMIN DEPENDENCIES

## AS01: GDPR Request → Admin Processing
```
┌─────────────────┐         ┌─────────────────┐
│     GUEST       │ ──────▶ │     ADMIN       │
│ Data request    │         │  Must fulfill   │
└─────────────────┘         └─────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Trigger | Guest submits GDPR export or deletion request |
| Required Response | Compile data / anonymize records |
| Response Time | 30 days (legal requirement) |
| Cascade if Delayed | Legal compliance violation |

---

## AS02: Integration Failure → Admin Fix
```
┌─────────────────┐         ┌─────────────────┐
│     SYSTEM      │ ──────▶ │     ADMIN       │
│ Integration down│         │  Must restore   │
└─────────────────┘         └─────────────────┘
```

| Critical Integrations |
|----------------------|
| Payment gateway - transactions fail |
| Channel manager - bookings not synced |
| Key encoder - keys can't be issued |
| PMS - data inconsistency |

---

# 📊 DEPENDENCY MATRIX

## Who Creates Work for Whom

| ↓ Creates Work For → | Front Desk | Kitchen | Housekeeping | Server | Spa | Manager | Admin |
|---------------------|------------|---------|--------------|--------|-----|---------|-------|
| **Guest** | ✅ Check-in/out | ✅ Orders | ✅ Requests | ✅ Service | ✅ Bookings | ⚠️ Escalations | ⚠️ GDPR |
| **Front Desk** | - | ❌ | ✅ Priorities | ❌ | ❌ | ⚠️ Escalations | ⚠️ Issues |
| **Kitchen** | ❌ | - | ❌ | ✅ Ready items | ❌ | ⚠️ Escalations | ❌ |
| **Housekeeping** | ✅ Room ready | ❌ | - | ❌ | ❌ | ⚠️ Issues | ⚠️ Maintenance |
| **Server** | ❌ | ✅ Orders | ❌ | - | ❌ | ⚠️ Complaints | ❌ |
| **Spa** | ❌ | ❌ | ❌ | ❌ | - | ⚠️ Escalations | ❌ |
| **Manager** | ✅ Directives | ✅ Directives | ✅ Directives | ✅ Directives | ✅ Directives | - | ⚠️ Config |
| **System** | ✅ Alerts | ✅ Orders | ✅ Tasks | ✅ Notifications | ✅ Bookings | ✅ Alerts | ✅ Alerts |

**Legend:**
- ✅ Regular workflow dependency
- ⚠️ Exceptional/escalation dependency
- ❌ No direct dependency

---

# ⏱️ RESPONSE TIME REQUIREMENTS

## Critical Response Windows

| Dependency | Response Window | Consequence of Delay |
|------------|-----------------|---------------------|
| Guest waiting for check-in | < 5 min | Queue grows, frustration |
| Food ready in kitchen | < 2 min | Cold food, quality loss |
| VIP arrival notification | Immediate | Miss opportunity to impress |
| Guest complaint | < 1 min acknowledge | Escalation |
| Room cleaning for arrival | Before arrival | Can't check in |
| Payment processing | < 30 sec | Transaction timeout |
| Rate parity alert | < 4 hours | Lost bookings |
| GDPR request | < 30 days | Legal violation |

---

# 🔄 CASCADE CHAINS

## Example: Lunch Rush Cascade

```
12:00 - 30 guests arrive for lunch simultaneously

Restaurant Host:
├── Seating capacity reached
├── Waitlist started
└── Average wait: 20 min

Servers (2):
├── 15 tables each (overloaded)
├── Order taking delayed
└── Delivery times increase

Kitchen (3 staff):
├── 30 orders in 30 minutes
├── Queue builds up
├── Average ticket time: 25 min (vs 15 min normal)
└── Quality pressure

Cascading Effects:
├── Guests frustrated with wait
├── Complaints to server
├── Server escalates to F&B Manager
├── Manager visits tables, offers comps
├── Some guests leave before ordering
├── Negative reviews possible
└── Revenue impact

Resolution Actions:
├── Manager calls backup server
├── Kitchen prioritizes simpler items
├── Host offers bar seating for drinks while waiting
└── Comps offered to most delayed guests
```

---

## Example: Saturday Turnover Cascade

```
Saturday 11:00 - Peak checkout period

Checkout Rush:
├── 50 rooms checking out
├── Front desk queue: 20 people
├── Express checkout helps (30%)
└── Some late checkouts requested

Housekeeping Challenge:
├── 50 rooms to clean
├── 40 arrivals coming
├── 3 staff available
├── Capacity: 6 rooms/person = 18 rooms in 3 hours
└── GAP: Need 50 rooms, can do 18 by 14:00

Cascade:
├── Front desk receives early arrivals (14:00)
├── Rooms not ready
├── Guests offered:
│   ├── Wait in lobby
│   ├── Restaurant voucher
│   └── Luggage storage
├── Housekeeping manager calls additional staff
├── Priority cleaning for arrivals
└── Some guests very unhappy

Resolution:
├── Extra staff arrive 13:00
├── Rooms prioritized by arrival time
├── VIPs get rooms first
├── Most guests checked in by 16:00
└── Comps offered to those who waited > 1 hour
```

---

*Document created: February 2, 2026*
