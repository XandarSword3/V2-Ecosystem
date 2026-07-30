const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- modules table columns ---');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'modules'
    ORDER BY ordinal_position
  `);
  console.table(cols.rows);

  console.log('--- existing module rows (all tenants) ---');
  const rows = await client.query(`SELECT * FROM modules ORDER BY created_at NULLS LAST LIMIT 20`);
  console.log(JSON.stringify(rows.rows, null, 2));

  console.log('--- rows matching classic-menu or menu ---');
  const menuRows = await client.query(`SELECT * FROM modules WHERE slug ILIKE '%menu%'`);
  console.log(JSON.stringify(menuRows.rows, null, 2));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
