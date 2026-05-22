import { Pool } from 'pg';

async function testConnection(port: number) {
  const host = 'aws-1-ap-northeast-1.pooler.supabase.com';
  const connectionString = `postgresql://postgres.qxtmesddgwmwspejnbvc:k8yhxQ8ktbKU8b@${host}:${port}/postgres`;
  console.log(`Testing host ${host} on port ${port}...`);
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log(` SUCCESS: Connected on port ${port}`);
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    client.release();
    return true;
  } catch (err: any) {
    console.log(` FAILED on port ${port}: ${err.message}`);
    return false;
  } finally {
    await pool.end();
  }
}

async function main() {
  await testConnection(5432);
  await testConnection(6543);
}

main();
