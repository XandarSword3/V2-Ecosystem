const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  const rel = await c.query(`SELECT relkind, relispartition FROM pg_class WHERE relname = 'audit_logs'`);
  console.log('audit_logs relkind/partition:', JSON.stringify(rel.rows));
  const rules = await c.query(`SELECT * FROM pg_rules WHERE tablename = 'audit_logs'`);
  console.log('audit_logs rules:', JSON.stringify(rules.rows));
  const parts = await c.query(`
    SELECT inhrelid::regclass AS partition
    FROM pg_inherits
    WHERE inhparent = 'public.audit_logs'::regclass
  `);
  console.log('audit_logs partitions:', JSON.stringify(parts.rows));
  await c.end();
})().catch(e=>{console.error(e);process.exit(1);});
