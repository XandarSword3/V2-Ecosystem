import pg from 'pg';
import fs from 'fs';
const { Client } = pg;
const envText = fs.readFileSync('.env', 'utf8');
const match = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m);
const connectionString = match[1];
const c = new Client({ connectionString });
await c.connect();
const r = await c.query(
  `select id, slug, tenant_id, property_id, is_active, created_at
   from modules
   where slug in ('classic-menu-service','boutique-hotel')
   order by slug, created_at`
);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
