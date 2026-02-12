
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';


async function runMigrations() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('Connected to database');

        const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Alphanumeric sort ensures correct timestamp order

        for (const file of files) {
            const fullPath = path.join(migrationsDir, file);
            console.log(`Processing: ${file}`);

            const sql = fs.readFileSync(fullPath, 'utf8');

            try {
                await client.query(sql);
                console.log(`Successfully executed: ${file}`);
            } catch (err: any) {
                // Ignore "relation already exists" or "column already exists" errors
                if (err.code === '42P07' || err.code === '42701') {
                    console.log(`Skipping (already exists): ${file}`);
                    await client.query('ROLLBACK'); // Ensure clean state just in case
                } else {
                    console.warn(`Error executing ${file}: ${err.message}`);
                    await client.query('ROLLBACK'); // Critical: Reset transaction state
                    // Continue? Yes, for now, to try to apply as much as possible
                }
            }
        }
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigrations();
