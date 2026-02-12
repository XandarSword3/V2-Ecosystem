# Scenario Definitions
## 5 Test Scenarios with Complete Configurations

**Version:** 1.0  
**Created:** February 2, 2026  
**Purpose:** Define comprehensive test scenarios that exercise all system capabilities

---

## 📋 Scenario Documentation Format

Each scenario includes:
- **Overview:** Purpose and goals
- **Duration:** Simulated time period
- **Actor Configuration:** Number and types of actors
- **Initial State:** Starting conditions
- **Injected Events:** Scheduled scenario events
- **Success Criteria:** What must pass
- **Metrics to Capture:** What to measure

---

# 📊 SCENARIO 1: NORMAL DAY

## Overview
A typical Tuesday in the resort. Moderate occupancy, normal operations, no special events. This is the baseline scenario to validate that all systems work correctly under standard conditions.

## Configuration

### Timing
| Parameter | Value |
|-----------|-------|
| Simulated Duration | 24 hours (06:00 - 06:00) |
| Real-Time Duration | ~30 minutes (48x speed) |
| Clock Tick Interval | 5 simulated minutes |

### Initial State
```yaml
hotel_state:
  total_rooms: 100
  occupancy_start: 65%  # 65 rooms occupied at 06:00
  
  arrivals_today: 23
  departures_today: 18
  stayovers: 47
  
  room_status:
    clean: 30
    occupied: 65
    dirty: 5
    ooo: 0

restaurant_state:
  breakfast_capacity: 80
  lunch_capacity: 60
  dinner_capacity: 60
  current_reservations:
    breakfast: 0
    lunch: 12
    dinner: 25

housekeeping_state:
  staff_morning: 3
  staff_afternoon: 2
  rooms_to_clean: 18 (departures) + 47 (stayovers) = 65
```

### Actor Distribution
| Actor Type | Count | Configuration |
|------------|-------|---------------|
| Business Travelers | 8 | Standard behavior |
| Family Vacationers | 6 | School holiday mode: off |
| Romantic Couples | 4 | Standard behavior |
| Solo Explorers | 3 | Standard behavior |
| VIP Guests | 2 | Gold tier |
| Problem Guests | 0 | Not in normal day |
| Front Desk Agents | 2 | Shifts: 07-15, 15-23 |
| Kitchen Staff | 3 | Shifts: 06-14, 11-19, 17-01 |
| Housekeeping | 3 | Shift: 08-16 |
| Servers | 2 | Shifts: 07-15, 17-01 |
| F&B Manager | 1 | Shift: 10-20 |
| Duty Manager | 1 | Shift: 08-20 |

### Timeline of Injected Events
```
06:00 - Simulation starts
06:30 - Night auditor completes close
07:00 - Day staff arrive
07:00-10:00 - Breakfast service
        - 45 guests expected (70% of in-house)
08:00 - Housekeeping starts
        - Priority: Today's arrivals
10:00-12:00 - Checkouts trickle in
        - 18 departures throughout morning
11:00 - First early arrival requests
12:00-14:00 - Lunch service
        - 25 covers expected
14:00-18:00 - Check-in peak
        - 23 arrivals
        - VIP at 15:30
17:00 - Turndown service begins (for VIP/suites)
18:30-21:30 - Dinner service
        - 40 covers expected
22:00 - Operations wind down
23:00 - Night audit begins
```

### Success Criteria
| # | Criterion | Threshold |
|---|-----------|-----------|
| 1 | All checkouts processed | 100% |
| 2 | All arrivals checked in | 100% |
| 3 | Average check-in time | < 8 minutes |
| 4 | Room ready for all arrivals | 100% |
| 5 | Kitchen avg prep time | < 20 minutes |
| 6 | No critical assertions failed | 0 |
| 7 | Payment reconciliation | 100% match |
| 8 | Loyalty points calculated | All accurate |

### Metrics to Capture
- Check-in/out times and wait times
- Kitchen ticket times
- Housekeeping turnaround
- Restaurant covers and revenue
- Complaints (should be minimal)
- Staff utilization rates

---

# 📊 SCENARIO 2: LUNCH RUSH

