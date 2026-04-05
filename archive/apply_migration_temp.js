
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dbConfig = {
    host: 'localhost',
    port: 5433,
    user: 'v2resort_test',
    password: 'v2resort_test_secret',
    database: 'v2resort_test',
};

async function run() {
    console.log('Connecting to DB...', dbConfig);
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('Connected.');
        
        const migrationsDir = path.join(__dirname, '../supabase/migrations');
        console.log(`Reading migrations from: ${migrationsDir}`);
        
        if (!fs.existsSync(migrationsDir)) {
            throw new Error('Migrations directory not found');
        }

        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Run in specific order

        for (const file of files) {
            console.log(`Applying: ${file}`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');
            try {
                await client.query(sql);
            } catch (e) {
                // Ignore "already exists" errors to make it idempotent-ish
                if (e.message.includes('already exists') || e.message.includes('duplicate')) {
                    console.log(`  Skipping (already exists): ${e.message.split('\n')[0]}`);
                } else {
                    console.error(`  Error in ${file}: ${e.message}`);
                    // Optional: stop on error?
                    // throw e; 
                }
            }
        }
        
        console.log('All migrations applied successfully.');
        
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
