import { ApiClient } from './tools/stress-test/utils/api-client';

async function main() {
    const api = new ApiClient();
    const timestamp = Date.now();
    const email = `test_reg_${timestamp}@test.com`;
    console.log(`Attempting to register: ${email}`);

    const success = await api.register(email, 'password123', 'Test Runner', '123456789');
    console.log(`Registration success: ${success}`);

    if (!success) {
        // Try to login to see if it already exists
        const login = await api.login(email, 'password123');
        console.log(`Login success: ${login}`);
    }
}

main();
