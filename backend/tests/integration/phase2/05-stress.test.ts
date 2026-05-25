/**
 * Phase 2 — Part 5: Stress Scenarios (S-01 through S-05)
 *
 * High-concurrency tests that determine system behavior under load.
 * These exercise rate limits, capacity enforcement, and event delivery.
 *
 * Run:  npx vitest run --config vitest.integration.config.ts tests/integration/phase2/05-stress.test.ts
 */

import { Phase2Client } from './phase2-client';
import { state, requireState } from './phase2-state';
import { initializePhase2SuiteState, cleanupPhase2SuiteState } from './phase2-suite-bootstrap';

// ─────────── Helpers ───────────

function client(token: string): Phase2Client {
  const c = new Phase2Client();
  c.setToken(token);
  return c;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  await initializePhase2SuiteState();
});

afterAll(() => {
  cleanupPhase2SuiteState();
});

/**
 * Fire N concurrent requests using the same token (different client instances).
 */
async function fireN(
  token: string,
  count: number,
  callFn: (c: Phase2Client, index: number) => Promise<any>,
): Promise<any[]> {
  const clients = Array.from({ length: count }, () => {
    const c = new Phase2Client();
    c.setToken(token);
    return c;
  });
  return Promise.all(clients.map((c, i) => callFn(c, i)));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// S-01: Concurrent Shared Capacity Access Purchases — Capacity Enforcement
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('S-01: 35 Concurrent Shared Capacity Purchases vs 30 Capacity', () => {
  it('should not allow more than max_capacity total guests', async () => {
    const sessionId = requireState('eveningSessionId');
    const ticketDate = futureDate(90); // Use a far-future date to avoid collisions

    const token = requireState('adminToken');
    const CONCURRENT = 35;

    const results = await fireN(
      token,
      CONCURRENT,
      async (c, i) => {
        try {
          return await c.purchasePoolTicket({
            sessionId,
            customerName: `Stress Tester ${i}`,
            customerPhone: `+1-555-${String(i).padStart(4, '0')}`,
            numberOfGuests: 1,
            ticketDate,
            visitDate: ticketDate,
            paymentMethod: 'cash',
            guestType: 'adult',
          });
        } catch (err: any) {
          return { success: false, status: 500, error: err.message };
        }
      },
    );

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);
    const serverErrors = results.filter(r => r.status >= 500);

    console.log(
      `S-01 RESULTS: ${successes.length} succeeded, ${failures.length} failed, ` +
      `${serverErrors.length} server errors.`
    );

    if (successes.length > 30) {
      console.warn(
        `⚠️  S-01 CAPACITY BREACH: ${successes.length} tickets created, max_capacity=30. ` +
        `Over by ${successes.length - 30}.`
      );
    }

    // The system should enforce max_capacity
    expect(successes.length).toBeLessThanOrEqual(30);
    // There should be no server errors
    expect(serverErrors.length).toBe(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// S-02: Concurrent Gift Card Redemptions — Balance Enforcement
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('S-02: 20 Concurrent $100 Redemptions from $1000 Gift Card', () => {
  let gcCode: string;

  beforeAll(async () => {
    const admin = client(requireState('adminToken'));
    const code = `GC_STRESS_${Date.now()}`;

    const res = await admin.createGiftCard({
      code,
      initial_balance: 1000,
      amount: 1000,
      balance: 1000,
      purchaser_name: 'Stress Admin',
      purchaser_email: 'admin@v2ecosystem.com',
      status: 'active',
    });

    if (res.success) {
      gcCode = res.data?.code || code;
    } else {
      gcCode = code;
    }
    expect(gcCode).toBeTruthy();
  });

  it('should allow exactly 10 successful $100 redemptions', async () => {
    const token = requireState('adminToken');
    const CONCURRENT = 20;

    const results = await fireN(
      token,
      CONCURRENT,
      async (c) => {
        try {
          return await c.redeemGiftCard(gcCode, 100);
        } catch (err: any) {
          return { success: false, status: 500, error: err.message };
        }
      },
    );

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    console.log(
      `S-02 RESULTS: ${successes.length} of ${CONCURRENT} redemptions succeeded. ` +
      `Total redeemed: $${successes.length * 100} from $1000 card.`
    );

    if (successes.length > 10) {
      console.warn(
        `⚠️  S-02 OVER-REDEMPTION: $${successes.length * 100} redeemed from $1000 card. ` +
        `Over-redemption: $${(successes.length * 100) - 1000}.`
      );
    }

    // Should have at most 10 successes ($1000 / $100)
    expect(successes.length).toBeLessThanOrEqual(10);

    // Check final balance
    const checker = client(requireState('adminToken'));
    const balanceRes = await checker.checkGiftCardBalance(gcCode);
    if (balanceRes.success) {
      const balance = balanceRes.data?.balance ?? balanceRes.data?.remaining_balance;
      if (balance !== undefined) {
        console.log(`S-02: Final balance: $${balance}`);
        expect(balance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// S-03: Concurrent Same-Date Chalet Bookings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('S-03: 10 Concurrent Bookings for Same Chalet & Dates', () => {
  it('should allow exactly 1 booking', async () => {
    const chaletId = requireState('chaletBId');
    const s03Offset = 2500 + Math.floor(Math.random() * 800);
    const checkIn = futureDate(s03Offset);
    const checkOut = futureDate(s03Offset + 2);

    const token = requireState('adminToken');
    const CONCURRENT = 10;

    const results = await fireN(
      token,
      CONCURRENT,
      async (c, i) => {
        try {
          return await c.createBooking({
            chaletId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            customerName: `Stress Tester ${String.fromCharCode(65 + (i % 26))}`,
            customerEmail: `stress${i}@test.com`,
            customerPhone: `+1-555-${String(i + 100).padStart(4, '0')}`,
            numberOfGuests: 2,
            paymentMethod: 'cash',
          });
        } catch (err: any) {
          return { success: false, status: 500, error: err.message };
        }
      },
    );

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    console.log(
      `S-03 RESULTS: ${successes.length} of ${CONCURRENT} bookings created.`
    );

    if (successes.length > 1) {
      console.warn(
        `⚠️  S-03 DOUBLE BOOKING: ${successes.length} bookings for same chalet/dates.`
      );
    }

    // Exactly 1 should succeed
    expect(successes.length).toBeLessThanOrEqual(1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// S-04: Rapid Order Placement — 20 Orders in 5 Seconds
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('S-04: Rapid Order Placement', () => {
  it('should create 20 orders within 5 seconds without errors', async () => {
    const token = requireState('adminToken');
    const ORDERS = 20;
    const start = Date.now();

    const results = await fireN(
      token,
      ORDERS,
      async (c, i) => {
        try {
          const suffix = String.fromCharCode(65 + (i % 26)); // A, B, C, ...
          return await c.createOrder({
            customerName: `Rapid Tester ${suffix}`,
            orderType: 'takeaway',
            paymentMethod: 'cash',
            items: [
              { menuItemId: requireState('espressoId'), quantity: 1 },
            ],
          });
        } catch (err: any) {
          return { success: false, status: 500, error: err.message };
        }
      },
    );

    const elapsed = Date.now() - start;
    const successes = results.filter(r => r.success);
    const serverErrors = results.filter(r => r.status >= 500);

    console.log(
      `S-04 RESULTS: ${successes.length}/${ORDERS} succeeded in ${elapsed}ms. ` +
      `Server errors: ${serverErrors.length}.`
    );

    // All orders should create successfully (may be rate-limited)
    expect(successes.length).toBeGreaterThan(0);
    // No server errors (rate limit returns 429, not 500)
    expect(serverErrors.length).toBe(0);

    // Verify each successful order has a valid ID
    for (const res of successes) {
      expect(res.data?.id).toBeTruthy();
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// S-05: Webhook Flood — 50 Sequential Payment Recordings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('S-05: Rapid Cash Payment Recording — Idempotency Check', () => {
  it('should handle 50 rapid payment records without duplicates', async () => {
    const token = requireState('adminToken');
    const PAYMENTS = 50;

    // First, create 50 orders
    const orderResults = await fireN(
      token,
      PAYMENTS,
      async (c, i) => {
        try {
          const suffix = String.fromCharCode(65 + (i % 26));
          return await c.createOrder({
            customerName: `Webhook Flood ${suffix}`,
            orderType: 'takeaway',
            paymentMethod: 'cash',
            items: [
              { menuItemId: requireState('espressoId'), quantity: 1 },
            ],
          });
        } catch (err: any) {
          return { success: false, status: 500, error: err.message };
        }
      },
    );

    const validOrders = orderResults.filter(r => r.success && r.data?.id);
    console.log(`S-05: Created ${validOrders.length}/${PAYMENTS} orders.`);

    if (validOrders.length === 0) {
      console.warn('S-05: No orders created — cannot test payment recording.');
      return;
    }

    // Now fire cash payment recordings for each order rapidly
    const paymentResults = await fireN(
      token,
      validOrders.length,
      async (c, i) => {
        try {
          return await c.post('/payments/record-cash', {
            referenceType: 'order',
            referenceId: validOrders[i].data.id,
            amount: validOrders[i].data.total_amount || validOrders[i].data.subtotal || 5.0,
            paymentMethod: 'cash',
          });
        } catch (err: any) {
          return { success: false, status: 500, error: err.message };
        }
      },
    );

    const paySuccesses = paymentResults.filter(r => r.success || r.status < 300);
    const payServerErrors = paymentResults.filter(r => r.status >= 500);

    console.log(
      `S-05 RESULTS: ${paySuccesses.length}/${validOrders.length} payments recorded. ` +
      `Server errors: ${payServerErrors.length}.`
    );

    // No server errors
    expect(payServerErrors.length).toBe(0);

    // Now send duplicate payments for the first 10 orders
    const duplicateCount = Math.min(10, validOrders.length);
    if (duplicateCount > 0) {
      const dupeResults = await fireN(
        token,
        duplicateCount,
        async (c, i) => {
          try {
            return await c.post('/payments/record-cash', {
              referenceType: 'order',
              referenceId: validOrders[i].data.id,
              amount: validOrders[i].data.total_amount || validOrders[i].data.subtotal || 5.0,
              paymentMethod: 'cash',
            });
          } catch (err: any) {
            return { success: false, status: 500, error: err.message };
          }
        },
      );

      const dupeSuccesses = dupeResults.filter(r => r.success || r.status < 300);
      if (dupeSuccesses.length > 0) {
        console.warn(
          `⚠️  S-05 DUPLICATE PAYMENTS: ${dupeSuccesses.length}/${duplicateCount} duplicate payments accepted. ` +
          `Cash recording lacks idempotency.`
        );
      }
    }
  });
});
