import axios from 'axios';

// Supabase Management API to reload PostgREST schema cache
const PROJECT_REF = 'dfneswicpdprhneeqlsn';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbmVzd2ljcGRwcmhuZWVxbHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA5NDIzNSwiZXhwIjoyMDgyNjcwMjM1fQ.N1pHUMHaQWDevK1CIG6pN8re5Qr2cX5jfJSoE9UoHP8';

async function reloadSchema() {
    console.log('Reloading PostgREST schema cache...');

    // Method 1: Use rpc to execute NOTIFY
    try {
        const res = await axios.post(
            `${SUPABASE_URL}/rest/v1/rpc/reload_schema`,
            {},
            {
                headers: {
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('RPC Response:', res.status);
    } catch (e: any) {
        console.log('RPC reload_schema not found (expected). Trying alternative...');
    }

    // Method 2: Just verify the tables exist by querying
    try {
        const res = await axios.get(
            `${SUPABASE_URL}/rest/v1/`,
            {
                headers: {
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                }
            }
        );
        console.log('Available tables:', Object.keys(res.data || {}).slice(0, 20).join(', '));
    } catch (e: any) {
        console.log('Could not list tables.');
    }

    // Method 3: Try to insert/select from the problem tables
    console.log('\nTesting waitlist_entries columns...');
    try {
        const res = await axios.get(
            `${SUPABASE_URL}/rest/v1/waitlist_entries?select=id,customer_name,type,phone,party_size,status&limit=1`,
            {
                headers: {
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                }
            }
        );
        console.log('✅ Waitlist columns accessible! Status:', res.status);
    } catch (e: any) {
        if (e.response) {
            console.log('❌ Waitlist error:', e.response.status, e.response.data?.message || e.response.data);
        } else {
            console.log('❌ Error:', e.message);
        }
    }

    console.log('\nTesting menu_modifier_groups...');
    try {
        const res = await axios.get(
            `${SUPABASE_URL}/rest/v1/menu_modifier_groups?select=id,name&limit=1`,
            {
                headers: {
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                }
            }
        );
        console.log('✅ Modifiers table accessible! Status:', res.status);
    } catch (e: any) {
        if (e.response) {
            console.log('❌ Modifiers error:', e.response.status, e.response.data?.message || e.response.data);
        } else {
            console.log('❌ Error:', e.message);
        }
    }

    console.log('\nTesting cash_drawers...');
    try {
        const res = await axios.get(
            `${SUPABASE_URL}/rest/v1/cash_drawers?select=id,status&limit=1`,
            {
                headers: {
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                }
            }
        );
        console.log('✅ Cash drawers table accessible! Status:', res.status);
    } catch (e: any) {
        if (e.response) {
            console.log('❌ Cash drawers error:', e.response.status, e.response.data?.message || e.response.data);
        } else {
            console.log('❌ Error:', e.message);
        }
    }
}

reloadSchema();
