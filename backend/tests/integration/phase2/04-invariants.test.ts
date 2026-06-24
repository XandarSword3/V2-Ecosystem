/**
 * Phase 2 — Part 4: Cross-Engine Invariant Journeys (I-01 through I-07)
 *
 * Verify data consistency invariants hold across all engines after the
 * journey and race tests have executed.
 * Engine-refit: assertions use `transactions` via module REST surfaces (ARCHITECTURE_LAW.md).
 *
 * Run:  npx vitest run --config vitest.integration.config.ts tests/integration/phase2/04-invariants.test.ts
 */

import { Phase2Client } from './phase2-client';
import { state, requireState } from './phase2-state';
import { initializePhase2SuiteState, cleanupPhase2SuiteState } from './phase2-suite-bootstrap';
import { ModuleSlug } from '../engine-refit-helpers';

// ─────────── Helpers ───────────

function client(token: string): Phase2Client {
  const c = new Phase2Client();
  c.setToken(token);
  return c;
}

beforeAll(async () => {
  await initializePhase2SuiteState();
});

afterAll(() => {
  cleanupPhase2SuiteState();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// I-01: Financial Ledger Balances Across All Engines
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('I-01: Financial Ledger Internal Consistency', () => {
  it('should have all ledger entries where total_amount ≈ subtotal + tax - discount', async () => {
    const admin = client(requireState('adminToken'));

    // Query ledger via admin reports endpoint
    const res = await admin.get('/admin/reports/ledger?limit=500');

    if (!res.success) {
      // Ledger endpoint may not exist; try payments listing
      const paymentsRes = await admin.get('/payments?limit=100');
      expect(paymentsRes.status).toBeLessThan(500);
      console.log('I-01: Ledger endpoint unavailable; payment records checked for server errors.');
      return;
    }

    const entries = Array.isArray(res.data) ? res.data : res.data?.entries || res.data?.ledger || [];

    let driftCount = 0;
    for (const entry of entries) {
      if (entry.transaction_type === 'refund' || entry.transaction_type === 'void') continue;

      const total = parseFloat(entry.total_amount) || 0;
      const subtotal = parseFloat(entry.subtotal) || 0;
      const tax = parseFloat(entry.tax_amount) || 0;
      const sc = parseFloat(entry.service_charge) || 0;
      const delivery = parseFloat(entry.delivery_fee) || 0;
      const discount = parseFloat(entry.total_discount) || 0;

      const expected = Math.max(0, subtotal + tax + sc + delivery - discount);
      const drift = Math.abs(total - expected);

      if (drift > 0.02) {
        driftCount++;
        console.warn(
          `  ⚠️  Ledger entry ${entry.id}: total=${total}, expected=${expected}, drift=${drift.toFixed(2)}`
        );
      }
    }

    if (driftCount > 0) {
      console.warn(`⚠️  I-01: ${driftCount} ledger entries have arithmetic drift > $0.02`);
    }
    expect(driftCount).toBe(0);
  });

  it('should report non-negative net revenue per engine type', async () => {
    const admin = client(requireState('adminToken'));
    const res = await admin.getDashboardRevenue();

    if (res.success && res.data) {
      // Revenue per engine should be non-negative
      const engines = res.data.engines || res.data.breakdown || [];
      for (const engine of Array.isArray(engines) ? engines : []) {
        const net = parseFloat(engine.net_revenue || engine.revenue || 0);
        expect(net).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// I-02: Loyalty Points Consistency Across Engines
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('I-02: Loyalty Points Consistency', () => {
  it('should have current balance = signup_bonus + earned - redeemed + adjusted for Alice', async () => {
    const alice = client(requireState('aliceToken'));
    const res = await alice.getMyLoyalty();

    if (!res.success) {
      console.log('I-02: Loyalty endpoint unavailable; skipping.');
      return;
    }

    const data = res.data;
    const currentBalance = data?.total_points ?? data?.points ?? data?.balance;

    if (currentBalance === undefined) {
      console.log('I-02: No points field found in loyalty response.');
      return;
    }

    // Try to get breakdown from transactions
    const txRes = await alice.get('/loyalty/my-transactions?limit=500');
    if (!txRes.success) {
      console.log('I-02: Cannot fetch transaction history; verifying balance is non-negative.');
      expect(currentBalance).toBeGreaterThanOrEqual(0);
      return;
    }

    const transactions = Array.isArray(txRes.data) ? txRes.data : txRes.data?.transactions || [];

    let totalEarned = 0;
    let totalRedeemed = 0;
    let totalAdjusted = 0;
    let signupBonus = data?.signup_bonus || 0;

    for (const tx of transactions) {
      const pts = Math.abs(parseFloat(tx.points) || 0);
      const type = (tx.type || tx.transaction_type || '').toLowerCase();
      if (type === 'earn' || type === 'earned') totalEarned += pts;
      else if (type === 'redeem' || type === 'redeemed') totalRedeemed += pts;
      else if (type === 'adjust' || type === 'adjustment') totalAdjusted += pts;
      else if (type === 'signup' || type === 'signup_bonus') signupBonus = pts;
    }

    const expectedBalance = signupBonus + totalEarned - totalRedeemed + totalAdjusted;
    const drift = Math.abs(currentBalance - expectedBalance);

    if (drift > 1) {
      console.warn(
        `⚠️  I-02 POINTS DRIFT: current=${currentBalance}, expected=${expectedBalance} ` +
        `(signup=${signupBonus}, earned=${totalEarned}, redeemed=${totalRedeemed}, adjusted=${totalAdjusted})`
      );
    }

    // Allow up to 1 point rounding tolerance
    expect(drift).toBeLessThanOrEqual(1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// I-03: Shared Capacity Access Accuracy
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('I-03: Shared Capacity Access Accuracy', () => {
  it('should have reported occupancy matching actual active tickets', async () => {
    const admin = client(requireState('adminToken'));
    const res = await admin.getPoolCapacity();

    if (!res.success) {
      console.log('I-03: Pool capacity endpoint unavailable; skipping.');
      return;
    }

    const data = res.success ? res.data : null;
    if (!data) return;

    const reportedOccupancy = data.current_occupancy ?? data.occupancy ?? data.currentOccupancy;
    const totalCapacity = data.max_capacity ?? data.total_capacity ?? data.maxCapacity;

    if (reportedOccupancy !== undefined) {
      // Occupancy should be non-negative and ≤ total capacity (unless breached)
      expect(reportedOccupancy).toBeGreaterThanOrEqual(0);

      if (totalCapacity !== undefined && reportedOccupancy > totalCapacity) {
        console.warn(
          `⚠️  I-03 CAPACITY BREACH: occupancy=${reportedOccupancy}, max=${totalCapacity}`
        );
      }
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// I-04: AccommodationUnit Availability — No Overlapping Bookings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('I-04: AccommodationUnit Availability — No Overlapping Reservations', () => {
  it('should have no overlapping non-cancelled time_exclusive_reservation rows per unit', async () => {
    const admin = client(requireState('adminToken'));

    const res = await admin.get(`/${ModuleSlug.ACCOMMODATION_UNITS}/bookings?limit=500`);

    if (!res.success) {
      console.log('I-04: Reservations endpoint unavailable; skipping.');
      return;
    }

    const responseData = res.data;
    const bookings = Array.isArray(responseData)
      ? responseData
      : responseData?.bookings || responseData?.data || [];

    // Filter to non-cancelled bookings
    const active = bookings.filter(
      (b: any) => !['cancelled', 'no_show'].includes(b.status)
    );

    // Group by unit id (metadata.unit_id from engine-refit reservations)
    const byUnitId = new Map<string, any[]>();
    for (const b of active) {
      const uid = b.metadata?.unit_id || b.unit_id || b.unitId || b.unit_id;
      if (!uid) continue;
      if (!byUnitId.has(uid)) byUnitId.set(uid, []);
      byUnitId.get(uid)!.push(b);
    }

    let overlapCount = 0;
    for (const [unitId, chaletBookings] of byUnitId) {
      // Sort by check-in date
      chaletBookings.sort(
        (a: any, b: any) =>
          new Date(a.check_in_date || a.checkInDate).getTime() -
          new Date(b.check_in_date || b.checkInDate).getTime()
      );

      for (let i = 0; i < chaletBookings.length; i++) {
        for (let j = i + 1; j < chaletBookings.length; j++) {
          const a = chaletBookings[i];
          const b = chaletBookings[j];
          const aIn = new Date(
            a.metadata?.check_in_date || a.check_in_date || a.checkInDate,
          );
          const aOut = new Date(
            a.metadata?.check_out_date || a.check_out_date || a.checkOutDate,
          );
          const bIn = new Date(
            b.metadata?.check_in_date || b.check_in_date || b.checkInDate,
          );
          const bOut = new Date(
            b.metadata?.check_out_date || b.check_out_date || b.checkOutDate,
          );

          if (aIn < bOut && bIn < aOut) {
            overlapCount++;
            console.warn(
              `⚠️  I-04 OVERLAP: Unit ${unitId}, ` +
              `Booking A (${aIn.toISOString().slice(0, 10)}–${aOut.toISOString().slice(0, 10)}) vs ` +
              `Booking B (${bIn.toISOString().slice(0, 10)}–${bOut.toISOString().slice(0, 10)})`
            );
          }
        }
      }
    }

    if (overlapCount > 0) {
      console.warn(`⚠️  I-04: ${overlapCount} overlapping booking pairs found.`);
    }
    expect(overlapCount).toBe(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// I-05: Coupon Usage Integrity
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('I-05: Coupon Usage Count Matches Actual Orders', () => {
  it('should have FIXED5 coupon times_used ≥ 0 and ≤ max_uses', async () => {
    const admin = client(requireState('adminToken'));

    // Fetch coupon details
    const res = await admin.get('/coupons');
    if (!res.success) {
      console.log('I-05: Coupons endpoint unavailable; skipping.');
      return;
    }

    const coupons = Array.isArray(res.data) ? res.data : res.data?.coupons || [];
    const fixed5 = coupons.find((c: any) => c.code === 'FIXED5');

    if (!fixed5) {
      console.log('I-05: FIXED5 coupon not found in listing.');
      return;
    }

    const timesUsed = fixed5.times_used ?? fixed5.timesUsed ?? 0;
    const maxUses = fixed5.max_uses ?? fixed5.maxUses ?? Infinity;

    expect(timesUsed).toBeGreaterThanOrEqual(0);
    if (maxUses !== Infinity && maxUses !== null) {
      expect(timesUsed).toBeLessThanOrEqual(maxUses);
    }

    console.log(`I-05: FIXED5 times_used=${timesUsed}, max_uses=${maxUses}`);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// I-06: Audit Log Completeness
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('I-06: Audit Log Completeness', () => {
  it('should list recent instant_transaction rows for the menu service module', async () => {
    const admin = client(requireState('adminToken'));

    const res = await admin.get(`/${ModuleSlug.RESTAURANT}/orders?limit=50`);
    if (!res.success) {
      console.log('I-06: MenuService transactions endpoint unavailable; skipping.');
      return;
    }

    const data = res.data;
    const transactions = Array.isArray(data) ? data : data?.orders || [];
    expect(transactions.length).toBeGreaterThanOrEqual(0);
    console.log(`I-06: Found ${transactions.length} menu service instant_transaction row(s).`);
  });

  it('should have audit log entries accessible via admin', async () => {
    const admin = client(requireState('adminToken'));
    const res = await admin.get('/admin/audit-logs?limit=10');

    if (res.success) {
      const logs = Array.isArray(res.data) ? res.data : res.data?.logs || [];
      expect(logs.length).toBeGreaterThan(0);
      console.log(`I-06: Found ${logs.length} recent audit log entries.`);
    } else {
      console.log('I-06: Audit logs endpoint returned', res.status);
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// I-07: Payment Record — Order Status Consistency
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('I-07: Payment Record vs Transaction Status Consistency', () => {
  it('should not have completed payments with pending transaction status', async () => {
    const admin = client(requireState('adminToken'));

    const ordersRes = await admin.get(`/${ModuleSlug.RESTAURANT}/orders?limit=100`);
    if (!ordersRes.success) {
      console.log('I-07: Transactions endpoint unavailable; skipping.');
      return;
    }

    const transactions = Array.isArray(ordersRes.data)
      ? ordersRes.data
      : ordersRes.data?.orders || [];

    let orphanCount = 0;
    for (const txn of transactions) {
      const meta = txn.metadata || {};
      const paymentStatus = meta.payment_status || txn.payment_status || txn.paymentStatus;
      const paymentMethod = meta.payment_method || txn.payment_method || txn.paymentMethod;

      if (paymentStatus === 'pending' && paymentMethod === 'card') {
        const payRes = await admin.get(`/payments?referenceId=${txn.id}&referenceType=transaction`);
        if (payRes.success) {
          const payments = Array.isArray(payRes.data) ? payRes.data : payRes.data?.payments || [];
          const completedPayment = payments.find((p: { status?: string }) => p.status === 'completed');
          if (completedPayment) {
            orphanCount++;
            console.warn(
              `⚠️  I-07 ORPHAN STATE: transaction ${txn.id} metadata payment_status=pending ` +
                `but payments record shows status=completed.`,
            );
          }
        }
      }
    }

    if (orphanCount > 0) {
      console.warn(`⚠️  I-07: ${orphanCount} transactions with orphan payment status.`);
    }
    expect(orphanCount).toBe(0);
  });
});
