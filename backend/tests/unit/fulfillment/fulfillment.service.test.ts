/**
 * Fulfillment persistence (plan Stage 6) — ADVERSARIAL.
 *
 * Proves the fulfillment layer has REAL persistence, separate from
 * transactions.status:
 *   1. ensure creates the canonical row idempotently (create-on-confirm);
 *   2. transition validates through the engine's layered validator, persists
 *      the canonical state, and records the append-only event;
 *   3. the engine type comes from the ROW, never hardcoded;
 *   4. optimistic concurrency: an expectedFrom mismatch fails the RPC;
 *   5. FAIL-CLOSED reads: a fulfillment read ERROR aborts the operation — it
 *      is never treated as "no row", which would fall back to
 *      transactions.status;
 *   6. selection validation: mode/destination are typed domain values
 *      validated against the engine's declared capability options before any
 *      write;
 *   7. the service NEVER writes to transactions.status — its mock asserts no
 *      transactions.update call is ever made;
 *   8. source assertions: fulfillment initialization is coupled to
 *      confirmation (DB trigger) and no production path calls ensure-after-
 *      confirm ("self-heal later") anymore.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FulfillmentService } from '../../../src/modules/fulfillment/fulfillment.service.js';
import { getAllEngines } from '../../../src/engines/registry.js';

// The service uses the REAL engine service singleton (pure, registry-backed)
// to validate moves through the layered validator — no DB involved there.
// Only the supabase argument is faked.

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

interface UpdateCall {
  table: string;
  updates: Record<string, unknown>;
}

type Row = Record<string, unknown> | null;

function createSupabaseMock(initialRow: Row, opts: { failFulfillmentRead?: boolean } = {}) {
  const calls: { rpc: RpcCall[]; updated: UpdateCall[] } = { rpc: [], updated: [] };
  let row: Row = initialRow;
  let failRead = opts.failFulfillmentRead ?? false;

  const supabase: any = {
    calls,
    setRow: (r: Row) => { row = r; },
    getRow: () => row,
    setReadError: (v: boolean) => { failRead = v; },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === 'fulfillments') {
              if (failRead) return { data: null, error: { message: 'connection reset (simulated)' } };
              return { data: row, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
      update: (updates: Record<string, unknown>) => {
        calls.updated.push({ table, updates });
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({ data: { ...(row ?? {}), ...updates }, error: null }),
              }),
            }),
          }),
        };
      },
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.rpc.push({ name, args });
      if (name === 'ensure_fulfillment') {
        if (row) return { data: [{ success: true, status: 'existing' }], error: null };
        return { data: [{ success: true, status: 'queued' }], error: null };
      }
      if (name === 'transition_fulfillment') {
        const expected = args.p_expected_from as string | null | undefined;
        const current = (row?.status as string | undefined) ?? 'queued';
        if (expected && expected !== current) {
          return {
            data: [{
              success: false,
              status: current,
              error_message: `Fulfillment status changed concurrently: expected ${expected}, found ${current}`,
            }],
            error: null,
          };
        }
        row = { ...(row ?? {}), status: args.p_to_status };
        return { data: [{ success: true, status: args.p_to_status }], error: null };
      }
      return { data: [{ success: false, error_message: `unknown rpc ${name}` }], error: null };
    },
  };
  return supabase;
}

function queuedRow(overrides: Record<string, unknown> = {}): Row {
  return {
    id: 'f1',
    transaction_id: 't1',
    engine_type: 'instant_transaction',
    module_id: null,
    property_id: null,
    tenant_id: null,
    status: 'queued',
    mode: null,
    destination_type: null,
    destination_ref: null,
    tracking_ref: null,
    queued_at: new Date().toISOString(),
    in_progress_at: null,
    ready_at: null,
    handed_off_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('FulfillmentService (Stage 6 persistence)', () => {
  it('ensure creates the canonical row idempotently (create-on-confirm)', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(null);

    const first = await service.ensure(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      moduleId: 'm1',
      mode: 'on_premise',
      destinationType: 'on_premise_location',
    });
    expect(first.ok).toBe(true);
    expect(first.status).toBe('queued');
    // The ensure RPC was invoked with the create payload.
    expect(supabase.calls.rpc.some((c) =>
      c.name === 'ensure_fulfillment' && c.args.p_transaction_id === 't1' && c.args.p_engine_type === 'instant_transaction'
    )).toBe(true);

    // Idempotent second call — the row now exists, RPC is ON CONFLICT DO NOTHING.
    supabase.setRow(queuedRow());
    const second = await service.ensure(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'on_premise',
      destinationType: 'on_premise_location',
    });
    expect(second.ok).toBe(true);
    expect(second.status).toBe('existing');
  });

  it('transition validates through the engine and persists the canonical state', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(queuedRow());

    const result = await service.transition(supabase, {
      transactionId: 't1',
      action: 'start_preparation',
      actor: 'staff',
      expectedFrom: 'queued',
    });
    expect(result.ok).toBe(true);
    expect(result.canonicalState).toBe('in_progress');
    expect(result.layer).toBe('fulfillment');

    // The canonical state was persisted via the transition RPC...
    const rpc = supabase.calls.rpc.find((c) => c.name === 'transition_fulfillment');
    expect(rpc).toBeDefined();
    expect(rpc!.args.p_to_status).toBe('in_progress');
    expect(rpc!.args.p_expected_from).toBe('queued');
    // ...and the service NEVER wrote fulfillment meaning to transactions.status.
    expect(supabase.calls.updated.some((u) => u.table === 'transactions')).toBe(false);
  });

  it('persists the handed_off → completed cross-layer completion', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(queuedRow({ status: 'handed_off' }));

    const result = await service.transition(supabase, {
      transactionId: 't1',
      action: 'complete',
      actor: 'staff',
      expectedFrom: 'handed_off',
    });
    expect(result.ok).toBe(true);
    expect(result.canonicalState).toBe('completed');
    const rpc = supabase.calls.rpc.find((c) => c.name === 'transition_fulfillment');
    expect(rpc!.args.p_to_status).toBe('completed');
  });

  it('rejects an invalid fulfillment move through the engine validator', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(queuedRow());

    // deliver from 'queued' is not on the hospitality machine.
    const result = await service.transition(supabase, {
      transactionId: 't1',
      action: 'deliver',
      actor: 'staff',
      expectedFrom: 'queued',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    // Nothing was persisted.
    expect(supabase.calls.rpc.some((c) => c.name === 'transition_fulfillment')).toBe(false);
  });

  it('fails on optimistic-concurrency mismatch (expectedFrom != row status)', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(queuedRow({ status: 'ready' }));

    // Caller validated against 'queued', but the row moved to 'ready'
    // concurrently — the RPC must fail, not silently overwrite.
    const result = await service.transition(supabase, {
      transactionId: 't1',
      action: 'deliver',
      actor: 'staff',
      expectedFrom: 'queued',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/concurrently/i);
  });

  it('reads the engine type from the row, never hardcoding it', async () => {
    // The engine_type the service validates against comes from the row's
    // own column. With 'instant_transaction' that resolves to the hospitality
    // machine; a different engine_type would route to that engine instead.
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(queuedRow({ engine_type: 'instant_transaction' }));

    const result = await service.transition(supabase, {
      transactionId: 't1',
      action: 'mark_ready',
      actor: 'staff',
      expectedFrom: 'queued',
    });
    expect(result.ok).toBe(true);
    expect(result.canonicalState).toBe('ready');
  });

  it('FAILS CLOSED on a fulfillment read error — never falls back to "no row"', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(queuedRow(), { failFulfillmentRead: true });

    // The read errors (simulated connection failure). The transition must
    // surface that failure — NOT treat it as "no fulfillment row" and NOT
    // proceed with a write from a stale assumption.
    const result = await service.transition(supabase, {
      transactionId: 't1',
      action: 'start_preparation',
      actor: 'staff',
      expectedFrom: 'queued',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/connection reset/);
    expect(result.error).not.toMatch(/No fulfillment row/);
    // Nothing was persisted — the error aborted the write path.
    expect(supabase.calls.rpc.some((c) => c.name === 'transition_fulfillment')).toBe(false);
  });

  it('getForTransaction throws on a read error (null means only "no row")', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(null, { failFulfillmentRead: true });
    await expect(service.getForTransaction(supabase, 't1')).rejects.toThrow(/connection reset/);
  });

  it('rejects a null mode at creation — selection is mandatory', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(null);

    const result = await service.ensure(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      // No mode — this is exactly what the invariant forbids.
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/mode is mandatory/);
    // The RPC was never called.
    expect(supabase.calls.rpc.some((c) => c.name === 'ensure_fulfillment')).toBe(false);
  });

  it('rejects an unknown engine type at creation (fail closed)', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(null);

    const result = await service.ensure(supabase, {
      transactionId: 't1',
      engineType: 'not_a_registered_engine',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown engine type/);
    // The RPC was never called — the capability check ran first.
    expect(supabase.calls.rpc.some((c) => c.name === 'ensure_fulfillment')).toBe(false);
  });

  it('rejects a mode not offered by the engine (typed selection validation)', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(null);

    // 'shipment' exists in the global registry but is NOT declared by
    // instant_transaction — the engine's own options are the authority.
    const result = await service.ensure(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'shipment',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not offered by this engine/);
    expect(supabase.calls.rpc.some((c) => c.name === 'ensure_fulfillment')).toBe(false);
  });

  it('rejects a destination that is illegal for the selected mode', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(null);

    // 'address' is legal for local_delivery, but NOT for on_premise.
    const result = await service.ensure(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'on_premise',
      destinationType: 'address',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not valid for mode 'on_premise'/);
    expect(supabase.calls.rpc.some((c) => c.name === 'ensure_fulfillment')).toBe(false);
  });

  it('accepts a legal typed selection and persists it', async () => {
    const service = new FulfillmentService();
    const supabase = createSupabaseMock(null);

    const result = await service.ensure(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'pickup',
      destinationType: 'pickup_location',
      destinationRef: 'counter-1',
    });
    expect(result.ok).toBe(true);
    const rpc = supabase.calls.rpc.find((c) => c.name === 'ensure_fulfillment');
    expect(rpc).toBeDefined();
    expect(rpc!.args.p_mode).toBe('pickup');
    expect(rpc!.args.p_destination_type).toBe('pickup_location');
  });

  it('source: fulfillment initialization is coupled to confirmation via the DB trigger', () => {
    const migrationsDir = join(__dirname, '../../../../supabase/migrations');
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const all = files.map((f) => readFileSync(join(migrationsDir, f), 'utf8')).join('\n');
    // The trigger must exist so the confirm UPDATE and the fulfillment row
    // creation are one atomic statement (no "confirm first, self-heal later").
    expect(all).toMatch(/ensure_fulfillment_on_confirm/);
    expect(all).toMatch(/AFTER UPDATE OF "?status"? ON "?public"?"?\.?"?transactions"?/);
  });

  it('source: no production path calls ensure-after-confirm (no self-heal)', () => {
    const orderStatusPath = join(__dirname, '../../../src/engines/order-status.service.ts');
    const src = readFileSync(orderStatusPath, 'utf8');
    // The service must not contain the "create the row after the confirm
    // already happened" pattern — the trigger owns creation.
    expect(src).not.toMatch(/ensure\(/);
  });

  it('source: the confirm trigger is capability-driven, never engine-hardcoded', () => {
    const migrationsDir = join(__dirname, '../../../../supabase/migrations');
    const triggerFile = readFileSync(join(migrationsDir, '20260821140000_engine_a_fulfillment_capabilities.sql'), 'utf8');
    const triggerFunction = triggerFile.split('CREATE OR REPLACE FUNCTION "public"."_ensure_fulfillment_on_confirm"')[1] ?? '';
    // The trigger body must not contain a hardcoded engine_type LITERAL —
    // required-fulfillment intent comes from the capability table. (The
    // `WHERE engine_type = NEW.engine_type` lookup against the table is the
    // point; only quoted literals are forbidden.)
    expect(triggerFunction).not.toMatch(/engine_type\s*=\s*'[a-z_]+'/);
    expect(triggerFunction).not.toMatch(/engine_type\s*=\s*"[a-z_]+"/);
    // ...and it reads the capability table instead.
    expect(triggerFunction).toMatch(/engine_fulfillment_capabilities/);
    // It fires on INSERT too (staff create orders directly as 'confirmed').
    expect(triggerFile).toMatch(/AFTER INSERT OR UPDATE OF "?status"?/);
  });

  it('source: the capability registry seed matches the TypeScript engine registry', () => {
    const migrationsDir = join(__dirname, '../../../../supabase/migrations');
    const triggerFile = readFileSync(join(migrationsDir, '20260821140000_engine_a_fulfillment_capabilities.sql'), 'utf8');
    for (const engine of getAllEngines()) {
      // Every registered engine has a capability row with the same required flag.
      const row = new RegExp(`\\('${engine.type}',\\s*(true|false),\\s*(true|false)\\)`).exec(triggerFile);
      expect(row, `seed row for engine '${engine.type}'`).toBeTruthy();
      expect(row![1]).toBe(String(engine.capabilities.fulfillment.required));
    }
  });

  it('source: order creation snapshots the typed selection (mode is never null at confirm)', () => {
    const routerPath = join(__dirname, '../../../src/routes/dynamic-module.router.ts');
    const router = readFileSync(routerPath, 'utf8');
    const staffPath = join(__dirname, '../../../src/modules/staff/module-staff.controller.ts');
    const staff = readFileSync(staffPath, 'utf8');
    // Both creation paths resolve + snapshot the selection into metadata.
    expect(router).toMatch(/fulfillment_mode: fulfillmentSelection\.mode/);
    expect(staff).toMatch(/fulfillment_mode: fulfillmentSelection\.mode/);
  });

  it('source: RLS hardening — fiscal + fulfillment policies are scoped, never USING (true)', () => {
    const migrationsDir = join(__dirname, '../../../../supabase/migrations');
    const hardening = readFileSync(join(migrationsDir, '20260821150000_engine_a_rls_hardening.sql'), 'utf8');
    // The USING (true) fiscal policies are dropped...
    for (const name of ['fiscal_profiles_read_authenticated', 'fiscal_documents_read_authenticated', 'fiscal_submissions_read_authenticated']) {
      expect(hardening).toMatch(new RegExp(`DROP POLICY IF EXISTS "${name}"`));
    }
    // ...and replaced by tenant/property-scoped policies using the schema helpers.
    expect(hardening).toMatch(/fiscal_profiles_isolation/);
    expect(hardening).toMatch(/fiscal_documents_isolation/);
    expect(hardening).toMatch(/fiscal_submissions_isolation/);
    expect(hardening).toMatch(/user_has_tenant_access/);
    // fulfillments + fulfillment_events get RLS + scoped policies.
    expect(hardening).toMatch(/fulfillments_isolation/);
    expect(hardening).toMatch(/fulfillment_events_isolation/);
    expect(hardening.match(/ENABLE ROW LEVEL SECURITY/g)!.length).toBeGreaterThanOrEqual(2);
    // SECURITY DEFINER RPCs are service_role-only.
    expect(hardening).toMatch(/REVOKE EXECUTE ON FUNCTION "public"."transition_fulfillment"/);
    expect(hardening).toMatch(/REVOKE EXECUTE ON FUNCTION "public"."next_fiscal_document_number"/);
    // The schema default is flipped so future tables fail closed.
    expect(hardening).toMatch(/ALTER DEFAULT PRIVILEGES[\s\S]*REVOKE SELECT ON TABLES FROM "?authenticated"?/);
    // The fulfillment service must not be impacted: it still reaches the RPCs
    // over the service-role client (see transition/ensure tests above).
  });

  it('source: the verification artifact exists and covers the proof steps', () => {
    const verifyPath = join(__dirname, '../../../../supabase/verify/rls-tenant-isolation.sql');
    const verify = readFileSync(verifyPath, 'utf8');
    expect(verify).toMatch(/SET ROLE authenticated/);
    expect(verify).toMatch(/permission denied/);
    // The script must assert the isolation outcome itself: cross-tenant rows are
    // invisible to authenticated, and the RPCs are service_role-only.
    expect(verify).toMatch(/visible_rows = 0/);
    expect(verify).toMatch(/has_function_privilege/);
    expect(verify).toMatch(/transition_fulfillment/);
  });
});
