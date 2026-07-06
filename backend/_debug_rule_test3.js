const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  await c.query('BEGIN');
  await c.query('DROP RULE audit_log_no_delete ON public.audit_logs');
  await c.query('DROP RULE audit_log_no_update ON public.audit_logs');

  try {
    const del = await c.query(`DELETE FROM public.tenants WHERE id = 'f93a6dc4-9565-4c14-943e-931e2a72dd3e' RETURNING id`);
    console.log('delete result:', JSON.stringify(del.rows));
  } catch (e) {
    console.log('delete failed:', e.message, e.detail, e.hint);
  }

  await c.query('ROLLBACK'); // just a test, don't commit
  await c.end();
})().catch(e=>{console.error(e);process.exit(1);});
