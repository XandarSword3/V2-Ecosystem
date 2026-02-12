# Actor Profiles
## Behavior Trees and Personas for Simulation Actors

**Version:** 1.0  
**Created:** February 2, 2026  
**Purpose:** Define realistic behavior patterns for each actor type

---

## 📋 Profile Documentation Format

Each actor profile includes:
- **Persona:** Character background and motivation
- **Behavior Pattern:** Typical action sequence
- **Decision Tree:** How the actor chooses actions
- **Time Distribution:** When actions occur
- **Interaction Triggers:** Events that prompt reactions

---

# 🧳 GUEST PROFILES

## GP01: Business Traveler
**Actor Count:** 10

### Persona
> **Name Pattern:** Alex, Jordan, Taylor, Morgan, Casey  
> **Age Range:** 28-55  
> **Travel Purpose:** Corporate meetings, conferences  
> **Budget:** Company expense account (flexible)  
> **Stay Duration:** 1-3 nights  
> **Loyalty Status:** Often Gold/Platinum

### Behavior Pattern
```
Day Before Arrival:
├── Complete mobile pre-registration (80%)
├── Request early check-in (40%)
└── Book dinner reservation (30%)

Arrival Day:
├── Check in: 14:00-18:00 (peak: 16:00)
│   ├── Use mobile check-in (60%)
│   └── Front desk (40%)
├── Work in room: 18:00-20:00
├── Dinner:
│   ├── Restaurant (50%) → Order quickly, charge to room
│   ├── Room service (30%) → Working dinner
│   └── Off-property (20%)
└── Bar: 21:00-23:00 (40% probability)

Stay Days:
├── Early wake-up: 06:00-07:00
├── Gym: 06:30-07:30 (30%)
├── Breakfast: 07:00-08:30
│   └── Quick service preferred
├── Leave for meetings: 08:30
├── Return: 18:00-20:00
├── Work in room: 18:00-21:00
├── Late room service (40%)
└── Bar networking (30%)

Departure:
├── Express checkout (70%)
├── Early departure: 06:00-09:00
├── Request late checkout (20%)
└── Feedback: Quick rating, rarely detailed review
```

### Decision Tree
```javascript
function decideNextAction(currentTime, state) {
  if (state.hasUnfinishedWork && currentTime.hour < 22) {
    return 60% -> 'workInRoom'
    return 20% -> 'orderRoomService'  
    return 20% -> 'goToBar'
  }
  
  if (currentTime.hour >= 18 && !state.hadDinner) {
    return weightedChoice({
      'restaurantDinner': 50,
      'roomService': 30,
      'skip': 20  // eating offsite
    })
  }
  
  if (currentTime.hour >= 6 && currentTime.hour < 8 && !state.exercised) {
    return 30% -> 'useGym'
  }
  
  if (needsCheckout(state)) {
    return state.inHurry ? 'expressCheckout' : 'deskCheckout'
  }
}
```

### Time Distribution
| Action | Time Window | Peak | Probability |
|--------|-------------|------|-------------|
| Check-in | 14:00-18:00 | 16:00 | 100% |
| Gym | 06:00-08:00 | 06:30 | 30% |
| Breakfast | 07:00-09:00 | 07:30 | 70% |
| Room Service | 19:00-22:00 | 20:00 | 40% |
| Bar | 21:00-24:00 | 22:00 | 40% |
| Checkout | 06:00-12:00 | 08:00 | 100% |

### Interaction Triggers
| Event | Response | Probability |
|-------|----------|-------------|
| WiFi slow | Report issue | 90% |
| Room service late | Complain | 60% |
| Upgrade offered | Accept | 85% |
| Loyalty recognition | Positive mood | 70% |
| Meeting room issue | Escalate quickly | 80% |

---

## GP02: Family Vacationer
**Actor Count:** 12

### Persona
> **Name Pattern:** The Smiths, The Johnsons, The Garcias  
> **Composition:** 2 adults + 1-3 children  
> **Age Range:** 30-50 (adults), 4-16 (children)  
> **Travel Purpose:** Leisure, school holidays  
> **Budget:** Mid-range, watching costs  
> **Stay Duration:** 3-7 nights  
> **Loyalty Status:** Silver or non-member

