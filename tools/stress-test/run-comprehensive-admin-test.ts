/**
 * Comprehensive Admin Feature Test Runner
 * 
 * This script runs the AdminBot in test mode to perform full CRUD verification
 * across all admin features. Unlike the stress test, this focuses on:
 * 
 * - Create → Read (Verify) → Update → Delete cycles
 * - Data integrity verification
 * - Workflow testing (order status progression, etc.)
 * 
 * Usage:
 *   npx ts-node run-comprehensive-admin-test.ts
 */

import { AdminBot } from './bots/admin-bot';

async function runComprehensiveTest() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║      🧪 V2 RESORT - COMPREHENSIVE ADMIN FEATURE TEST 🧪           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('This will test ALL admin features with full CRUD verification.');
  console.log('');

  const adminBot = new AdminBot(0);
  
  // Enable test mode for comprehensive testing
  adminBot.enableTestMode();

  // Initialize (login as admin)
  console.log('🔐 Logging in as admin...');
  const initialized = await adminBot.initialize();
  
  if (!initialized) {
    console.error('❌ Failed to initialize admin bot. Check your credentials and API server.');
    process.exit(1);
  }

  console.log('✅ Admin logged in successfully');
  console.log('');

  // Run comprehensive tests
  const startTime = Date.now();
  await adminBot.start();
  const duration = Date.now() - startTime;

  // Get and display results
  const results = adminBot.getTestResults();
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                        FINAL RESULTS                              ║');
  console.log('╠═══════════════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed:     ${String(passed).padEnd(6)}                                        ║`);
  console.log(`║  ❌ Failed:     ${String(failed).padEnd(6)}                                        ║`);
  console.log(`║  📝 Total:      ${String(results.length).padEnd(6)}                                        ║`);
  console.log(`║  📈 Pass Rate:  ${(results.length > 0 ? ((passed / results.length) * 100).toFixed(1) : '0.0').padEnd(6)}%                                       ║`);
  console.log(`║  ⏱️  Duration:   ${(duration / 1000).toFixed(1).padEnd(6)}s                                       ║`);
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  // Export results as JSON for CI/CD integration
  const fs = await import('fs');
  const resultFile = 'admin-test-results.json';
  fs.writeFileSync(resultFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    duration,
    summary: { passed, failed, total: results.length, passRate: results.length > 0 ? (passed / results.length) * 100 : 0 },
    results,
  }, null, 2));
  console.log(`\n📄 Detailed results saved to: ${resultFile}`);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

runComprehensiveTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
