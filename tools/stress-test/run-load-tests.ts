/**
 * Combined Load Test Runner
 * 
 * Runs all load tests in sequence and generates a comprehensive report.
 * 
 * Usage: npx tsx run-load-tests.ts [--target=URL]
 */

import { spawn } from 'child_process';
import { CONFIG } from './config';

const args = process.argv.slice(2);
const getArg = (name: string, defaultValue: string) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defaultValue;
};

const TARGET_URL = getArg('target', CONFIG.API_BASE_URL);

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  output: string;
}

async function runTest(script: string, description: string): Promise<TestResult> {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`▶️  Running: ${description}`);
  console.log(`${'─'.repeat(80)}\n`);

  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', script, `--target=${TARGET_URL}`], {
      cwd: __dirname,
      shell: true,
      stdio: 'pipe',
    });

    let output = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({
        name: description,
        passed: code === 0,
        duration: Date.now() - startTime,
        output,
      });
    });
  });
}

async function main() {
  console.log('\n' + '═'.repeat(80));
  console.log('  🧪 V2 RESORT - COMPREHENSIVE LOAD TEST SUITE');
  console.log('═'.repeat(80));
  console.log(`  Target: ${TARGET_URL}`);
  console.log(`  Time:   ${new Date().toISOString()}`);
  console.log('═'.repeat(80));

  const results: TestResult[] = [];

  // Run booking load test
  results.push(await runTest(
    'load-test-bookings.ts',
    '100 Concurrent Chalet Bookings'
  ));

  // Run order load test
  results.push(await runTest(
    'load-test-orders.ts',
    '50 Simultaneous Restaurant Orders'
  ));

  // Print summary
  console.log('\n' + '═'.repeat(80));
  console.log('  📊 LOAD TEST SUITE SUMMARY');
  console.log('═'.repeat(80));

  let allPassed = true;
  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    allPassed = allPassed && result.passed;
    console.log(`  ${status} ${result.name.padEnd(40)} ${(result.duration / 1000).toFixed(1)}s`);
  }

  console.log('─'.repeat(80));
  const finalStatus = allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED';
  console.log(`  ${finalStatus}`);
  console.log('═'.repeat(80) + '\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
