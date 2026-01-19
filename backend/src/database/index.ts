// Re-export everything from connection module
export { initializeDatabase, getDb, getSupabase, getPool, closeDatabase, isUsingSupabase } from './connection.js';

// Export supabase admin
export { getSupabaseAdmin } from './supabase.js';

// Create a db object that provides a query function for raw SQL
// This wrapper tries to use the direct PostgreSQL pool first, falling back to Supabase
import { getPool, isUsingSupabase, getSupabase } from './connection.js';

interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export const db = {
  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    // Try direct PostgreSQL pool first (preferred for raw SQL)
    if (!isUsingSupabase()) {
      const pool = getPool();
      const result = await pool.query(sql, params);
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount || 0,
      };
    }

    // Fallback: For Supabase, we need to use RPC or parse the SQL
    // This requires a database function to execute raw SQL
    // For now, throw an error with helpful message
    throw new Error(
      'Raw SQL queries are not supported when using Supabase HTTP API. ' +
      'Please refactor to use Supabase query builder or ensure direct PostgreSQL connection.'
    );
  }
};
