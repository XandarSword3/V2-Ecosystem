import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

async function main() {
    dotenv.config();
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260213160000_fix_constraints_and_locks.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL by semicolons (naive approach, but works for simple migrations)
    // Note: This won't handle semicolons inside function bodies correctly if not careful.
    // Better: use a robust regex or just execute the Part 1 and Part 2 separately.

    // Let's manually identify the blocks.
    const parts = sql.split('-- ==========================================');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Supabase often requires SSL
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (!part) continue;

            console.log(`Executing Part ${i}...`);
            try {
                // Statements within functions have nested semicolons. 
                // pg-client can handle multiple statements if they are in one string.
                await client.query(part);
                console.log(`Part ${i} success.`);
            } catch (err: any) {
                console.error(`ERROR IN PART ${i}:`);
                console.error('Message:', err.message);
                console.error('Constraint:', err.constraint);
                console.error('Data:', err.detail);
                // Don't throw, try to continue to see if other parts work 
                // (though usually we want to stop on error)
            }
        }
    } catch (err: any) {
        console.error('CRITICAL ERROR:', err.message);
    } finally {
        await client.end();
    }
}

main();
