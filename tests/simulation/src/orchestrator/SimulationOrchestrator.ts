/**
 * Simulation Orchestrator - Master controller for the simulation
 */

import { EventBus, EventTypes, SimulationEvent } from '../events/EventBus';
import { ClockManager, ClockConfig } from './ClockManager';
import { Actor } from '../actors/base/Actor';
import { GuestBot } from '../actors/guests/GuestBot';
import { createGuestBot } from '../actors/guests/GuestProfiles';
import { StaffBot } from '../actors/staff/StaffBot';
import { createStaffBot } from '../actors/staff/StaffProfiles';
import { ManagerBot, createManagerBot } from '../actors/managers/ManagerBot';
import { AdminBot, createAdminBot } from '../actors/admins/AdminBot';
import { AssertionEngine, Assertion } from '../assertions/AssertionEngine';

export interface ScenarioConfig {
  name: string;
  description: string;
  duration: {
    days: number;
    startTime?: Date;
  };
  actors: ActorDistribution;
  timeMultiplier: number;
  assertions: Assertion[];
  seedData?: () => Promise<void>;
}

export interface ActorDistribution {
  guests: {
    business: number;
    family: number;
    luxury: number;
    budget: number;
    honeymoon: number;
    conference?: { count: number; eventId: string };
  };
  staff: {
    frontDesk: number;
    housekeeping: number;
    kitchen: number;
    servers: number;
    spa: number;
  };
  managers: {
    frontOffice: number;
    fb: number;
    duty: number;
  };
  admins: {
    revenue: number;
    marketing: number;
    system: number;
  };
}

export interface SimulationState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  scenarioName: string;
  startTime?: Date;
  currentTime?: Date;
  endTime?: Date;
  actorCount: number;
  eventsProcessed: number;
  assertionsPassed: number;
  assertionsFailed: number;
}

export interface SimulationResults {
  scenario: string;
  duration: {
    simulated: number; // ms
    real: number; // ms
  };
  actors: {
    total: number;
    byType: Record<string, number>;
  };
  events: {
    total: number;
    byCategory: Record<string, number>;
  };
  assertions: {
    total: number;
    passed: number;
    failed: number;
    results: Array<{ name: string; passed: boolean; message?: string }>;
  };
  metrics: {
    avgGuestSatisfaction: number;
    totalOrders: number;
    totalCheckIns: number;
    totalCheckOuts: number;
    complaintsCount: number;
    escalationsCount: number;
  };
}

export class SimulationOrchestrator {
  private eventBus: EventBus;
  private clock: ClockManager;
  private assertionEngine: AssertionEngine;
  
  private actors: Map<string, Actor> = new Map();
  private guests: Map<string, GuestBot> = new Map();
  private staff: Map<string, StaffBot> = new Map();
  private managers: Map<string, ManagerBot> = new Map();
  private admins: Map<string, AdminBot> = new Map();

  private state: SimulationState = {
    status: 'idle',
    scenarioName: '',
    actorCount: 0,
    eventsProcessed: 0,
    assertionsPassed: 0,
    assertionsFailed: 0,
  };

  private currentScenario?: ScenarioConfig;
  private apiBaseUrl: string;
  private authToken?: string;

  constructor(apiBaseUrl: string, authToken?: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
    this.eventBus = EventBus.getInstance();
    this.clock = new ClockManager();
    this.assertionEngine = new AssertionEngine();

    this.setupEventTracking();
  }

  private setupEventTracking(): void {
    // Track all events
    this.eventBus.subscribeToAll((event) => {
      this.state.eventsProcessed++;
    });

    // Track assertion results
    this.eventBus.subscribe(EventTypes.ASSERTION_PASSED, () => {
      this.state.assertionsPassed++;
    });

    this.eventBus.subscribe(EventTypes.ASSERTION_FAILED, () => {
      this.state.assertionsFailed++;
    });
  }

  /**
   * Load and prepare a scenario
   */
  async loadScenario(scenario: ScenarioConfig): Promise<void> {
    console.log(`\n[Orchestrator] Loading scenario: ${scenario.name}`);
    console.log(`[Orchestrator] Description: ${scenario.description}`);

    this.currentScenario = scenario;
    this.state.scenarioName = scenario.name;
    this.state.status = 'idle';

    // Reset everything
    EventBus.resetInstance();
    this.eventBus = EventBus.getInstance();
    this.setupEventTracking();

    // Configure clock
    const startTime = scenario.duration.startTime || new Date();
    const endTime = new Date(startTime.getTime() + scenario.duration.days * 24 * 60 * 60 * 1000);

    this.clock = new ClockManager({
      startTime,
      endTime,
      timeMultiplier: scenario.timeMultiplier,
      tickIntervalMs: 100,
      simulatedTickMinutes: 5,
    });

    // Clear existing actors
    this.destroyAllActors();

    // Run seed data if provided
    if (scenario.seedData) {
      console.log('[Orchestrator] Running seed data...');
      await scenario.seedData();
    }

    // Create actors
    await this.createActors(scenario.actors);

    // Register assertions
    this.assertionEngine.clear();
    for (const assertion of scenario.assertions) {
      this.assertionEngine.registerAssertion(assertion);
    }

    console.log(`[Orchestrator] Scenario loaded. ${this.actors.size} actors created.`);
  }

