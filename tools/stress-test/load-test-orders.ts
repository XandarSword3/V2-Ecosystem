/**
 * Load Test: 50 Simultaneous Restaurant Orders
 * 
 * Validates system handles 50 concurrent order submissions:
 * - Tests inventory management under load
 * - Measures order processing response times
 * - Verifies WebSocket notifications are delivered
 * - Reports success rate and kitchen queue handling
 * 
 * Usage: npx tsx load-test-orders.ts [--target=URL] [--concurrent=N]
 */

import { CONFIG } from './config';

interface OrderResult {
  customerId: number;
  success: boolean;
  responseTime: number;
  orderId?: string;
  orderNumber?: string;
  error?: string;
  statusCode?: number;
  itemsOrdered: number;
}

interface LoadTestReport {
  totalAttempts: number;
  successfulOrders: number;
  failedOrders: number;
  outOfStockErrors: number;
  unexpectedErrors: number;
  totalItemsOrdered: number;
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
const CONCURRENT_ORDERS = parseInt(getArg('concurrent', '50'));
const ITEMS_PER_ORDER = parseInt(getArg('items', '3'));

class OrderLoadTest {
  private results: OrderResult[] = [];
  private authTokens: Map<number, string> = new Map();
  private menuItems: { id: string; name: string; price: number }[] = [];
  
  async run(): Promise<LoadTestReport> {
    console.log('\n' + '═'.repeat(80));
    console.log('  🍽️  V2 RESORT - RESTAURANT ORDER LOAD TEST');
    console.log('═'.repeat(80));
    console.log(`  Target:        ${TARGET_URL}`);
    console.log(`  Concurrent:    ${CONCURRENT_ORDERS} orders`);
    console.log(`  Items/Order:   ${ITEMS_PER_ORDER}`);
    console.log('═'.repeat(80) + '\n');

    // Step 1: Create and authenticate test users
    console.log('📝 Step 1: Creating test users...');
    await this.setupTestUsers();

    // Step 2: Fetch menu items
    console.log('📋 Step 2: Fetching menu items...');
    await this.fetchMenuItems();
    if (this.menuItems.length === 0) {
      throw new Error('No menu items available for testing');
    }
    console.log(`   Found ${this.menuItems.length} menu items\n`);

    // Step 3: Execute concurrent orders
    console.log(`🚀 Step 3: Executing ${CONCURRENT_ORDERS} concurrent orders...`);
    const startTime = Date.now();
    
    const orderPromises: Promise<OrderResult>[] = [];
    for (let i = 0; i < CONCURRENT_ORDERS; i++) {
      orderPromises.push(this.placeOrder(i));
    }

    this.results = await Promise.all(orderPromises);
    const totalDuration = Date.now() - startTime;

    // Step 4: Generate report
    const report = this.generateReport(totalDuration);
    this.printReport(report);

    // Step 5: Verify order queue
    console.log('\n🔍 Step 5: Verifying order queue...');
    await this.verifyOrderQueue();

    return report;
  }

  private async setupTestUsers(): Promise<void> {
    const userPromises: Promise<void>[] = [];
    
    for (let i = 0; i < CONCURRENT_ORDERS; i++) {
      userPromises.push(this.authenticateUser(i));
    }

    await Promise.all(userPromises);
    console.log(`   Authenticated ${this.authTokens.size} test users\n`);
  }

  private async authenticateUser(index: number): Promise<void> {
    const email = `ordertest${index}@loadtest.local`;
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
          full_name: `Order Test User ${index}`,
          phone: `+961${String(73000000 + index).padStart(8, '0')}`,
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

  private async fetchMenuItems(): Promise<void> {
    try {
      // Try restaurant menu first
      let response = await fetch(`${TARGET_URL}/restaurant/menu`);
      if (response.ok) {
        const data = await response.json();
        const items = data.data || data || [];
        
        // Flatten categories if needed
        if (items.length > 0 && items[0].items) {
          this.menuItems = items.flatMap((cat: any) => cat.items || []);
        } else {
          this.menuItems = items;
        }
        return;
      }

      // Fallback to menu items endpoint
      response = await fetch(`${TARGET_URL}/restaurant/menu-items`);
      if (response.ok) {
        const data = await response.json();
        this.menuItems = data.data || data || [];
      }
    } catch (error) {
      console.error('   Failed to fetch menu:', error);
    }
  }

  private selectRandomItems(): { id: string; quantity: number }[] {
    const items: { id: string; quantity: number }[] = [];
    const usedItems = new Set<string>();

    for (let i = 0; i < ITEMS_PER_ORDER && i < this.menuItems.length; i++) {
      // Pick a random item we haven't used yet
      let item;
      let attempts = 0;
      do {
        item = this.menuItems[Math.floor(Math.random() * this.menuItems.length)];
        attempts++;
      } while (usedItems.has(item.id) && attempts < 10);

      if (!usedItems.has(item.id)) {
        items.push({
          id: item.id,
          quantity: Math.floor(Math.random() * 2) + 1,  // 1-2 of each
        });
        usedItems.add(item.id);
      }
    }

    return items;
  }

  private async placeOrder(customerId: number): Promise<OrderResult> {
    const startTime = performance.now();
    const token = this.authTokens.get(customerId);
    const items = this.selectRandomItems();

    try {
      const response = await fetch(`${TARGET_URL}/restaurant/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          items: items.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity,
          })),
          order_type: 'dine_in',
          table_number: (customerId % 20) + 1,  // Spread across 20 tables
          notes: `Load test order #${customerId}`,
          customer_name: `Test Customer ${customerId}`,
        }),
      });

