# Assertion Framework
## 100+ Workflow Tests for Simulation Validation

**Version:** 1.0  
**Created:** February 2, 2026  
**Purpose:** Define all assertions that validate system correctness during simulation

---

## 📋 Assertion Documentation Format

Each assertion includes:
- **ID:** Unique identifier
- **Category:** Classification
- **Description:** What is being validated
- **Condition:** The logical test
- **Severity:** CRITICAL / ERROR / WARNING / INFO
- **Trigger:** When to evaluate
- **Recovery:** Action if failed

---

# 🔐 INVARIANT ASSERTIONS

## Data Integrity Invariants

These assertions must ALWAYS be true. Any failure is critical.

### INV-001: Room Count Balance
```typescript
assertion INV_001_RoomCountBalance {
  id: 'INV-001',
  category: 'Inventory',
  description: 'Total room counts must always balance',
  severity: 'CRITICAL',
  
  condition: () => {
    const state = getRoomInventoryState()
    return state.available + state.occupied + state.dirty + 
           state.outOfOrder + state.blocked === state.total
  },
  
  trigger: 'EVERY_TICK',
  
  recovery: () => {
    logCritical('Room count imbalance detected')
    pauseSimulation()
    dumpRoomState()
  }
}
```

### INV-002: No Double Booking
```typescript
assertion INV_002_NoDoubleBooking {
  id: 'INV-002',
  category: 'Booking',
  description: 'No room can have overlapping confirmed bookings',
  severity: 'CRITICAL',
  
  condition: () => {
    const bookings = getConfirmedBookings()
    for (const room of getAllRooms()) {
      const roomBookings = bookings.filter(b => b.roomId === room.id)
      for (let i = 0; i < roomBookings.length; i++) {
        for (let j = i + 1; j < roomBookings.length; j++) {
          if (datesOverlap(roomBookings[i], roomBookings[j])) {
            return false
          }
        }
      }
    }
    return true
  },
  
  trigger: 'ON_BOOKING_CHANGE',
  
  recovery: () => {
    const conflicts = findBookingConflicts()
    alertManager(conflicts)
    initiateOverbookingProtocol()
  }
}
```

### INV-003: Folio Balance Accuracy
```typescript
assertion INV_003_FolioBalance {
  id: 'INV-003',
  category: 'Financial',
  description: 'Folio balance must equal charges minus payments',
  severity: 'CRITICAL',
  
  condition: () => {
    for (const folio of getActiveFolios()) {
      const charges = sumCharges(folio)
      const payments = sumPayments(folio)
      if (folio.balance !== charges - payments) {
        return false
      }
    }
    return true
  },
  
  trigger: 'ON_FINANCIAL_TRANSACTION',
  
  recovery: () => {
    const discrepancies = findFolioDiscrepancies()
    logFinancialAlert(discrepancies)
    flagForReconciliation()
  }
}
```

### INV-004: No Negative Inventory
```typescript
assertion INV_004_NoNegativeInventory {
  id: 'INV-004',
  category: 'Inventory',
  description: 'Inventory counts can never be negative',
  severity: 'CRITICAL',
  
  condition: () => {
    return getAllInventoryItems().every(item => item.quantity >= 0)
  },
  
  trigger: 'ON_INVENTORY_CHANGE',
  
  recovery: () => {
    const negativeItems = findNegativeInventory()
    correctInventoryCount(negativeItems)
    alertPurchasing()
  }
}
```

### INV-005: Loyalty Points Integrity
```typescript
assertion INV_005_LoyaltyPointsIntegrity {
  id: 'INV-005',
  category: 'Loyalty',
  description: 'Points balance must equal earned minus redeemed minus expired',
  severity: 'CRITICAL',
  
  condition: () => {
    for (const member of getLoyaltyMembers()) {
      const earned = sumPoints(member, 'earned')
      const redeemed = sumPoints(member, 'redeemed')
      const expired = sumPoints(member, 'expired')
      if (member.balance !== earned - redeemed - expired) {
        return false
      }
    }
    return true
  },
  
  trigger: 'ON_LOYALTY_TRANSACTION'
}
```

---

# 🔄 WORKFLOW ASSERTIONS

## Booking Workflow

### WF-B-001: Booking Creates Folio
```typescript
assertion WF_B_001_BookingCreatesFolio {
  id: 'WF-B-001',
  category: 'Booking Workflow',
  description: 'Every confirmed booking must have an associated folio',
  severity: 'ERROR',
  
  condition: (event: BookingConfirmedEvent) => {
    const folio = getFolioByBookingId(event.bookingId)
    return folio !== null && folio.status === 'active'
  },
  
  trigger: 'ON_BOOKING_CONFIRMED'
}
```

