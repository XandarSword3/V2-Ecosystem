const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();

  // Confirm the alt account really is gone (expected — we deleted it).
  const check = await c.query(`SELECT id FROM public.users WHERE email = 'walidbereh56@gmail.com'`);
  console.log('walid row still exists?', JSON.stringify(check.rows));

  // Find varchar(20) columns on public.users — likely culprit for the
  // registration error.
  const cols = await c.query(`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND character_maximum_length IS NOT NULL
    ORDER BY character_maximum_length
  `);
  console.log('users varchar columns with length limits:', JSON.stringify(cols.rows, null, 2));

  await c.end();
})().catch(e=>{console.error(e);process.exit(1);});