## Overview
A stress test for F&B operations. High-demand lunch period with restaurant at full capacity, kitchen stressed, servers overwhelmed. Tests queue management, kitchen performance, and complaint handling.

## Configuration

### Timing
| Parameter | Value |
|-----------|-------|
| Simulated Duration | 3 hours (11:00 - 14:00) |
| Real-Time Duration | ~10 minutes (18x speed) |
| Clock Tick Interval | 2 simulated minutes |

### Initial State
```yaml
hotel_state:
  occupancy: 85%
  in_house_guests: 85

restaurant_state:
  capacity: 60 seats
  reservations_11:30: 15
  reservations_12:00: 20
  reservations_12:30: 18
  reservations_13:00: 12
  total_expected: 65 (over capacity!)
  
kitchen_state:
  staff: 3
  prep_capacity: 40 orders/hour
  inventory: normal levels
```

### Actor Distribution
| Actor Type | Count | Behavior Mode |
|------------|-------|---------------|
| Hungry Guests | 50 | Aggressive dining behavior |
| Business Lunchers | 15 | Quick service demanded |
| Family Groups | 10 | Large orders, slow dining |
| Walk-ins | 10 | No reservation, expect seating |
| Servers | 2 | Overwhelmed mode |
| Kitchen Staff | 3 | Maximum output |
| F&B Manager | 1 | Crisis management |
| Host | 1 | Waitlist management |

### Injected Events Timeline
```
11:00 - Scenario starts
        - Kitchen begins prep
        - First reservations arrive early
        
11:30 - First reservation wave (15 people)
        - All tables seating
        - Orders start flowing
        
11:45 - Walk-ins begin arriving
        - Waitlist activated
        - Wait time: 15 min
        
12:00 - Peak arrival (20 reservations + walk-ins)
        - All tables full
        - Kitchen queue: 25 orders
        - Wait time: 25 min
        
12:15 - Kitchen backs up
        - Avg ticket time: 22 min
        - First complaint about wait
        
12:30 - Second wave (18 reservations)
        - Some reservations can't be seated on time
        - Complaints increase
        - Manager intervention needed
        
12:45 - INJECT: One item 86'd (popular dish)
        - Servers must inform guests
        - Substitutions needed
        
13:00 - INJECT: VIP walk-in demands table
        - Priority seating decision
        - Regular guest displaced?
        
13:15 - Kitchen starts clearing backlog
        - Ticket times improving
        
13:30 - Peak subsides
        - Table turnover begins
        - Waitlist clearing
        
14:00 - Scenario ends
        - Measure final metrics
```

### Success Criteria
| # | Criterion | Threshold |
|---|-----------|-----------|
| 1 | All guests eventually served | 100% |
| 2 | No guest walks out unserved | 0 walkouts |
| 3 | Kitchen max ticket time | < 35 minutes |
| 4 | Complaints handled | 100% acknowledged |
| 5 | VIP handled appropriately | Special treatment |
| 6 | 86 communicated to all servers | Within 1 min |
| 7 | Revenue captured | All bills paid |

### Metrics to Capture
- Peak queue depth
- Maximum wait time
- Ticket time distribution
- Complaints per 15-min period
- Comps given
- Table turnover rate
- Server steps (efficiency)
- Kitchen output rate
- Guest satisfaction scores

---

# 📊 SCENARIO 3: EVENT DAY

## Overview
A major corporate event with 200 attendees plus regular hotel operations. Tests group booking, conference facilities, catering, and coordination between event and hotel operations.

## Configuration

### Timing
| Parameter | Value |
|-----------|-------|
| Simulated Duration | 14 hours (07:00 - 21:00) |
| Real-Time Duration | ~25 minutes (35x speed) |
| Clock Tick Interval | 5 simulated minutes |

### Initial State
```yaml
hotel_state:
  occupancy: 92%  # High due to event
  room_block: 40 rooms for conference attendees
  
event_state:
  name: "TechCorp Annual Conference"
  attendees: 200
  schedule:
    - 08:00-09:00: Registration & Breakfast
    - 09:00-12:00: Morning Sessions
    - 12:00-13:30: Lunch (catered)
    - 13:30-17:00: Afternoon Sessions
    - 17:00-18:00: Break
    - 18:00-21:00: Gala Dinner
    
  rooms_booked:
    - Grand Ballroom (plenary)
    - Meeting Room A (breakout)
    - Meeting Room B (breakout)
    - Meeting Room C (breakout)
    
  catering:
    breakfast: Continental for 200
    lunch: Plated for 200
    coffee_breaks: 4 × 200
    dinner: 3-course for 200
```

