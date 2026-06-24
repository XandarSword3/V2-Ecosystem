/**
 * Simulation Runner - Starts and monitors the simulation
 * Run with: npx ts-node src/run-simulation.ts
 */

import { SimulationOrchestrator, ScenarioConfig } from './orchestrator/SimulationOrchestrator';
import { EventBus, EventTypes } from './events/EventBus';
import { CommonAssertions } from './assertions/AssertionEngine';

// Quick test scenario for monitoring
const QuickTestScenario: ScenarioConfig = {
  name: 'Quick Test - All Features',
  description: 'Short simulation to test all bot actions and UI coverage',
  duration: {
    days: 0.0208, // 30 minutes simulated
    startTime: new Date(),
  },
  timeMultiplier: 10, // 1 simulated minute = 6 real seconds (much slower for debugging)
  actors: {
    guests: {
      business: 2,
      family: 1,
      luxury: 1,
      budget: 1,
      honeymoon: 0,
    },
    staff: {
      frontDesk: 1,
      housekeeping: 1,
      kitchen: 1,
      servers: 1,
      spa: 0,
    },
    managers: {
      frontOffice: 1,
      fb: 0,
      duty: 0,
    },
    admins: {
      revenue: 1,
      marketing: 0,
      system: 1,
    },
  },
  assertions: [
    CommonAssertions.checkInTimeLimit(15),
    CommonAssertions.orderFulfillmentTime(30),
    CommonAssertions.paymentSuccessRate(95),
  ],
};

// Console colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Event type to color mapping
const categoryColors: Record<string, string> = {
  guest_lifecycle: colors.green,
  booking: colors.cyan,
  checkin: colors.green,
  checkout: colors.yellow,
  fb: colors.magenta,
  menu service: colors.magenta,
  housekeeping: colors.blue,
  spa: colors.cyan,
  pool: colors.cyan,
  financial: colors.yellow,
  billing: colors.yellow,
  loyalty: colors.green,
  giftcards: colors.green,
  coupons: colors.green,
  messaging: colors.blue,
  reviews: colors.yellow,
  support: colors.red,
  'mobile-checkin': colors.cyan,
  kiosk: colors.cyan,
  gdpr: colors.yellow,
  marketing: colors.magenta,
  channels: colors.blue,
  groups: colors.blue,
  accommodation unit: colors.cyan,
  kiosk item: colors.magenta,
  promotion: colors.green,
  pos: colors.yellow,
  staff: colors.blue,
  manager: colors.yellow,
  admin: colors.red,
  system: colors.dim,
  assertion: colors.bright,
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function logEvent(event: any): void {
  const color = categoryColors[event.category] || colors.reset;
  const time = formatTime(event.simulationTime);
  const realTime = formatTime(new Date());
  
  console.log(
    `${colors.dim}[${realTime}]${colors.reset} ` +
    `${colors.bright}[${time}]${colors.reset} ` +
    `${color}[${event.category.toUpperCase()}]${colors.reset} ` +
    `${event.type} ` +
    `${colors.dim}from ${event.source}${colors.reset}`
  );
  
  // Show payload details for important events
  if (event.type.includes('COMPLETED') || event.type.includes('FAILED') || event.type.includes('ERROR')) {
    console.log(`  ${colors.dim}→ ${JSON.stringify(event.payload)}${colors.reset}`);
  }
}

async function runSimulation() {
  console.log(`\n${colors.bright}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}║       V2 RESORT MULTI-ACTOR SIMULATION SYSTEM             ║${colors.reset}`);
  console.log(`${colors.bright}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // API URL - default to 3005 which is the actual backend port
  const apiBaseUrl = process.env.API_URL || 'http://localhost:3005';
  
  console.log(`${colors.cyan}API Base URL:${colors.reset} ${apiBaseUrl}`);
  console.log(`${colors.cyan}Scenario:${colors.reset} ${QuickTestScenario.name}`);
  console.log(`${colors.cyan}Duration:${colors.reset} ${QuickTestScenario.duration.days * 24 * 60} simulated minutes`);
  console.log(`${colors.cyan}Time Multiplier:${colors.reset} ${QuickTestScenario.timeMultiplier}x\n`);

  // Create orchestrator
  const orchestrator = new SimulationOrchestrator(apiBaseUrl);

  // Subscribe to all events for logging
  const eventBus = EventBus.getInstance();
  eventBus.subscribeToAll(logEvent);

  // Show event statistics periodically
  let lastStatsTime = Date.now();
  const statsInterval = setInterval(() => {
    const stats = eventBus.getStats();
    const elapsed = (Date.now() - lastStatsTime) / 1000;
    const eventsPerSec = Math.round(stats.totalEvents / elapsed);
    
    console.log(`\n${colors.bright}═══ STATS ════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}Total Events:${colors.reset} ${stats.totalEvents} (${eventsPerSec}/sec)`);
    console.log(`${colors.cyan}By Category:${colors.reset}`);
    Object.entries(stats.eventsByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([cat, count]) => {
        console.log(`  ${categoryColors[cat] || colors.reset}${cat}: ${count}${colors.reset}`);
      });
    console.log(`${colors.bright}═══════════════════════════════════════════════════════════${colors.reset}\n`);
  }, 10000); // Every 10 seconds

  try {
    // Load and run
    await orchestrator.loadScenario(QuickTestScenario);
    
    console.log(`\n${colors.green}▶ Starting simulation...${colors.reset}\n`);
    console.log(`${colors.dim}Press Ctrl+C to stop${colors.reset}\n`);
    
    await orchestrator.start();
    
    // Get results
    const results = orchestrator.getResults();
    
    clearInterval(statsInterval);
    
    console.log(`\n${colors.bright}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}║                   SIMULATION COMPLETE                      ║${colors.reset}`);
    console.log(`${colors.bright}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);
    
    console.log(`${colors.cyan}Duration:${colors.reset} ${results.duration.real / 1000}s real, ${results.duration.simulated / 1000 / 60}min simulated`);
    console.log(`${colors.cyan}Actors:${colors.reset} ${results.actors.total}`);
    console.log(`${colors.cyan}Events:${colors.reset} ${results.events.total}`);
    console.log(`${colors.cyan}Assertions:${colors.reset} ${results.assertions.passed}/${results.assertions.total} passed`);
    
    if (results.assertions.failed > 0) {
      console.log(`\n${colors.red}Failed Assertions:${colors.reset}`);
      results.assertions.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`  ${colors.red}✗${colors.reset} ${r.name}: ${r.message}`));
    }
    
    console.log(`\n${colors.cyan}Metrics:${colors.reset}`);
    console.log(`  Total Check-ins: ${results.metrics.totalCheckIns}`);
    console.log(`  Total Check-outs: ${results.metrics.totalCheckOuts}`);
    console.log(`  Total Orders: ${results.metrics.totalOrders}`);
    console.log(`  Complaints: ${results.metrics.complaintsCount}`);
    console.log(`  Escalations: ${results.metrics.escalationsCount}`);
    console.log(`  Avg Guest Satisfaction: ${results.metrics.avgGuestSatisfaction.toFixed(1)}%`);
    
  } catch (error) {
    clearInterval(statsInterval);
    console.error(`\n${colors.red}Simulation failed:${colors.reset}`, error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n\n${colors.yellow}Stopping simulation...${colors.reset}\n`);
  process.exit(0);
});

// Run
runSimulation();
