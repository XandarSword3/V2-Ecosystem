const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  const rls = await c.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'audit_logs'`);
  console.log('audit_logs RLS flags:', JSON.stringify(rls.rows));

  const bypass = await c.query(`SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`);
  console.log('current role bypass/super:', JSON.stringify(bypass.rows));

  const policies = await c.query(`SELECT polname, polcmd, qual FROM pg_policy pol JOIN pg_class cl ON pol.polrelid = cl.oid WHERE cl.relname = 'audit_logs'`);
  console.log('audit_logs policies:', JSON.stringify(policies.rows));

  await c.end();
})().catch(e=>{console.error(e);process.exit(1);});
