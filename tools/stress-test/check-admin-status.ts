// @ts-nocheck
const fs = require('fs');
const path = require('path');

// Manual .env parser
function loadEnv() {
    const envPath = path.join(__dirname, '../../backend/.env');
    if (!fs.existsSync(envPath)) {
        console.error(`.env not found at ${envPath}`);
        return {};
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            let val = parts.slice(1).join('=').trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
            }
            env[key] = val;
        }
    });
    return env;
}

async function checkAdmin() {
    const env = loadEnv();
    const SUPABASE_URL = env['SUPABASE_URL'];
    const SUPABASE_SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] || env['SUPABASE_SERVICE_KEY'];

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('Missing Supabase config in .env');
        return;
    }

    const HEADERS = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        // 1. Check Admin Status
        console.log('Checking Admin Status...');
        const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.admin@v2ecosystem.com&select=*`, { headers: HEADERS });
        if (!userRes.ok) {
            console.error('Error fetching admin:', await userRes.text());
        } else {
            const users = await userRes.json();
            if (users.length === 0) {
                console.log('Admin user not found in database.');
            } else {
                console.log('Admin User Status:', JSON.stringify(users[0], null, 2));
            }
        }

        // 2. Check Security Logs
        console.log('\nChecking Recent Security Logs...');
        const logRes = await fetch(`${SUPABASE_URL}/rest/v1/security_audit_log?select=*&order=created_at.desc&limit=20`, { headers: HEADERS });
        if (!logRes.ok) {
            console.error('Error fetching logs:', await logRes.text());
        } else {
            const logs = await logRes.json();
            console.log('Total logs found:', logs.length);
            logs.forEach(log => {
                console.log(`[${log.created_at}] ${log.event_type} (${log.severity}): ${log.description}`);
                if (log.metadata) console.log(`  Metadata: ${log.metadata}`);
            });
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

checkAdmin();
