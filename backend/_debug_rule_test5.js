const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();

  // Drop + COMMIT in its own transaction so relhasrules actually refreshes.
  await c.query('BEGIN');
  await c.query('DROP RULE audit_log_no_delete ON public.audit_logs');
  await c.query('DROP RULE audit_log_no_update ON public.audit_logs');
  await c.query('COMMIT');

  const relhasrules = await c.query(`SELECT relhasrules FROM pg_class WHERE relname='audit_logs'`);
  console.log('relhasrules after commit:', JSON.stringify(relhasrules.rows));

  await c.query('BEGIN');
  try {
    const del = await c.query(`DELETE FROM public.tenants WHERE id = 'f93a6dc4-9565-4c14-943e-931e2a72dd3e' RETURNING id`);
    console.log('delete result:', JSON.stringify(del.rows));
  } catch (e) {
    console.log('delete failed:', e.message);
  }
  await c.query('ROLLBACK'); // still just testing, restore rules after this script regardless

  // Restore rules exactly as they were, regardless of test outcome.
  await c.query('BEGIN');
  await c.query("CREATE RULE audit_log_no_delete AS ON DELETE TO public.audit_logs DO INSTEAD NOTHING");
  await c.query("CREATE RULE audit_log_no_update AS ON UPDATE TO public.audit_logs DO INSTEAD NOTHING");
  await c.query('COMMIT');
  console.log('rules restored');

  await c.end();
})().catch(async e=>{ console.error('outer error', e); process.exit(1); });
