# Event Definitions
## Simulation Event Bus Events

**Version:** 1.0  
**Created:** February 2, 2026  
**Purpose:** Define all events that flow through the simulation event bus

---

## 📋 Event Documentation Format

Each event includes:
- **Event Name:** Unique identifier
- **Category:** Event classification
- **Payload:** Data structure
- **Emitters:** Who can emit this event
- **Listeners:** Who should listen
- **Cascades:** What other events may be triggered

---

# 📡 EVENT BUS ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EVENT BUS                                      │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  Guest   │  │  Staff   │  │ Manager  │  │  System  │               │
│  │  Events  │  │  Events  │  │  Events  │  │  Events  │               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │             │             │             │                       │
│       └─────────────┴──────┬──────┴─────────────┘                       │
│                            │                                             │
│                    ┌───────▼───────┐                                    │
│                    │    Router     │                                    │
│                    │  (Priority,   │                                    │
│                    │   Filtering)  │                                    │
│                    └───────┬───────┘                                    │
│                            │                                             │
│       ┌─────────────┬──────┴──────┬─────────────┐                       │
│       ▼             ▼             ▼             ▼                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                   │
│  │ Actors  │  │  State  │  │ Logging │  │ Assert  │                   │
│  │         │  │ Monitor │  │         │  │ Engine  │                   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# 🧳 GUEST EVENTS

