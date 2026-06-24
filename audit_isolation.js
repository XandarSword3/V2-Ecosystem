const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
const dotenvPath = path.join(__dirname, '.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
}

async function tryConnect(connectionString) {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    return client;
  } catch (err) {
    console.warn(`⚠️  Connection failed for URL: ${connectionString.replace(/:([^:@]+)@/, ':****@')}. Error: ${err.message}`);
    return null;
  }
}

async function main() {
  const urlFromEnv = process.env.DATABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!urlFromEnv) {
    console.error("❌ Error: DATABASE_URL is not set in environment.");
    process.exit(1);
  }

  let client = null;

  // Try 1: Try using the DATABASE_URL directly
  console.log("📡 Attempting connection using DATABASE_URL...");
  client = await tryConnect(urlFromEnv);

  // Try 2: Try using decoded password in DATABASE_URL if it has encoding
  if (!client && urlFromEnv.includes('%')) {
    console.log("📡 Attempting connection with decoded DATABASE_URL...");
    try {
      const decodedUrl = decodeURIComponent(urlFromEnv);
      client = await tryConnect(decodedUrl);
    } catch (e) {
      console.warn("⚠️ Failed to decode DATABASE_URL:", e.message);
    }
  }

  // Try 3: Try replacing the password in DATABASE_URL with SUPABASE_DB_PASSWORD, keeping username intact
  if (!client && dbPassword) {
    console.log("📡 Attempting connection using DATABASE_URL with SUPABASE_DB_PASSWORD replaced...");
    try {
      // DATABASE_URL is: postgresql://<user>:<password>@<host>/<dbname>
      // Replace the password part
      const newUrl = urlFromEnv.replace(/:([^:@]+)@/, `:${dbPassword}@`);
      client = await tryConnect(newUrl);
    } catch (e) {
      console.warn("⚠️ Failed to construct URL with replaced password:", e.message);
    }
  }

  if (!client) {
    console.error("❌ Error: All connection attempts failed. Cannot perform database audit.");
    process.exit(1);
  }

  console.log("✅ Connected successfully!");

  try {
    console.log("🔍 Fetching table schemas and RLS settings...");

    const sql = `
      SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        (
          SELECT json_agg(column_name::text)
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = c.relname
        ) AS columns,
        (
          SELECT count(*) 
          FROM pg_policies 
          WHERE schemaname = 'public' AND tablename = c.relname
        ) AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relkind = 'r' -- 'r' means ordinary table
      ORDER BY c.relname;
    `;

    const res = await client.query(sql);
    const tables = res.rows;

    console.log(`📋 Found ${tables.length} tables in the public schema.\n`);

    const results = [];
    let fullyIsolatedCount = 0;
    let tenantOnlyCount = 0;
    let propertyOnlyCount = 0;
    let unisolatedCount = 0;
    let rlsDisabledCount = 0;

    for (const row of tables) {
      const tableName = row.table_name;
      const rlsEnabled = row.rls_enabled;
      const columns = row.columns || [];
      const policyCount = parseInt(row.policy_count, 10);

      const hasTenantId = columns.includes('tenant_id');
      const hasPropertyId = columns.includes('property_id');

      let isolationType = '';
      if (hasTenantId && hasPropertyId) {
        isolationType = 'Both (Tenant & Property)';
        fullyIsolatedCount++;
      } else if (hasTenantId) {
        isolationType = 'Tenant Only';
        tenantOnlyCount++;
      } else if (hasPropertyId) {
        isolationType = 'Property Only';
        propertyOnlyCount++;
      } else {
        isolationType = 'None';
        unisolatedCount++;
      }

      if (!rlsEnabled) {
        rlsDisabledCount++;
      }

      results.push({
        tableName,
        rlsEnabled,
        policyCount,
        hasTenantId,
        hasPropertyId,
        isolationType
      });
    }

    // Print summaries
    console.log("=== ISOLATION SUMMARY ===");
    console.log(`Total Tables: ${results.length}`);
    console.log(`Fully Isolated (Both Columns): ${fullyIsolatedCount}`);
    console.log(`Tenant Isolated Only: ${tenantOnlyCount}`);
    console.log(`Property Isolated Only: ${propertyOnlyCount}`);
    console.log(`Not Isolated (Missing Columns): ${unisolatedCount}`);
    console.log(`RLS Enabled: ${results.length - rlsDisabledCount}`);
    console.log(`RLS Disabled: ${rlsDisabledCount}`);
    console.log("=========================\n");

    // Write markdown report
    const reportPath = path.join(__dirname, 'isolation_report.md');
    let md = `# Database Isolation Audit Report\n\n`;
    md += `Generated on: ${new Date().toISOString()}\n\n`;
    
    md += `## Summary Metrics\n\n`;
    md += `| Metric | Count | Percentage |\n`;
    md += `| --- | --- | --- |\n`;
    md += `| **Total Tables** | ${results.length} | 100% |\n`;
    md += `| **Fully Isolated (Tenant & Property Columns)** | ${fullyIsolatedCount} | ${(fullyIsolatedCount/results.length*100).toFixed(1)}% |\n`;
    md += `| **Tenant Column Only** | ${tenantOnlyCount} | ${(tenantOnlyCount/results.length*100).toFixed(1)}% |\n`;
    md += `| **Property Column Only** | ${propertyOnlyCount} | ${(propertyOnlyCount/results.length*100).toFixed(1)}% |\n`;
    md += `| **Missing Both Columns** | ${unisolatedCount} | ${(unisolatedCount/results.length*100).toFixed(1)}% |\n`;
    md += `| **RLS Enabled** | ${results.length - rlsDisabledCount} | ${((results.length - rlsDisabledCount)/results.length*100).toFixed(1)}% |\n`;
    md += `| **RLS Disabled** | ${rlsDisabledCount} | ${(rlsDisabledCount/results.length*100).toFixed(1)}% |\n\n`;

    md += `## Detailed Table Breakdown\n\n`;
    md += `| Table Name | RLS Enabled | Policies | Has \`tenant_id\` | Has \`property_id\` | Isolation Type |\n`;
    md += `| --- | --- | --- | --- | --- | --- |\n`;

    for (const r of results) {
      md += `| \`${r.tableName}\` | ${r.rlsEnabled ? '🟢 Yes' : '🔴 No'} | ${r.policyCount} | ${r.hasTenantId ? '✅ Yes' : '❌ No'} | ${r.hasPropertyId ? '✅ Yes' : '❌ No'} | ${r.isolationType} |\n`;
    }

    fs.writeFileSync(reportPath, md);
    console.log(`📝 Written detailed markdown report to: ${reportPath}`);

  } catch (err) {
    console.error("❌ Error running isolation audit:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
