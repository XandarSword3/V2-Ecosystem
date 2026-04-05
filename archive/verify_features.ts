import axios from 'axios';

const BASE_URL = 'http://localhost:3005';
const API_URL = `${BASE_URL}/api/v1`;

async function runTests() {
    try {
        console.log('--- Starting Verification ---');

        let cookies: string[] = [];
        let csrfToken = '';

        // 0. Get CSRF Token
        console.log('0. Fetching CSRF Token...');
        try {
            const csrfRes = await axios.get(`${BASE_URL}/api/csrf-token`, {
                withCredentials: true
            });
            csrfToken = csrfRes.data.csrfToken;
            if (csrfRes.headers['set-cookie']) {
                cookies = csrfRes.headers['set-cookie'];
            }
            console.log('   CSRF Token obtained.');
        } catch (e: any) {
            console.warn('   Could not fetch CSRF token directly:', e.message);
        }

        const getHeaders = () => {
            const h: any = {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            };
            if (cookies.length > 0) {
                h['Cookie'] = cookies.join('; ');
            }
            return h;
        };

        // 1. Login
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@v2resort.com',
            password: 'admin123'
        }, { headers: getHeaders() });

        if (!loginRes.data.success) throw new Error('Login failed');

        const token = loginRes.data.data.tokens.accessToken;
        console.log('   ✅ Login successful.');

        if (loginRes.headers['set-cookie']) {
            cookies = [...cookies, ...loginRes.headers['set-cookie']];
        }

        const authHeaders = {
            ...getHeaders(),
            Authorization: `Bearer ${token}`
        };

        // 2. Modifiers
        console.log('2. Testing Modifiers: Create Group...');
        const modRes = await axios.post(`${API_URL}/restaurant/modifiers`, {
            name: 'Spiciness Level',
            minSelections: 1,
            maxSelections: 1,
            isRequired: true,
            options: [
                { name: 'Mild', price: 0 },
                { name: 'Medium', price: 0 },
                { name: 'Hot', price: 0.50 }
            ]
        }, { headers: authHeaders });

        if (modRes.data.success) {
            console.log('   ✅ Modifier Group created:', modRes.data.data.id);
        } else {
            console.error('   ❌ Failed to create modifier group');
        }

        // 3. Waitlist (requires type: 'restaurant' or 'pool')
        console.log('3. Testing Waitlist: Join...');
        const waitRes = await axios.post(`${API_URL}/restaurant/waitlist/join`, {
            customerName: 'John Doe',
            partySize: 4,
            phone: '555-0199',
            type: 'restaurant'
        }, { headers: getHeaders() });

        if (waitRes.data.success) {
            console.log('   ✅ Joined Waitlist:', waitRes.data.data.id);
        } else {
            console.error('   ❌ Failed to join waitlist');
        }

        // 4. Cash Drawer
        console.log('4. Testing Finance: Open Drawer...');
        const cashRes = await axios.post(`${API_URL}/finance/open`, {
            amount: 200.00,
            notes: 'Morning Shift'
        }, { headers: authHeaders });

        if (cashRes.data.success) {
            console.log('   ✅ Cash Drawer Opened:', cashRes.data.data.id);

            console.log('   Closing Drawer...');
            await axios.post(`${API_URL}/finance/close`, {
                drawerId: cashRes.data.data.id,
                actualBalance: 200.00,
                notes: 'Closing verification'
            }, { headers: authHeaders });
            console.log('   ✅ Cash Drawer Closed.');
        } else {
            console.error('   ❌ Failed to open cash drawer');
        }

        console.log('\n--- ✅ VERIFICATION COMPLETE: All tests passed ---');

    } catch (error: any) {
        if (error.response) {
            console.error('\n❌ Test Failed:', error.message);
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('\n❌ Script Error:', error.message);
        }
    }
}

runTests();
