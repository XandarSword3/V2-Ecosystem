import axios from 'axios';

const BASE_URL = 'http://localhost:3005';
const API_URL = `${BASE_URL}/api/v1`;

// Verification Results Container
const results = {
    roles: { success: false, findings: [] as string[] },
    dataPopulation: { success: false, items: [] as string[] },
    customerJourney: { success: false, steps: [] as string[] },
    moduleIsolation: { success: false, notes: [] as string[] }
};

let adminToken = '';
let customerToken = '';
let csrfToken = '';
let cookies: string[] = [];

// Modules Dictionary (Slug -> ID)
const moduleIds: Record<string, string> = {};

async function verifyGymScenario() {
    console.log('=== SCENARIO 1: GYM VERIFICATION & CUSTOMER JOURNEY ===\n');

    try {
        // 1. SETUP: Auth & ID Retrieval
        await setup();
        await fetchModuleIds();

        // 2. PHASE 3: Roles Verification
        await verifyRoles();

        // 3. PHASE 4: Content Population (Admin)
        await populateGymContent();

        // 4. PHASE 4: Customer Journey (User)
        await simulateCustomerJourney();

        // 5. Final Report
        printReport();

    } catch (error: any) {
        console.error('FATAL ERROR:', error.message);
        if (error.response) console.error('Response:', error.response.status, error.response.data);
    }
}

async function setup() {
    console.log('1. Setup operations...');
    // CSRF
    try {
        const csrfRes = await axios.get(`${BASE_URL}/api/csrf-token`, { withCredentials: true });
        csrfToken = csrfRes.data.csrfToken || '';
        if (csrfRes.headers['set-cookie']) cookies = csrfRes.headers['set-cookie'];
    } catch (e) { console.log('   ⚠️ CSRF Token fetch failed'); }

    function getHeaders(token?: string) {
        return {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            'Authorization': token ? `Bearer ${token}` : undefined,
            'Cookie': cookies.join('; ')
        };
    }

    // Admin Login
    const adminRes = await axios.post(`${API_URL}/auth/login`, {
        email: 'admin@v2resort.com', password: 'admin123'
    }, { headers: getHeaders() });
    adminToken = adminRes.data.data.tokens.accessToken;
    console.log('   ✅ Admin logged in');

    // Customer Creation via Admin API
    const customerEmail = `gymuser_${Date.now()}@example.com`;

    try {
        await axios.post(`${API_URL}/admin/users`, {
            email: customerEmail,
            password: 'Password123!',
            full_name: 'Gym Customer',
            phone: '+15550000000',
            roles: ['customer']
        }, { headers: getHeaders(adminToken) });
        console.log(`   ✅ Customer created: ${customerEmail}`);
    } catch (e: any) {
        console.log('   Warning: Customer creation failed:', e.response?.data?.message || e.message);
    }

    // Customer Login
    const custRes = await axios.post(`${API_URL}/auth/login`, {
        email: customerEmail, password: 'Password123!'
    }, { headers: getHeaders() });
    customerToken = custRes.data.data.tokens.accessToken;
    console.log('   ✅ Customer logged in');
}

function getHeaders(token?: string) {
    return {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'Authorization': token ? `Bearer ${token}` : undefined,
        'Cookie': cookies.join('; ')
    };
}

async function fetchModuleIds() {
    console.log('   Fetching module IDs...');
    const res = await axios.get(`${API_URL}/admin/modules`, { headers: getHeaders(adminToken) });
    const modules = res.data.data;

    const targets = ['fitness-classes', 'personal-training', 'nutrition-store'];
    targets.forEach(slug => {
        const m = modules.find((x: any) => x.slug === slug);
        if (m) {
            moduleIds[slug] = m.id;
            console.log(`     Found ${slug}: ${m.id}`);
        } else {
            console.error(`     ❌ Module ${slug} not found!`);
        }
    });
}

async function verifyRoles() {
    console.log('\n2. Verifying Roles & Permissions (Phase 3)...');
    const res = await axios.get(`${API_URL}/admin/roles`, { headers: getHeaders(adminToken) });
    const roles = res.data.data;

    const expectedRoles = [
        'fitness-classes_admin', 'fitness-classes_staff',
        'personal-training_admin', 'personal-training_staff',
        'nutrition-store_admin', 'nutrition-store_staff'
    ];

    let missing = [];
    expectedRoles.forEach(r => {
        if (roles.find((x: any) => x.name === r)) {
            results.roles.findings.push(`✅ Role found: ${r}`);
        } else {
            results.roles.findings.push(`❌ Role MISSING: ${r}`);
            missing.push(r);
        }
    });

    if (missing.length === 0) {
        results.roles.success = true;
        console.log('   ✅ All auto-generated roles verified.');
    } else {
        console.log('   ❌ Missing roles:', missing.join(', '));
    }
}

