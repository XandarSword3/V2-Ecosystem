const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  const rules = await c.query(`SELECT schemaname, tablename, rulename, definition FROM pg_rules WHERE schemaname='public'`);
  console.log('ALL rules in public schema:', JSON.stringify(rules.rows, null, 2));
  await c.end();
})().catch(e=>{console.error(e);process.exit(1);});
