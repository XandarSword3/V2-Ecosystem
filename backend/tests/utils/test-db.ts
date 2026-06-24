/**
 * Database / Supabase Mock Helpers
 *
 * Provides a fully-chainable mock Supabase client so unit tests
 * never hit a real database.  Every query-builder method returns
 * `this`, and the terminal methods (`.single()`, `.maybeSingle()`,
 * `.then()`, etc.) resolve with the data you configure via
 * `mockSupabaseResponse()`.
 */

import { vi } from 'vitest';

// ─── Types ───────────────────────────────────────────────────────────

export interface SupabaseResponse<T = unknown> {
  data: T | null;
  error: SupabaseError | null;
  count?: number | null;
  status?: number;
  statusText?: string;
}

export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * The mock query-builder exposes every chaining method Supabase offers.
 * Methods that normally terminate a query (`.single()`, `.maybeSingle()`,
 * `.csv()`) return the configured response as a resolved promise-like.
 */
export interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  like: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  containedBy: ReturnType<typeof vi.fn>;
  filter: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  match: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  csv: ReturnType<typeof vi.fn>;
  returns: ReturnType<typeof vi.fn>;
  throwOnError: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
  /** Override the response the builder will resolve with */
  _setResponse: (data: unknown, error?: SupabaseError | null, count?: number | null) => void;
}

export interface MockSupabaseClient {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    signUp: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    admin: {
      listUsers: ReturnType<typeof vi.fn>;
      getUserById: ReturnType<typeof vi.fn>;
      deleteUser: ReturnType<typeof vi.fn>;
      updateUserById: ReturnType<typeof vi.fn>;
    };
  };
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
  /** Direct reference to the query builder used by the last `.from()` call */
  _lastQueryBuilder: MockQueryBuilder;
  /** Map of table name → query builder (populated as `.from(table)` is called) */
  _queryBuilders: Map<string, MockQueryBuilder>;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Build a `{ data, error }` response matching Supabase's shape.
 *
 * @param data  The payload to return (array, object, or null).
 * @param error Optional error object.
 * @param count Optional count for `.select('*', { count: 'exact' })` queries.
 */
export function mockSupabaseResponse<T = unknown>(
  data: T | null,
  error?: SupabaseError | null,
  count?: number | null,
): SupabaseResponse<T> {
  return {
    data,
    error: error ?? null,
    count: count ?? null,
    status: error ? 400 : 200,
    statusText: error ? 'Bad Request' : 'OK',
  };
}

/**
 * Shorthand to build an error response.
 */
export function mockSupabaseError(
  message: string,
  code = 'PGRST000',
): SupabaseResponse<null> {
  return mockSupabaseResponse(null, { message, code });
}

// ─── Mock Query Builder ──────────────────────────────────────────────

