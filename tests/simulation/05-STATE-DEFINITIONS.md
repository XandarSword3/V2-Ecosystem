# State Definitions
## All Monitored State with Assertions

**Version:** 1.0  
**Created:** February 2, 2026  
**Purpose:** Define all system state to monitor and assertions to validate

---

## 📋 State Documentation Format

Each state definition includes:
- **State Name:** Identifier
- **Source:** Where to read the state
- **Data Type:** Structure of the state
- **Valid Range:** Acceptable values
- **Assertions:** Rules that must always hold
- **Alert Threshold:** When to trigger warnings

---

# 🏨 OCCUPANCY STATE

## OS01: Room Inventory State
```typescript
interface RoomInventoryState {
  totalRooms: number
  roomsByType: Map<RoomType, number>
  available: {
    total: number
    byType: Map<RoomType, number>
    byDate: Map<Date, number>
  }
  occupied: {
    total: number
    byType: Map<RoomType, number>
  }
  dirty: {
    total: number
    rooms: Room[]
  }
  outOfOrder: {
    total: number
    rooms: Room[]
    reasons: string[]
  }
  blocked: {
    total: number
    rooms: Room[]
    blockReasons: string[]
  }
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| OS01-A1 | `available + occupied + dirty + ooo + blocked == total` | CRITICAL | Room counts must balance |
| OS01-A2 | `occupied <= total` | CRITICAL | Cannot exceed capacity |
| OS01-A3 | `available >= 0` | CRITICAL | Cannot have negative availability |
| OS01-A4 | `dirty.rooms.every(r => !r.hasGuest)` | ERROR | Dirty rooms can't have guests |
| OS01-A5 | `occupied.rooms.every(r => r.booking != null)` | ERROR | Occupied rooms must have booking |

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Occupancy Rate | > 90% | > 98% |
| OOO Rooms | > 5% | > 10% |
| Dirty Rooms at 14:00 | > 30% | > 50% |

---

## OS02: Booking State
```typescript
interface BookingState {
  today: {
    arrivals: Booking[]
    departures: Booking[]
    stayovers: Booking[]
    noShows: Booking[]
  }
  pending: {
    total: number
    unconfirmed: Booking[]
    awaitingPayment: Booking[]
  }
  confirmed: {
    upcoming: number
    byDate: Map<Date, number>
  }
  inHouse: {
    total: number
    guests: Guest[]
    roomNumbers: number[]
  }
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| OS02-A1 | `arrivals.all(b => b.status == 'confirmed')` | ERROR | Only confirmed bookings arrive |
| OS02-A2 | `inHouse.total == occupied.total` | ERROR | In-house count matches occupied |
| OS02-A3 | `departures.all(b => b.checkOutDate == today)` | WARNING | Departures have correct date |
| OS02-A4 | `no duplicate room assignments for same date` | CRITICAL | No double bookings |

---

# 🍽️ F&B STATE

## FS01: Restaurant State
```typescript
interface RestaurantState {
  name: string
  capacity: {
    total: number
    tables: Table[]
    seats: number
  }
  current: {
    occupied: number
    occupiedTables: Table[]
    available: number
    availableTables: Table[]
  }
  waitlist: {
    parties: WaitlistEntry[]
    estimatedWait: number // minutes
  }
  reservations: {
    today: Reservation[]
    upcoming: Reservation[]
  }
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| FS01-A1 | `occupied + available == total` | ERROR | Table counts balance |
| FS01-A2 | `occupied <= total` | CRITICAL | Cannot exceed capacity |
| FS01-A3 | `no overlapping reservations for same table` | CRITICAL | Table double-booking |
| FS01-A4 | `waitlist.estimatedWait > 0 when full` | WARNING | Wait time calculated |

---

## FS02: Kitchen State
```typescript
interface KitchenState {
  orderQueue: {
    pending: Order[]
    preparing: Order[]
    ready: Order[]
    total: number
  }
  metrics: {
    avgPrepTime: number
    ordersPerHour: number
    currentBacklog: number
    estimatedClearTime: number
  }
  staff: {
    onDuty: number
    stations: StationStatus[]
  }
  alerts: {
    items86d: MenuItem[]
    lowStock: InventoryItem[]
    longWaitOrders: Order[]
  }
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| FS02-A1 | `pending + preparing + ready == total` | ERROR | Order counts balance |
| FS02-A2 | `order.prepTime < 45 minutes` | WARNING | Reasonable prep time |
| FS02-A3 | `items86d not in active orders` | ERROR | Can't serve 86'd items |
| FS02-A4 | `currentBacklog < capacity * 2` | WARNING | Not overwhelmed |

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Avg Prep Time | > 20 min | > 35 min |
| Queue Depth | > 15 | > 30 |
| Items 86'd | > 2 | > 5 |
| Staff Utilization | > 85% | > 95% |

---

## FS03: Inventory State
```typescript
interface InventoryState {
  items: Map<ItemId, {
    name: string
    currentStock: number
    parLevel: number
    reorderPoint: number
    unit: string
    lastUpdated: Date
  }>
  alerts: {
    belowPar: InventoryItem[]
    belowReorder: InventoryItem[]
    outOfStock: InventoryItem[]
  }
  pendingOrders: PurchaseOrder[]
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| FS03-A1 | `currentStock >= 0` | CRITICAL | No negative inventory |
| FS03-A2 | `belowReorder implies pendingOrder exists` | WARNING | Reorder triggered |
| FS03-A3 | `outOfStock implies menu item disabled` | ERROR | Can't sell unavailable |

---

# 💳 FINANCIAL STATE

## FN01: Folio State
```typescript
interface FolioState {
  activeFolios: {
    total: number
    folios: Folio[]
    totalOutstanding: number
  }
  folio: {
    id: string
    guestId: string
    charges: Charge[]
    payments: Payment[]
    balance: number
    status: 'open' | 'closed' | 'disputed'
  }
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| FN01-A1 | `sum(charges) - sum(payments) == balance` | CRITICAL | Balance calculation correct |
| FN01-A2 | `closed folio has balance == 0` | CRITICAL | No outstanding on checkout |
| FN01-A3 | `all charges have valid reason codes` | WARNING | Proper categorization |
| FN01-A4 | `payments.sum == actual received` | CRITICAL | Payment reconciliation |

---

## FN02: Payment State
```typescript
interface PaymentState {
  today: {
    totalReceived: number
    transactions: PaymentTransaction[]
    methods: Map<PaymentMethod, number>
  }
  pending: {
    authorizations: Authorization[]
    settlements: Settlement[]
  }
  refunds: {
    pending: Refund[]
    processed: Refund[]
  }
  disputes: {
    open: Dispute[]
    resolved: Dispute[]
  }
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| FN02-A1 | `all transactions have gateway response` | ERROR | Complete transaction logging |
| FN02-A2 | `refund.amount <= original payment` | CRITICAL | No over-refund |
| FN02-A3 | `authorizations expire after 7 days` | WARNING | Auth timeout |
| FN02-A4 | `settlements match gateway batch` | CRITICAL | Reconciliation |

---

# 🧹 HOUSEKEEPING STATE

## HK01: Room Status State
```typescript
interface HousekeepingState {
  rooms: Map<RoomId, {
    status: 'clean' | 'dirty' | 'cleaning' | 'inspected'
    lastCleaned: Date
    assignedTo: StaffId | null
    priority: number
    estimatedCompletion: Date | null
  }>
  staff: {
    onDuty: HousekeepingStaff[]
    assignments: Map<StaffId, Room[]>
    productivity: Map<StaffId, number> // rooms/hour
  }
  queue: {
    pending: Room[]
    inProgress: Room[]
    completed: Room[]
  }
  metrics: {
    roomsCleanedToday: number
    avgCleanTime: number
    turnaroundTime: number
  }
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| HK01-A1 | `dirty + cleaning + clean + inspected == total` | ERROR | Status counts balance |
| HK01-A2 | `cleaning room has assignedTo != null` | ERROR | Cleaning has assignment |
| HK01-A3 | `VIP arrival room clean by arrival time` | CRITICAL | VIP room ready |
| HK01-A4 | `turnaround < 4 hours for standard` | WARNING | Acceptable turnaround |

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Dirty rooms at 14:00 | > 20 | > 40 |
| Avg clean time | > 45 min | > 60 min |
| Rooms per person | > 15 | > 20 |

---

# 🔐 SYSTEM STATE

## SY01: Integration State
```typescript
interface IntegrationState {
  integrations: Map<IntegrationId, {
    name: string
    status: 'connected' | 'degraded' | 'disconnected'
    lastSync: Date
    errorCount: number
    pendingOperations: number
  }>
  channelManager: {
    status: string
    channels: Channel[]
    lastInventoryPush: Date
    lastRatePush: Date
    pendingUpdates: number
  }
  paymentGateway: {
    status: string
    transactionsToday: number
    declineRate: number
    avgResponseTime: number
  }
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| SY01-A1 | `paymentGateway.status == 'connected'` | CRITICAL | Payment must work |
| SY01-A2 | `channelManager.pendingUpdates < 100` | WARNING | Not falling behind |
| SY01-A3 | `errorCount < 10 in last hour` | WARNING | Error rate acceptable |
| SY01-A4 | `lastSync < 5 minutes ago` | WARNING | Sync current |

---

## SY02: Queue State
```typescript
interface QueueState {
  checkInQueue: {
    waiting: number
    avgWaitTime: number
    longestWait: number
  }
  restaurantWaitlist: Map<RestaurantId, {
    parties: number
    avgWait: number
  }>
  housekeepingQueue: {
    pending: number
    estimatedClearTime: Date
  }
  supportTickets: {
    open: number
    avgResolutionTime: number
    escalated: number
  }
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| SY02-A1 | `checkInQueue.avgWait < 15 minutes` | WARNING | Acceptable wait |
| SY02-A2 | `escalated tickets < 10%` | WARNING | Most resolved at first level |
| SY02-A3 | `all queues decreasing during off-peak` | INFO | Queue health |

---

# 📊 LOYALTY STATE

## LY01: Loyalty Points State
```typescript
interface LoyaltyState {
  member: {
    id: string
    tier: 'Silver' | 'Gold' | 'Platinum' | 'Diamond'
    points: {
      balance: number
      lifetime: number
      expiring: number
      expirationDate: Date
    }
    staysThisYear: number
    nightsThisYear: number
  }
  transactions: {
    earned: LoyaltyTransaction[]
    redeemed: LoyaltyTransaction[]
    expired: LoyaltyTransaction[]
  }
  tierProgress: {
    currentTier: Tier
    nextTier: Tier
    pointsNeeded: number
    nightsNeeded: number
  }
}
```

### Assertions
| ID | Assertion | Severity | Description |
|----|-----------|----------|-------------|
| LY01-A1 | `sum(earned) - sum(redeemed) - sum(expired) == balance` | CRITICAL | Points balance |
| LY01-A2 | `tier matches points/nights criteria` | ERROR | Correct tier |
| LY01-A3 | `redemption.points <= balance` | CRITICAL | Can't redeem more than have |
| LY01-A4 | `points expire after 2 years inactive` | WARNING | Expiration policy |

---

# ✅ ASSERTION SUMMARY

## By Severity

| Severity | Count | Auto-Response |
|----------|-------|---------------|
| CRITICAL | 15 | Immediate alert, may halt simulation |
| ERROR | 12 | Log and flag for review |
| WARNING | 18 | Monitor trend |
| INFO | 5 | Dashboard display |

## By Category

| Category | Assertions | Key Focus |
|----------|------------|-----------|
| Occupancy | 9 | Room inventory integrity |
| F&B | 10 | Order flow, inventory |
| Financial | 8 | Payment reconciliation |
| Housekeeping | 4 | Room status tracking |
| System | 7 | Integration health |
| Loyalty | 4 | Points integrity |
| **TOTAL** | **42** | **Core System Integrity** |

---

# 🖥️ STATE MONITORING DASHBOARD

## Real-Time Metrics Display
```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SIMULATION STATE MONITOR                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  OCCUPANCY          F&B                    HOUSEKEEPING                 │
│  ───────────        ───                    ────────────                 │
│  Rooms: 85/100      Kitchen Queue: 12      Dirty: 8                     │
│  Check-ins: 23      Avg Prep: 14 min       Cleaning: 3                  │
│  Check-outs: 18     Items 86'd: 0          Clean: 89                    │
│  Dirty: 8           Wait Time: 8 min       Staff: 3 active              │
│                                                                          │
│  FINANCIAL          QUEUES                 ASSERTIONS                   │
│  ─────────          ──────                 ──────────                   │
│  Revenue: $45,230   Check-in: 2 waiting    ✅ CRITICAL: 15/15           │
│  Payments: 127      Restaurant: 4 waiting  ✅ ERROR: 12/12              │
│  Refunds: 3         Support: 5 open        ⚠️ WARNING: 16/18            │
│  Disputes: 0        HK Queue: 8 rooms      ℹ️ INFO: 5/5                 │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  ACTIVE ALERTS:                                                          │
│  ⚠️ 14:15 - Kitchen prep time exceeded 20 min threshold (23 min avg)    │
│  ⚠️ 14:20 - Housekeeping queue > 20 rooms                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

*Document created: February 2, 2026*