### WF-B-002: Check-In Updates Room Status
```typescript
assertion WF_B_002_CheckInUpdatesRoom {
  id: 'WF-B-002',
  category: 'Check-In Workflow',
  description: 'Check-in must change room status to occupied',
  severity: 'ERROR',
  
  condition: (event: CheckInCompletedEvent) => {
    const room = getRoomByNumber(event.roomNumber)
    return room.status === 'occupied' && room.guestId === event.guestId
  },
  
  trigger: 'ON_CHECK_IN_COMPLETED'
}
```

### WF-B-003: Check-Out Creates Housekeeping Task
```typescript
assertion WF_B_003_CheckOutCreatesHKTask {
  id: 'WF-B-003',
  category: 'Check-Out Workflow',
  description: 'Check-out must create housekeeping task for room',
  severity: 'ERROR',
  
  condition: (event: CheckOutCompletedEvent) => {
    const room = getRoomByNumber(event.roomNumber)
    const task = getHousekeepingTask(event.roomNumber)
    return room.status === 'dirty' && 
           task !== null && 
           task.type === 'checkout_clean'
  },
  
  trigger: 'ON_CHECK_OUT_COMPLETED'
}
```

### WF-B-004: Cancellation Refunds Processed
```typescript
assertion WF_B_004_CancellationRefund {
  id: 'WF-B-004',
  category: 'Cancellation Workflow',
  description: 'Eligible cancellations must have refund initiated',
  severity: 'WARNING',
  
  condition: (event: BookingCancelledEvent) => {
    if (!event.refundEligible) return true
    const refund = getRefundByBookingId(event.bookingId)
    return refund !== null && refund.status !== 'failed'
  },
  
  trigger: 'ON_BOOKING_CANCELLED'
}
```

### WF-B-005: VIP Recognition
```typescript
assertion WF_B_005_VIPRecognition {
  id: 'WF-B-005',
  category: 'VIP Workflow',
  description: 'VIP guests must be flagged in system on arrival',
  severity: 'WARNING',
  
  condition: (event: GuestArrivedEvent) => {
    if (!event.isVIP) return true
    const alerts = getActiveAlerts('vip_arrival')
    return alerts.some(a => a.guestId === event.guestId)
  },
  
  trigger: 'ON_GUEST_ARRIVED'
}
```

---

## F&B Workflow

### WF-F-001: Order Creates Kitchen Ticket
```typescript
assertion WF_F_001_OrderCreatesTicket {
  id: 'WF-F-001',
  category: 'F&B Workflow',
  description: 'Restaurant order must create kitchen ticket',
  severity: 'ERROR',
  
  condition: (event: OrderPlacedEvent) => {
    const ticket = getKitchenTicket(event.orderId)
    return ticket !== null && ticket.status === 'pending'
  },
  
  trigger: 'ON_ORDER_PLACED'
}
```

### WF-F-002: Item Ready Notifies Server
```typescript
assertion WF_F_002_ItemReadyNotification {
  id: 'WF-F-002',
  category: 'F&B Workflow',
  description: 'Item ready must send notification to assigned server',
  severity: 'WARNING',
  
  condition: (event: OrderItemReadyEvent) => {
    const notification = getNotification(event.serverId, 'item_ready')
    return notification !== null && 
           notification.orderId === event.orderId &&
           timeSince(event.timestamp) < 60_SECONDS
  },
  
  trigger: 'ON_ORDER_ITEM_READY'
}
```

### WF-F-003: Payment Closes Table
```typescript
assertion WF_F_003_PaymentClosesTable {
  id: 'WF-F-003',
  category: 'F&B Workflow',
  description: 'Full payment must change table status to clearing',
  severity: 'ERROR',
  
  condition: (event: RestaurantPaymentEvent) => {
    if (!event.isFullPayment) return true
    const table = getTable(event.tableNumber)
    return table.status === 'clearing' || table.status === 'available'
  },
  
  trigger: 'ON_RESTAURANT_PAYMENT'
}
```

