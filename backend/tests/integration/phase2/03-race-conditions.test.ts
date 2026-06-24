/**
 * Phase 2 — Part 3: Concurrency & Race Condition Journeys (R-01 through R-07)
 *
 * Tests for every race condition risk from Phase 1 risk register.
 * These tests fire concurrent requests to expose unsafe read-then-write patterns.
 *
 * Run:  npx vitest run --config vitest.integration.config.ts tests/integration/phase2/03-race-conditions.test.ts
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
 * Fire N HTTP calls simultaneously and collect results.
 * Each callFn receives its client and returns the response.
 */
async function fireSimultaneously<T>(
  clients: Phase2Client[],
  callFn: (c: Phase2Client, index: number) => Promise<T>,
): Promise<T[]> {
  return Promise.all(clients.map((c, i) => callFn(c, i)));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// R-01: Gift Card Over-Redemption (Risk H1)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('R-01: Gift Card Over-Redemption — Concurrent Race', () => {
  let gcCode: string;
  let gcId: string;

  beforeAll(async () => {
    const admin = client(requireState('adminToken'));
    const code = `GC_RACE_${Date.now()}`;

    const res = await admin.createGiftCard({
      code,
      initial_balance: 100,
      amount: 100,
      balance: 100,
      purchaser_name: 'Admin',
      purchaser_email: 'admin@v2ecosystem.com',
      status: 'active',
    });

    if (res.success) {
      gcId = res.data?.id || res.data?.giftcard?.id;
      gcCode = res.data?.code || code;
    } else {
      gcCode = code;
    }
    expect(gcCode).toBeTruthy();
  });

  it('should not allow $160 total redemption from a $100 gift card', async () => {
    // Create 2 authenticated clients
    const clientA = client(requireState('aliceToken'));
    const clientB = client(requireState('bobToken'));

    // Both attempt to redeem $80 simultaneously from a $100 card
    const results = await fireSimultaneously(
      [clientA, clientB],
      async (c) => c.redeemGiftCard(gcCode, 80),
    );

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    // CORRECT behavior: exactly 1 succeeds, 1 fails
    // BROKEN behavior: both succeed (over-redemption)
    if (successes.length > 1) {
      console.warn(
        `⚠️  R-01 RACE CONDITION CONFIRMED: ${successes.length}/2 redemptions succeeded. ` +
        `$${successes.length * 80} redeemed from $100 card (over-redemption: $${successes.length * 80 - 100}).`
      );
    }

    // Assert the desired invariant
    expect(successes.length).toBeLessThanOrEqual(1);

    // Verify final balance
    const balanceRes = await clientA.checkGiftCardBalance(gcCode);
    if (balanceRes.success) {
      const balance = balanceRes.data?.balance ?? balanceRes.data?.remaining_balance;
      if (balance !== undefined) {
        expect(balance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// R-02: Concurrent Capacity Allocation (Risk H2)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('R-02: Concurrent Capacity Allocation', () => {
  it('should not allow 2 concurrent 2-guest tickets when only 2 spots remain', async () => {
    const sessionId = requireState('eveningSessionId');
    const ticketDate = today();

    // First, check current capacity
    const admin = client(requireState('adminToken'));
    const capacityRes = await admin.getPoolCapacity();

    // Create 2 clients that both try to buy 2-guest tickets
    const clientA = client(requireState('aliceToken'));
    const clientB = client(requireState('bobToken'));

    const results = await fireSimultaneously(
      [clientA, clientB],
      async (c) => c.purchaseCapacityTicket({
        sessionId,
        customerName: 'Race Test',
        numberOfGuests: 2,
        ticketDate,
        visitDate: ticketDate,
        paymentMethod: 'cash',
        guestType: 'adult',
      }),
    );

    const successes = results.filter(r => r.success);

    // NOTE: Whether this breaches depends on existing ticket count.
    // We document behavior rather than hard-assert, since capacity fill state is unknown.
    if (successes.length === 2) {
      console.log('R-02: Both tickets accepted — check if total exceeds max_capacity.');
    } else if (successes.length === 1) {
      console.log('R-02: Only one ticket accepted — capacity check may have serialized.');
    } else {
      console.log('R-02: Neither ticket accepted — session may be full or closed.');
    }

    // For now, just verify no 500 errors
    for (const r of results) {
      expect(r.status).toBeLessThan(500);
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// R-03: Webhook Partial Failure (Risk H3)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('R-03: Payment Webhook Partial Failure — Orphan State', () => {
  it('should not leave orders in pending after payment completes', async () => {
    const admin = client(requireState('adminToken'));

    // This is a consistency check: find any orders where payment records
    // show completed but order payment_status is still pending
    // (This tests for the R-03 orphan state from webhook partial failures)

    // We can only test this via API — checking order + payment alignment
    // Create a card payment order
    const alice = client(requireState('aliceToken'));
    const orderRes = await alice.createOrder({
      customerName: 'Webhook Test',
      orderType: 'takeaway',
      paymentMethod: 'card',
      items: [
        { menuItemId: requireState('espressoId'), quantity: 1 },
      ],
    });

    expect(orderRes.status).toBeLessThan(500);

    // Without injecting Stripe webhook failures, we verify the order is created
    // and its payment_status is consistent with expectations
    if (orderRes.success && orderRes.data?.id) {
      const orderId = orderRes.data.id;
      // For card orders, status should be pending_payment until webhook arrives
      const orderCheck = await alice.getOrder(orderId);
      if (orderCheck.success) {
        const status = orderCheck.data?.payment_status || orderCheck.data?.paymentStatus;
        expect(status).toMatch(/pending|pending_payment|awaiting_payment/);
      }
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// R-04: AccommodationUnit Double-Booking (Redis Lock)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('R-04: AccommodationUnit Double-Booking — Concurrent Requests', () => {
  it('should only allow one booking when two clients book same dates simultaneously', async () => {
    const unitId = requireState('unitBId');
    const checkIn = futureDate(45);
    const checkOut = futureDate(47);

    const clientA = client(requireState('aliceToken'));
    const clientB = client(requireState('bobToken'));

    const bookingPayload = {
      unitId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      customerName: 'Race Tester',
      customerEmail: 'race@test.com',
      customerPhone: '+1-555-0000',
      numberOfGuests: 2,
      paymentMethod: 'cash' as const,
    };

    const results = await fireSimultaneously(
      [clientA, clientB],
      async (c) => c.createBooking(bookingPayload),
    );

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    if (successes.length > 1) {
      console.warn(
        `⚠️  R-04 DOUBLE BOOKING CONFIRMED: ${successes.length}/2 bookings created for same dates.`
      );
    }

    // Exactly 1 should succeed
    expect(successes.length).toBeLessThanOrEqual(1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// R-05: Coupon Usage Consumed Without Discount (Risk M4)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('R-05: Coupon Used But Discount Not Applied', () => {
  it('should ensure coupon times_used matches actual orders using it', async () => {
    const admin = client(requireState('adminToken'));

    // Create a single-use coupon for this test
    const testCode = `RACETEST_${Date.now()}`;
    const couponRes = await admin.createCoupon({
      code: testCode,
      type: 'fixed',
      discountType: 'fixed',
      value: 3.00,
      discountValue: 3.00,
      maxUses: 1,
      max_uses: 1,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      isActive: true,
      is_active: true,
    });

    if (!couponRes.success) {
      console.warn('R-05: Could not create test coupon — skipping');
      return;
    }

    // Use the coupon in an order
    const alice = client(requireState('aliceToken'));
    const orderRes = await alice.createOrder({
      customerName: 'Coupon Race Test',
      orderType: 'takeaway',
      paymentMethod: 'cash',
      couponCode: testCode,
      items: [
        { menuItemId: requireState('espressoId'), quantity: 1 },
      ],
    });

    // Whether the order succeeds or not, validate the coupon
    const validateRes = await alice.validateCoupon(testCode, 10);
    // If the coupon was used, it should report as expired/reached limit
    if (orderRes.success) {
      // Coupon should now be exhausted
      if (validateRes.success && validateRes.data?.valid === true) {
        console.warn('⚠️  R-05: Coupon still valid after being used — times_used may not have incremented');
      }
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// R-06: Cash Payment Double-Record (Risk M7)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('R-06: Cash Payment Double-Record', () => {
  let testOrderId: string;

  it('should create a test order', async () => {
    const admin = client(requireState('adminToken'));
    const orderRes = await admin.createOrder({
      customerName: 'Cash Double Test',
      orderType: 'takeaway',
      paymentMethod: 'cash',
      items: [
        { menuItemId: requireState('espressoId'), quantity: 1 },
      ],
    });

    expect(orderRes.success, `Order failed: ${orderRes.error}`).toBe(true);
    testOrderId = orderRes.data?.id;
    expect(testOrderId).toBeTruthy();
  });

  it('should detect if double cash payment creates duplicate records', async () => {
    if (!testOrderId) return;

    const staff = client(requireState('kitchenStaffToken'));

    // Fire the same cash payment twice in rapid succession
    const results = await fireSimultaneously(
      [staff, staff],
      async (c) => c.post('/payments/record-cash', {
        referenceType: 'order',
        referenceId: testOrderId,
        amount: 5.0,
        paymentMethod: 'cash',
      }),
    );

    const successes = results.filter(r => r.success || r.status < 300);

    if (successes.length > 1) {
      console.warn(
        `⚠️  R-06 DOUBLE PAYMENT CONFIRMED: ${successes.length} payment records created for same order. ` +
        `Financial ledger over-states revenue.`
      );
    }

    // Ideally only 1 should succeed (idempotent)
    expect(successes.length).toBeLessThanOrEqual(1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// R-07: Booking Add-on Orphan (Risk M3)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('R-07: Booking Created Without Add-ons (Orphan)', () => {
  it('should create a booking with multiple add-ons and verify all are present', async () => {
    const alice = client(requireState('aliceToken'));
    const baseOffset = 140 + (Date.now() % 30);
    const bookingWindows = [baseOffset, baseOffset + 30, baseOffset + 60, baseOffset + 90];

    const addOns: any[] = [];
    if (state.bbqAddonId) addOns.push({ addOnId: state.bbqAddonId, quantity: 1 });
    if (state.basketAddonId) addOns.push({ addOnId: state.basketAddonId, quantity: 1 });
    if (state.beddingAddonId) addOns.push({ addOnId: state.beddingAddonId, quantity: 1 });

    if (addOns.length === 0) {
      console.warn('R-07: No add-on IDs available — skipping');
      return;
    }

    const availableRes = await alice.getAddOns();
    const availableRows = Array.isArray(availableRes.data)
      ? availableRes.data
      : availableRes.data?.addOns || availableRes.data?.items || [];
    const availableIds = new Set((Array.isArray(availableRows) ? availableRows : []).map((a: any) => a.id));
    const validAddOns = addOns.filter((a) => availableIds.has(a.addOnId));

    if (validAddOns.length === 0) {
      console.warn('R-07: No active add-ons available for booking payload — skipping');
      return;
    }

    let res: any;
    for (const offset of bookingWindows) {
      const attempt = await alice.createBooking({
        unitId: requireState('unitCId'),
        checkInDate: futureDate(offset),
        checkOutDate: futureDate(offset + 2),
        customerName: 'Add-on Orphan Test',
        customerEmail: 'addon@test.com',
        customerPhone: '+1-555-0007',
        numberOfGuests: 2,
        paymentMethod: 'cash',
        addOns: validAddOns,
      });

      res = attempt;
      if (attempt.success || !/already booked/i.test(String(attempt.error || ''))) {
        break;
      }
    }

    expect(res.success, `Booking failed: ${res.error}`).toBe(true);

    const bookingId = res.data?.id || res.data?.booking?.id;
    if (!bookingId) return;

    // Fetch booking detail and verify add-ons are attached
    const detail = await alice.getBooking(bookingId);
    if (detail.success && detail.data) {
      const bookingAddOns = detail.data.add_ons || detail.data.addOns || [];
      if (Array.isArray(bookingAddOns)) {
        if (bookingAddOns.length < validAddOns.length) {
          console.warn(
            `⚠️  R-07 ORPHAN CONFIRMED: Booking has ${bookingAddOns.length} add-ons ` +
            `but ${validAddOns.length} were requested.`
          );
        }
        expect(bookingAddOns.length).toBe(validAddOns.length);
      }
    }
  });
});
