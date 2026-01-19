import { vi } from 'vitest';

/**
 * Creates a properly chainable Supabase mock that resolves at the end of the chain.
 * Each terminal method (order, range, single, etc.) can be configured to resolve to specific data.
 */
export function createSupabaseMock() {
  const queryResults: Array<{ data: any; error: any; count?: number }> = [];
  let resultIndex = 0;

  const getNextResult = () => {
    const result = queryResults[resultIndex] || { data: null, error: null };
    resultIndex++;
    return result;
  };

  // Create a chainable query builder that is also thenable
  const createQueryBuilder = (): any => {
    const builder: any = {
      // Chainable methods
      select: vi.fn().mockImplementation(() => builder),
      insert: vi.fn().mockImplementation(() => builder),
      update: vi.fn().mockImplementation(() => builder),
      delete: vi.fn().mockImplementation(() => builder),
      upsert: vi.fn().mockImplementation(() => builder),
      eq: vi.fn().mockImplementation(() => builder),
      neq: vi.fn().mockImplementation(() => builder),
      gt: vi.fn().mockImplementation(() => builder),
      gte: vi.fn().mockImplementation(() => builder),
      lt: vi.fn().mockImplementation(() => builder),
      lte: vi.fn().mockImplementation(() => builder),
      like: vi.fn().mockImplementation(() => builder),
      ilike: vi.fn().mockImplementation(() => builder),
      is: vi.fn().mockImplementation(() => builder),
      in: vi.fn().mockImplementation(() => builder),
      or: vi.fn().mockImplementation(() => builder),
      not: vi.fn().mockImplementation(() => builder),
      filter: vi.fn().mockImplementation(() => builder),
      match: vi.fn().mockImplementation(() => builder),
      order: vi.fn().mockImplementation(() => builder),
      limit: vi.fn().mockImplementation(() => builder),
      range: vi.fn().mockImplementation(() => builder),
      
      // Terminal methods that resolve
      single: vi.fn().mockImplementation(() => Promise.resolve(getNextResult())),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(getNextResult())),
      
      // Make the builder thenable - when awaited without .single(), return the next result
      then: (resolve: any, reject: any) => {
        return Promise.resolve(getNextResult()).then(resolve, reject);
      },
    };
    
    return builder;
  };

  const mockFrom = vi.fn().mockImplementation(() => createQueryBuilder());

  return {
    from: mockFrom,
    // Helper to queue up results
    queueResult: (data: any, error: any = null, count?: number) => {
      queryResults.push({ data, error, count });
    },
    // Reset for between tests
    reset: () => {
      queryResults.length = 0;
      resultIndex = 0;
      mockFrom.mockClear();
    },
    // Get the mock for assertions
    mockFrom,
  };
}

/**
 * Simple helper to create a mock that just returns specific data for specific tables
 */
export function createSimpleSupabaseMock() {
  const tableResponses: Map<string, Array<{ data: any; error: any }>> = new Map();
  const tableIndexes: Map<string, number> = new Map();

  const getTableResponse = (table: string) => {
    const responses = tableResponses.get(table) || [];
    const index = tableIndexes.get(table) || 0;
    const response = responses[index] || { data: null, error: null };
    tableIndexes.set(table, index + 1);
    return response;
  };

  const createQueryBuilder = (table: string): any => {
    const builder: any = {};
    
    const chainMethods = [
      'select', 'insert', 'update', 'delete', 'upsert',
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
      'like', 'ilike', 'is', 'in', 'or', 'not',
      'filter', 'match', 'order', 'limit', 'range',
    ];
    
    chainMethods.forEach(method => {
      builder[method] = vi.fn().mockImplementation(() => builder);
    });

    builder.single = vi.fn().mockImplementation(() => 
      Promise.resolve(getTableResponse(table))
    );
    
    builder.maybeSingle = vi.fn().mockImplementation(() => 
      Promise.resolve(getTableResponse(table))
    );
    
    builder.then = (resolve: any, reject: any) => 
      Promise.resolve(getTableResponse(table)).then(resolve, reject);

    return builder;
  };

  return {
    from: vi.fn().mockImplementation((table: string) => createQueryBuilder(table)),
    
    setResponse: (table: string, data: any, error: any = null) => {
      if (!tableResponses.has(table)) {
        tableResponses.set(table, []);
      }
      tableResponses.get(table)!.push({ data, error });
    },
    
    reset: () => {
      tableResponses.clear();
      tableIndexes.clear();
    },
  };
}