### Behavior Pattern
```
Pre-Arrival:
├── Research amenities extensively
├── Book multiple rooms if needed (30%)
├── Request connecting rooms (60%)
├── Pre-book activities (40%)
└── Note dietary requirements (50%)

Arrival Day:
├── Check in: 14:00-17:00 (often early arrivals)
│   └── Request early check-in (60%)
├── Room inspection (always)
│   └── Request extra beds/cribs (40%)
├── Pool: First stop (70%)
├── Restaurant dinner: 18:00-19:30
│   ├── Request kids menu
│   ├── Order multiple courses
│   └── Charge to room
└── Early night: Kids tired

Stay Days:
├── Breakfast: 08:00-10:00 (leisurely)
├── Pool: 10:00-12:00
├── Lunch: 12:00-13:30
│   └── Often poolside snacks
├── Activities/excursions: 14:00-17:00
├── Pool or rest: 17:00-18:30
├── Dinner: 18:30-20:00
│   └── Always restaurant (kids can't wait for room service)
├── Kids activities: 20:00-21:00
└── Adults bar (if kids club): 21:00-23:00 (30%)

Departure:
├── Late checkout request (80%)
├── Pool morning (60%)
├── Last lunch (40%)
└── Detailed review likely
```

### Decision Tree
```javascript
function decideNextAction(currentTime, state, familyState) {
  // Kids' needs often drive decisions
  if (familyState.kidsHungry || familyState.kidsComplaining) {
    return immediateAction('restaurant' || 'snackBar')
  }
  
  if (currentTime.hour >= 10 && currentTime.hour < 18 && state.weather === 'sunny') {
    return weightedChoice({
      'pool': 40,
      'activities': 30,
      'restaurant': 20,
      'rest': 10
    })
  }
  
  if (familyState.kidsTired) {
    return 'returnToRoom'
  }
  
  if (currentTime.hour >= 18 && currentTime.hour < 20) {
    return 'restaurantDinner' // almost always
  }
  
  if (familyState.kidsAsleep && state.hasKidsClub) {
    return 40% -> 'bar'
    return 30% -> 'spa' // one parent
    return 30% -> 'roomRelax'
  }
}
```

### Time Distribution
| Action | Time Window | Peak | Probability |
|--------|-------------|------|-------------|
| Check-in | 14:00-17:00 | 15:00 | 100% |
| Pool | 10:00-18:00 | 11:00, 16:00 | 90%/day |
| Breakfast | 08:00-10:00 | 09:00 | 95% |
| Lunch | 12:00-14:00 | 12:30 | 80% |
| Dinner | 18:00-20:00 | 18:30 | 100% |
| Kids Club | 20:00-22:00 | 20:30 | 40% |
| Activities | 10:00-17:00 | 14:00 | 60% |

### Interaction Triggers
| Event | Response | Probability |
|-------|----------|-------------|
| Pool crowded | Complain | 40% |
| Kids menu limited | Request alternatives | 70% |
| Room issue | Report quickly | 90% |
| Activities sold out | Disappointed, request waitlist | 80% |
| Free kids activity | Very positive | 95% |
| Long restaurant wait | Very frustrated | 90% |

---

## GP03: Romantic Couple
**Actor Count:** 8

### Persona
> **Name Pattern:** Sarah & Mike, Emma & James  
> **Age Range:** 25-45  
> **Travel Purpose:** Anniversary, honeymoon, getaway  
> **Budget:** Higher than usual (special occasion)  
> **Stay Duration:** 2-4 nights  
> **Loyalty Status:** Varies

### Behavior Pattern
```
Pre-Arrival:
├── Request room with view (80%)
├── Book spa couples treatment (60%)
├── Reserve special dinner (70%)
├── Request champagne/flowers (30%)
└── Note celebration occasion (50%)

Arrival Day:
├── Check in: 15:00-18:00
│   └── Prefer upgrade if available
├── Room appreciation time
├── Spa or pool: 16:00-18:00 (50%)
├── Special dinner: 19:30-22:00
│   ├── Wine pairing
│   ├── Multiple courses
│   └── Linger over dessert
└── Bar for nightcap (40%)

Stay Days:
├── Late wake-up: 09:00-10:00
├── Room service breakfast (70%)
│   └── Or late leisurely restaurant breakfast
├── Spa treatment: 10:00-14:00 (60%)
├── Lazy pool/beach: 14:00-17:00
├── Pre-dinner drinks: 18:00-19:00
├── Dinner: 19:30-22:00
│   └── Different restaurant each night
└── Late night activities: bar, room

Departure:
├── Late checkout (almost always request)
├── Final brunch (60%)
└── Write detailed positive review (if good experience)
```

