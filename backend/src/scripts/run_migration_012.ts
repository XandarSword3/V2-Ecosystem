
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function runMigration() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL missing');
        return;
    }

    const pool = new Pool({ connectionString, ssl: false });
    const client = await pool.connect();

    try {
        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '012_session_ingredients.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log("Applying migration 012...");
        await client.query('BEGIN');
        await client.query(sql);
        // Also mark as applied in _migrations to avoid run-migrations attempting it again
        await client.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', ['012_session_ingredients.sql']);
        await client.query('COMMIT');

        console.log("Migration 012 applied successfully!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
