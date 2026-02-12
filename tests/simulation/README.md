# V2 Resort Multi-Actor Simulation System

A comprehensive simulation framework for testing the V2 Resort hospitality platform with realistic, concurrent actor behaviors.

## Overview

This simulation system creates a "digital twin" of resort operations, allowing you to:
- Test all workflows with 50+ concurrent actors
- Verify system behavior under various load conditions
- Validate business rules and SLAs
- Identify race conditions and edge cases
- Measure performance under stress

## Quick Start

```bash
# Install dependencies
cd tests/simulation
npm install

# Run a scenario
npm run run:normal    # Standard weekday operation
npm run run:lunch     # Lunch rush stress test
npm run run:conference # Conference day simulation
npm run run:stress    # Maximum load test
npm run run:weekend   # Weekend turnover
```

## Architecture

```
tests/simulation/
├── src/
│   ├── events/           # Event bus and types
│   │   └── EventBus.ts   # Central event system
│   ├── orchestrator/     # Simulation control
│   │   ├── ClockManager.ts       # Time management
│   │   └── SimulationOrchestrator.ts
│   ├── actors/           # Actor implementations
│   │   ├── base/         # Base Actor class
│   │   ├── guests/       # Guest bots (6 profiles)
│   │   ├── staff/        # Staff bots (5 types)
│   │   ├── managers/     # Manager bots (3 types)
│   │   └── admins/       # Admin bots (3 types)
│   ├── assertions/       # Validation engine
│   │   └── AssertionEngine.ts
│   └── scenarios/        # Pre-built scenarios
│       └── ScenarioDefinitions.ts
├── scripts/
│   └── run-scenario.ts   # CLI runner
└── docs/                 # Planning documents
```

## Actor Types

### Guests (72 total in stress test)
- **Business Traveler**: Fast-paced, expense account, complains about time
- **Family Vacationer**: Kids activities, budget-conscious, family dining
- **Luxury Seeker**: High expectations, spa/fine dining, premium services
- **Budget Conscious**: Value-focused, uses deals, minimal extras
- **Honeymooner**: Romantic packages, privacy, special occasions
- **Conference Attendee**: Event-focused, networking, group activities

### Staff
- **Front Desk Agent**: Check-ins, check-outs, guest requests
- **Housekeeping Staff**: Room cleaning, issue reporting
- **Kitchen Staff**: Order preparation, prep work, 86'ing items
- **Server/Waitstaff**: Table service, orders, payments
- **Spa Therapist**: Treatments, room preparation

### Managers
- **Front Office Manager**: Room escalations, billing issues
- **F&B Manager**: Kitchen oversight, service complaints
- **Duty Manager**: All-areas authority, high-severity issues

### Admins
- **Revenue Manager**: Rate parity, pricing rules, forecasting
- **Marketing Admin**: Campaigns, email journeys, segments
- **System Admin**: Health checks, integrations, maintenance

## Scenarios

### 1. Normal Weekday Operation
- 65% occupancy
- Standard dining patterns
- Typical spa bookings
- 40 guests, 40 staff, 3 managers

### 2. Lunch Rush
- 90% restaurant occupancy
- 11:30 AM - 2:00 PM window
- Kitchen stress testing
- Extra F&B staff

### 3. Conference Day
- 150-person event
- Bulk check-in
- Banquet service
- Meeting room coordination

### 4. Stress Test
- 95% occupancy
- All venues at capacity
- Multiple concurrent events
- Maximum staff deployment

### 5. Weekend Turnover
- 60% checkout morning
- 70% check-in afternoon
- Heavy housekeeping load
- Family guest mix

## Assertions

Built-in validations include:
- Check-in time limits (< 15 minutes)
- Order fulfillment times (< 25 minutes)
- Complaint acknowledgement (< 30 minutes)
- Room turnover efficiency
- Escalation thresholds
- Payment success rates
- Guest satisfaction levels

## Programmatic Usage