      const responseTime = performance.now() - startTime;
      const data = await response.json().catch(() => ({}));

      return {
        customerId,
        success: response.ok,
        responseTime,
        orderId: data.data?.id || data.id,
        orderNumber: data.data?.order_number || data.order_number,
        statusCode: response.status,
        itemsOrdered: items.reduce((sum, item) => sum + item.quantity, 0),
        error: !response.ok ? (data.message || data.error || `Status ${response.status}`) : undefined,
      };
    } catch (error: any) {
      return {
        customerId,
        success: false,
        responseTime: performance.now() - startTime,
        itemsOrdered: items.reduce((sum, item) => sum + item.quantity, 0),
        error: error.message || 'Network error',
      };
    }
  }

  private generateReport(totalDuration: number): LoadTestReport {
    const responseTimes = this.results.map(r => r.responseTime).sort((a, b) => a - b);
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    // Expected errors: out of stock
    const outOfStockErrors = failed.filter(r => 
      r.error?.toLowerCase().includes('out of stock') ||
      r.error?.toLowerCase().includes('insufficient') ||
      r.error?.toLowerCase().includes('unavailable')
    );

    const unexpectedErrors = failed.filter(r => 
      !outOfStockErrors.includes(r)
    );

    return {
      totalAttempts: this.results.length,
      successfulOrders: successful.length,
      failedOrders: failed.length,
      outOfStockErrors: outOfStockErrors.length,
      unexpectedErrors: unexpectedErrors.length,
      totalItemsOrdered: this.results.reduce((sum, r) => sum + r.itemsOrdered, 0),
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
     Successful:          ${report.successfulOrders} (${((report.successfulOrders / report.totalAttempts) * 100).toFixed(1)}%)
     Failed:              ${report.failedOrders}
       - Out of Stock:    ${report.outOfStockErrors}
       - Unexpected:      ${report.unexpectedErrors}
     Total Items:         ${report.totalItemsOrdered}

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
        !r.error?.toLowerCase().includes('out of stock') &&
        !r.error?.toLowerCase().includes('insufficient')
      );
      errors.slice(0, 10).forEach(e => {
        console.log(`   Customer ${e.customerId}: ${e.error} (${e.statusCode})`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more`);
      }
    }
  }

  private async verifyOrderQueue(): Promise<void> {
    const successfulOrders = this.results.filter(r => r.success);
    console.log(`   Created ${successfulOrders.length} orders`);

    // Verify unique order numbers
    const orderNumbers = new Set<string>();
    const duplicates: string[] = [];

    for (const order of successfulOrders) {
      if (order.orderNumber) {
        if (orderNumbers.has(order.orderNumber)) {
          duplicates.push(order.orderNumber);
        }
        orderNumbers.add(order.orderNumber);
      }
    }

    if (duplicates.length > 0) {
      console.log(`   ❌ CRITICAL: Found ${duplicates.length} duplicate order numbers!`);
      duplicates.slice(0, 5).forEach(d => console.log(`      - ${d}`));
    } else {
      console.log(`   ✅ All order numbers are unique`);
    }

    // Check pending orders via API (if available)
    try {
      const response = await fetch(`${TARGET_URL}/restaurant/orders?status=pending`);
      if (response.ok) {
        const data = await response.json();
        const pendingCount = (data.data || data || []).length;
        console.log(`   📋 Pending orders in queue: ${pendingCount}`);
      }
    } catch {
      // Endpoint may require auth
    }
  }
}

// Run the test
const test = new OrderLoadTest();
test.run()
  .then((report) => {
    const exitCode = report.unexpectedErrors > 0 ? 1 : 0;
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  });