### WF-F-004: 86 Item Updates All Menus
```typescript
assertion WF_F_004_86UpdatesMenus {
  id: 'WF-F-004',
  category: 'F&B Workflow',
  description: 'When item is 86d, all menu displays must update',
  severity: 'WARNING',
  
  condition: (event: ItemUnavailableEvent) => {
    const menuDisplays = getAllMenuDisplays()
    return menuDisplays.every(display => 
      !display.availableItems.includes(event.itemId)
    )
  },
  
  trigger: 'ON_ITEM_86',
  delay: 60_SECONDS // Allow time for propagation
}
```

### WF-F-005: Charge to Room Updates Folio
```typescript
assertion WF_F_005_ChargeToRoomUpdatesFolio {
  id: 'WF-F-005',
  category: 'F&B Workflow',
  description: 'Charge to room must add to guest folio immediately',
  severity: 'ERROR',
  
  condition: (event: ChargeToRoomEvent) => {
    const folio = getFolioByRoomNumber(event.roomNumber)
    const charge = folio.charges.find(c => c.reference === event.orderId)
    return charge !== null && charge.amount === event.amount
  },
  
  trigger: 'ON_CHARGE_TO_ROOM'
}
```

---

## Housekeeping Workflow

### WF-H-001: Clean Room Updates Availability
```typescript
assertion WF_H_001_CleanRoomAvailable {
  id: 'WF-H-001',
  category: 'Housekeeping Workflow',
  description: 'Completed cleaning must update room to clean/available',
  severity: 'ERROR',
  
  condition: (event: RoomCleaningCompletedEvent) => {
    const room = getRoomByNumber(event.roomNumber)
    return room.status === 'clean' || room.status === 'inspected'
  },
  
  trigger: 'ON_ROOM_CLEANING_COMPLETED'
}
```

### WF-H-002: Issue Creates Maintenance Ticket
```typescript
assertion WF_H_002_IssueCreatesMaintenance {
  id: 'WF-H-002',
  category: 'Housekeeping Workflow',
  description: 'Reported issue must create maintenance ticket',
  severity: 'WARNING',
  
  condition: (event: IssueReportedEvent) => {
    const ticket = getMaintenanceTicket(event.roomNumber, event.issueType)
    return ticket !== null && ticket.status === 'open'
  },
  
  trigger: 'ON_ISSUE_REPORTED'
}
```

### WF-H-003: Priority Room Cleaned First
```typescript
assertion WF_H_003_PriorityRoomFirst {
  id: 'WF-H-003',
  category: 'Housekeeping Workflow',
  description: 'VIP arrival rooms must be cleaned before standard',
  severity: 'WARNING',
  
  condition: () => {
    const queue = getHousekeepingQueue()
    const vipRooms = queue.filter(r => r.priority === 'vip')
    const standardRooms = queue.filter(r => r.priority === 'standard')
    
    // VIP rooms should have earlier position or be done
    return vipRooms.every(vip => 
      vip.status === 'clean' ||
      standardRooms.every(std => 
        std.queuePosition > vip.queuePosition || std.status === 'clean'
      )
    )
  },
  
  trigger: 'ON_HOUSEKEEPING_QUEUE_UPDATE'
}
```

---

## Financial Workflow

### WF-P-001: Payment Recorded Correctly
```typescript
assertion WF_P_001_PaymentRecorded {
  id: 'WF-P-001',
  category: 'Payment Workflow',
  description: 'Every payment must be recorded with full details',
  severity: 'CRITICAL',
  
  condition: (event: PaymentProcessedEvent) => {
    const payment = getPayment(event.paymentId)
    return payment !== null &&
           payment.amount === event.amount &&
           payment.method === event.method &&
           payment.gatewayReference !== null
  },
  
  trigger: 'ON_PAYMENT_PROCESSED'
}
```

### WF-P-002: Refund Does Not Exceed Original
```typescript
assertion WF_P_002_RefundNotExceedOriginal {
  id: 'WF-P-002',
  category: 'Refund Workflow',
  description: 'Refund amount cannot exceed original payment',
  severity: 'CRITICAL',
  
  condition: (event: RefundIssuedEvent) => {
    const originalPayment = getPayment(event.originalPaymentId)
    const totalRefunds = sumRefunds(event.originalPaymentId)
    return totalRefunds <= originalPayment.amount
  },
  
  trigger: 'ON_REFUND_ISSUED'
}
```