```typescript
import { 
  SimulationOrchestrator, 
  NormalWeekdayScenario,
  CommonAssertions 
} from '@v2-resort/simulation';

const orchestrator = new SimulationOrchestrator('http://localhost:3005');

// Load a scenario
await orchestrator.loadScenario(NormalWeekdayScenario);

// Start simulation
await orchestrator.start();

// Get results
const results = orchestrator.getResults();
console.log(`Passed: ${results.assertions.passed}/${results.assertions.total}`);

// Cleanup
orchestrator.destroy();
```

## Custom Scenarios

```typescript
import { ScenarioConfig, CommonAssertions } from '@v2-resort/simulation';

const MyScenario: ScenarioConfig = {
  name: 'My Custom Scenario',
  description: 'Testing specific workflow',
  duration: { days: 1 },
  timeMultiplier: 60,
  actors: {
    guests: { business: 10, family: 5, luxury: 3, budget: 5, honeymoon: 2 },
    staff: { frontDesk: 4, housekeeping: 8, kitchen: 6, servers: 6, spa: 2 },
    managers: { frontOffice: 1, fb: 1, duty: 1 },
    admins: { revenue: 1, marketing: 0, system: 1 },
  },
  assertions: [
    CommonAssertions.checkInTimeLimit(10),
    CommonAssertions.orderFulfillmentTime(20),
    // Custom assertion
    {
      id: 'custom-assertion',
      name: 'Custom Check',
      description: 'My custom validation',
      type: 'custom',
      trigger: 'end_of_simulation',
      severity: 'error',
      condition: (ctx) => ctx.getEventCount('ORDER_PLACED') > 0,
    },
  ],
};
```

## Event System

The simulation uses an event-driven architecture. Key events:

```typescript
// Guest lifecycle
GUEST_ARRIVED, GUEST_CHECK_IN_STARTED, GUEST_CHECK_IN_COMPLETED
GUEST_CHECK_OUT_STARTED, GUEST_CHECK_OUT_COMPLETED

// F&B
ORDER_PLACED, ORDER_ACCEPTED, ORDER_ITEM_READY, ORDER_DELIVERED
TABLE_SEATED, TABLE_CLEARED, ITEM_86D

// Housekeeping
ROOM_MARKED_DIRTY, ROOM_CLEANING_STARTED, ROOM_CLEANING_COMPLETED

// Staff
SHIFT_STARTED, SHIFT_ENDED, TASK_ASSIGNED, TASK_COMPLETED, TASK_ESCALATED

// Manager
MANAGER_DECISION, COMP_APPROVED, COMPLAINT_RESOLVED
```

## Configuration

Environment variables:
```bash
API_BASE_URL=http://localhost:3005  # Backend API URL
AUTH_TOKEN=your-token               # Optional auth token
```

## Running Tests

```bash
npm test              # Run unit tests
npm run test:watch    # Watch mode
```

## Output

Simulation results include:
- Duration (simulated vs real time)
- Actor statistics
- Event counts by category
- Assertion pass/fail results
- Key metrics (satisfaction, orders, complaints, etc.)

```
📊 SIMULATION RESULTS
======================================================================
📋 Scenario: Normal Weekday Operation

⏱️  Duration:
   Simulated: 24.0h
   Real: 2.4m

👥 Actors: 86
   guests: 40
   staff: 40
   managers: 3
   admins: 3

📨 Events: 1,234
   fb: 456
   checkin: 123
   housekeeping: 234

✅ Assertions: 8/8 passed
   ✅ Check-in Time Limit
   ✅ Order Fulfillment Time
   ✅ Complaint Acknowledgement
   ...

📈 Key Metrics:
   Avg Guest Satisfaction: 78/100
   Total Orders: 156
   Check-ins: 40
   Check-outs: 35
   Complaints: 3
   Escalations: 2

======================================================================
🎉 SIMULATION PASSED - All assertions met!
======================================================================
```
