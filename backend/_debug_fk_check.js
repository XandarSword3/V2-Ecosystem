const { Client } = require('pg');
require('dotenv').config();

const c = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await c.connect();

  const fks = await c.query(`
    SELECT
      tc.table_name AS child_table,
      kcu.column_name AS fk_column,
      ccu.table_name AS parent_table,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name IN ('tenants','users')
      AND tc.table_schema = 'public'
    ORDER BY parent_table, child_table;
  `);
  console.log('--- FKs referencing tenants/users ---');
  console.log(JSON.stringify(fks.rows, null, 2));

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
