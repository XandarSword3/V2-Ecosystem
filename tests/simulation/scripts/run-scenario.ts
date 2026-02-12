/**
 * CLI Script to run simulation scenarios
 * Usage: npx ts-node scripts/run-scenario.ts <scenario-name>
 */

import { SimulationOrchestrator, SimulationResults } from '../src/orchestrator/SimulationOrchestrator';
import { 
  getAllScenarios, 
  getScenarioByName,
  NormalWeekdayScenario 
} from '../src/scenarios/ScenarioDefinitions';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3005';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

async function main() {
  const scenarioArg = process.argv[2];

  // Show available scenarios if none specified
  if (!scenarioArg || scenarioArg === '--help' || scenarioArg === '-h') {
    console.log('\n🎭 V2 Resort Multi-Actor Simulation System\n');
    console.log('Usage: npx ts-node scripts/run-scenario.ts <scenario>\n');
    console.log('Available scenarios:');
    for (const scenario of getAllScenarios()) {
      console.log(`  ${scenario.name.toLowerCase().replace(/\s+/g, '-').padEnd(25)} - ${scenario.description}`);
    }
    console.log('\nOptions:');
    console.log('  normal     - Normal Weekday Operation');
    console.log('  lunch      - Lunch Rush');
    console.log('  conference - Conference Day');
    console.log('  stress     - Stress Test');
    console.log('  weekend    - Weekend Turnover');
    console.log('\nEnvironment variables:');
    console.log('  API_BASE_URL - Backend API URL (default: http://localhost:3005)');
    console.log('  AUTH_TOKEN   - Authentication token (optional)');
    return;
  }

  // Map short names to full names
  const shortNameMap: Record<string, string> = {
    'normal': 'Normal Weekday Operation',
    'lunch': 'Lunch Rush',
    'conference': 'Conference Day',
    'stress': 'Stress Test',
    'weekend': 'Weekend Turnover',
  };

  const scenarioName = shortNameMap[scenarioArg.toLowerCase()] || scenarioArg;
  const scenario = getScenarioByName(scenarioName) || NormalWeekdayScenario;

  console.log('\n' + '='.repeat(70));
  console.log('🎭 V2 RESORT MULTI-ACTOR SIMULATION');
  console.log('='.repeat(70));
  console.log(`\n📋 Scenario: ${scenario.name}`);
  console.log(`📝 Description: ${scenario.description}`);
  console.log(`⏱️  Duration: ${scenario.duration.days} day(s)`);
  console.log(`⚡ Time Multiplier: ${scenario.timeMultiplier}x`);
  console.log(`🌐 API: ${API_BASE_URL}`);
  console.log('\n' + '-'.repeat(70));

  // Calculate total actors
  const actors = scenario.actors;
  const guestCount = Object.values(actors.guests).reduce((sum, val) => {
    if (typeof val === 'number') return sum + val;
    if (typeof val === 'object' && 'count' in val) return sum + val.count;
    return sum;
  }, 0);
  const staffCount = Object.values(actors.staff).reduce((sum, val) => sum + val, 0);
  const managerCount = Object.values(actors.managers).reduce((sum, val) => sum + val, 0);
  const adminCount = Object.values(actors.admins).reduce((sum, val) => sum + val, 0);
  const totalActors = guestCount + staffCount + managerCount + adminCount;

  console.log(`\n👥 Actor Distribution (${totalActors} total):`);
  console.log(`   🧳 Guests: ${guestCount}`);
  console.log(`      - Business: ${actors.guests.business}`);
  console.log(`      - Family: ${actors.guests.family}`);
  console.log(`      - Luxury: ${actors.guests.luxury}`);
  console.log(`      - Budget: ${actors.guests.budget}`);
  console.log(`      - Honeymoon: ${actors.guests.honeymoon}`);
  if (actors.guests.conference) {
    console.log(`      - Conference: ${actors.guests.conference.count}`);
  }
  console.log(`   👨‍💼 Staff: ${staffCount}`);
  console.log(`   👔 Managers: ${managerCount}`);
  console.log(`   🖥️  Admins: ${adminCount}`);

  console.log(`\n✅ Assertions: ${scenario.assertions.length}`);
  for (const assertion of scenario.assertions) {
    console.log(`   - ${assertion.name} (${assertion.severity})`);
  }

  console.log('\n' + '-'.repeat(70));
  console.log('🚀 Starting simulation...\n');

  const orchestrator = new SimulationOrchestrator(API_BASE_URL, AUTH_TOKEN);

  // Track progress
  let lastProgress = 0;
  const progressInterval = setInterval(() => {
    const state = orchestrator.getState();
    if (state.status === 'running') {
      const progress = Math.min(100, state.eventsProcessed / 10);
      if (progress > lastProgress + 5) {
        process.stdout.write(`\r⏳ Progress: ${Math.floor(progress)}% | Events: ${state.eventsProcessed} | Assertions: ✅${state.assertionsPassed} ❌${state.assertionsFailed}`);
        lastProgress = progress;
      }
    }
  }, 500);

  try {
    await orchestrator.loadScenario(scenario);
    await orchestrator.start();

    clearInterval(progressInterval);
    console.log('\n');

    const results = orchestrator.getResults();
    printResults(results);

    orchestrator.destroy();

    // Exit with error if any assertions failed
    if (results.assertions.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    clearInterval(progressInterval);
    console.error('\n❌ Simulation failed:', error);
    orchestrator.destroy();
    process.exit(1);
  }
}

function printResults(results: SimulationResults): void {
  console.log('='.repeat(70));
  console.log('📊 SIMULATION RESULTS');
  console.log('='.repeat(70));

  console.log(`\n📋 Scenario: ${results.scenario}`);
  
  console.log(`\n⏱️  Duration:`);
  console.log(`   Simulated: ${formatDuration(results.duration.simulated)}`);
  console.log(`   Real: ${formatDuration(results.duration.real)}`);

  console.log(`\n👥 Actors: ${results.actors.total}`);
  for (const [type, count] of Object.entries(results.actors.byType)) {
    console.log(`   ${type}: ${count}`);
  }

  console.log(`\n📨 Events: ${results.events.total}`);
  const topCategories = Object.entries(results.events.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  for (const [category, count] of topCategories) {
    console.log(`   ${category}: ${count}`);
  }

  console.log(`\n✅ Assertions: ${results.assertions.passed}/${results.assertions.total} passed`);
  for (const assertion of results.assertions.results) {
    const icon = assertion.passed ? '✅' : '❌';
    console.log(`   ${icon} ${assertion.name}${assertion.message ? ` - ${assertion.message}` : ''}`);
  }

  console.log(`\n📈 Key Metrics:`);
  console.log(`   Avg Guest Satisfaction: ${results.metrics.avgGuestSatisfaction}/100`);
  console.log(`   Total Orders: ${results.metrics.totalOrders}`);
  console.log(`   Check-ins: ${results.metrics.totalCheckIns}`);
  console.log(`   Check-outs: ${results.metrics.totalCheckOuts}`);
  console.log(`   Complaints: ${results.metrics.complaintsCount}`);
  console.log(`   Escalations: ${results.metrics.escalationsCount}`);

  console.log('\n' + '='.repeat(70));
  
  if (results.assertions.failed === 0) {
    console.log('🎉 SIMULATION PASSED - All assertions met!');
  } else {
    console.log(`⚠️  SIMULATION FAILED - ${results.assertions.failed} assertion(s) failed`);
  }
  console.log('='.repeat(70) + '\n');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

main().catch(console.error);
