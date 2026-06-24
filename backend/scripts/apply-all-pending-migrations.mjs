import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const password = process.env.SUPABASE_DB_PASSWORD || 'KItFysca3NolmhQG';
const encoded = encodeURIComponent(password);
const conn = `postgresql://postgres.qxtmesddgwmwspejnbvc:${encoded}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`;

const migDir = path.resolve(__dirname, '../../supabase/migrations');

async function run() {
  const pool = new pg.Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  let client;
  try {
    client = await pool.connect();
    
    // Get applied migrations
    const res = await client.query('SELECT version FROM supabase_migrations.schema_migrations');
    const applied = new Set(res.rows.map(r => r.version));
    
    // Read local files
    const files = fs.readdirSync(migDir)
      .filter(f => f.endsWith('.sql') && f !== 'README.md')
      .sort();
      
    console.log(`Found ${files.length} migration files in local directory.`);
    
    let appliedCount = 0;
    for (const file of files) {
      const version = file.match(/^(\d{14})/)?.[1];
      if (!version) {
        console.log(`Skip (no version in name): ${file}`);
        continue;
      }
      
      if (applied.has(version)) {
        // Already applied
        continue;
      }
      
      console.log(`Applying missing migration: ${file}`);
      const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
      
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO supabase_migrations.schema_migrations(version, name)
           VALUES ($1, $2) ON CONFLICT (version) DO NOTHING`,
          [version, file.replace('.sql', '')]
        );
        console.log(`  OK: Applied ${file}`);
        appliedCount++;
      } catch (err) {
        console.error(`  FAIL applying ${file}:`, err.message);
        // Throw to stop execution on failure
        throw err;
      }
    }
    
    console.log(`Successfully applied ${appliedCount} pending migrations.`);
  } catch (error) {
    console.error('Migration runner failed:', error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

run();
