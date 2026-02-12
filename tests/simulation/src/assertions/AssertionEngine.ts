/**
 * Assertion Engine - Validates simulation state and behaviors
 */

import { EventBus, SimulationEvent, EventTypes } from '../events/EventBus';

export type AssertionType = 
  | 'state' 
  | 'event' 
  | 'timing' 
  | 'count' 
  | 'sequence' 
  | 'invariant'
  | 'custom';

export type AssertionTrigger = 
  | 'immediate'
  | 'on_event'
  | 'periodic'
  | 'end_of_simulation';

export interface Assertion {
  id: string;
  name: string;
  description: string;
  type: AssertionType;
  trigger: AssertionTrigger;
  triggerEvent?: string;
  triggerInterval?: number; // ms for periodic
  condition: (context: AssertionContext) => boolean | Promise<boolean>;
  severity: 'warning' | 'error' | 'critical';
  enabled?: boolean;
}

export interface AssertionContext {
  eventBus: EventBus;
  currentTime: Date;
  event?: SimulationEvent;
  getState: (key: string) => any;
  setState: (key: string, value: any) => void;
  getEventLog: () => SimulationEvent[];
  getEventsByType: (type: string) => SimulationEvent[];
  getEventCount: (type: string) => number;
  timeSince: (timestamp: Date) => number; // ms
}

export interface AssertionResult {
  assertionId: string;
  name: string;
  passed: boolean;
  timestamp: Date;
  message?: string;
  context?: any;
}

export class AssertionEngine {
  private eventBus: EventBus;
  private assertions: Map<string, Assertion> = new Map();
  private results: AssertionResult[] = [];
  private state: Map<string, any> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.setupTriggers();
  }

  private setupTriggers(): void {
    // Listen for all events to trigger event-based assertions
    this.eventBus.subscribeToAll((event) => {
      this.runEventTriggeredAssertions(event);
    });

    // Listen for simulation end
    this.eventBus.subscribe(EventTypes.SIMULATION_ENDED, () => {
      this.runEndOfSimulationAssertions();
    });
  }

  /**
   * Register an assertion
   */
  registerAssertion(assertion: Assertion): void {
    this.assertions.set(assertion.id, assertion);

    // Setup periodic assertions
    if (assertion.trigger === 'periodic' && assertion.triggerInterval) {
      const interval = setInterval(() => {
        if (assertion.enabled !== false) {
          this.runAssertion(assertion);
        }
      }, assertion.triggerInterval);
      this.intervals.set(assertion.id, interval);
    }

    // Run immediate assertions
    if (assertion.trigger === 'immediate') {
      this.runAssertion(assertion);
    }
  }

  /**
   * Run event-triggered assertions
   */
  private async runEventTriggeredAssertions(event: SimulationEvent): Promise<void> {
    for (const assertion of this.assertions.values()) {
      if (
        assertion.enabled !== false &&
        assertion.trigger === 'on_event' &&
        assertion.triggerEvent === event.type
      ) {
        await this.runAssertion(assertion, event);
      }
    }
  }

  /**
   * Run end-of-simulation assertions
   */
  private async runEndOfSimulationAssertions(): Promise<void> {
    for (const assertion of this.assertions.values()) {
      if (assertion.enabled !== false && assertion.trigger === 'end_of_simulation') {
        await this.runAssertion(assertion);
      }
    }
  }

  /**
   * Run a specific assertion
   */
  async runAssertion(assertion: Assertion, event?: SimulationEvent): Promise<AssertionResult> {
    const context = this.createContext(event);

    let passed = false;
    let message: string | undefined;

    try {
      const result = assertion.condition(context);
      passed = result instanceof Promise ? await result : result;
    } catch (error) {
      passed = false;
      message = error instanceof Error ? error.message : String(error);
    }

    const result: AssertionResult = {
      assertionId: assertion.id,
      name: assertion.name,
      passed,
      timestamp: new Date(),
      message: message || (passed ? 'Assertion passed' : 'Assertion failed'),
    };

    this.results.push(result);

    // Emit event
    this.eventBus.emitEvent(
      passed ? EventTypes.ASSERTION_PASSED : EventTypes.ASSERTION_FAILED,
      'assertion',
      {
        assertionId: assertion.id,
        name: assertion.name,
        severity: assertion.severity,
        message: result.message,
      },
      'AssertionEngine',
      { severity: passed ? 'info' : assertion.severity }
    );

    // Log failures
    if (!passed) {
      console.log(`[Assertion ${assertion.severity.toUpperCase()}] ${assertion.name}: ${result.message}`);
    }

    return result;
  }

  /**
   * Create assertion context
   */
  private createContext(event?: SimulationEvent): AssertionContext {
    return {
      eventBus: this.eventBus,
      currentTime: this.eventBus.getSimulationTime(),
      event,
      getState: (key: string) => this.state.get(key),
      setState: (key: string, value: any) => this.state.set(key, value),
      getEventLog: () => this.eventBus.getEventLog(),
      getEventsByType: (type: string) => this.eventBus.getEventLog({ types: [type] }),
      getEventCount: (type: string) => this.eventBus.getEventLog({ types: [type] }).length,
      timeSince: (timestamp: Date) => new Date().getTime() - timestamp.getTime(),
    };
  }

  /**
   * Get all results
   */
  getResults(): { total: number; passed: number; failed: number; results: Array<{ name: string; passed: boolean; message?: string }> } {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    return {
      total: this.results.length,
      passed,
      failed,
      results: this.results.map(r => ({
        name: r.name,
        passed: r.passed,
        message: r.message,
      })),
    };
  }

  /**
   * Clear all assertions and results
   */
  clear(): void {
    // Clear intervals
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();

    this.assertions.clear();
    this.results = [];
    this.state.clear();
  }

  /**
   * Get assertion by ID
   */
  getAssertion(id: string): Assertion | undefined {
    return this.assertions.get(id);
  }

  /**
   * Enable/disable assertion
   */
  setAssertionEnabled(id: string, enabled: boolean): void {
    const assertion = this.assertions.get(id);
    if (assertion) {
      assertion.enabled = enabled;
    }
  }
}

