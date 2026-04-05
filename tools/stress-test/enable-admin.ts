import * as fs from 'fs';
import * as path from 'path';

// Manual .env parser
function loadEnv() {
    const envPath = path.join(__dirname, '../../backend/.env');
    if (!fs.existsSync(envPath)) {
        console.error(`.env not found at ${envPath}`);
        return {};
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const env: Record<string, string> = {};
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            // Handle quoted values
            let val = parts.slice(1).join('=').trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
            }
            env[key] = val;
        }
    });
    return env;
}

const env = loadEnv();
const SUPABASE_URL = env['SUPABASE_URL'];
const SUPABASE_SERVICE_KEY = env['SUPABASE_SERVICE_KEY'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials in .env');
    console.log('Keys found:', Object.keys(env));
    process.exit(1);
}

const HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

async function enableAdmin() {
    const email = 'admin@v2resort.com';
    console.log(`Enabling account for ${email} via REST API...`);
    console.log(`Supabase URL: ${SUPABASE_URL}`);

    // 1. Get user
    const url = `${SUPABASE_URL}/rest/v1/users?email=eq.${email}`;

    try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

        const users = await res.json();
        if (!users || users.length === 0) {
            console.error('User not found!');
            return;
        }

        const user = users[0];
        console.log(`Found user: ${user.id} (Active: ${user.is_active})`);

        // 2. Update
        if (!user.is_active) {
            const updateUrl = `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`;
            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers: HEADERS,
                body: JSON.stringify({ is_active: true })
            });

            if (!updateRes.ok) {
                const err = await updateRes.text();
                console.error('Update failed:', err);
            } else {
                console.log('Successfully enabled admin account!');
            }
        } else {
            console.log('Account is already active.');
        }

    } catch (e) {
        console.error('Exception:', e);
    }
}

enableAdmin().catch(console.error);
