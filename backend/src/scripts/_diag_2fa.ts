import 'dotenv/config';
import { Pool } from 'pg';
import { config } from '../config/index.js';
import { getSupabaseAdmin } from '../database/supabase.js';

async function main() {
  const supabase = getSupabaseAdmin();

  // 0. Direct SQL for column nullability (bypasses PostgREST schema cache)
  const pool = new Pool({ connectionString: config.database.url, ssl: config.database.url.includes('localhost') ? false : { rejectUnauthorized: false } });
  try {
    const { rows } = await pool.query(`
      SELECT table_name, column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name IN ('two_factor_pending', 'two_factor_auth')
      AND column_name IN ('tenant_id', 'property_id', 'user_id')
      ORDER BY table_name, column_name;
    `);
    console.log('=== column nullability (direct SQL) ===');
    console.table(rows);
  } catch (e) {
    console.log('Direct PG query failed (expected if using pooler-only):', (e as Error).message);
  } finally {
    await pool.end().catch(() => {});
  }

  // 1. Does the table exist / is it reachable at all?
  const { data: pendingAll, error: pendingErr } = await supabase
    .from('two_factor_pending')
    .select('*')
    .limit(5);
  console.log('=== two_factor_pending sample ===');
  console.log('error:', pendingErr);
  console.log('rows:', pendingAll);

  // 2. Specific user from the failing logs
  const userId = 'edc6f22a-33ba-4928-973c-1ad013c46944';
  const { data: row, error: rowErr } = await supabase
    .from('two_factor_pending')
    .select('*')
    .eq('user_id', userId);
  console.log('=== specific user row ===');
  console.log('error:', rowErr);
  console.log('rows:', row);

  // 3. Try an actual upsert exactly like generateSetup does
  const { data: upsertData, error: upsertErr } = await supabase
    .from('two_factor_pending')
    .upsert({
      user_id: userId,
      secret: 'diagnostic-test-secret',
      backup_codes: ['TEST-CODE'],
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }, { onConflict: 'user_id' })
    .select();
  console.log('=== test upsert result ===');
  console.log('error:', upsertErr);
  console.log('data:', upsertData);

  // 4. Confirm the user actually exists
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, email, two_factor_enabled, is_active, tenant_id')
    .eq('id', userId)
    .maybeSingle();
  console.log('=== user row ===');
  console.log('error:', userErr);
  console.log('data:', userRow);

  // 5. Check two_factor_auth table too (same upsert pattern in verifyAndEnable)
  const { data: tfaCols, error: tfaErr } = await supabase
    .from('two_factor_auth')
    .select('*')
    .limit(1);
  console.log('=== two_factor_auth sample (to see columns) ===');
  console.log('error:', tfaErr);
  console.log('data:', tfaCols);
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
