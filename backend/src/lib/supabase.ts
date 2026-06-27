/**
 * Shim: re-exports the Supabase client from the canonical database layer.
 *
 * Several services were written importing from '../lib/supabase.js'.
 * The actual implementation lives in '../database/supabase.ts'.
 * This file keeps those imports working without touching every service.
 */
export { getSupabase, getSupabaseAdmin } from '../database/supabase.js';

// Named singleton exports expected by services that write `import { supabase } from ...`
import { getSupabase, getSupabaseAdmin } from '../database/supabase.js';
export const supabase = getSupabase();
export const supabaseAdmin = getSupabaseAdmin();
