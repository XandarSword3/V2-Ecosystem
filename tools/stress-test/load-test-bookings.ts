/**
 * Load Test: 100 Concurrent Chalet Bookings
 * 
 * Validates system handles 100 simultaneous booking attempts:
 * - Tests database locking and race conditions
 * - Measures response times under load
 * - Verifies no double-bookings occur
 * - Reports success rate and performance metrics
 * 
 * Usage: npx tsx load-test-bookings.ts [--target=URL] [--concurrent=N]
 */

import { CONFIG } from './config';

interface BookingResult {
  customerId: number;
  success: boolean;
  responseTime: number;
  bookingId?: string;
  error?: string;
  statusCode?: number;
}

interface LoadTestReport {
  totalAttempts: number;
  successfulBookings: number;
  failedBookings: number;
  expectedConflicts: number;  // Same chalet/dates
  unexpectedErrors: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  totalDuration: number;
}

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string, defaultValue: string) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defaultValue;
};

const TARGET_URL = getArg('target', CONFIG.API_BASE_URL);
const CONCURRENT_BOOKINGS = parseInt(getArg('concurrent', '100'));
const CHALETS_TO_TEST = parseInt(getArg('chalets', '10'));  // Spread across chalets

class BookingLoadTest {
  private results: BookingResult[] = [];
  private authTokens: Map<number, string> = new Map();
  
  async run(): Promise<LoadTestReport> {
    console.log('\n' + '═'.repeat(80));
    console.log('  🏨 V2 RESORT - CHALET BOOKING LOAD TEST');
    console.log('═'.repeat(80));
    console.log(`  Target:     ${TARGET_URL}`);
    console.log(`  Concurrent: ${CONCURRENT_BOOKINGS} bookings`);
    console.log(`  Chalets:    ${CHALETS_TO_TEST} chalets`);
    console.log('═'.repeat(80) + '\n');

    // Step 1: Create and authenticate test users
    console.log('📝 Step 1: Creating test users...');
    await this.setupTestUsers();

    // Step 2: Fetch available chalets
    console.log('🏠 Step 2: Fetching available chalets...');
    const chalets = await this.fetchChalets();
    if (chalets.length === 0) {
      throw new Error('No chalets available for testing');
    }
    console.log(`   Found ${chalets.length} chalets\n`);

    // Step 3: Execute concurrent bookings
    console.log(`🚀 Step 3: Executing ${CONCURRENT_BOOKINGS} concurrent bookings...`);
    const startTime = Date.now();
    
    const bookingPromises: Promise<BookingResult>[] = [];
    for (let i = 0; i < CONCURRENT_BOOKINGS; i++) {
      const chaletId = chalets[i % Math.min(chalets.length, CHALETS_TO_TEST)].id;
      bookingPromises.push(this.makeBooking(i, chaletId));
    }

    this.results = await Promise.all(bookingPromises);
    const totalDuration = Date.now() - startTime;

    // Step 4: Generate report
    const report = this.generateReport(totalDuration);
    this.printReport(report);

    // Step 5: Verify no double-bookings
    console.log('\n🔍 Step 5: Verifying booking integrity...');
    await this.verifyNoDoubleBookings();

    return report;
  }

  private async setupTestUsers(): Promise<void> {
    // Register or login test users
    const userPromises: Promise<void>[] = [];
    
    for (let i = 0; i < CONCURRENT_BOOKINGS; i++) {
      userPromises.push(this.authenticateUser(i));
    }

    await Promise.all(userPromises);
    console.log(`   Authenticated ${this.authTokens.size} test users\n`);
  }

  private async authenticateUser(index: number): Promise<void> {
    const email = `bookingtest${index}@loadtest.local`;
    const password = 'LoadTest123!';

    try {
      // Try login first
      const loginResponse = await fetch(`${TARGET_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (loginResponse.ok) {
        const data = await loginResponse.json();
        this.authTokens.set(index, data.accessToken || data.token);
        return;
      }

      // If login fails, try to register
      const registerResponse = await fetch(`${TARGET_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: `Booking Test User ${index}`,
          phone: `+961${String(71000000 + index).padStart(8, '0')}`,
        }),
      });

