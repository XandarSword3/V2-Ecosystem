#!/usr/bin/env node
import { Orchestrator } from './orchestrator';
import { HellModeOrchestrator } from './hell-mode';
import { FinancialAuditor } from './utils/auditor';
import { CONFIG } from './config';

const orchestrator = new Orchestrator();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT. Shutting down gracefully...');
  orchestrator.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM. Shutting down gracefully...');
  orchestrator.stop();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  orchestrator.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
V2 Ecosystem Stress Test Runner

Usage: npx ts-node tools/stress-test/run.ts [options]

Options:
  --help, -h        Show this help message
  --url <url>       Override base URL (default: ${CONFIG.BASE_URL})
  --customers <n>   Number of customer bots (default: ${CONFIG.CUSTOMER_BOTS})
  --staff <n>       Number of initial staff bots (default: ${CONFIG.STAFF_BOTS_INITIAL})
  --trainees <n>    Number of trainees to hire (default: ${CONFIG.STAFF_BOTS_TRAINEES})
  --admins <n>      Number of admin bots (default: ${CONFIG.ADMIN_BOTS})
  --duration <s>    Test duration in seconds (0 = infinite, default: 0)
  --audit           Run financial and data integrity audit
  --chaos           Enable chaos injection (latency, drops, etc.)
  --hell-mode <sc>  Run a high-concurrency "Hell Mode" scenario

Environment Variables:
  STRESS_TEST_URL         Base URL for the API
  STRESS_TEST_ADMIN_EMAIL Admin email for auth
  STRESS_TEST_ADMIN_PASS  Admin password for auth

Example:
  npx ts-node tools/stress-test/run.ts --url http://localhost:3000 --customers 20
`);
  process.exit(0);
}

// Parse URL override
const urlIndex = args.indexOf('--url');
if (urlIndex !== -1 && args[urlIndex + 1]) {
  (CONFIG as any).BASE_URL = args[urlIndex + 1];
}

// Parse bot count overrides
const customersIndex = args.indexOf('--customers');
if (customersIndex !== -1 && args[customersIndex + 1]) {
  (CONFIG as any).CUSTOMER_BOTS = parseInt(args[customersIndex + 1], 10);
}

const staffIndex = args.indexOf('--staff');
if (staffIndex !== -1 && args[staffIndex + 1]) {
  (CONFIG as any).STAFF_BOTS_INITIAL = parseInt(args[staffIndex + 1], 10);
}

const traineesIndex = args.indexOf('--trainees');
if (traineesIndex !== -1 && args[traineesIndex + 1]) {
  (CONFIG as any).STAFF_BOTS_TRAINEES = parseInt(args[traineesIndex + 1], 10);
}

const adminsIndex = args.indexOf('--admins');
if (adminsIndex !== -1 && args[adminsIndex + 1]) {
  (CONFIG as any).ADMIN_BOTS = parseInt(args[adminsIndex + 1], 10);
}

// Parse duration
const durationIndex = args.indexOf('--duration');
let testDuration = 0;
if (durationIndex !== -1 && args[durationIndex + 1]) {
  testDuration = parseInt(args[durationIndex + 1], 10);
}


// Parse Chaos Mode
if (args.includes('--chaos')) {
  console.log('🌪️ CHAOS MODE ENABLED: Expect latency, drops, and unruly bots.');
  CONFIG.CHAOS_CONFIG.ENABLED = true;
}

// Parse Hell Mode
const hellModeIndex = args.indexOf('--hell-mode');
let hellModeScenario = '';
if (hellModeIndex !== -1 && args[hellModeIndex + 1]) {
  hellModeScenario = args[hellModeIndex + 1];
}

async function main() {
  if (args.includes('--audit')) {
    const auditor = new FinancialAuditor();
    const success = await auditor.runAudit();
    process.exit(success ? 0 : 1);
  }

  if (hellModeScenario) {
    console.log(`
🔥 V2 Ecosystem HELL MODE Starting...
   Scenario: ${hellModeScenario}
`);
    const hellOrchestrator = new HellModeOrchestrator();
    // Handle shutdown for hell orchestrator
    process.on('SIGINT', () => { console.log('🛑 Stopping Hell Mode...'); hellOrchestrator.stop(); process.exit(0); });

    const availableScenarios = hellOrchestrator.getAvailableScenarios();
    if (availableScenarios.includes(hellModeScenario)) {
      await hellOrchestrator.startScenario(hellModeScenario);
    } else {
      console.error(`❌ Unknown Hell Mode scenario: "${hellModeScenario}"`);
      console.error(`Available: ${availableScenarios.join(', ')}`);
      process.exit(1);
    }

    process.exit(0);
  }

  console.log(`
🚀 V2 Ecosystem Stress Test Starting...

Configuration:
  - Base URL: ${CONFIG.BASE_URL}
  - Chaos Mode: ${CONFIG.CHAOS_CONFIG.ENABLED ? 'ON 🌪️' : 'OFF'}
  - Customer Bots: ${CONFIG.CUSTOMER_BOTS}
  - Staff Bots: ${CONFIG.STAFF_BOTS_INITIAL} + ${CONFIG.STAFF_BOTS_TRAINEES} trainees
  - Admin Bots: ${CONFIG.ADMIN_BOTS}
  - Duration: ${testDuration > 0 ? testDuration + 'ss' : 'Until stopped (Ctrl+C)'}
`);

  // Start the test
  const startPromise = orchestrator.start();

  // If duration is set, stop after that time
  if (testDuration > 0) {
    setTimeout(() => {
      console.log(`\n⏰ Test duration (${testDuration}s) reached. Stopping...`);
      orchestrator.stop();
      process.exit(0);
    }, testDuration * 1000);
  }

  await startPromise;
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  orchestrator.stop();
  process.exit(1);
});