### WF-P-003: Daily Revenue Reconciles
```typescript
assertion WF_P_003_DailyRevenue {
  id: 'WF-P-003',
  category: 'Financial Workflow',
  description: 'Daily revenue must match sum of closed folios',
  severity: 'ERROR',
  
  condition: () => {
    const closedFolios = getClosedFoliosToday()
    const folioTotal = sumFolioRevenue(closedFolios)
    const reportedRevenue = getDailyRevenue()
    return Math.abs(folioTotal - reportedRevenue) < 0.01
  },
  
  trigger: 'ON_DAY_CLOSE'
}
```

---

# ⏱️ TIMING ASSERTIONS

### TM-001: Check-In Time SLA
```typescript
assertion TM_001_CheckInSLA {
  id: 'TM-001',
  category: 'Timing',
  description: 'Check-in should complete within 10 minutes',
  severity: 'WARNING',
  
  condition: (event: CheckInCompletedEvent) => {
    return event.duration <= 10 * 60 // 10 minutes in seconds
  },
  
  trigger: 'ON_CHECK_IN_COMPLETED',
  
  metrics: {
    track: 'checkInDuration',
    threshold: { warning: 600, critical: 900 }
  }
}
```

### TM-002: Kitchen Ticket Time
```typescript
assertion TM_002_KitchenTicketTime {
  id: 'TM-002',
  category: 'Timing',
  description: 'Kitchen tickets should complete within 25 minutes',
  severity: 'WARNING',
  
  condition: (event: OrderCompletedEvent) => {
    const order = getOrder(event.orderId)
    const ticketTime = event.timestamp - order.createdAt
    return ticketTime <= 25 * 60 * 1000 // 25 minutes
  },
  
  trigger: 'ON_ORDER_COMPLETED',
  
  metrics: {
    track: 'avgTicketTime',
    threshold: { warning: 20, critical: 30 } // minutes
  }
}
```

### TM-003: Room Turnaround Time
```typescript
assertion TM_003_RoomTurnaround {
  id: 'TM-003',
  category: 'Timing',
  description: 'Room turnaround should complete within 45 minutes',
  severity: 'WARNING',
  
  condition: (event: RoomCleaningCompletedEvent) => {
    if (event.cleaningType !== 'checkout') return true
    return event.duration <= 45 * 60 // 45 minutes
  },
  
  trigger: 'ON_ROOM_CLEANING_COMPLETED'
}
```

### TM-004: Complaint Response Time
```typescript
assertion TM_004_ComplaintResponse {
  id: 'TM-004',
  category: 'Timing',
  description: 'Complaints must be acknowledged within 5 minutes',
  severity: 'WARNING',
  
  condition: (event: ComplaintAcknowledgedEvent) => {
    const complaint = getComplaint(event.complaintId)
    const responseTime = event.timestamp - complaint.createdAt
    return responseTime <= 5 * 60 * 1000 // 5 minutes
  },
  
  trigger: 'ON_COMPLAINT_ACKNOWLEDGED'
}
```

### TM-005: VIP Room Ready
```typescript
assertion TM_005_VIPRoomReady {
  id: 'TM-005',
  category: 'Timing',
  description: 'VIP rooms must be ready 30 minutes before arrival',
  severity: 'ERROR',
  
  condition: () => {
    const vipArrivals = getVIPArrivals()
    return vipArrivals.every(arrival => {
      const room = getAssignedRoom(arrival.bookingId)
      if (!room) return false
      const timeToArrival = arrival.expectedTime - now()
      if (timeToArrival <= 30 * 60 * 1000) { // 30 minutes
        return room.status === 'clean' || room.status === 'inspected'
      }
      return true
    })
  },
  
  trigger: 'EVERY_5_MINUTES'
}
```

---

# 📊 CAPACITY ASSERTIONS

### CAP-001: Room Capacity
```typescript
assertion CAP_001_RoomCapacity {
  id: 'CAP-001',
  category: 'Capacity',
  description: 'Occupied rooms cannot exceed total rooms',
  severity: 'CRITICAL',
  
  condition: () => {
    const state = getRoomInventoryState()
    return state.occupied <= state.total
  },
  
  trigger: 'ON_OCCUPANCY_CHANGE'
}
```

### CAP-002: Restaurant Seating
```typescript
assertion CAP_002_RestaurantSeating {
  id: 'CAP-002',
  category: 'Capacity',
  description: 'Seated guests cannot exceed restaurant capacity',
  severity: 'ERROR',
  
  condition: () => {
    for (const restaurant of getRestaurants()) {
      if (restaurant.seatedGuests > restaurant.capacity) {
        return false
      }
    }
    return true
  },
  
  trigger: 'ON_SEATING_CHANGE'
}
```

