const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres'
});

async function run() {
  await client.connect();
  const query = `
    SELECT 
      t.table_name,
      CASE WHEN r.rowsecurity THEN 'RLS ON' ELSE 'NO RLS' END as rls_status,
      COUNT(p.policyname) as policy_count
    FROM information_schema.tables t
    JOIN pg_class r ON r.relname = t.table_name
    LEFT JOIN pg_policies p ON p.tablename = t.table_name
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name, r.rowsecurity
    ORDER BY rls_status, t.table_name;
  `;
  const res = await client.query(query);
  console.table(res.rows);
  
  // Also list all tables that have 'property_id' column
  const colsRes = await client.query(`
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name = 'property_id';
  `);
  console.log('Tables with property_id:', colsRes.rows.map(r => r.table_name));
  
  await client.end();
}

run().catch(console.error);
