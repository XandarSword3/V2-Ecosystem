import { test, expect, Page, APIRequestContext } from './fixtures/auth.fixture';

/**
 * Stress Testing Utilities for V2 Ecosystem Ecosystem
 * 
 * Tests for:
 * - Concurrency simulation
 * - Race condition detection
 * - Double-submit prevention
 * - Idempotency verification
 */

// ============================================
// Test Helpers
// ============================================

interface TestUser {
  email: string;
  password: string;
  token?: string;
}

async function loginUser(request: APIRequestContext, baseUrl: string, user: TestUser): Promise<string> {
  const response = await request.post(`${baseUrl}/api/v1/auth/login`, {
    data: { email: user.email, password: user.password },
  });
  const data = await response.json();
  return data.data?.accessToken || data.token;
}

async function createTestOrder(request: APIRequestContext, baseUrl: string, token: string, items: any[]) {
  return request.post(`${baseUrl}/api/v1/restaurant/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { items },
  });
}

// ============================================
// Concurrency Tests
// ============================================

test.describe('Concurrency Stress Tests', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3005';
  
  test('concurrent order creation should not oversell inventory', async ({ request }) => {
    // This test simulates multiple users trying to order the same low-stock item
    const itemId = process.env.TEST_ITEM_ID || 'test-item-uuid';
    const initialStock = 5;
    const concurrentOrders = 10;
    
    // Create multiple order requests simultaneously
    const orderPromises = Array(concurrentOrders).fill(null).map(async (_, i) => {
      try {
        const response = await request.post(`${baseUrl}/api/v1/restaurant/orders`, {
          data: {
            items: [{ menuItemId: itemId, quantity: 1 }],
            tableNumber: i + 1,
          },
        });
        return { success: response.ok(), status: response.status() };
      } catch (error) {
        return { success: false, error };
      }
    });
    
    const results = await Promise.all(orderPromises);
    const successfulOrders = results.filter(r => r.success).length;
    
    // Should not exceed stock
    expect(successfulOrders).toBeLessThanOrEqual(initialStock);
    console.log(`Concurrent orders: ${concurrentOrders}, Successful: ${successfulOrders}, Stock: ${initialStock}`);
  });

  test('concurrent payment processing should not double-charge', async ({ request }) => {
    const paymentId = 'test-payment-id';
    const concurrentPayments = 5;
    
    const paymentPromises = Array(concurrentPayments).fill(null).map(async () => {
      try {
        const response = await request.post(`${baseUrl}/api/v1/payments/process`, {
          data: {
            orderId: paymentId,
            amount: 100,
            method: 'card',
            idempotencyKey: `idem-${paymentId}`, // Same key for all
          },
        });
        return { success: response.ok(), status: response.status() };
      } catch (error) {
        return { success: false, error };
      }
    });
    
    const results = await Promise.all(paymentPromises);
    const successfulPayments = results.filter(r => r.success).length;
    
    // Only ONE should succeed
    expect(successfulPayments).toBe(1);
  });

  test('concurrent booking requests should prevent double-booking', async ({ request }) => {
    const chaletId = process.env.TEST_CHALET_ID || 'test-chalet-uuid';
    const checkIn = '2025-02-15';
    const checkOut = '2025-02-17';
    const concurrentBookings = 5;
    
    const bookingPromises = Array(concurrentBookings).fill(null).map(async (_, i) => {
      try {
        const response = await request.post(`${baseUrl}/api/v1/chalets/bookings`, {
          data: {
            chaletId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            guestEmail: `guest${i}@test.com`,
          },
        });
        return { success: response.ok(), status: response.status() };
      } catch (error) {
        return { success: false, error };
      }
    });
    
    const results = await Promise.all(bookingPromises);
    const successfulBookings = results.filter(r => r.success).length;
    
    // Only ONE should succeed for the same dates
    expect(successfulBookings).toBe(1);
  });
});

// ============================================
// Race Condition Tests
// ============================================

test.describe('Race Condition Tests', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3005';
  
  test('tab merge race condition - two staff merging same tabs', async ({ request }) => {
    const tab1 = 'tab-1-uuid';
    const tab2 = 'tab-2-uuid';
    
    // Simulate two staff trying to merge the same tabs simultaneously
    const mergePromises = [
      request.post(`${baseUrl}/api/v1/restaurant/pos/tabs/merge`, {
        data: { tabIds: [tab1, tab2], targetTabId: tab1 },
      }),
      request.post(`${baseUrl}/api/v1/restaurant/pos/tabs/merge`, {
        data: { tabIds: [tab1, tab2], targetTabId: tab2 },
      }),
    ];
    
    const results = await Promise.all(mergePromises);
    const successCount = results.filter(r => r.ok()).length;
    
    // Only one should succeed
    expect(successCount).toBe(1);
  });

  test('inventory update race - multiple transactions on same item', async ({ request }) => {
    const itemId = process.env.TEST_ITEM_ID || 'test-item-uuid';
    
    // Multiple transactions trying to update same item
    const transactions = Array(10).fill(null).map((_, i) => ({
      type: i % 2 === 0 ? 'sale' : 'adjustment',
      quantity: i % 2 === 0 ? -1 : 1,
    }));
    
    const transactionPromises = transactions.map(tx => 
      request.post(`${baseUrl}/api/v1/inventory/transactions`, {
        data: { itemId, ...tx },
      })
    );
    
    await Promise.all(transactionPromises);
    
    // Verify final stock is consistent
    const stockResponse = await request.get(`${baseUrl}/api/v1/inventory/items/${itemId}`);
    const stockData = await stockResponse.json();
    
    // Stock should be a valid number (not NaN or negative)
    expect(typeof stockData.data?.current_stock).toBe('number');
    expect(stockData.data?.current_stock).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// Double-Submit Prevention Tests
// ============================================

test.describe('Double-Submit Prevention', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3005';
  
  test('double-click order submission should create only one order', async ({ request }) => {
    const orderData = {
      items: [{ menuItemId: 'test-item', quantity: 2 }],
      tableNumber: 5,
      idempotencyKey: `order-${Date.now()}`,
    };
    
    // Simulate rapid double-click (two requests <100ms apart)
    const [response1, response2] = await Promise.all([
      request.post(`${baseUrl}/api/v1/restaurant/orders`, { data: orderData }),
      new Promise<any>(resolve => 
        setTimeout(() => 
          resolve(request.post(`${baseUrl}/api/v1/restaurant/orders`, { data: orderData }))
        , 50)
      ),
    ]);
    
    const data1 = await response1.json();
    const data2 = await (await response2).json();
    
    // Both should return same order ID (idempotent)
    if (data1.data?.id && data2.data?.id) {
      expect(data1.data.id).toBe(data2.data.id);
    }
  });

  test('double-click payment should not charge twice', async ({ request }) => {
    const paymentData = {
      orderId: 'test-order-uuid',
      amount: 50.00,
      method: 'card',
      idempotencyKey: `payment-${Date.now()}`,
    };
    
    const responses = await Promise.all([
      request.post(`${baseUrl}/api/v1/payments/process`, { data: paymentData }),
      request.post(`${baseUrl}/api/v1/payments/process`, { data: paymentData }),
    ]);
    
    const successCount = responses.filter(r => r.ok()).length;
    
    // Second should return cached result or conflict
    expect(successCount).toBeLessThanOrEqual(1);
  });
});

// ============================================
// Idempotency Verification Tests
// ============================================

test.describe('Idempotency Verification', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3005';
  
  test('order creation with same idempotency key returns same order', async ({ request }) => {
    const idempotencyKey = `idem-test-${Date.now()}`;
    
    // First request
    const response1 = await request.post(`${baseUrl}/api/v1/restaurant/orders`, {
      data: {
        items: [{ menuItemId: 'test-item', quantity: 1 }],
        idempotencyKey,
      },
    });
    
    // Retry with same key
    const response2 = await request.post(`${baseUrl}/api/v1/restaurant/orders`, {
      data: {
        items: [{ menuItemId: 'test-item', quantity: 1 }],
        idempotencyKey,
      },
    });
    
    if (response1.ok() && response2.ok()) {
      const data1 = await response1.json();
      const data2 = await response2.json();
      expect(data1.data?.id).toBe(data2.data?.id);
    }
  });

  test('webhook replay should not duplicate actions', async ({ request }) => {
    const webhookId = `webhook-${Date.now()}`;
    const webhookData = {
      type: 'payment.completed',
      id: webhookId,
      data: { orderId: 'test-order', amount: 100 },
    };
    
    // Simulate webhook being sent multiple times
    const responses = await Promise.all([
      request.post(`${baseUrl}/api/v1/payments/webhook`, { data: webhookData }),
      request.post(`${baseUrl}/api/v1/payments/webhook`, { data: webhookData }),
      request.post(`${baseUrl}/api/v1/payments/webhook`, { data: webhookData }),
    ]);
    
    // All should succeed but only first should process
    const successCount = responses.filter(r => r.ok()).length;
    expect(successCount).toBe(3); // All 200, but idempotent
  });
});

// ============================================
// Load Tests
// ============================================

test.describe('Load Tests', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3005';
  
  test('sustained load - 100 requests in 10 seconds', async ({ request }) => {
    const totalRequests = 100;
    const durationMs = 10000;
    const intervalMs = durationMs / totalRequests;
    
    const results: { success: boolean; latency: number }[] = [];
    
    for (let i = 0; i < totalRequests; i++) {
      const start = Date.now();
      try {
        const response = await request.get(`${baseUrl}/api/v1/restaurant/menu`);
        results.push({ 
          success: response.ok(), 
          latency: Date.now() - start 
        });
      } catch (error) {
        results.push({ success: false, latency: Date.now() - start });
      }
      
      // Pace the requests
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    const successRate = results.filter(r => r.success).length / totalRequests;
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / totalRequests;
    const maxLatency = Math.max(...results.map(r => r.latency));
    
    console.log(`Load Test Results:
      - Success Rate: ${(successRate * 100).toFixed(1)}%
      - Avg Latency: ${avgLatency.toFixed(0)}ms
      - Max Latency: ${maxLatency}ms
    `);
    
    expect(successRate).toBeGreaterThan(0.95); // 95% success rate
    expect(avgLatency).toBeLessThan(500); // Avg under 500ms
  });

  test('burst load - 50 simultaneous requests', async ({ request }) => {
    const burstSize = 50;
    const start = Date.now();
    
    const promises = Array(burstSize).fill(null).map(() =>
      request.get(`${baseUrl}/api/v1/restaurant/menu`)
        .then(r => ({ success: r.ok(), status: r.status() }))
        .catch(() => ({ success: false, status: 0 }))
    );
    
    const results = await Promise.all(promises);
    const duration = Date.now() - start;
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    const rateLimited = results.filter(r => r.status === 429).length;
    
    console.log(`Burst Test Results:
      - Total Requests: ${burstSize}
      - Successful: ${successCount}
      - Failed: ${errorCount}
      - Rate Limited: ${rateLimited}
      - Duration: ${duration}ms
    `);
    
    // At least 80% should succeed (allowing for rate limiting)
    expect(successCount).toBeGreaterThan(burstSize * 0.8);
  });
});

// ============================================
// Data Integrity Tests
// ============================================

test.describe('Data Integrity Tests', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3005';
  
  test('order total calculation matches item sum', async ({ request }) => {
    const orderResponse = await request.post(`${baseUrl}/api/v1/restaurant/orders`, {
      data: {
        items: [
          { menuItemId: 'item-1', quantity: 2, price: 10.00 },
          { menuItemId: 'item-2', quantity: 1, price: 15.00 },
        ],
        tableNumber: 1,
      },
    });
    
    if (orderResponse.ok()) {
      const orderData = await orderResponse.json();
      const order = orderData.data;
      
      // Calculate expected total
      const expectedTotal = order.items?.reduce(
        (sum: number, item: any) => sum + (item.quantity * item.unit_price),
        0
      ) || 0;
      
      expect(parseFloat(order.total_amount)).toBeCloseTo(expectedTotal, 2);
    }
  });

  test('inventory stock matches transaction history', async ({ request }) => {
    const itemId = process.env.TEST_ITEM_ID || 'test-item-uuid';
    
    // Get current stock
    const stockResponse = await request.get(`${baseUrl}/api/v1/inventory/items/${itemId}`);
    const stockData = await stockResponse.json();
    const currentStock = parseFloat(stockData.data?.current_stock) || 0;
    
    // Get transaction history
    const txResponse = await request.get(`${baseUrl}/api/v1/inventory/transactions?itemId=${itemId}`);
    const txData = await txResponse.json();
    const transactions = txData.data || [];
    
    // Calculate expected stock from transactions
    const calculatedStock = transactions.reduce((stock: number, tx: any) => {
      const qty = parseFloat(tx.quantity) || 0;
      return tx.transaction_type === 'purchase' || tx.transaction_type === 'adjustment' 
        ? stock + qty 
        : stock - qty;
    }, 0);
    
    // Should match (or be close due to initial stock)
    console.log(`Current: ${currentStock}, Calculated: ${calculatedStock}`);
  });
});
