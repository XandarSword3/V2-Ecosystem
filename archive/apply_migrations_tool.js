
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const dbConfig = {
    host: 'localhost',
    port: 5433,
    user: 'v2resort_test',
    password: 'v2resort_test_secret',
    database: 'v2resort_test',
};

async function run() {
    const client = new Client(dbConfig);
    try {
        await client.connect();
        console.log('Connected to DB.');

        // 1. Reset Schema (Clean Start)
        console.log('Resetting public schema...');
        await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
        await client.query('CREATE SCHEMA public;');
        await client.query('GRANT ALL ON SCHEMA public TO "v2resort_test";');
        await client.query('GRANT ALL ON SCHEMA public TO public;');

        // 2. Setup Extensions
        console.log('Setting up extensions...');
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
        await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
        
        // 3. Setup Shims (Auth, Users)
        console.log('Setting up auth shim and users table...');
        await client.query(`CREATE SCHEMA IF NOT EXISTS auth;`);
        
        // Create users table (mirroring Supabase auth.users or public.users usage)
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email TEXT UNIQUE,
                encrypted_password TEXT,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                last_sign_in_at TIMESTAMPTZ,
                raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
                raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
                is_super_admin BOOLEAN DEFAULT false,
                phone TEXT,
                phone_confirmed_at TIMESTAMPTZ,
                confirmation_token TEXT,
                email_confirmed_at TIMESTAMPTZ DEFAULT NOW(),
                recovery_token TEXT -- Simple list of common potential columns
            );
        `);
        
        // Mock auth functions if not present
        try {
            await client.query(`
                CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
                SELECT null::uuid;
                $$ LANGUAGE SQL STABLE;
                
                CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
                SELECT 'anon';
                $$ LANGUAGE SQL STABLE;
                 
                 CREATE OR REPLACE FUNCTION auth.email() RETURNS text AS $$
                SELECT null::text;
                $$ LANGUAGE SQL STABLE;
            `);
        } catch (e) { console.log('Auth shim functions already exist or failed:', e.message); }

        // 4. Apply Migrations
        // Move up from backend to superbase/migrations
        const migrationsDir = path.join(__dirname, '../supabase/migrations');
        const files = fs.readdirSync(migrationsDir).sort();

        let successCount = 0;
        let failCount = 0;

        for (const file of files) {
            if (!file.endsWith('.sql')) continue;
            console.log(`Applying: ${file}`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            try {
                // Handle basic transaction per file
                 await client.query(sql);
                successCount++;
            } catch (err) {
                console.error(`Error in ${file}:`, err.message);
                failCount++;
                try { await client.query('ROLLBACK'); } catch (e) {}
            }
        }

        console.log(`Migration Summary: ${successCount} succeeded, ${failCount} failed.`);
        if (failCount > 0) {
            console.warn('Some migrations failed. Check logs.');
        }

    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await client.end();
    }
}

run();
