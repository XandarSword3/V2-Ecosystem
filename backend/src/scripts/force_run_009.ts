
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Fix SSL issue for local
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function runSpecificMigration() {
    try {
        console.log("Connecting...");
        const client = await pool.connect();
        console.log("Connected.");

        const filePath = path.join(__dirname, '../database/migrations/009_add_settings_version.sql');
        const sql = fs.readFileSync(filePath, 'utf8');

        console.log("Running SQL...");
        await client.query(sql);
        console.log("Done.");
        client.release();
        await pool.end();
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

runSpecificMigration();
