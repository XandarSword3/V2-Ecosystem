import { ApiClient } from './utils/api-client';
import { CONFIG } from './config';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function stressLogin() {
    console.log('Starting Login Stress Test (10 attempts)...');
    const api = new ApiClient(); // Base URL from config
    let successCount = 0;

    for (let i = 0; i < 10; i++) {
        try {
            console.log(`\nAttempt ${i + 1}:`);
            await api.fetchCsrfToken();
            const res = await api.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
            if (res) {
                console.log(`✅ Success`);
                successCount++;
            } else {
                console.log(`❌ Failed (res=false)`);
            }
        } catch (e: any) {
            console.log(`💥 Exception: ${e.message}`);
        }
        await delay(500); // 500ms delay
    }

    console.log(`\nSummary: ${successCount}/10 Logins Successful`);
}

stressLogin().catch(console.error);
