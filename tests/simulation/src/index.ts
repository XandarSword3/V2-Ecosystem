/**
 * Simulation System - Main Entry Point
 * Multi-Actor Real-Time Simulation for V2 Ecosystem
 */

// Core exports
export { EventBus, EventTypes } from './events/EventBus';
export type { SimulationEvent, EventCategory, EventSeverity } from './events/EventBus';

export { ClockManager } from './orchestrator/ClockManager';
export type { ClockConfig, ClockState } from './orchestrator/ClockManager';

export { SimulationOrchestrator } from './orchestrator/SimulationOrchestrator';
export type { ScenarioConfig, ActorDistribution, SimulationState, SimulationResults } from './orchestrator/SimulationOrchestrator';

// Actor exports
export { Actor } from './actors/base/Actor';
export type { ActorConfig, ActorAction, ActionResult } from './actors/base/Actor';

export { GuestBot } from './actors/guests/GuestBot';
export type { GuestProfile, GuestState, GuestConfig } from './actors/guests/GuestBot';
export { 
  BusinessTravelerBot, 
  FamilyVacationerBot, 
  LuxurySeekerBot, 
  BudgetConsciousBot,
  HoneymoonerBot,
  ConferenceAttendeeBot,
  createGuestBot 
} from './actors/guests/GuestProfiles';

export { StaffBot } from './actors/staff/StaffBot';
export type { StaffProfile, StaffState, StaffConfig, Task } from './actors/staff/StaffBot';
export { 
  FrontDeskAgent, 
  HousekeepingStaff, 
  KitchenStaff, 
  ServerStaff,
  SpaTherapist,
  createStaffBot 
} from './actors/staff/StaffProfiles';

export { ManagerBot, FrontOfficeManager, FBManager, DutyManager, createManagerBot } from './actors/managers/ManagerBot';
export type { ManagerProfile, ManagerState, ManagerConfig, Decision } from './actors/managers/ManagerBot';

export { AdminBot, RevenueManagerBot, MarketingAdminBot, SystemAdminBot, createAdminBot } from './actors/admins/AdminBot';
export type { AdminProfile, AdminState, AdminConfig } from './actors/admins/AdminBot';

// Assertion exports
export { AssertionEngine, CommonAssertions } from './assertions/AssertionEngine';
export type { Assertion, AssertionResult, AssertionContext } from './assertions/AssertionEngine';

// Scenario exports
export { 
  NormalWeekdayScenario,
  LunchRushScenario,
  ConferenceDayScenario,
  StressTestScenario,
  WeekendTurnoverScenario,
  getAllScenarios,
  getScenarioByName,
} from './scenarios/ScenarioDefinitions';

/**
 * Quick start function for running a simulation
 */
export async function runSimulation(
  apiBaseUrl: string,
  scenarioName?: string,
  options?: {
    authToken?: string;
    onProgress?: (state: import('./orchestrator/SimulationOrchestrator').SimulationState) => void;
  }
): Promise<import('./orchestrator/SimulationOrchestrator').SimulationResults> {
  const { SimulationOrchestrator } = await import('./orchestrator/SimulationOrchestrator');
  const { getScenarioByName, NormalWeekdayScenario } = await import('./scenarios/ScenarioDefinitions');

  const orchestrator = new SimulationOrchestrator(apiBaseUrl, options?.authToken);
  
  const scenario = scenarioName 
    ? getScenarioByName(scenarioName) || NormalWeekdayScenario
    : NormalWeekdayScenario;

  await orchestrator.loadScenario(scenario);

  // Setup progress callback if provided
  if (options?.onProgress) {
    const { EventBus, EventTypes } = await import('./events/EventBus');
    EventBus.getInstance().subscribe(EventTypes.SIMULATION_TICK, () => {
      options.onProgress!(orchestrator.getState());
    });
  }

  await orchestrator.start();
  
  const results = orchestrator.getResults();
  orchestrator.destroy();

  return results;
}