// Pre-built common assertions
export const CommonAssertions = {
  /**
   * Check-in must complete within time limit
   */
  checkInTimeLimit: (maxMinutes: number): Assertion => ({
    id: 'checkin_time_limit',
    name: 'Check-in Time Limit',
    description: `Check-in must complete within ${maxMinutes} minutes`,
    type: 'timing',
    trigger: 'on_event',
    triggerEvent: EventTypes.GUEST_CHECK_IN_COMPLETED,
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.event) return true;
      
      // Find corresponding check-in started event
      const startEvents = ctx.getEventsByType(EventTypes.GUEST_CHECK_IN_STARTED)
        .filter(e => e.payload.guestId === ctx.event!.payload.guestId);
      
      if (startEvents.length === 0) return true;
      
      const startTime = startEvents[startEvents.length - 1].simulationTime;
      const endTime = ctx.event.simulationTime;
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = durationMs / (1000 * 60);
      
      return durationMinutes <= maxMinutes;
    },
  }),

  /**
   * Orders must be fulfilled within time limit
   */
  orderFulfillmentTime: (maxMinutes: number): Assertion => ({
    id: 'order_fulfillment_time',
    name: 'Order Fulfillment Time',
    description: `Orders must be ready within ${maxMinutes} minutes`,
    type: 'timing',
    trigger: 'on_event',
    triggerEvent: EventTypes.ORDER_ITEM_READY,
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.event) return true;
      
      const orderEvents = ctx.getEventsByType(EventTypes.ORDER_PLACED)
        .filter(e => e.payload.orderId === ctx.event!.payload.orderId);
      
      if (orderEvents.length === 0) return true;
      
      const orderTime = orderEvents[0].simulationTime;
      const readyTime = ctx.event.simulationTime;
      const durationMinutes = (readyTime.getTime() - orderTime.getTime()) / (1000 * 60);
      
      return durationMinutes <= maxMinutes;
    },
  }),

  /**
   * Complaints must be acknowledged within time limit
   */
  complaintAcknowledgement: (maxMinutes: number): Assertion => ({
    id: 'complaint_acknowledgement',
    name: 'Complaint Acknowledgement',
    description: `Complaints must be acknowledged within ${maxMinutes} minutes`,
    type: 'timing',
    trigger: 'on_event',
    triggerEvent: EventTypes.COMPLAINT_ACKNOWLEDGED,
    severity: 'error',
    condition: (ctx) => {
      if (!ctx.event) return true;
      
      const filedEvents = ctx.getEventsByType(EventTypes.COMPLAINT_FILED)
        .filter(e => e.payload.complaintId === ctx.event!.payload.complaintId);
      
      if (filedEvents.length === 0) return true;
      
      const filedTime = filedEvents[0].simulationTime;
      const ackTime = ctx.event.simulationTime;
      const durationMinutes = (ackTime.getTime() - filedTime.getTime()) / (1000 * 60);
      
      return durationMinutes <= maxMinutes;
    },
  }),

  /**
   * Room must be cleaned after checkout
   */
  roomCleanedAfterCheckout: (maxMinutes: number): Assertion => ({
    id: 'room_cleaned_after_checkout',
    name: 'Room Cleaned After Checkout',
    description: `Room must be cleaned within ${maxMinutes} minutes of checkout`,
    type: 'timing',
    trigger: 'on_event',
    triggerEvent: EventTypes.ROOM_CLEANING_COMPLETED,
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.event) return true;
      
      const roomNumber = ctx.event.payload.roomNumber;
      const dirtyEvents = ctx.getEventsByType(EventTypes.ROOM_MARKED_DIRTY)
        .filter(e => e.payload.roomNumber === roomNumber);
      
      if (dirtyEvents.length === 0) return true;
      
      const lastDirty = dirtyEvents[dirtyEvents.length - 1];
      const dirtyTime = lastDirty.simulationTime;
      const cleanTime = ctx.event.simulationTime;
      const durationMinutes = (cleanTime.getTime() - dirtyTime.getTime()) / (1000 * 60);
      
      return durationMinutes <= maxMinutes;
    },
  }),

  /**
   * Check-in must follow check-out sequence
   */
  checkInOutSequence: (): Assertion => ({
    id: 'checkin_checkout_sequence',
    name: 'Check-in/Check-out Sequence',
    description: 'Check-in must occur before check-out for same guest',
    type: 'sequence',
    trigger: 'on_event',
    triggerEvent: EventTypes.GUEST_CHECK_OUT_COMPLETED,
    severity: 'error',
    condition: (ctx) => {
      if (!ctx.event) return true;
      
      const guestId = ctx.event.payload.guestId;
      const checkIns = ctx.getEventsByType(EventTypes.GUEST_CHECK_IN_COMPLETED)
        .filter(e => e.payload.guestId === guestId);
      const checkOuts = ctx.getEventsByType(EventTypes.GUEST_CHECK_OUT_COMPLETED)
        .filter(e => e.payload.guestId === guestId);
      
      return checkIns.length >= checkOuts.length;
    },
  }),

  /**
   * No more escalations than threshold
   */
  escalationThreshold: (maxPercent: number): Assertion => ({
    id: 'escalation_threshold',
    name: 'Escalation Threshold',
    description: `Escalations should not exceed ${maxPercent}% of tasks`,
    type: 'count',
    trigger: 'end_of_simulation',
    severity: 'warning',
    condition: (ctx) => {
      const completed = ctx.getEventCount(EventTypes.TASK_COMPLETED);
      const escalated = ctx.getEventCount(EventTypes.TASK_ESCALATED);
      
      if (completed + escalated === 0) return true;
      
      const escalationRate = escalated / (completed + escalated) * 100;
      return escalationRate <= maxPercent;
    },
  }),

  /**
   * Payment success rate
   */
  paymentSuccessRate: (minPercent: number): Assertion => ({
    id: 'payment_success_rate',
    name: 'Payment Success Rate',
    description: `Payment success rate should be at least ${minPercent}%`,
    type: 'count',
    trigger: 'end_of_simulation',
    severity: 'error',
    condition: (ctx) => {
      const successful = ctx.getEventCount(EventTypes.PAYMENT_PROCESSED);
      const failed = ctx.getEventCount(EventTypes.PAYMENT_FAILED);
      
      if (successful + failed === 0) return true;
      
      const successRate = successful / (successful + failed) * 100;
      return successRate >= minPercent;
    },
  }),

  /**
   * Guest satisfaction threshold
   */
  guestSatisfaction: (minAverage: number, getGuests: () => { satisfactionLevel: number }[]): Assertion => ({
    id: 'guest_satisfaction',
    name: 'Guest Satisfaction',
    description: `Average guest satisfaction should be at least ${minAverage}`,
    type: 'state',
    trigger: 'end_of_simulation',
    severity: 'warning',
    condition: () => {
      const guests = getGuests();
      if (guests.length === 0) return true;
      
      const totalSatisfaction = guests.reduce((sum, g) => sum + g.satisfactionLevel, 0);
      const avgSatisfaction = totalSatisfaction / guests.length;
      
      return avgSatisfaction >= minAverage;
    },
  }),

  /**
   * All complaints resolved
   */
  allComplaintsResolved: (): Assertion => ({
    id: 'all_complaints_resolved',
    name: 'All Complaints Resolved',
    description: 'All filed complaints must be resolved by end of simulation',
    type: 'count',
    trigger: 'end_of_simulation',
    severity: 'error',
    condition: (ctx) => {
      const filed = ctx.getEventCount(EventTypes.COMPLAINT_FILED);
      const resolved = ctx.getEventCount(EventTypes.COMPLAINT_RESOLVED);
      
      return resolved >= filed;
    },
  }),

  /**
   * No SLA breaches
   */
  noSLABreaches: (): Assertion => ({
    id: 'no_sla_breaches',
    name: 'No SLA Breaches',
    description: 'No SLA breaches should occur',
    type: 'event',
    trigger: 'on_event',
    triggerEvent: EventTypes.SLA_BREACH,
    severity: 'critical',
    condition: () => false, // Always fail when SLA_BREACH occurs
  }),

  /**
   * Staff coverage invariant
   */
  staffCoverage: (department: string, minStaff: number): Assertion => ({
    id: `staff_coverage_${department}`,
    name: `Staff Coverage - ${department}`,
    description: `At least ${minStaff} staff must be on shift for ${department}`,
    type: 'invariant',
    trigger: 'periodic',
    triggerInterval: 60000, // Check every minute
    severity: 'warning',
    condition: (ctx) => {
      const shiftStarts = ctx.getEventsByType(EventTypes.SHIFT_STARTED)
        .filter(e => e.payload.department === department);
      const shiftEnds = ctx.getEventsByType(EventTypes.SHIFT_ENDED)
        .filter(e => e.payload.department === department);
      
      // Count currently on shift
      const onShift = shiftStarts.length - shiftEnds.length;
      return onShift >= minStaff;
    },
  }),
};
