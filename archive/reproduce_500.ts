import axios from 'axios';

const API_URL = 'http://localhost:3005/api/v1';

async function reproduce() {
    console.log('Attempting to create session_access module...');

    // Gets CSRF token
    const csrfRes = await axios.get('http://localhost:3005/api/csrf-token', { withCredentials: true });
    const csrfToken = csrfRes.data.csrfToken;
    const cookie = csrfRes.headers['set-cookie'] || [];

    // Login
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
        email: 'admin@v2resort.com',
        password: 'admin123'
    }, {
        headers: { 'x-csrf-token': csrfToken, 'Cookie': cookie.join('; ') }
    });
    const token = loginRes.data.data.tokens.accessToken;
    const authCookie = loginRes.headers['set-cookie'] ? [...cookie, ...loginRes.headers['set-cookie']] : cookie;

    try {
        const res = await axios.post(`${API_URL}/admin/modules`, {
            template_type: 'session_access',
            name: 'Test Fitness',
            slug: 'test-fitness',
            description: 'Test module',
            settings: {
                icon: 'Dumbbell'
            }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-csrf-token': csrfToken,
                'Cookie': authCookie.join('; ')
            }
        });
        console.log('Success:', res.data);
    } catch (e: any) {
        console.log('Error:', e.response?.status, e.response?.data);
    }
}

reproduce();
