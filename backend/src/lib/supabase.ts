/**
 * src/lib/supabase.ts — compatibility shim
 *
 * Single import point for Supabase so tests can mock one path.
 *
 * Services must import from HERE (not from database/connection or
 * database/supabase directly). Tests mock '../../../src/lib/supabase'
 * and Vitest replaces the whole module, giving services the mock client.
 *
 * Two exports to cover all callers:
 *   import { supabase }    from '../lib/supabase.js'  // singleton constant
 *   import { getSupabase } from '../lib/supabase.js'  // factory (same singleton)
 */

import { getSupabase as _getSupabase } from '../database/connection.js';
import { getSupabaseAdmin as _getSupabaseAdmin } from '../database/supabase.js';

// Named function re-exports — tests can replace these via vi.mock factory
export function getSupabase() {
  return _getSupabase();
}

export function getSupabaseAdmin() {
  return _getSupabaseAdmin();
}

// Pre-instantiated constants for services that call getSupabase() at module load
export const supabase = _getSupabase();
export const supabaseAdmin = _getSupabaseAdmin();
