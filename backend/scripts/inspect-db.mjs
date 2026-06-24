import pg from 'pg';
const password = process.env.SUPABASE_DB_PASSWORD || 'KItFysca3NolmhQG';
const encoded = encodeURIComponent(password);
const conn = `postgresql://postgres.qxtmesddgwmwspejnbvc:${encoded}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`;

async function run() {
  const pool = new pg.Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const tables = [
      'loyalty_point_batches',
      'loyalty_members',
      'loyalty_profiles',
      'loyalty_transactions'
    ];
    for (const t of tables) {
      const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [t]);
      console.log(`Table ${t}:`, res.rows.map(r => r.column_name).join(', '));
    }
  } finally {
    client.release();
    await pool.end();
  }
}
run();