### Decision Tree
```javascript
function decideNextAction(currentTime, state, coupleState) {
  // Romance-focused decisions
  if (coupleState.celebratingTonight) {
    return prioritize('specialDinner', 'champagneOrder', 'spaBooking')
  }
  
  if (currentTime.hour >= 9 && currentTime.hour < 11 && !state.hadBreakfast) {
    return coupleState.feelingLazy 
      ? 'roomServiceBreakfast' 
      : 'lateRestaurantBreakfast'
  }
  
  if (!state.hadSpaToday && coupleState.spaBooked) {
    return 'attendSpa'
  }
  
  if (currentTime.hour >= 14 && currentTime.hour < 18) {
    return weightedChoice({
      'pool': 50,
      'spa': 20,
      'explore': 20,
      'roomTime': 10
    })
  }
  
  if (currentTime.hour >= 19 && !state.hadDinner) {
    return 'fineDining' // Always restaurant, never room service for dinner
  }
}
```

### Time Distribution
| Action | Time Window | Peak | Probability |
|--------|-------------|------|-------------|
| Wake up | 09:00-11:00 | 10:00 | 100% |
| Breakfast | 10:00-12:00 | 10:30 | 90% |
| Spa | 10:00-16:00 | 11:00 | 60%/stay |
| Pool | 14:00-18:00 | 15:00 | 70% |
| Pre-dinner drinks | 18:00-19:30 | 18:30 | 60% |
| Dinner | 19:30-22:30 | 20:00 | 100% |
| Bar | 22:00-01:00 | 23:00 | 50% |

### Interaction Triggers
| Event | Response | Probability |
|-------|----------|-------------|
| Free upgrade | Extremely positive | 100% |
| Celebration recognized | Very positive | 95% |
| Noise from neighbors | Complain | 80% |
| Spa fully booked | Disappointed, try alternatives | 70% |
| Poor restaurant experience | Major complaint | 85% |
| Special touch (flowers, etc.) | Rave review | 90% |

---

## GP04: VIP / Loyalty Member
**Actor Count:** 3

### Persona
> **Name Pattern:** Distinguished names  
> **Age Range:** 35-65  
> **Loyalty Status:** Platinum/Diamond  
> **Budget:** High  
> **Expectations:** Very high  
> **Stay Frequency:** 10+ stays/year

### Behavior Pattern
```
Pre-Arrival:
├── Expect recognition immediately
├── Preferences already on file
├── Suite upgrade expected
└── Personal call from GM (expected for Diamond)

Arrival:
├── Express check-in or personal escort
├── Welcome amenity expected
├── Room must be perfect
└── Any issue = immediate escalation

During Stay:
├── Uses all premium services
├── Expects immediate service
├── Name recognition at all outlets
├── Priority reservations
└── Complimentary upgrades expected

Departure:
├── Seamless checkout
├── Personal farewell
└── Influence through reviews
```

### Decision Tree
```javascript
function decideNextAction(currentTime, state, vipState) {
  // VIPs expect immediate service
  if (state.waitingForService && state.waitTime > 2_MINUTES) {
    return 'escalateToManager'
  }
  
  if (vipState.notRecognized) {
    state.mood = 'frustrated'
    return 'remindOfStatus'
  }
  
  // Uses all amenities
  return fullServicePattern()
}
```

### Interaction Triggers
| Event | Response | Probability |
|-------|----------|-------------|
| Not recognized | Immediate complaint | 95% |
| No upgrade available | Disappointed, note in review | 80% |
| Exceptional service | Positive feedback to GM | 70% |
| Any service failure | Escalate to management | 90% |
| Wait time > 5 min | Expect compensation | 85% |

---

## GP05: Problem Guest
**Actor Count:** 2

### Persona
> **Purpose:** Test complaint handling, escalation workflows  
> **Behavior:** Finds issues, demands compensation

### Behavior Pattern
```
Every Interaction:
├── Find something wrong (80% probability)
├── Request manager (40%)
├── Demand compensation (60%)
├── Threaten bad review (50%)
└── Eventually may be satisfied (70%)
    └── Or leave very negative review (30%)
```

---

# 👔 STAFF PROFILES

## SP01: Front Desk Agent
**Actor Count:** 3

### Persona
> **Shift Pattern:** Morning (7-15), Afternoon (15-23), Night (23-7)  
> **Experience Level:** Varied (junior, mid, senior)  
> **Skills:** Check-in/out, reservations, complaints

### Behavior Pattern
```
Shift Start:
├── Review arrivals/departures
├── Check pending requests
└── Handover from previous shift

During Shift:
├── Process check-ins (as guests arrive)
├── Process check-outs (as guests leave)
├── Handle walk-ins
├── Answer questions
├── Process requests
├── Handle complaints (escalate if needed)
└── Coordinate with housekeeping

Shift End:
├── Complete pending tasks
├── Prepare handover
└── Clock out
```

### Decision Tree
```javascript
function processTask(taskQueue) {
  // Priority order
  if (hasVIPWaiting()) return handleVIP()
  if (hasComplaintEscalation()) return handleComplaint()
  if (hasCheckOutQueue()) return processCheckOut()
  if (hasCheckInQueue()) return processCheckIn()
  if (hasPhoneRinging()) return answerPhone()
  return handleGeneralInquiry()
}
```

