/**
 * Scripted Supabase mock for unit tests.
 *
 * The Supabase query builder chains look like:
 *   supabase.from('tenants').select('id').eq(...).maybeSingle()
 *   supabase.from('tenants').insert({...})                      // awaited directly
 *   supabase.from('property_groups').insert({...}).select().single()
 *   supabase.rpc('fn', { p_x: 1 })
 *
 * Tests script results into per-(table:op) — or rpc:(fn) — FIFO queues:
 *
 *   const db = createScriptedSupabase();
 *   db.queue('tenants:select', { data: null, error: null });     // idempotency check
 *   db.queue('plans:select', { data: planRow, error: null });
 *
 * A queued entry is consumed by the NEXT operation matching that key. Any
 * operation with no queued entry resolves to `{ data: null, error: null }`.
 * Every link in the chain is thenable, so `await` may land on ANY link
 * (matching real code that awaits `.eq()` directly). Call logs for each
 * chain step are exposed via `db.calls` for argument assertions.
 */

export interface DbResult {
  data?: unknown;
  error?: { message: string } | null;
}

export interface RecordedCall {
  table: string; // '<table>' or 'rpc:<fn>'
  op: string; // builder method or 'call' for rpc
  payload?: unknown; // insert/update/upsert body
  args?: unknown[]; // non-payload args (filters, select strings, rpc params)
}

const CHAIN_METHODS = [
  'select',
  'eq',
  'neq',
  'gte',
  'lte',
  'gt',
  'lt',
  'in',
  'is',
  'or',
  'not',
  'order',
  'limit',
  'range',
] as const;

const WRITE_METHODS = ['insert', 'update', 'upsert', 'delete'] as const;

export function createScriptedSupabase() {
  const queues = new Map<string, DbResult[]>();
  const calls: RecordedCall[] = [];

  const db = {
    /** Queue one or more results for the next operation on `key`. */
    queue(key: string, ...results: DbResult[]) {
      const list = queues.get(key) ?? [];
      list.push(...results);
      queues.set(key, list);
    },

    /** All chain steps so far (table/op/payload/args recorded per step). */
    calls,

    /** Filtered call log helper: e.g. db.ops('tenants', 'insert'). */
    ops(table: string, op?: string) {
      return calls.filter((c) => c.table === table || c.table === `rpc:${table}` || (op ? c.op === op : true));
    },

    resolve(key: string, fallback: DbResult): DbResult {
      const q = queues.get(key);
      if (q && q.length > 0) return (q.shift() as DbResult);
      return fallback;
    },

    /** Clear all queued results AND the call log — call in beforeEach. */
    reset() {
      queues.clear();
      calls.length = 0;
    },
  };

  function makeLink(table: string, firstOp: string | null): any {
    const state = { firstOp, payload: undefined as unknown };
    const resolve = () => {
      const key = `${table}:${state.firstOp ?? 'select'}`;
      return db.resolve(key, { data: null, error: null });
    };

    const link: any = {
      // Terminal-ish read methods resolve immediately
      single: () => Promise.resolve(resolve()),
      maybeSingle: () => Promise.resolve(resolve()),
      textSearch: (...args: unknown[]) => {
        calls.push({ table, op: 'textSearch', args });
        return link;
      },
      // Thenable: supports `await chain....` at ANY link
      then: (onFulfilled?: (v: DbResult) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolve()).then(onFulfilled, onRejected),
      catch: (onRejected?: (e: unknown) => unknown) => Promise.resolve(resolve()).catch(onRejected),
      finally: (onFinally?: () => void) => Promise.resolve(resolve()).finally(onFinally),
    };

    const record = (op: string, args: unknown[]) => {
      if (state.firstOp === null) {
        state.firstOp = op;
      }
      const payloadArg = (op === 'insert' || op === 'update' || op === 'upsert') ? args[0] : undefined;
      calls.push({ table, op, payload: payloadArg, args: payloadArg !== undefined ? args.slice(1) : args });
      return link;
    };

    for (const m of WRITE_METHODS) {
      link[m] = (...args: unknown[]) => {
        if (state.firstOp === null) state.firstOp = m;
        calls.push({ table, op: m, payload: args[0], args: args.slice(1) });
        return link;
      };
    }
    for (const m of CHAIN_METHODS) {
      link[m] = (...args: unknown[]) => record(m, args);
    }
    return link;
  }

  return {
    ...db,
    from: (table: string) => makeLink(table, null),
    rpc: (fn: string, params?: unknown) => {
      const result = db.resolve(`rpc:${fn}`, { data: null, error: null });
      calls.push({ table: `rpc:${fn}`, op: 'call', args: params ? [params] : [] });
      return Promise.resolve(result);
    },
    removeChannel: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
  };
}
