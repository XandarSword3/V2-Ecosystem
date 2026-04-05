const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function applySql() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL not found in .env');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        const sqlPath = path.join(__dirname, '../backend/supabase/migrations/20260213000000_atomic_loyalty.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying SQL: 20260213000000_atomic_loyalty.sql');
        await pool.query(sql);
        console.log('✅ SQL applied successfully');
    } catch (err) {
        console.error('❌ Failed to apply SQL:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

applySql();