## GE01: GuestArrived
```typescript
interface GuestArrivedEvent {
  type: 'GUEST_ARRIVED'
  timestamp: Date
  payload: {
    guestId: string
    bookingId: string
    expectedArrival: Date
    actualArrival: Date
    isEarlyArrival: boolean
    isVIP: boolean
    loyaltyTier: string | null
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Guest Lifecycle |
| Emitters | Front Desk, Kiosk, Mobile App |
| Listeners | Front Desk Bot, State Monitor, Housekeeping Bot |
| Cascades | CheckInStarted, RoomPriorityUpdated |

---

## GE02: CheckInCompleted
```typescript
interface CheckInCompletedEvent {
  type: 'CHECK_IN_COMPLETED'
  timestamp: Date
  payload: {
    guestId: string
    bookingId: string
    roomNumber: number
    checkInMethod: 'desk' | 'mobile' | 'kiosk'
    duration: number // seconds
    keyIssued: boolean
    welcomeAmenityScheduled: boolean
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Guest Lifecycle |
| Emitters | Front Desk Bot, System |
| Listeners | Room State, Housekeeping, IoT, Marketing |
| Cascades | RoomOccupied, WelcomeMessageSent |

---

## GE03: CheckOutCompleted
```typescript
interface CheckOutCompletedEvent {
  type: 'CHECK_OUT_COMPLETED'
  timestamp: Date
  payload: {
    guestId: string
    bookingId: string
    roomNumber: number
    finalBill: number
    paymentMethod: string
    stayDuration: number // nights
    loyaltyPointsEarned: number
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Guest Lifecycle |
| Emitters | Front Desk Bot, System |
| Listeners | Housekeeping Bot, Revenue State, Marketing |
| Cascades | RoomMarkedDirty, HousekeepingTaskCreated, PostStayJourneyStarted |

---

## GE04: GuestComplained
```typescript
interface GuestComplainedEvent {
  type: 'GUEST_COMPLAINED'
  timestamp: Date
  payload: {
    guestId: string
    complaintId: string
    category: 'room' | 'service' | 'food' | 'staff' | 'other'
    severity: 1 | 2 | 3 | 4 | 5
    description: string
    channel: 'verbal' | 'app' | 'email' | 'phone'
    assignedTo: string | null
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Service |
| Emitters | Any Staff Bot, Guest Bot |
| Listeners | Manager Bot, Staff Bot, State Monitor |
| Cascades | StaffTaskCreated, ManagerAlerted (if severity > 3) |

---

## GE05: GuestOrderPlaced
```typescript
interface GuestOrderPlacedEvent {
  type: 'GUEST_ORDER_PLACED'
  timestamp: Date
  payload: {
    guestId: string
    orderId: string
    orderType: 'restaurant' | 'room_service' | 'bar' | 'pool'
    items: OrderItem[]
    totalAmount: number
    tableNumber: number | null
    roomNumber: number | null
    specialInstructions: string[]
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | F&B |
| Emitters | Server Bot, Guest Bot (mobile) |
| Listeners | Kitchen Bot, State Monitor |
| Cascades | KitchenOrderReceived, InventoryReserved |

---

## GE06: GuestBookedSpa
```typescript
interface GuestBookedSpaEvent {
  type: 'GUEST_BOOKED_SPA'
  timestamp: Date
  payload: {
    guestId: string
    appointmentId: string
    treatmentId: string
    treatmentName: string
    therapistId: string
    scheduledTime: Date
    duration: number
    price: number
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Spa |
| Emitters | Guest Bot, Spa Reception |
| Listeners | Spa Bot, State Monitor |
| Cascades | TherapistScheduleUpdated, ConfirmationSent |

---

# 👔 STAFF EVENTS

## SE01: StaffShiftStarted
```typescript
interface StaffShiftStartedEvent {
  type: 'STAFF_SHIFT_STARTED'
  timestamp: Date
  payload: {
    staffId: string
    role: string
    department: string
    shiftStart: Date
    shiftEnd: Date
    assignments: string[]
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Staff Lifecycle |
| Emitters | System (schedule-based) |
| Listeners | Department Managers, Task Assigners |
| Cascades | TasksAssigned, StaffCapacityUpdated |

---

## SE02: TaskCompleted
```typescript
interface TaskCompletedEvent {
  type: 'TASK_COMPLETED'
  timestamp: Date
  payload: {
    staffId: string
    taskId: string
    taskType: string
    startTime: Date
    endTime: Date
    duration: number
    outcome: 'success' | 'partial' | 'failed'
    notes: string | null
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Operations |
| Emitters | Any Staff Bot |
| Listeners | State Monitor, Manager Bot, Reporting |
| Cascades | NextTaskAssigned, MetricsUpdated |

---

## SE03: RoomCleaningCompleted
```typescript
interface RoomCleaningCompletedEvent {
  type: 'ROOM_CLEANING_COMPLETED'
  timestamp: Date
  payload: {
    staffId: string
    roomNumber: number
    cleaningType: 'checkout' | 'stayover' | 'deep_clean' | 'turndown'
    startTime: Date
    endTime: Date
    duration: number
    issuesFound: string[]
    minibarCharges: MinibarItem[]
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Housekeeping |
| Emitters | Housekeeping Bot |
| Listeners | Front Desk Bot, State Monitor, Manager Bot |
| Cascades | RoomStatusUpdated, FrontDeskNotified, IssuesLogged |

---

## SE04: OrderItemReady
```typescript
interface OrderItemReadyEvent {
  type: 'ORDER_ITEM_READY'
  timestamp: Date
  payload: {
    orderId: string
    itemId: string
    itemName: string
    preparedBy: string
    prepTime: number
    quality: 'standard' | 'expedited'
    expoLocation: string
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | F&B |
| Emitters | Kitchen Bot |
| Listeners | Server Bot, State Monitor |
| Cascades | ServerNotified, DeliveryTimerStarted |

---

## SE05: StaffEscalated
```typescript
interface StaffEscalatedEvent {
  type: 'STAFF_ESCALATED'
  timestamp: Date
  payload: {
    staffId: string
    issueId: string
    issueType: string
    reason: string
    escalatedTo: string
    guestId: string | null
    urgency: 'low' | 'medium' | 'high' | 'critical'
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Operations |
| Emitters | Any Staff Bot |
| Listeners | Manager Bot |
| Cascades | ManagerTaskCreated, UrgencyAlertIfCritical |

---

# 📊 MANAGER EVENTS

## ME01: ManagerDecisionMade
```typescript
interface ManagerDecisionMadeEvent {
  type: 'MANAGER_DECISION_MADE'
  timestamp: Date
  payload: {
    managerId: string
    decisionType: 'comp' | 'refund' | 'upgrade' | 'escalation' | 'policy_override'
    relatedIssueId: string
    decision: string
    value: number | null
    justification: string
    guestId: string | null
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Management |
| Emitters | Manager Bot |
| Listeners | Staff Bot, State Monitor, Finance |
| Cascades | ActionExecuted, GuestNotified, AuditLogged |

---

## ME02: RateChanged
```typescript
interface RateChangedEvent {
  type: 'RATE_CHANGED'
  timestamp: Date
  payload: {
    managerId: string
    roomType: string
    dates: DateRange
    oldRate: number
    newRate: number
    reason: string
    channels: string[]
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Revenue |
| Emitters | Revenue Manager Bot |
| Listeners | Channel Manager, State Monitor |
| Cascades | ChannelsSynced, ParityCheckScheduled |

---

## ME03: InventoryBlocked
```typescript
interface InventoryBlockedEvent {
  type: 'INVENTORY_BLOCKED'
  timestamp: Date
  payload: {
    managerId: string
    roomType: string | null
    roomNumbers: number[]
    dates: DateRange
    reason: string
    blockType: 'maintenance' | 'vip' | 'group' | 'other'
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Inventory |
| Emitters | Front Office Manager Bot |
| Listeners | State Monitor, Channel Manager |
| Cascades | AvailabilityUpdated, ChannelsSynced |

---

# ⚙️ SYSTEM EVENTS

## SYE01: SimulationClockTick
```typescript
interface SimulationClockTickEvent {
  type: 'SIMULATION_CLOCK_TICK'
  timestamp: Date
  payload: {
    simulationTime: Date
    realTime: Date
    timeMultiplier: number
    tickNumber: number
    scenario: string
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Simulation Control |
| Emitters | Clock Manager |
| Listeners | All Actors, Schedulers |
| Cascades | ScheduledActionsTriggered |

---

## SYE02: AlertTriggered
```typescript
interface AlertTriggeredEvent {
  type: 'ALERT_TRIGGERED'
  timestamp: Date
  payload: {
    alertId: string
    alertType: string
    severity: 'info' | 'warning' | 'error' | 'critical'
    message: string
    source: string
    data: Record<string, any>
    requiresAction: boolean
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Monitoring |
| Emitters | State Monitor, Assertion Engine |
| Listeners | Admin Bot, Dashboard, Logging |
| Cascades | AdminNotified (if critical), AutoResponse (if configured) |

---

## SYE03: AssertionFailed
```typescript
interface AssertionFailedEvent {
  type: 'ASSERTION_FAILED'
  timestamp: Date
  payload: {
    assertionId: string
    assertionName: string
    severity: 'warning' | 'error' | 'critical'
    expected: any
    actual: any
    context: Record<string, any>
    continueSim: boolean
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Validation |
| Emitters | Assertion Engine |
| Listeners | Dashboard, Logging, Orchestrator |
| Cascades | SimulationPaused (if critical), ReportGenerated |

---

## SYE04: IntegrationStatusChanged
```typescript
interface IntegrationStatusChangedEvent {
  type: 'INTEGRATION_STATUS_CHANGED'
  timestamp: Date
  payload: {
    integrationId: string
    integrationName: string
    previousStatus: string
    newStatus: string
    reason: string | null
    impact: string[]
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | System Health |
| Emitters | Integration Monitor |
| Listeners | Admin Bot, State Monitor |
| Cascades | FallbackActivated, AdminAlerted |

---

## SYE05: CapacityThresholdReached
```typescript
interface CapacityThresholdReachedEvent {
  type: 'CAPACITY_THRESHOLD_REACHED'
  timestamp: Date
  payload: {
    resourceType: 'rooms' | 'restaurant' | 'spa' | 'pool' | 'parking'
    resourceId: string | null
    currentCapacity: number
    maxCapacity: number
    utilizationPercent: number
    trend: 'increasing' | 'stable' | 'decreasing'
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Operations |
| Emitters | State Monitor |
| Listeners | Manager Bots, Revenue Bot |
| Cascades | PricingAdjustment, WaitlistActivated |

---

## SYE06: ScheduledJobTriggered
```typescript
interface ScheduledJobTriggeredEvent {
  type: 'SCHEDULED_JOB_TRIGGERED'
  timestamp: Date
  payload: {
    jobId: string
    jobType: string
    scheduledTime: Date
    actualTime: Date
    parameters: Record<string, any>
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Automation |
| Emitters | Scheduler |
| Listeners | Relevant Service Bots |
| Cascades | JobActionExecuted |

---

# 💰 FINANCIAL EVENTS

## FE01: PaymentProcessed
```typescript
interface PaymentProcessedEvent {
  type: 'PAYMENT_PROCESSED'
  timestamp: Date
  payload: {
    paymentId: string
    folioId: string
    guestId: string
    amount: number
    method: string
    status: 'success' | 'declined' | 'pending'
    reference: string
    gatewayResponse: string
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Financial |
| Emitters | Payment Service |
| Listeners | State Monitor, Finance Bot, Guest Bot |
| Cascades | FolioUpdated, ReceiptGenerated |

---

## FE02: RefundIssued
```typescript
interface RefundIssuedEvent {
  type: 'REFUND_ISSUED'
  timestamp: Date
  payload: {
    refundId: string
    originalPaymentId: string
    amount: number
    reason: string
    approvedBy: string
    guestId: string
  }
}
```

| Attribute | Value |
|-----------|-------|
| Category | Financial |
| Emitters | Manager Bot, System |
| Listeners | Finance Bot, State Monitor |
| Cascades | FolioAdjusted, GuestNotified |

---

# 📊 EVENT SUMMARY

## By Category

| Category | Event Count | Key Events |
|----------|-------------|------------|
| Guest Lifecycle | 6 | Arrived, CheckIn, CheckOut |
| F&B | 4 | OrderPlaced, ItemReady |
| Staff Operations | 5 | ShiftStarted, TaskCompleted |
| Management | 3 | DecisionMade, RateChanged |
| System | 6 | ClockTick, Alert, Assertion |
| Financial | 2 | PaymentProcessed, Refund |
| **TOTAL** | **26** | **Core Simulation Events** |

---

## Event Flow Example

```
Lunch Rush Event Sequence:
──────────────────────────

12:00 SimulationClockTick
  │
  ├─▶ GuestOrderPlaced (Guest #1)
  │     └─▶ KitchenOrderReceived
  │           └─▶ InventoryReserved
  │
  ├─▶ GuestOrderPlaced (Guest #2)
  ├─▶ GuestOrderPlaced (Guest #3)
  │
  ├─▶ CapacityThresholdReached (Kitchen > 80%)
  │     └─▶ AlertTriggered (Warning)
  │
12:15 SimulationClockTick
  │
  ├─▶ OrderItemReady (Guest #1, Item 1)
  │     └─▶ ServerNotified
  │
  ├─▶ GuestComplained (Guest #4, slow service)
  │     └─▶ StaffEscalated
  │           └─▶ ManagerDecisionMade (comp appetizer)
  │
12:30 SimulationClockTick
  │
  └─▶ AssertionFailed (AvgPrepTime > 20 min)
        └─▶ AlertTriggered (Warning)
```

---

*Document created: February 2, 2026*
