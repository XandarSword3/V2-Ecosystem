require('dotenv').config();
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  const r = await c.query(`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) ILIKE '%INSERT INTO transactions%'
  `);
  console.log('Found', r.rows.length, 'functions that INSERT INTO transactions:\n');
  for (const row of r.rows) {
    const hasTenant = /INSERT INTO transactions\s*\([^)]*\btenant_id\b/is.test(row.def);
    const hasProperty = /INSERT INTO transactions\s*\([^)]*\bproperty_id\b/is.test(row.def);
    console.log(`- ${row.proname}(${row.args})  tenant_id=${hasTenant}  property_id=${hasProperty}`);
  }
  await c.end();
}).catch(e => { console.log('ERR', e.message); process.exit(1); });