async function populateGymContent() {
    console.log('\n3. Populating Gym Content (Phase 4)...');

    // 1. Nutrition Store (Menu Service)
    if (moduleIds['nutrition-store']) {
        console.log('   Populating Nutrition Store...');
        const mid = moduleIds['nutrition-store'];

        // Create Categories - Correct Endpoint: /restaurant/admin/categories
        try {
            const catRes = await axios.post(`${API_URL}/restaurant/admin/categories`, {
                name: 'Supplements',
                description: 'Protein and Vitamins',
                moduleId: mid
            }, { headers: getHeaders(adminToken) });
            const catId = catRes.data.data.id;

            // Create Item - Correct Endpoint
            await axios.post(`${API_URL}/restaurant/admin/items`, {
                categoryId: catId,
                name: 'Whey Protein Isolate',
                description: 'Chocolate flavor, 5lbs',
                price: 79.99,
                moduleId: mid
            }, { headers: getHeaders(adminToken) });

            results.dataPopulation.items.push('✅ Created Category: Supplements');
            results.dataPopulation.items.push('✅ Created Item: Whey Protein Isolate');
        } catch (e: any) {
            console.log('     Failed to populate nutrition store:', e.response?.data?.message || e.message);
            results.dataPopulation.items.push(`❌ Nutrition Store Population Failed: ${e.response?.data?.message || e.message}`);
        }
    }

    // 2. Fitness Classes (Session/Pool Service)
    if (moduleIds['fitness-classes']) {
        console.log('   Populating Fitness Classes...');
        const mid = moduleIds['fitness-classes'];

        // Create Session Type (Morning Yoga)
        try {
            // Endpoint /pool/admin/sessions
            const sessionRes = await axios.post(`${API_URL}/pool/admin/sessions`, {
                module_id: mid,
                name: 'Morning Yoga Flow',
                description: 'Start your day with zen',
                start_time: '08:00',
                end_time: '09:00',
                capacity: 20,
                price: 15.00
            }, { headers: getHeaders(adminToken) });

            results.dataPopulation.items.push('✅ Created Session: Morning Yoga Flow');
        } catch (e: any) {
            console.log('     Failed to populate fitness class:', e.response?.data?.message || e.message);
            if (e.response?.data) console.log('     Details:', JSON.stringify(e.response.data, null, 2));
            results.dataPopulation.items.push(`❌ Fitness Class Population Failed: ${e.response?.data?.message || e.message}`);
        }
    }

    results.dataPopulation.success = true;
}

async function simulateCustomerJourney() {
    console.log('\n4. Simulating Customer Journey...');

    // 1. Browse Nutrition Store
    if (moduleIds['nutrition-store']) {
        try {
            const mid = moduleIds['nutrition-store'];
            const menuRes = await axios.get(`${API_URL}/restaurant/menu?moduleId=${mid}`, {
                headers: getHeaders(customerToken)
            });

            const hasItems = menuRes.data.data.items?.length > 0;
            if (hasItems) {
                results.customerJourney.steps.push('✅ Customer can view Nutrition Store products');
            } else {
                results.customerJourney.steps.push('❌ Nutrition Store empty for customer');
            }
        } catch (e: any) {
            results.customerJourney.steps.push(`❌ Customer failed to view Nutrition Store: ${e.message}`);
        }
    }

    // 2. Browse Fitness Classes
    if (moduleIds['fitness-classes']) {
        try {
            const mid = moduleIds['fitness-classes'];

            const sessRes = await axios.get(`${API_URL}/pool/sessions`, {
                headers: getHeaders(customerToken),
                params: { moduleId: mid } // Query param camelCase
            });

            const sessions = sessRes.data.data || [];
            const yoga = sessions.find((s: any) => s.name === 'Morning Yoga Flow');

            if (yoga) {
                results.customerJourney.steps.push('✅ Customer found "Morning Yoga Flow"');

                // Attempt Booking (Purchase Ticket)
                // Endpoint: POST /api/v1/pool/tickets
                try {
                    const bookRes = await axios.post(`${API_URL}/pool/tickets`, {
                        sessionId: yoga.id,
                        ticketDate: new Date().toISOString().split('T')[0],
                        customerName: 'Gym Customer',
                        customerPhone: '+15550000000',
                        numberOfGuests: 1,
                        numberOfAdults: 1,
                        paymentMethod: 'cash'
                    }, { headers: getHeaders(customerToken) });

                    if (bookRes.data.success) {
                        results.customerJourney.steps.push('✅ Customer successfully booked Yoga Class');
                    }
                } catch (e: any) {
                    results.customerJourney.steps.push(`❌ Booking failed: ${e.response?.data?.message || e.message}`);
                }
            } else {
                results.customerJourney.steps.push('❌ "Morning Yoga Flow" not found in user list');
            }
        } catch (e: any) {
            results.customerJourney.steps.push(`❌ Customer failed to view Classes: ${e.message}`);
        }
    }
}

function printReport() {
    console.log('\n\n=== VERIFICATION REPORT ===');

    results.roles.findings.forEach(f => console.log(`  ${f}`));
    results.dataPopulation.items.forEach(i => console.log(`  ${i}`));
    results.customerJourney.steps.forEach(s => console.log(`  ${s}`));

    const roleSuccess = results.roles.findings.filter(f => f.startsWith('✅')).length;
    const journeySuccess = results.customerJourney.steps.filter(s => s.startsWith('✅')).length;
    console.log(`\nVerified Roles: ${roleSuccess}/6`);
    console.log(`Verified Journey Steps: ${journeySuccess}/3`);
}

verifyGymScenario();