### Actor Distribution
| Actor Type | Count | Notes |
|------------|-------|-------|
| Conference Attendees | 150 | External (not staying) |
| Conference Attendees | 40 | Hotel guests (room block) |
| Event Organizer | 2 | VIP, demanding |
| Regular Hotel Guests | 55 | Non-event |
| Banquet Staff | 10 | Event dedicated |
| Kitchen Staff | 5 | Enhanced for event |
| AV Technician | 2 | Technical support |
| Event Manager | 1 | Coordination |
| F&B Manager | 1 | Oversight |
| Front Desk | 3 | Extra for group check-in |

### Injected Events Timeline
```
07:00 - Event setup begins
        - Ballroom configured
        - AV tested
        - Registration desk set up

08:00 - MASS CHECK-IN: 30 attendees arrive together
        - Group check-in process
        - Keys issued in batch
        - Luggage storage for early arrivals

08:00-09:00 - Registration & Breakfast
        - 200 people through registration
        - Continental breakfast served

09:00 - Sessions begin
        - Regular hotel operations continue
        
10:30 - Coffee break (200)
        - Catering delivered
        - 15-minute window
        
12:00 - LUNCH SERVICE: 200 plated lunches
        - Simultaneous with regular restaurant lunch
        - Kitchen at maximum capacity
        
13:00 - INJECT: AV failure in main room
        - Technician dispatched
        - Session delayed 15 min
        - Attendees frustrated
        
15:00 - Coffee break
        
17:00 - Break period
        - Attendees scatter to hotel amenities
        - Pool, bar, spa all see surge
        
18:00 - Gala dinner setup (30 min)
        - Tables reconfigured
        - Place settings for 200
        
18:30 - INJECT: Organizer finds seating chart wrong
        - 20 place cards need moving
        - Staff scramble
        
19:00 - Gala dinner service
        - 3-course meal for 200
        - Speeches between courses
        - Bar service active
        
21:00 - Event concludes
        - Bar remains open
        - Teardown begins
```

### Success Criteria
| # | Criterion | Threshold |
|---|-----------|-----------|
| 1 | Group check-in time | < 3 min/person |
| 2 | All meals served on time | < 15 min variance |
| 3 | AV issue resolved | < 20 minutes |
| 4 | Regular guests not impacted | No complaints |
| 5 | Event organizer satisfied | No major issues |
| 6 | Event charges captured | 100% billed |
| 7 | Teardown completed | By midnight |

### Metrics to Capture
- Group check-in throughput
- Catering service times
- Staff utilization
- Cross-contamination (event vs regular)
- Issue resolution times
- Revenue per event
- Guest satisfaction (both event and regular)

---

# 📊 SCENARIO 4: STRESS TEST

## Overview
Everything goes wrong. Overbooking, system failures, staff shortages, complaints everywhere. Tests resilience, failover, escalation paths, and recovery procedures.

## Configuration

### Timing
| Parameter | Value |
|-----------|-------|
| Simulated Duration | 8 hours (14:00 - 22:00) |
| Real-Time Duration | ~20 minutes (24x speed) |
| Clock Tick Interval | 2 simulated minutes |

### Initial State
```yaml
hotel_state:
  rooms: 100
  sold: 105  # OVERBOOKED BY 5!
  occupied: 78
  arrivals: 27 (but only 22 rooms available after checkouts)
  departures: 20
  late_checkouts: 5 (blocking rooms)
  
  problems:
    - 2 rooms OOO (AC broken)
    - 1 room flooded (discovered this morning)
    - Night staff called in sick (short-staffed)
    
staff_state:
  front_desk: 1 (should be 2)
  housekeeping: 2 (should be 3)
  kitchen: 2 (should be 3)
```

