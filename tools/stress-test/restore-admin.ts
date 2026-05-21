// @ts-nocheck
const fs = require('fs');
const path = require('path');

async function restoreAdmin() {
    const envPath = path.join(__dirname, '../../backend/.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        }
    });

    const SUPABASE_URL = env['SUPABASE_URL'];
    const SUPABASE_SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] || env['SUPABASE_SERVICE_KEY'];

    const HEADERS = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
    };

    const email = 'admin@v2ecosystem.com';
    console.log(`Restoring ${email}...`);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${email}`, { headers: HEADERS });
    const users = await res.json();
    if (!users.length) {
        console.error('Admin not found!');
        return;
    }

    const user = users[0];
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({
            deleted_at: null,
            is_active: true
        })
    });

    if (updateRes.ok) {
        console.log('Admin account restored successfully!');
    } else {
        console.error('Failed to restore admin:', await updateRes.text());
    }
}

restoreAdmin();