---

## SP02: Kitchen Staff
**Actor Count:** 3

### Persona
> **Positions:** Line cook, prep cook, expeditor  
> **Shift Pattern:** Breakfast, Lunch, Dinner  
> **Skills:** Food prep, timing, quality

### Behavior Pattern
```
Order Received:
├── View on KDS
├── Acknowledge order
├── Prep time assessment
├── Start cooking
├── Mark item ready
├── Quality check
└── Send to expo

Continuous:
├── Monitor inventory
├── Flag low stock
├── Maintain station
└── Communicate with servers
```

### Decision Tree
```javascript
function processOrders(orderQueue) {
  const sorted = sortByPriority(orderQueue, {
    vip: 10,
    longWait: 8,
    fireCourse: 7,
    newOrder: 5
  })
  
  return processNext(sorted[0])
}
```

---

## SP03: Housekeeping Staff
**Actor Count:** 3

### Persona
> **Shift Pattern:** 8:00-16:00 (most), 14:00-22:00 (turndown)  
> **Skills:** Room cleaning, turnover, inspections

### Behavior Pattern
```
Shift Start:
├── Receive room assignments
├── Load cart with supplies
└── Review VIP/special requests

During Shift:
├── Clean rooms in assigned order
│   ├── Departure rooms (priority)
│   ├── Stay-over rooms
│   └── VIP rooms (extra attention)
├── Mark rooms complete
├── Report issues found
└── Restock supplies as needed

Shift End:
├── Return cart
├── Report incomplete rooms
└── Clock out
```

---

# 📊 MANAGER PROFILES

## MP01: F&B Manager
**Actor Count:** 1

### Persona
> **Responsibilities:** Restaurant, bar, room service, pool bar  
> **Shift:** 10:00-20:00 (flexible)  
> **Focus:** Service quality, revenue, complaints

### Behavior Pattern
```
Daily:
├── Review previous day metrics
├── Check inventory alerts
├── Floor presence during peak
├── Handle escalated complaints
├── Approve comps/adjustments
├── Staff communication
└── Daily close review

Peak Times (Lunch/Dinner):
├── Monitor kitchen queue
├── Check table turnover
├── Handle VIP tables
├── Resolve issues immediately
└── Staff support
```

### Decision Tree
```javascript
function prioritizeActions(alerts) {
  if (hasGuestComplaint()) return handleComplaintImmediately()
  if (hasKitchenBackup()) return supportKitchen()
  if (hasStaffIssue()) return addressStaffing()
  if (hasInventoryAlert()) return reviewInventory()
  return monitorOperations()
}
```

---

## MP02: Revenue Manager
**Actor Count:** 1

### Persona
> **Responsibilities:** Pricing, forecasting, channel management  
> **Shift:** 9:00-18:00  
> **Focus:** Occupancy optimization, revenue maximization

### Behavior Pattern
```
Daily:
├── Review overnight bookings
├── Check rate parity alerts
├── Review pickup pace
├── Adjust rates if needed
├── Competitor rate check
├── Demand forecast review
└── Channel performance

Weekly:
├── Forecast accuracy review
├── Promotion performance
├── Strategy adjustment
└── Group pricing review

Triggers:
├── Low pickup → Consider rate reduction
├── High pickup → Consider rate increase
├── Competitor change → Analyze and respond
├── Parity violation → Investigate and resolve
└── Event announced → Adjust strategy
```

---

# 🔧 ADMIN PROFILES

## AP01: System Administrator
**Actor Count:** 1

### Persona
> **Responsibilities:** Configuration, integrations, security  
> **Availability:** Business hours + on-call  
> **Focus:** System stability, compliance

### Behavior Pattern
```
Daily:
├── Review system alerts
├── Check integration status
├── Review security logs
├── Process access requests
└── Configuration changes

Weekly:
├── Backup verification
├── User access audit
├── Performance review
├── Integration health check
└── Compliance checklist

On-Demand:
├── New integration setup
├── User management
├── Troubleshooting
├── GDPR requests
└── Emergency response
```

---

# 📊 PROFILE SUMMARY

| Actor Type | Profile Count | Key Behaviors |
|------------|---------------|---------------|
| Guest | 5 | Business, Family, Couple, VIP, Problem |
| Staff | 3 | Front Desk, Kitchen, Housekeeping |
| Manager | 2 | F&B, Revenue |
| Admin | 1 | System Admin |
| **TOTAL** | **11** | **Comprehensive Coverage** |

---

*Document created: February 2, 2026*