### Actor Distribution
| Actor Type | Count | Behavior Mode |
|------------|-------|---------------|
| Arriving Guests | 27 | Normal expectations |
| Overbooked Guests | 5 | Will be walked |
| Problem Guests | 3 | Already frustrated |
| VIP Guest | 1 | Expecting perfection |
| Departing Guests | 20 | Some want late checkout |
| Front Desk | 1 | Overwhelmed |
| Housekeeping | 2 | Rushing |
| Kitchen | 2 | Reduced capacity |
| Duty Manager | 1 | Crisis mode |

### Injected Events Timeline
```
14:00 - Scenario starts
        - 5 late checkouts refusing to leave
        - Front desk queue already building
        
14:30 - INJECT: Payment system goes down
        - Cannot process payments
        - Manual authorization needed
        - 10-minute outage
        
15:00 - First overbook situation
        - Guest arrives, no room available
        - Walk procedure initiated
        - Guest extremely upset
        
15:15 - INJECT: VIP arrives, suite not ready
        - Housekeeping still cleaning
        - Manager must handle
        
15:30 - Second overbook walk
        - Different situation (room OOO)
        - Compensation negotiation
        
16:00 - INJECT: Kitchen equipment failure
        - One oven down
        - Menu items limited
        - Dinner prep compromised
        
16:30 - Late checkout guest finally leaves
        - Creates housekeeping rush
        - 3 arrivals waiting for this room type
        
17:00 - Complaint cascade begins
        - Multiple guests unhappy
        - Social media threat
        - Manager juggling multiple issues
        
17:30 - INJECT: Fire alarm (false)
        - Evacuation procedure
        - 15-minute disruption
        - Guests assembled outside
        
18:00 - Return to building
        - Dinner service must start
        - Kitchen behind schedule
        
18:30 - Dinner service struggles
        - Long wait times
        - Order mistakes
        - Comps accumulating
        
19:00 - INJECT: Guest medical emergency
        - EMT called
        - Room blocked
        - Staff occupied
        
20:00 - Situation stabilizing
        - Most guests settled
        - Comps totaled
        
21:00 - Evening wind-down
        - Incident reports filed
        - Recovery mode
        
22:00 - Scenario ends
        - Damage assessment
```

### Success Criteria
| # | Criterion | Threshold |
|---|-----------|-----------|
| 1 | All walked guests accommodated | 100% at partner hotel |
| 2 | VIP ultimately satisfied | No complaint letter |
| 3 | Payment system recovered | < 15 min downtime |
| 4 | Fire evacuation proper | All procedures followed |
| 5 | Medical handled correctly | EMT arrived, guest cared for |
| 6 | No data loss | All transactions recovered |
| 7 | Manager handled all escalations | None unresolved |

### Metrics to Capture
- Time to resolve each crisis
- Compensation total ($)
- Guest satisfaction (expect low)
- Staff stress indicators
- Recovery time from each failure
- Procedures followed correctly
- Escalation count

---

# 📊 SCENARIO 5: WEEKEND TURNOVER

## Overview
Saturday and Sunday with complete guest turnover. Saturday sees 80% checkout, Sunday sees 80% new arrivals. Tests housekeeping capacity, room turnover, and the transition between guest populations.

## Configuration

### Timing
| Parameter | Value |
|-----------|-------|
| Simulated Duration | 48 hours (Sat 06:00 - Mon 06:00) |
| Real-Time Duration | ~45 minutes (64x speed) |
| Clock Tick Interval | 10 simulated minutes |

### Initial State (Saturday 06:00)
```yaml
hotel_state:
  occupancy: 95%  # Full weekend
  
saturday:
  departures: 80  # 80% turnover
  arrivals: 15
  stayovers: 15
  
sunday:
  departures: 10
  arrivals: 75  # New week guests arrive
  stayovers: 20
  
housekeeping_state:
  saturday_staff: 5 (all hands on deck)
  sunday_staff: 4
  rooms_to_clean_saturday: 80 + 15 stayovers = 95
  rooms_to_clean_sunday: 10 + 20 stayovers = 30
```