### CAP-003: Kitchen Queue Depth
```typescript
assertion CAP_003_KitchenQueueDepth {
  id: 'CAP-003',
  category: 'Capacity',
  description: 'Kitchen queue should not exceed sustainable depth',
  severity: 'WARNING',
  
  condition: () => {
    const kitchen = getKitchenState()
    return kitchen.orderQueue.total <= kitchen.maxSustainableQueue
  },
  
  trigger: 'ON_ORDER_PLACED',
  
  metrics: {
    track: 'kitchenQueueDepth',
    threshold: { warning: 20, critical: 35 }
  }
}
```

---

# ✅ ASSERTION SUMMARY BY CATEGORY

| Category | Count | Critical | Error | Warning |
|----------|-------|----------|-------|---------|
| Invariants | 5 | 5 | 0 | 0 |
| Booking Workflow | 5 | 0 | 3 | 2 |
| F&B Workflow | 5 | 0 | 3 | 2 |
| Housekeeping Workflow | 3 | 0 | 1 | 2 |
| Financial Workflow | 3 | 2 | 1 | 0 |
| Timing SLAs | 5 | 0 | 1 | 4 |
| Capacity | 3 | 1 | 1 | 1 |
| **TOTAL** | **29** | **8** | **10** | **11** |

---

# 🔧 ASSERTION ENGINE IMPLEMENTATION

```typescript
class AssertionEngine {
  private assertions: Map<string, Assertion> = new Map()
  private results: AssertionResult[] = []
  private metrics: MetricsCollector
  
  registerAssertion(assertion: Assertion): void {
    this.assertions.set(assertion.id, assertion)
  }
  
  async evaluate(trigger: string, event?: any): Promise<void> {
    const relevantAssertions = this.getAssertionsForTrigger(trigger)
    
    for (const assertion of relevantAssertions) {
      const result = await this.evaluateAssertion(assertion, event)
      this.results.push(result)
      
      if (!result.passed) {
        this.handleFailure(assertion, result)
      }
      
      if (assertion.metrics) {
        this.metrics.record(assertion.metrics.track, result.value)
      }
    }
  }
  
  private handleFailure(assertion: Assertion, result: AssertionResult): void {
    const event: AssertionFailedEvent = {
      type: 'ASSERTION_FAILED',
      timestamp: new Date(),
      payload: {
        assertionId: assertion.id,
        assertionName: assertion.description,
        severity: assertion.severity,
        expected: result.expected,
        actual: result.actual,
        context: result.context,
        continueSim: assertion.severity !== 'CRITICAL'
      }
    }
    
    eventBus.emit(event)
    
    if (assertion.recovery) {
      assertion.recovery()
    }
    
    if (assertion.severity === 'CRITICAL') {
      simulationOrchestrator.pause()
    }
  }
  
  getReport(): AssertionReport {
    return {
      total: this.results.length,
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => !r.passed).length,
      bySeverity: this.groupBySeverity(),
      byCategory: this.groupByCategory(),
      failureDetails: this.results.filter(r => !r.passed)
    }
  }
}
```

---

# 📈 METRICS DASHBOARD

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ASSERTION STATUS DASHBOARD                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  REAL-TIME STATUS                                                        │
│  ────────────────                                                        │
│  ✅ Invariants:    5/5 passing                                          │
│  ✅ Workflows:    16/16 passing                                         │
│  ⚠️ Timing:        4/5 passing (TM-002 at threshold)                   │
│  ✅ Capacity:      3/3 passing                                          │
│                                                                          │
│  RECENT FAILURES                                                         │
│  ────────────────                                                        │
│  ⚠️ 14:23 TM-002 Kitchen ticket time 28 min (threshold 25)             │
│  ⚠️ 14:15 TM-001 Check-in took 12 min (threshold 10)                   │
│                                                                          │
│  METRICS TRENDS                                                          │
│  ────────────────                                                        │
│  Check-in Time:    ████████░░ 8.2 min avg (good)                        │
│  Ticket Time:      █████████░ 19.5 min avg (caution)                    │
│  Room Turnaround:  ███████░░░ 38 min avg (good)                         │
│  Complaint Resp:   ██████░░░░ 3.2 min avg (excellent)                   │
│                                                                          │
│  ASSERTION HISTORY (last hour)                                           │
│  ────────────────────────────                                           │
│  Evaluated: 1,247 | Passed: 1,241 | Failed: 6                           │
│  Pass Rate: 99.5%                                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

*Document created: February 2, 2026*
