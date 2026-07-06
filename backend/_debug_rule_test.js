const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  const whoami = await c.query('SELECT current_user, session_user');
  console.log('user:', JSON.stringify(whoami.rows));

  await c.query('BEGIN');
  await c.query('ALTER TABLE public.audit_logs DISABLE RULE audit_log_no_delete');
  const check = await c.query("SELECT rulename, ev_enabled FROM pg_rewrite r JOIN pg_class cl ON r.ev_class = cl.oid WHERE cl.relname = 'audit_logs'");
  console.log('rule state during txn:', JSON.stringify(check.rows));

  try {
    const del = await c.query(`DELETE FROM public.tenants WHERE id = 'f93a6dc4-9565-4c14-943e-931e2a72dd3e' RETURNING id`);
    console.log('delete result:', JSON.stringify(del.rows));
  } catch (e) {
    console.log('delete failed:', e.message, e.detail, e.hint);
  }

  await c.query('ROLLBACK'); // don't actually commit this test
  await c.end();
})().catch(e=>{console.error(e);process.exit(1);});
