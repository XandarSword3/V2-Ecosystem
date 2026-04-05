const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://postgres:k8yhxQ8ktbKU8b@db.dfneswicpdprhneeqlsn.supabase.co:5432/postgres";

async function run() {
    const client = new Client({ connectionString });
    try {
        console.log('Connecting to database...');
        await client.connect();

        const migrationPath = path.join(__dirname, '../supabase/migrations/20260213160000_fix_constraints_and_locks.sql');
        console.log(`Reading migration file: ${migrationPath}`);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing migration...');
        await client.query(sql);
        console.log('Migration applied successfully!');

    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
