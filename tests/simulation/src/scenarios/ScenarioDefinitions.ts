/**
 * Pre-built Scenario Definitions
 */

import { ScenarioConfig } from '../orchestrator/SimulationOrchestrator';
import { CommonAssertions } from '../assertions/AssertionEngine';

/**
 * Scenario 1: Normal Weekday Operation
 * Tests standard daily operations
 */
export const NormalWeekdayScenario: ScenarioConfig = {
  name: 'Normal Weekday Operation',
  description: 'Standard weekday with 65% occupancy, regular dining, typical spa bookings',
  duration: {
    days: 1,
  },
  timeMultiplier: 60, // 1 simulated minute = 1 real second
  actors: {
    guests: {
      business: 15,
      family: 8,
      luxury: 5,
      budget: 10,
      honeymoon: 2,
    },
    staff: {
      frontDesk: 6,    // 2 per shift
      housekeeping: 12, // 6 per shift
      kitchen: 9,       // 3 per shift
      servers: 9,       // 3 per shift
      spa: 4,           // 2 per shift
    },
    managers: {
      frontOffice: 1,
      fb: 1,
      duty: 1,
    },
    admins: {
      revenue: 1,
      marketing: 1,
      system: 1,
    },
  },
  assertions: [
    CommonAssertions.checkInTimeLimit(15),
    CommonAssertions.orderFulfillmentTime(25),
    CommonAssertions.complaintAcknowledgement(30),
    CommonAssertions.roomCleanedAfterCheckout(120),
    CommonAssertions.checkInOutSequence(),
    CommonAssertions.escalationThreshold(10),
    CommonAssertions.paymentSuccessRate(98),
    CommonAssertions.allComplaintsResolved(),
  ],
};

/**
 * Scenario 2: Lunch Rush
 * High F&B load, tests kitchen and service under pressure
 */
export const LunchRushScenario: ScenarioConfig = {
  name: 'Lunch Rush',
  description: 'Peak lunch service (11:30 AM - 2:00 PM) with 90% menu service occupancy',
  duration: {
    days: 0.125, // 3 hours
    startTime: new Date(new Date().setHours(11, 30, 0, 0)),
  },
  timeMultiplier: 30, // Faster to focus on the rush
  actors: {
    guests: {
      business: 25, // Lunch meetings
      family: 5,
      luxury: 8,
      budget: 5,
      honeymoon: 2,
    },
    staff: {
      frontDesk: 2,
      housekeeping: 4,
      kitchen: 6,    // Extra kitchen staff
      servers: 8,    // Extra servers
      spa: 2,
    },
    managers: {
      frontOffice: 0,
      fb: 2, // Extra F&B manager
      duty: 1,
    },
    admins: {
      revenue: 0,
      marketing: 0,
      system: 0,
    },
  },
  assertions: [
    CommonAssertions.orderFulfillmentTime(20), // Tighter during rush
    CommonAssertions.escalationThreshold(15),
    CommonAssertions.paymentSuccessRate(99),
    {
      id: 'no_86d_items',
      name: 'No Items 86d',
      description: 'Kitchen should not run out of items during rush',
      type: 'count',
      trigger: 'end_of_simulation',
      severity: 'warning',
      condition: (ctx) => ctx.getEventCount('ITEM_86D') === 0,
    },
  ],
};

/**
 * Scenario 3: Event Day - Conference
 * Large group arrival + conference activities
 */
export const ConferenceDayScenario: ScenarioConfig = {
  name: 'Conference Day',
  description: '150-person corporate conference with arrivals, sessions, networking dinners',
  duration: {
    days: 2,
  },
  timeMultiplier: 60,
  actors: {
    guests: {
      business: 5,
      family: 2,
      luxury: 3,
      budget: 2,
      honeymoon: 1,
      conference: {
        count: 50,
        eventId: 'conf_2026_tech_summit',
      },
    },
    staff: {
      frontDesk: 8,     // Extra for bulk check-in
      housekeeping: 15,
      kitchen: 12,      // Banquet prep
      servers: 12,
      spa: 4,
    },
    managers: {
      frontOffice: 2,
      fb: 2,
      duty: 2,
    },
    admins: {
      revenue: 1,
      marketing: 1,
      system: 1,
    },
  },
  assertions: [
    CommonAssertions.checkInTimeLimit(10), // Faster check-in required
    CommonAssertions.orderFulfillmentTime(30),
    CommonAssertions.complaintAcknowledgement(20),
    CommonAssertions.escalationThreshold(8),
    CommonAssertions.paymentSuccessRate(99),
    {
      id: 'group_checkin_completed',
      name: 'Group Check-in Completed',
      description: 'All conference attendees must be checked in within 2 hours',
      type: 'timing',
      trigger: 'end_of_simulation',
      severity: 'error',
      condition: (ctx) => {
        const checkIns = ctx.getEventsByType('GUEST_CHECK_IN_COMPLETED');
        const conferenceCheckIns = checkIns.filter(e => 
          e.payload.guestName?.includes('Conference Attendee')
        );
        return conferenceCheckIns.length >= 50;
      },
    },
  ],
};

