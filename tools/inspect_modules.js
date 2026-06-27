const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
const dotenvPath = path.join(__dirname, '.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
}

const connectionString = process.env.DATABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

async function main() {
  const newUrl = connectionString.replace(/:([^:@]+)@/, `:${dbPassword}@`);
  const client = new Client({ connectionString: newUrl });
  
  try {
    await client.connect();
    
    // Fetch all tenants
    const tenantsRes = await client.query('SELECT id, subdomain, property_group_id FROM tenants');
    console.log("=== TENANTS IN DATABASE ===");
    console.table(tenantsRes.rows);

    // Fetch all properties
    const propertiesRes = await client.query('SELECT id, name, group_id FROM properties');
    console.log("\n=== PROPERTIES IN DATABASE ===");
    console.table(propertiesRes.rows);

    // Fetch all modules
    const modulesRes = await client.query('SELECT id, name, slug, tenant_id, property_id, is_active FROM modules');
    console.log("\n=== MODULES IN DATABASE ===");
    console.table(modulesRes.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

main();
