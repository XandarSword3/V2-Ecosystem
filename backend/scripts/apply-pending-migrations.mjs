import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const password = process.env.SUPABASE_DB_PASSWORD || '@Qvinmw@&Uran6f';
const encoded = encodeURIComponent(password);
const conn =
  process.env.DATABASE_URL ||
  `postgresql://postgres.qxtmesddgwmwspejnbvc:${encoded}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`;

const migDir = path.resolve(__dirname, '../../supabase/migrations');
const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      '20260522000000_clean_transactions_table.sql',
      '20260522000001_add_system_config.sql',
      '20260522100000_fix_view_schema_gaps.sql',
      '20260522200000_purchase_shared_capacity_atomic.sql',
      '20260522210000_audit_logs_user_agent.sql',
    ];

const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

for (const file of targets) {
  const version = file.match(/^(\d{14})/)?.[1];
  if (!version) {
    console.log('Skip (no version):', file);
    continue;
  }
  const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
  console.log('Applying', file);
  try {
    await client.query(sql);
    await client.query(
      `INSERT INTO supabase_migrations.schema_migrations(version, name)
       VALUES ($1, $2) ON CONFLICT (version) DO NOTHING`,
      [version, file.replace('.sql', '')],
    );
    console.log('  OK');
  } catch (err) {
    console.log('  FAIL:', err.message);
  }
}

const rpc = await client.query(
  `SELECT 1 FROM pg_proc WHERE proname = 'purchase_shared_capacity_atomic'`,
);
console.log('purchase_shared_capacity_atomic:', rpc.rowCount > 0 ? 'yes' : 'no');

const cols = await client.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'bookable_units'
     AND column_name IN ('base_price', 'deleted_at', 'price')`,
);
console.log('bookable_units columns:', cols.rows.map((r) => r.column_name).join(', ') || '(view may differ)');

client.release();
await pool.end();