/**
 * Scenario 4: Stress Test
 * Maximum load across all systems
 */
export const StressTestScenario: ScenarioConfig = {
  name: 'Stress Test',
  description: '95% occupancy, sold-out menu services, full spa, multiple events',
  duration: {
    days: 1,
  },
  timeMultiplier: 60,
  actors: {
    guests: {
      business: 20,
      family: 15,
      luxury: 15,
      budget: 15,
      honeymoon: 5,
      conference: {
        count: 30,
        eventId: 'stress_event_001',
      },
    },
    staff: {
      frontDesk: 9,     // Max staffing
      housekeeping: 20,
      kitchen: 15,
      servers: 15,
      spa: 6,
    },
    managers: {
      frontOffice: 2,
      fb: 2,
      duty: 2,
    },
    admins: {
      revenue: 1,
      marketing: 1,
      system: 1,
    },
  },
  assertions: [
    CommonAssertions.checkInTimeLimit(20), // Relaxed but still monitored
    CommonAssertions.orderFulfillmentTime(35),
    CommonAssertions.complaintAcknowledgement(45),
    CommonAssertions.roomCleanedAfterCheckout(180),
    CommonAssertions.escalationThreshold(20), // Higher tolerance
    CommonAssertions.paymentSuccessRate(95),
    CommonAssertions.noSLABreaches(),
    {
      id: 'system_stability',
      name: 'System Stability',
      description: 'No critical system errors during stress test',
      type: 'event',
      trigger: 'end_of_simulation',
      severity: 'critical',
      condition: (ctx) => {
        const errors = ctx.getEventLog().filter(e => e.severity === 'critical');
        return errors.length === 0;
      },
    },
  ],
};

/**
 * Scenario 5: Weekend Turnover
 * High checkout/checkin volume, family-heavy guest mix
 */
export const WeekendTurnoverScenario: ScenarioConfig = {
  name: 'Weekend Turnover',
  description: 'Saturday with 60% checkout in morning, 70% checkin in afternoon',
  duration: {
    days: 1,
  },
  timeMultiplier: 60,
  actors: {
    guests: {
      business: 5,
      family: 25,
      luxury: 10,
      budget: 15,
      honeymoon: 8,
    },
    staff: {
      frontDesk: 8,
      housekeeping: 18, // Heavy cleaning day
      kitchen: 12,
      servers: 12,
      spa: 6,
    },
    managers: {
      frontOffice: 2,
      fb: 1,
      duty: 2,
    },
    admins: {
      revenue: 1,
      marketing: 0,
      system: 1,
    },
  },
  assertions: [
    CommonAssertions.checkInTimeLimit(15),
    CommonAssertions.orderFulfillmentTime(25),
    CommonAssertions.roomCleanedAfterCheckout(90), // Tighter on turnover day
    CommonAssertions.checkInOutSequence(),
    CommonAssertions.escalationThreshold(12),
    CommonAssertions.paymentSuccessRate(98),
    {
      id: 'turnover_efficiency',
      name: 'Turnover Efficiency',
      description: 'Rooms should be ready for 2 PM check-in',
      type: 'timing',
      trigger: 'end_of_simulation',
      severity: 'warning',
      condition: (ctx) => {
        const cleaningEvents = ctx.getEventsByType('ROOM_CLEANING_COMPLETED');
        const lateCleanings = cleaningEvents.filter(e => {
          const hour = e.simulationTime.getHours();
          return hour >= 14; // After 2 PM
        });
        // At least 80% of cleanings should be done by 2 PM
        return (cleaningEvents.length - lateCleanings.length) / cleaningEvents.length >= 0.8;
      },
    },
  ],
};

/**
 * Get all predefined scenarios
 */
export function getAllScenarios(): ScenarioConfig[] {
  return [
    NormalWeekdayScenario,
    LunchRushScenario,
    ConferenceDayScenario,
    StressTestScenario,
    WeekendTurnoverScenario,
  ];
}

/**
 * Get scenario by name
 */
export function getScenarioByName(name: string): ScenarioConfig | undefined {
  return getAllScenarios().find(s => s.name.toLowerCase() === name.toLowerCase());
}
