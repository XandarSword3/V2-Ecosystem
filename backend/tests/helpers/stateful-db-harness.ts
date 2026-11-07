/**
 * Stateful Relational Database Test Harness
 *
 * Replaces dumb FIFO createChainableMock with a state-verifying in-memory database.
 * Tracks multi-table mutations, cascading fulfillments, event logs, and RPC calls
 * so unit and controller tests assert on real state changes rather than mock echoes.
 */

export interface StatefulHarness {
  client: any;
  seed: (table: string, rows: Record<string, any>[]) => void;
  getTable: (table: string) => Record<string, any>[];
  getRpcCalls: (name: string) => any[];
  simulateError: (table: string, error: { message: string; code?: string } | null) => void;
  clear: () => void;
}

export function createStatefulDbHarness(): StatefulHarness {
  const tables = new Map<string, Record<string, any>[]>();
  const rpcCalls = new Map<string, any[]>();
  const tableErrors = new Map<string, { message: string; code?: string }>();

  const getTable = (tableName: string): Record<string, any>[] => {
    if (!tables.has(tableName)) {
      tables.set(tableName, []);
    }
    return tables.get(tableName)!;
  };

  const seed = (tableName: string, rows: Record<string, any>[]) => {
    const table = getTable(tableName);
    table.length = 0;
    table.push(...JSON.parse(JSON.stringify(rows)));
  };

  const simulateError = (tableName: string, error: { message: string; code?: string } | null) => {
    if (error) {
      tableErrors.set(tableName, error);
    } else {
      tableErrors.delete(tableName);
    }
  };

  const clear = () => {
    tables.clear();
    rpcCalls.clear();
    tableErrors.clear();
  };

  const getRpcCalls = (name: string): any[] => {
    return rpcCalls.get(name) || [];
  };

  function parseOrClause(clause: string, row: Record<string, any>): boolean {
    // e.g. "property_id.eq.abc,property_id.is.null"
    const parts = clause.split(',');
    for (const part of parts) {
      const match = part.trim().match(/^([a-zA-Z0-9_]+)\.(eq|neq|is)\.(.+)$/);
      if (match) {
        const [, col, op, val] = match;
        const actualVal = row[col];
        if (op === 'eq' && String(actualVal) === String(val)) return true;
        if (op === 'neq' && String(actualVal) !== String(val)) return true;
        if (op === 'is' && val === 'null' && (actualVal === null || actualVal === undefined)) return true;
      }
    }
    return false;
  }

  function createQueryBuilder(tableName: string) {
    const table = getTable(tableName);
    let currentRows = [...table];
    let pendingAction: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null = null;
    let pendingPayload: any = null;
    let singleMode = false;
    let maybeSingleMode = false;
    let countOption: 'exact' | 'planned' | 'estimated' | null = null;

    const builder: any = {
      select: (_cols?: string, opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) => {
        if (!pendingAction) pendingAction = 'select';
        if (opts?.count) countOption = opts.count;
        return builder;
      },
      insert: (payload: any) => {
        pendingAction = 'insert';
        pendingPayload = payload;
        return builder;
      },
      upsert: (payload: any, _opts?: any) => {
        pendingAction = 'upsert';
        pendingPayload = payload;
        return builder;
      },
      update: (payload: any) => {
        pendingAction = 'update';
        pendingPayload = payload;
        return builder;
      },
      delete: () => {
        pendingAction = 'delete';
        return builder;
      },
      eq: (col: string, val: any) => {
        currentRows = currentRows.filter((r) => r[col] === val);
        return builder;
      },
      neq: (col: string, val: any) => {
        currentRows = currentRows.filter((r) => r[col] !== val);
        return builder;
      },
      gt: (col: string, val: any) => {
        currentRows = currentRows.filter((r) => r[col] > val);
        return builder;
      },
      gte: (col: string, val: any) => {
        currentRows = currentRows.filter((r) => r[col] >= val);
        return builder;
      },
      lt: (col: string, val: any) => {
        currentRows = currentRows.filter((r) => r[col] < val);
        return builder;
      },
      lte: (col: string, val: any) => {
        currentRows = currentRows.filter((r) => r[col] <= val);
        return builder;
      },
      in: (col: string, vals: any[]) => {
        currentRows = currentRows.filter((r) => vals.includes(r[col]));
        return builder;
      },
      is: (col: string, val: any) => {
        if (val === null) {
          currentRows = currentRows.filter((r) => r[col] === null || r[col] === undefined);
        } else {
          currentRows = currentRows.filter((r) => r[col] === val);
        }
        return builder;
      },
      ilike: (col: string, pattern: string) => {
        const clean = pattern.replace(/%/g, '').toLowerCase();
        currentRows = currentRows.filter((r) => String(r[col] || '').toLowerCase().includes(clean));
        return builder;
      },
      like: (col: string, pattern: string) => {
        const clean = pattern.replace(/%/g, '');
        currentRows = currentRows.filter((r) => String(r[col] || '').includes(clean));
        return builder;
      },
      or: (clause: string) => {
        currentRows = currentRows.filter((r) => parseOrClause(clause, r));
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending !== false;
        currentRows.sort((a, b) => {
          if (a[col] < b[col]) return asc ? -1 : 1;
          if (a[col] > b[col]) return asc ? 1 : -1;
          return 0;
        });
        return builder;
      },
      range: (from: number, to: number) => {
        currentRows = currentRows.slice(from, to + 1);
        return builder;
      },
      limit: (n: number) => {
        currentRows = currentRows.slice(0, n);
        return builder;
      },
      single: () => {
        singleMode = true;
        return builder.execute();
      },
      maybeSingle: () => {
        maybeSingleMode = true;
        return builder.execute();
      },
      execute: async () => {
        // Deliberate error injection for testing error paths
        if (tableErrors.has(tableName)) {
          const err = tableErrors.get(tableName)!;
          return { data: null, error: err, count: null };
        }

        if (pendingAction === 'insert') {
          const toInsert = Array.isArray(pendingPayload) ? pendingPayload : [pendingPayload];
          const inserted = toInsert.map((item) => ({
            id: item.id || `gen-${Math.random().toString(36).substring(2, 9)}`,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            ...item,
          }));
          table.push(...inserted);
          return {
            data: singleMode || maybeSingleMode ? inserted[0] : inserted,
            error: null,
            count: countOption ? inserted.length : null,
          };
        }

        if (pendingAction === 'upsert') {
          const toUpsert = Array.isArray(pendingPayload) ? pendingPayload : [pendingPayload];
          const upserted: Record<string, any>[] = [];
          for (const item of toUpsert) {
            const existingIdx = table.findIndex((r) => (item.id && r.id === item.id) || (item.name && r.name === item.name));
            if (existingIdx >= 0) {
              Object.assign(table[existingIdx], item, { updated_at: new Date().toISOString() });
              upserted.push(table[existingIdx]);
            } else {
              const newRow = {
                id: item.id || `gen-${Math.random().toString(36).substring(2, 9)}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...item,
              };
              table.push(newRow);
              upserted.push(newRow);
            }
          }
          return { data: singleMode || maybeSingleMode ? upserted[0] : upserted, error: null };
        }

        if (pendingAction === 'update') {
          const matchedIds = new Set(currentRows.map((r) => r.id));
          const updated: Record<string, any>[] = [];
          for (const row of table) {
            if (matchedIds.has(row.id)) {
              Object.assign(row, pendingPayload, { updated_at: new Date().toISOString() });
              updated.push({ ...row });
            }
          }
          return {
            data: singleMode || maybeSingleMode ? updated[0] || null : updated,
            error: null,
            count: countOption ? updated.length : null,
          };
        }

        if (pendingAction === 'delete') {
          const matchedIds = new Set(currentRows.map((r) => r.id));
          const remaining = table.filter((r) => !matchedIds.has(r.id));
          table.length = 0;
          table.push(...remaining);
          return { data: null, error: null, count: countOption ? matchedIds.size : null };
        }

        // Default: select
        if (singleMode) {
          if (currentRows.length === 0) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' }, count: 0 };
          }
          return { data: currentRows[0], error: null, count: 1 };
        }

        if (maybeSingleMode) {
          return { data: currentRows.length > 0 ? currentRows[0] : null, error: null, count: currentRows.length };
        }

        return {
          data: currentRows,
          error: null,
          count: countOption ? currentRows.length : null,
        };
      },
    };

    // Make builder awaitable directly
    builder.then = (resolve: any, reject: any) => builder.execute().then(resolve, reject);
    return builder;
  }

  const client: any = {
    from: (tableName: string) => createQueryBuilder(tableName),
    rpc: (fnName: string, args?: any) => {
      const calls = rpcCalls.get(fnName) || [];
      calls.push(args);
      rpcCalls.set(fnName, calls);

      if (fnName === 'deduct_stock_fifo') {
        const itemId = args?.p_item_id;
        const qty = args?.p_quantity || 0;
        const inventory = getTable('inventory_items');
        const row = inventory.find((i) => i.id === itemId);
        if (row) {
          row.current_stock = Math.max(0, (row.current_stock || 0) - qty);
        }
        return Promise.resolve({ data: { success: true }, error: null });
      }

      if (fnName === 'restore_inventory_for_order_items') {
        const items = args?.p_items || [];
        const inventory = getTable('inventory_items');
        for (const item of items) {
          const row = inventory.find((i) => i.catalog_item_id === item.catalog_item_id);
          if (row) {
            row.current_stock = (row.current_stock || 0) + (item.quantity || 1);
          }
        }
        return Promise.resolve({ data: { success: true }, error: null });
      }

      return Promise.resolve({ data: { success: true }, error: null });
    },
  };

  return {
    client,
    seed,
    getTable,
    getRpcCalls,
    simulateError,
    clear,
  };
}
