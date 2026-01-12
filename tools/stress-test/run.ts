#!/usr/bin/env node
import { Orchestrator } from './orchestrator';
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
V2 Resort Stress Test Runner

Usage: npx ts-node tools/stress-test/run.ts [options]

Options:
  --help, -h        Show this help message
  --url <url>       Override base URL (default: ${CONFIG.BASE_URL})
  --customers <n>   Number of customer bots (default: ${CONFIG.CUSTOMER_BOTS})
  --staff <n>       Number of initial staff bots (default: ${CONFIG.STAFF_BOTS_INITIAL})
  --trainees <n>    Number of trainees to hire (default: ${CONFIG.STAFF_BOTS_TRAINEES})
  --admins <n>      Number of admin bots (default: ${CONFIG.ADMIN_BOTS})
  --duration <s>    Test duration in seconds (0 = infinite, default: 0)

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

async function main() {
  console.log(`
🚀 V2 Resort Stress Test Starting...

Configuration:
  - Base URL: ${CONFIG.BASE_URL}
  - Customer Bots: ${CONFIG.CUSTOMER_BOTS}
  - Staff Bots: ${CONFIG.STAFF_BOTS_INITIAL} + ${CONFIG.STAFF_BOTS_TRAINEES} trainees
  - Admin Bots: ${CONFIG.ADMIN_BOTS}
  - Duration: ${testDuration > 0 ? testDuration + 's' : 'Until stopped (Ctrl+C)'}
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