function createMockQueryBuilder(initialResponse?: SupabaseResponse): MockQueryBuilder {
  let response: SupabaseResponse = initialResponse ?? mockSupabaseResponse([]);

  const builder: MockQueryBuilder = {} as MockQueryBuilder;

  // Chainable filter / modifier methods — all return `builder`
  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in',
    'contains', 'containedBy',
    'filter', 'not', 'or', 'match',
    'order', 'limit', 'range',
    'returns', 'throwOnError',
  ] as const;

  for (const method of chainMethods) {
    (builder as unknown as Record<string, unknown>)[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods — resolve with the current response
  builder.single = vi.fn().mockImplementation(() => {
    // For .single(), extract first element if data is an array
    const d = Array.isArray(response.data) ? response.data[0] ?? null : response.data;
    return Promise.resolve({ ...response, data: d });
  });

  builder.maybeSingle = vi.fn().mockImplementation(() => {
    const d = Array.isArray(response.data) ? response.data[0] ?? null : response.data;
    return Promise.resolve({ ...response, data: d });
  });

  builder.csv = vi.fn().mockImplementation(() => Promise.resolve(response));

  // Make the builder itself thenable so `await supabase.from('x').select()` works
  builder.then = vi.fn().mockImplementation(
    (resolve?: (value: SupabaseResponse) => unknown) => {
      return Promise.resolve(response).then(resolve);
    },
  );

  // Allow overriding the response at any time
  builder._setResponse = (data, error = null, count = null) => {
    response = { data, error, count, status: error ? 400 : 200, statusText: error ? 'Bad Request' : 'OK' };
  };

  return builder;
}

// ─── Mock Supabase Client ────────────────────────────────────────────

/**
 * Create a mock Supabase client suitable for dependency injection.
 *
 * All `.from(tableName)` calls return a chainable query builder.
 * By default every query resolves with `{ data: [], error: null }`.
 *
 * ### Configuring responses
 *
 * ```ts
 * const supabase = createMockSupabase();
 *
 * // Option A — set response before the test acts
 * supabase._lastQueryBuilder._setResponse([{ id: '1', name: 'AccommodationUnit A' }]);
 *
 * // Option B — override per-table
 * const qb = supabase._queryBuilders.get('accommodation_units')!;
 * qb.select.mockReturnValue({ ...qb, then: vi.fn((r) => Promise.resolve(r).then(r)) });
 *
 * // Option C — simple one-liner
 * supabase.from('accommodation_units').select.mockResolvedValue(mockSupabaseResponse([{ id: '1' }]));
 * ```
 *
 * ### Using with vi.mock
 *
 * ```ts
 * const mockSb = createMockSupabase();
 * vi.mock('../../src/database/supabase', () => ({
 *   getSupabase: () => mockSb,
 *   getSupabaseAdmin: () => mockSb,
 * }));
 * ```
 */
export function createMockSupabase(): MockSupabaseClient {
  const queryBuilders = new Map<string, MockQueryBuilder>();
  let lastQb: MockQueryBuilder = createMockQueryBuilder();

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (!queryBuilders.has(table)) {
      queryBuilders.set(table, createMockQueryBuilder());
    }
    lastQb = queryBuilders.get(table)!;
    return lastQb;
  });

  const mockStorageBucket = {
    upload: vi.fn().mockResolvedValue({ data: { path: 'test/file.png' }, error: null }),
    download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.png' } }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  const client: MockSupabaseClient = {
    from: fromFn,
    rpc: vi.fn().mockResolvedValue(mockSupabaseResponse(null)),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        deleteUser: vi.fn().mockResolvedValue({ data: null, error: null }),
        updateUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    },
    storage: {
      from: vi.fn().mockReturnValue(mockStorageBucket),
    },
    get _lastQueryBuilder() {
      return lastQb;
    },
    _queryBuilders: queryBuilders,
  };

  return client;
}

// ─── Convenience: pre-configured response builders ───────────────────

/**
 * Configure a table's query builder to return specific data on the
 * **next** chained query.
 *
 * ```ts
 * const sb = createMockSupabase();
 * setTableResponse(sb, 'catalog_items', [{ id: '1', name: 'Burger' }]);
 *
 * // Now: await sb.from('catalog_items').select()  →  { data: [{…}], error: null }
 * ```
 */
export function setTableResponse(
  client: MockSupabaseClient,
  table: string,
  data: unknown,
  error?: SupabaseError | null,
  count?: number | null,
): void {
  // Trigger builder creation if it doesn't exist yet
  (client.from as (...args: unknown[]) => MockQueryBuilder)(table);
  client._queryBuilders.get(table)!._setResponse(data, error, count);
}

/**
 * Configure a table's query builder to return an error.
 */
export function setTableError(
  client: MockSupabaseClient,
  table: string,
  message: string,
  code = 'PGRST000',
): void {
  setTableResponse(client, table, null, { message, code });
}

/**
 * Reset all query builders so every table returns empty arrays again.
 */
export function resetMockSupabase(client: MockSupabaseClient): void {
  client._queryBuilders.clear();
  client.from.mockClear();
  client.rpc.mockClear();
}
