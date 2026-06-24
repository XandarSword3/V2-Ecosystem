import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const password = process.env.SUPABASE_DB_PASSWORD || 'KItFysca3NolmhQG';
const encoded = encodeURIComponent(password);
const conn = `postgresql://postgres.qxtmesddgwmwspejnbvc:${encoded}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`;

const migDir = path.resolve(__dirname, '../../supabase/migrations');

// Helper to split SQL by statements roughly
function splitSql(sql) {
  // Remove block comments
  let cleanSql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Split by semicolon, but be careful of semicolon inside dollar-quoted strings $$
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  
  const lines = cleanSql.split('\n');
  for (const line of lines) {
    // Remove line comment
    let cleanLine = line.replace(/--.*$/, '').trim();
    if (!cleanLine) continue;
    
    if (cleanLine.includes('$$')) {
      inDollarQuote = !inDollarQuote;
    }
    
    current += ' ' + cleanLine;
    
    if (!inDollarQuote && cleanLine.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) {
    statements.push(current.trim());
  }
  return statements;
}

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
      
    for (const file of files) {
      const version = file.match(/^(\d{14})/)?.[1];
      if (!version || applied.has(version)) {
        continue;
      }
      
      console.log(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
      const statements = splitSql(sql);
      
      let stmtIdx = 0;
      try {
        await client.query('BEGIN');
        for (const stmt of statements) {
          stmtIdx++;
          try {
            await client.query(stmt);
          } catch (err) {
            console.error(`Error in statement #${stmtIdx}:`);
            console.error(`Statement: ${stmt}`);
            console.error(`Error message: ${err.message}`);
            throw err;
          }
        }
        await client.query(
          `INSERT INTO supabase_migrations.schema_migrations(version, name)
           VALUES ($1, $2) ON CONFLICT (version) DO NOTHING`,
          [version, file.replace('.sql', '')]
        );
        await client.query('COMMIT');
        console.log(`  OK: Applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  Migration ${file} failed at statement #${stmtIdx}. Rolled back.`);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Migration runner failed:', error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

run();