  /**
   * Create all actors based on distribution
   */
  private async createActors(distribution: ActorDistribution): Promise<void> {
    const baseConfig = {
      apiBaseUrl: this.apiBaseUrl,
      authToken: this.authToken,
    };

    // Create guests
    const guestTypes: Array<{ type: 'business' | 'family' | 'luxury' | 'budget' | 'honeymoon'; count: number }> = [
      { type: 'business', count: distribution.guests.business },
      { type: 'family', count: distribution.guests.family },
      { type: 'luxury', count: distribution.guests.luxury },
      { type: 'budget', count: distribution.guests.budget },
      { type: 'honeymoon', count: distribution.guests.honeymoon },
    ];

    for (const { type, count } of guestTypes) {
      for (let i = 0; i < count; i++) {
        const guest = createGuestBot(type, {
          ...baseConfig,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)} Guest ${i + 1}`,
          arrivalDate: this.clock.getCurrentTime(),
          departureDate: new Date(this.clock.getCurrentTime().getTime() + 3 * 24 * 60 * 60 * 1000),
          partySize: type === 'family' ? 4 : type === 'honeymoon' ? 2 : 1,
        });
        this.guests.set(guest.id, guest);
        this.actors.set(guest.id, guest);
      }
    }

    // Conference attendees
    if (distribution.guests.conference) {
      const { count, eventId } = distribution.guests.conference;
      for (let i = 0; i < count; i++) {
        const guest = createGuestBot('conference', {
          ...baseConfig,
          name: `Conference Attendee ${i + 1}`,
          arrivalDate: this.clock.getCurrentTime(),
          departureDate: new Date(this.clock.getCurrentTime().getTime() + 2 * 24 * 60 * 60 * 1000),
          partySize: 1,
          eventId,
        });
        this.guests.set(guest.id, guest);
        this.actors.set(guest.id, guest);
      }
    }

    // Create staff
    const staffTypes: Array<{ type: 'front_desk' | 'housekeeping' | 'kitchen' | 'server' | 'spa'; count: number; shifts: number[] }> = [
      { type: 'front_desk', count: distribution.staff.frontDesk, shifts: [7, 15, 23] },
      { type: 'housekeeping', count: distribution.staff.housekeeping, shifts: [8, 16] },
      { type: 'kitchen', count: distribution.staff.kitchen, shifts: [6, 14, 22] },
      { type: 'server', count: distribution.staff.servers, shifts: [7, 15, 23] },
      { type: 'spa', count: distribution.staff.spa, shifts: [9, 17] },
    ];

    for (const { type, count, shifts } of staffTypes) {
      for (let i = 0; i < count; i++) {
        const shiftIndex = i % shifts.length;
        const startHour = shifts[shiftIndex];
        const endHour = (startHour + 8) % 24;

        const staff = createStaffBot(type, {
          ...baseConfig,
          name: `${type.replace('_', ' ')} ${i + 1}`,
          shift: {
            startHour,
            endHour,
            breakTime: startHour + 4,
            breakDuration: 30,
          },
        });
        this.staff.set(staff.id, staff);
        this.actors.set(staff.id, staff);
      }
    }

    // Create managers
    const managerTypes: Array<{ type: 'front_office' | 'fb' | 'duty'; count: number; hours: { start: number; end: number } }> = [
      { type: 'front_office', count: distribution.managers.frontOffice, hours: { start: 8, end: 18 } },
      { type: 'fb', count: distribution.managers.fb, hours: { start: 10, end: 22 } },
      { type: 'duty', count: distribution.managers.duty, hours: { start: 6, end: 22 } },
    ];

    for (const { type, count, hours } of managerTypes) {
      for (let i = 0; i < count; i++) {
        const manager = createManagerBot(type, {
          ...baseConfig,
          name: `${type.replace('_', ' ')} Manager ${i + 1}`,
          shiftHours: hours,
        });
        this.managers.set(manager.id, manager);
        this.actors.set(manager.id, manager);
      }
    }

    // Create admins
    const adminTypes: Array<{ type: 'revenue' | 'marketing' | 'system'; count: number }> = [
      { type: 'revenue', count: distribution.admins.revenue },
      { type: 'marketing', count: distribution.admins.marketing },
      { type: 'system', count: distribution.admins.system },
    ];

    for (const { type, count } of adminTypes) {
      for (let i = 0; i < count; i++) {
        const admin = createAdminBot(type, {
          ...baseConfig,
          name: `${type} Admin ${i + 1}`,
        });
        this.admins.set(admin.id, admin);
        this.actors.set(admin.id, admin);
      }
    }

    this.state.actorCount = this.actors.size;
    console.log(`[Orchestrator] Created ${this.guests.size} guests, ${this.staff.size} staff, ${this.managers.size} managers, ${this.admins.size} admins`);
  }

  /**
   * Start the simulation
   */
  async start(): Promise<void> {
    if (!this.currentScenario) {
      throw new Error('No scenario loaded');
    }

    console.log(`\n[Orchestrator] Starting simulation: ${this.currentScenario.name}`);
    this.state.status = 'running';
    this.state.startTime = new Date();

    // Emit simulation started event
    this.eventBus.emitEvent(
      EventTypes.SIMULATION_STARTED,
      'system',
      {
        scenario: this.currentScenario.name,
        actorCount: this.actors.size,
        startTime: this.clock.getCurrentTime(),
      },
      'Orchestrator'
    );

    // Start the clock
    this.clock.start();

    // Wait for simulation to complete
    await this.waitForCompletion();
  }

  /**
   * Wait for simulation to complete
   */
  private waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      this.eventBus.subscribe(EventTypes.SIMULATION_ENDED, () => {
        this.state.status = 'completed';
        this.state.endTime = new Date();
        resolve();
      });
    });
  }

  /**
   * Pause the simulation
   */
  pause(): void {
    this.clock.pause();
    this.state.status = 'paused';

    this.eventBus.emitEvent(
      EventTypes.SIMULATION_PAUSED,
      'system',
      { currentTime: this.clock.getCurrentTime() },
      'Orchestrator'
    );
  }

  /**
   * Resume the simulation
   */
  resume(): void {
    this.clock.resume();
    this.state.status = 'running';

    this.eventBus.emitEvent(
      EventTypes.SIMULATION_RESUMED,
      'system',
      { currentTime: this.clock.getCurrentTime() },
      'Orchestrator'
    );
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    this.clock.stop();
    this.state.status = 'completed';
    this.state.endTime = new Date();
  }

  /**
   * Get simulation results
   */
  getResults(): SimulationResults {
    const clockState = this.clock.getState();
    const eventStats = this.eventBus.getStats();
    const assertionResults = this.assertionEngine.getResults();

    // Calculate metrics from event log
    const events = this.eventBus.getEventLog();
    
    const checkIns = events.filter(e => e.type === EventTypes.GUEST_CHECK_IN_COMPLETED).length;
    const checkOuts = events.filter(e => e.type === EventTypes.GUEST_CHECK_OUT_COMPLETED).length;
    const orders = events.filter(e => e.type === EventTypes.ORDER_PLACED).length;
    const complaints = events.filter(e => e.type === EventTypes.COMPLAINT_FILED).length;
    const escalations = events.filter(e => e.type === EventTypes.TASK_ESCALATED).length;

    // Calculate average guest satisfaction
    let totalSatisfaction = 0;
    let guestCount = 0;
    for (const guest of this.guests.values()) {
      totalSatisfaction += guest.getGuestState().satisfactionLevel;
      guestCount++;
    }
    const avgSatisfaction = guestCount > 0 ? totalSatisfaction / guestCount : 0;

    return {
      scenario: this.state.scenarioName,
      duration: {
        simulated: clockState.elapsedSimulatedMs,
        real: clockState.elapsedRealMs,
      },
      actors: {
        total: this.actors.size,
        byType: {
          guests: this.guests.size,
          staff: this.staff.size,
          managers: this.managers.size,
          admins: this.admins.size,
        },
      },
      events: {
        total: eventStats.totalEvents,
        byCategory: eventStats.eventsByCategory,
      },
      assertions: {
        total: assertionResults.total,
        passed: assertionResults.passed,
        failed: assertionResults.failed,
        results: assertionResults.results,
      },
      metrics: {
        avgGuestSatisfaction: Math.round(avgSatisfaction),
        totalOrders: orders,
        totalCheckIns: checkIns,
        totalCheckOuts: checkOuts,
        complaintsCount: complaints,
        escalationsCount: escalations,
      },
    };
  }

  /**
   * Get current state
   */
  getState(): SimulationState {
    return {
      ...this.state,
      currentTime: this.clock.getCurrentTime(),
    };
  }

  /**
   * Get specific actor
   */
  getActor(id: string): Actor | undefined {
    return this.actors.get(id);
  }

  /**
   * Get all guests
   */
  getGuests(): GuestBot[] {
    return Array.from(this.guests.values());
  }

  /**
   * Get all staff
   */
  getStaff(): StaffBot[] {
    return Array.from(this.staff.values());
  }

  /**
   * Destroy all actors
   */
  private destroyAllActors(): void {
    for (const actor of this.actors.values()) {
      actor.destroy();
    }
    this.actors.clear();
    this.guests.clear();
    this.staff.clear();
    this.managers.clear();
    this.admins.clear();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    this.destroyAllActors();
    EventBus.resetInstance();
  }
}
