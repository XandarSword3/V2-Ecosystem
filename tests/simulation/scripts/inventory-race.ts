/**
 * Inventory Race Condition Load Test
 *
 * Fires 50 simultaneous pool ticket purchase requests against a single session
 * with a max_capacity of 10. Exactly 10 should succeed; the other 40 must
 * receive a 4xx rejection. Any deviation from exactly 10 successes means the
 * race condition is still present.
 *
 * Usage:
 *   # From tests/simulation/ directory:
 *   npx ts-node scripts/inventory-race.ts
 *
 *   # Or with a specific session ID and backend URL:
 *   SESSION_ID=<uuid> BACKEND_URL=http://localhost:4000 npx ts-node scripts/inventory-race.ts
 *
 * Environment variables:
 *   BACKEND_URL    Base URL of the running backend  (default: http://localhost:4000)
 *   SESSION_ID     Pool session UUID to target       (default: auto-created via API)
 *   AUTH_TOKEN     JWT for a staff/admin user        (required)
 *   MAX_CAPACITY   Expected session capacity         (default: 10)
 *   CONCURRENCY    Number of simultaneous requests   (default: 50)
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BACKEND_URL   = process.env.BACKEND_URL   ?? 'http://localhost:4000';
const AUTH_TOKEN    = process.env.AUTH_TOKEN     ?? '';
const SESSION_ID    = process.env.SESSION_ID     ?? '';   // provided or created below
const MAX_CAPACITY  = parseInt(process.env.MAX_CAPACITY ?? '10', 10);
const CONCURRENCY   = parseInt(process.env.CONCURRENCY  ?? '50', 10);
const API_BASE      = `${BACKEND_URL}/api/v1`;

if (!AUTH_TOKEN) {
  console.error('ERROR: AUTH_TOKEN env variable is required.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function authHeaders(): Record<string, string> {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    // The backend's Bearer bypass already skips CSRF for Bearer-token requests.
  };
}

async function createTestSession(): Promise<string> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const body = {
    name:           `Race-Test Session ${Date.now()}`,
    session_date:   dateStr,
    start_time:     '09:00',
    end_time:       '18:00',
    max_capacity:   MAX_CAPACITY,
    price:          10.00,
    gender_restriction: null,
    is_active:      true,
  };

  const res = await fetch(`${API_BASE}/pool/sessions`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create test session (${res.status}): ${text}`);
  }

  const json = await res.json() as { data?: { id: string }; id?: string };
  const id = json?.data?.id ?? (json as { id?: string }).id;
  if (!id) throw new Error(`Session created but no ID returned: ${JSON.stringify(json)}`);

  console.log(`✓ Created test session: ${id}  (max_capacity=${MAX_CAPACITY})`);
  return id;
}

interface PurchaseResult {
  requestIndex: number;
  status:       number;
  success:      boolean;
  body:         unknown;
  latencyMs:    number;
  error?:       string;
}

async function purchaseTicket(sessionId: string, index: number): Promise<PurchaseResult> {
  const start = Date.now();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const body = {
    session_id:       sessionId,
    ticket_date:      tomorrow.toISOString(),
    ticket_number:    `RACE-${index}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    customer_name:    `Race Tester ${index}`,
    number_of_guests: 1,
    number_of_adults: 1,
    number_of_children: 0,
    payment_method:   'cash',
  };

  try {
    const res = await fetch(`${API_BASE}/pool/tickets/purchase`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify(body),
    });

    const latencyMs = Date.now() - start;
    let responseBody: unknown;
    try { responseBody = await res.json(); } catch { responseBody = null; }

    return {
      requestIndex: index,
      status:       res.status,
      success:      res.ok,
      body:         responseBody,
      latencyMs,
    };
  } catch (err) {
    return {
      requestIndex: index,
      status:       0,
      success:      false,
      body:         null,
      latencyMs:    Date.now() - start,
      error:        err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Inventory Race Condition Load Test');
  console.log(`  Backend : ${BACKEND_URL}`);
  console.log(`  Capacity: ${MAX_CAPACITY}  |  Concurrency: ${CONCURRENCY}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');

  // 1. Get or create session
  const sessionId = SESSION_ID || (await createTestSession());

  // 2. Fire all requests simultaneously
  console.log(`Firing ${CONCURRENCY} simultaneous purchase requests...`);
  const start = Date.now();
  const requests = Array.from({ length: CONCURRENCY }, (_, i) => purchaseTicket(sessionId, i));
  const results  = await Promise.all(requests);
  const totalMs  = Date.now() - start;

  // 3. Analyse results
  const successes   = results.filter(r => r.success);
  const failures    = results.filter(r => !r.success);
  const networkErrs = results.filter(r => r.error);
  const latencies   = results.map(r => r.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log('');
  console.log('── Results ─────────────────────────────────────────────────');
  console.log(`  Total requests : ${CONCURRENCY}`);
  console.log(`  Successes      : ${successes.length}   (expected: ${MAX_CAPACITY})`);
  console.log(`  Failures       : ${failures.length}    (expected: ${CONCURRENCY - MAX_CAPACITY})`);
  console.log(`  Network errors : ${networkErrs.length}`);
  console.log(`  Total time     : ${totalMs}ms`);
  console.log(`  Latency p50    : ${p50}ms`);
  console.log(`  Latency p95    : ${p95}ms`);
  console.log(`  Latency p99    : ${p99}ms`);

  if (failures.length > 0) {
    const sampleStatuses = [...new Set(failures.map(f => f.status))];
    console.log(`  Failure status codes: ${sampleStatuses.join(', ')}`);
  }

  console.log('');
  console.log('── Verdict ─────────────────────────────────────────────────');

  const passed = successes.length === MAX_CAPACITY;
  if (passed) {
    console.log(`  ✅ PASS — Exactly ${MAX_CAPACITY} requests succeeded. Race condition is NOT present.`);
  } else if (successes.length < MAX_CAPACITY) {
    console.log(`  ❌ FAIL — Only ${successes.length} requests succeeded (expected ${MAX_CAPACITY}).`);
    console.log('     Possible causes: session already had tickets, capacity mismatch, or server error.');
    console.log('     Check backend logs and re-run with a fresh SESSION_ID.');
  } else {
    console.log(`  ❌ FAIL — ${successes.length} requests succeeded, but only ${MAX_CAPACITY} were allowed.`);
    console.log('     RACE CONDITION DETECTED: the lock fix was not applied or did not take effect.');
    console.log('     Verify that migration 20260424000004_fix_deduct_stock_fifo_race.sql has been applied.');
  }

  console.log('');

  if (networkErrs.length > 0) {
    console.log('── Network Errors ──────────────────────────────────────────');
    networkErrs.slice(0, 5).forEach(e => console.log(`  [${e.requestIndex}] ${e.error}`));
    if (networkErrs.length > 5) console.log(`  ...and ${networkErrs.length - 5} more`);
    console.log('');
  }

  // 4. Exit with non-zero if test failed
  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