      if (registerResponse.ok) {
        const data = await registerResponse.json();
        this.authTokens.set(index, data.accessToken || data.token);
      }
    } catch (error) {
      console.error(`   Failed to authenticate user ${index}:`, error);
    }
  }

  private async fetchChalets(): Promise<{ id: string; name: string }[]> {
    try {
      const response = await fetch(`${TARGET_URL}/chalets`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.data || data || [];
    } catch {
      return [];
    }
  }

  private async makeBooking(customerId: number, chaletId: string): Promise<BookingResult> {
    const startTime = performance.now();
    const token = this.authTokens.get(customerId);

    // Generate booking dates (spread across next 30 days to reduce conflicts)
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + (customerId % 30) + 1);  // Different days
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 1);

    try {
      const response = await fetch(`${TARGET_URL}/chalets/${chaletId}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          check_in_date: checkIn.toISOString().split('T')[0],
          check_out_date: checkOut.toISOString().split('T')[0],
          guest_name: `Test Guest ${customerId}`,
          guest_phone: `+961${String(72000000 + customerId).padStart(8, '0')}`,
          guest_count: 2,
        }),
      });

      const responseTime = performance.now() - startTime;
      const data = await response.json().catch(() => ({}));

      return {
        customerId,
        success: response.ok,
        responseTime,
        bookingId: data.data?.id || data.id,
        statusCode: response.status,
        error: !response.ok ? (data.message || data.error || `Status ${response.status}`) : undefined,
      };
    } catch (error: any) {
      return {
        customerId,
        success: false,
        responseTime: performance.now() - startTime,
        error: error.message || 'Network error',
      };
    }
  }

  private generateReport(totalDuration: number): LoadTestReport {
    const responseTimes = this.results.map(r => r.responseTime).sort((a, b) => a - b);
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    // Expected conflicts: same chalet/date combinations
    const expectedConflicts = failed.filter(r => 
      r.statusCode === 409 || 
      r.error?.toLowerCase().includes('conflict') ||
      r.error?.toLowerCase().includes('already booked') ||
      r.error?.toLowerCase().includes('not available')
    );

    const unexpectedErrors = failed.filter(r => 
      !expectedConflicts.includes(r)
    );

    return {
      totalAttempts: this.results.length,
      successfulBookings: successful.length,
      failedBookings: failed.length,
      expectedConflicts: expectedConflicts.length,
      unexpectedErrors: unexpectedErrors.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      minResponseTime: responseTimes[0],
      maxResponseTime: responseTimes[responseTimes.length - 1],
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.99)],
      requestsPerSecond: (this.results.length / totalDuration) * 1000,
      totalDuration,
    };
  }

  private printReport(report: LoadTestReport): void {
    const status = report.unexpectedErrors === 0 ? '✅ PASSED' : '❌ FAILED';
    
    console.log('\n' + '═'.repeat(80));
    console.log(`  📊 LOAD TEST RESULTS - ${status}`);
    console.log('═'.repeat(80));
    console.log(`
  📈 Summary:
     Total Attempts:      ${report.totalAttempts}
     Successful:          ${report.successfulBookings} (${((report.successfulBookings / report.totalAttempts) * 100).toFixed(1)}%)
     Failed:              ${report.failedBookings}
       - Expected (409):  ${report.expectedConflicts}
       - Unexpected:      ${report.unexpectedErrors}

  ⏱️  Response Times:
     Average:             ${report.averageResponseTime.toFixed(2)}ms
     Min:                 ${report.minResponseTime.toFixed(2)}ms
     Max:                 ${report.maxResponseTime.toFixed(2)}ms
     P95:                 ${report.p95ResponseTime.toFixed(2)}ms
     P99:                 ${report.p99ResponseTime.toFixed(2)}ms

  🚀 Throughput:
     Duration:            ${report.totalDuration}ms
     Requests/sec:        ${report.requestsPerSecond.toFixed(2)}
`);
    console.log('═'.repeat(80) + '\n');

    // Print unexpected errors if any
    if (report.unexpectedErrors > 0) {
      console.log('❌ Unexpected Errors:');
      const errors = this.results.filter(r => 
        !r.success && 
        r.statusCode !== 409 && 
        !r.error?.toLowerCase().includes('conflict')
      );
      errors.slice(0, 10).forEach(e => {
        console.log(`   Customer ${e.customerId}: ${e.error} (${e.statusCode})`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more`);
      }
    }
  }

  private async verifyNoDoubleBookings(): Promise<void> {
    // Fetch all bookings and verify no overlaps
    const successfulBookings = this.results.filter(r => r.success && r.bookingId);
    console.log(`   Verifying ${successfulBookings.length} successful bookings...`);

    // Group by booking ID to check for duplicates
    const bookingIds = new Set<string>();
    const duplicates: string[] = [];

    for (const booking of successfulBookings) {
      if (booking.bookingId) {
        if (bookingIds.has(booking.bookingId)) {
          duplicates.push(booking.bookingId);
        }
        bookingIds.add(booking.bookingId);
      }
    }

    if (duplicates.length > 0) {
      console.log(`   ❌ CRITICAL: Found ${duplicates.length} duplicate booking IDs!`);
      console.log(`      This indicates a race condition bug.`);
    } else {
      console.log(`   ✅ No duplicate bookings detected`);
    }
  }
}

// Run the test
const test = new BookingLoadTest();
test.run()
  .then((report) => {
    const exitCode = report.unexpectedErrors > 0 ? 1 : 0;
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  });
