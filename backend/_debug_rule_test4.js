const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  await c.query('BEGIN');

  const r1 = await c.query('DROP RULE audit_log_no_delete ON public.audit_logs');
  console.log('drop delete rule ok');
  const r2 = await c.query('DROP RULE audit_log_no_update ON public.audit_logs');
  console.log('drop update rule ok');

  const rulesLeft = await c.query(`SELECT rulename FROM pg_rules WHERE tablename='audit_logs'`);
  console.log('rules left (in-txn):', JSON.stringify(rulesLeft.rows));

  const relhasrules = await c.query(`SELECT relhasrules FROM pg_class WHERE relname='audit_logs'`);
  console.log('relhasrules (in-txn):', JSON.stringify(relhasrules.rows));

  try {
    const del = await c.query(`DELETE FROM public.tenants WHERE id = 'f93a6dc4-9565-4c14-943e-931e2a72dd3e' RETURNING id`);
    console.log('delete result:', JSON.stringify(del.rows));
  } catch (e) {
    console.log('delete failed:', e.message);
  }

  await c.query('ROLLBACK');
  await c.end();
})().catch(e=>{console.error('outer error', e); process.exit(1);});