### Actor Distribution
| Actor Type | Count | Timeline |
|------------|-------|----------|
| Weekend Guests (departing Sat) | 75 | Check out 07:00-12:00 |
| Weekend Stayover | 15 | In-house both days |
| Saturday Arrivals | 15 | Check in 14:00-18:00 |
| Sunday Departures | 10 | Check out Sun AM |
| Sunday Arrivals (business) | 60 | Check in Sun 14:00-20:00 |
| Sunday Arrivals (family) | 15 | Check in Sun 14:00-18:00 |
| Housekeeping Sat | 5 | 08:00-18:00 |
| Housekeeping Sun | 4 | 08:00-18:00 |
| Front Desk | 3 | Full coverage |
| Duty Manager | 1 | Each day |

### Injected Events Timeline
```
SATURDAY
─────────
06:00 - Scenario starts
07:00 - First departures begin
08:00 - Housekeeping starts
        - Priority: Quick turnarounds
        - Target: 80 rooms by 14:00
        
10:00 - Departure peak
        - 40 checkouts in 2 hours
        - Front desk queue
        
11:00 - INJECT: 5 late checkout requests
        - Room conflict
        - Sunday arrivals need these rooms
        
12:00 - Checkout deadline
        - 70/80 checked out
        - 10 late departures
        
13:00 - Housekeeping crunch
        - 50 rooms cleaned
        - 30 rooms remaining
        - First arrivals in 1 hour
        
14:00 - First Saturday arrivals
        - Only 60% rooms ready
        - Some guests waiting
        - Complimentary drinks offered
        
15:00 - INJECT: Family arrives early (12:00 booking)
        - Room not ready
        - Kids cranky
        - Manager escalation
        
16:00 - Most rooms turned
        - 75/80 complete
        - Remaining 5 are suites (longer clean)
        
18:00 - All Saturday arrivals checked in
        - Operations normalize
        
19:00-22:00 - Normal Saturday evening
        - Full restaurant
        - Bar busy
        
SUNDAY
───────
08:00 - Quiet morning
        - Only 10 departures
        - Housekeeping: stayovers first
        
10:00 - Departures complete
        - 20 stayover rooms to service
        
12:00 - INJECT: Early business arrivals (3)
        - Rooms not ready
        - Business center offered
        
14:00 - Sunday arrival wave begins
        - 75 arrivals expected
        - 4-hour check-in window
        
14:00-15:00 - First wave: 30 arrivals
        - Front desk queue: 8 deep
        - Mobile check-in promoted
        
15:00-16:00 - Second wave: 25 arrivals
        
16:00 - INJECT: Tour bus arrives (15 guests)
        - All at once
        - Group check-in process
        
17:00-18:00 - Final arrivals
        - 20 more guests
        
19:00 - Full house
        - 95 occupied rooms
        - Restaurant packed
        
22:00 - Sunday evening wind down
        - Business guests in early
        
MONDAY 06:00 - Scenario ends
        - New week begins
```

### Success Criteria
| # | Criterion | Threshold |
|---|-----------|-----------|
| 1 | All Saturday rooms turned | By 18:00 |
| 2 | Saturday check-in wait | < 15 min average |
| 3 | Sunday check-in wait | < 10 min average |
| 4 | Housekeeping completion | 100% by deadline |
| 5 | No guest without room | 0 walks |
| 6 | Late checkout impact | < 30 min delay cascade |
| 7 | Tour bus handled | < 30 min total check-in |

### Metrics to Capture
- Hourly checkout count
- Hourly check-in count
- Room turnaround time
- Queue lengths over time
- Housekeeping productivity
- Staff utilization
- Guest wait times
- Mobile check-in adoption

---

# 📊 SCENARIO COMPARISON

| Metric | Normal | Lunch Rush | Event Day | Stress | Weekend |
|--------|--------|------------|-----------|--------|---------|
| Duration | 24h | 3h | 14h | 8h | 48h |
| Actors | 30 | 80 | 220 | 60 | 150 |
| Complexity | Low | Medium | High | Extreme | High |
| Primary Focus | Baseline | F&B | Groups | Recovery | Housekeeping |
| Failure Injection | None | Minor | Moderate | Severe | Moderate |
| Expected Issues | 0-2 | 5-10 | 10-15 | 20+ | 10-15 |

---

*Document created: February 2, 2026*
