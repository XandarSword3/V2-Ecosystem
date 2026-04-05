import { ApiClient } from '../utils/api-client';
import { Logger } from '../utils/logger';
import { InvariantScenario, ScenarioResult } from '../types';
import { CONFIG } from '../config';

export class LoyaltyRaceScenario implements InvariantScenario {
    name = 'LoyaltyRace';
    description = 'Concurrent loyalty point adjustments and tier updates';

    private userId: string = '';
    private userEmail: string = '';

    // Dynamic result tracking
    private _success = false;
    private _invariantHeld = false;
    private _details = 'Not executed';
    private _duration = 0;
    private _requests = 0;
    private _failures = 0;

    async setup(api: ApiClient, logger: Logger): Promise<void> {
        this.userEmail = `loyalty-race-${Date.now()}@test.com`;
        await api.register(this.userEmail, 'Password123!', 'Loyalty Racer');

        const profile = await api.getProfile();
        this.userId = profile.data.id;

        await api.enrollLoyalty();

        const adminApi = new ApiClient();
        await adminApi.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
        await adminApi.earnLoyaltyPoints({
            userId: this.userId,
            points: 100,
            description: 'Initial Setup'
        });
    }

    async run(api: ApiClient, logger: Logger): Promise<void> {
        logger.action(`[${this.name}] Racing: Earn 50 vs Redeem 100...`);
        this._requests = 2;
        const startTime = Date.now();

        const adminApi = new ApiClient();
        const loggedIn = await adminApi.loginWithRetry(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
        if (!loggedIn) {
            throw new Error('Admin login failed after retries');
        }

        const p1 = adminApi.earnLoyaltyPoints({
            userId: this.userId,
            points: 50,
            description: 'Race Earn'
        });

        const p2 = adminApi.redeemLoyaltyPoints({
            userId: this.userId,
            points: 100
        });

        const results = await Promise.allSettled([p1, p2]);
        this._duration = Date.now() - startTime;

        results.forEach((res, index) => {
            if (res.status === 'rejected') {
                this._failures++;
                logger.error(`[${this.name}] Request ${index + 1} REJECTED: ${res.reason}`);
            } else {
                if (!res.value.success) {
                    this._failures++;
                    logger.error(`[${this.name}] Request ${index + 1} FAILED API: ${res.value.error}`);
                } else {
                    logger.info(`[${this.name}] Request ${index + 1} SUCCESS: Balance ${res.value.data.newBalance}`);
                }
            }
        });
    }

    async verify(api: ApiClient, logger: Logger): Promise<boolean> {
        const loyaltyRes = await api.getMyLoyalty();
        const points = (loyaltyRes.data as any).available_points;

        logger.info(`[${this.name}] Final Points: ${points}`);

        // With 100 points setup, user hits Silver tier (1.3x multiplier).
        // Earn 50 * 1.3 = 65.
        // Balance: 100 + 65 - 100 = 65.
        // If lost update occurred, it would be 0 or 100 or 165.
        // So 65 is CORRECT behavior with tiers.
        if (points !== 50 && points !== 65) {
            logger.error(`[${this.name}] SUSPICIOUS: Points are ${points}, expected 50 or 65. Potential Lost Update!`);
            this._details = `Points: ${points}, expected 50/65`;
            this._invariantHeld = false;
            this._success = true;
            return false;
        }

        this._details = `Points verified (${points})`;

        this._invariantHeld = true;
        this._success = true;
        logger.success(`[${this.name}] Points verified (${points})`);
        return true;
    }

    async teardown(api: ApiClient, logger: Logger): Promise<void> {
        // Clean up test user
        if (this.userId) {
            try {
                const adminApi = new ApiClient();
                await adminApi.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
                await adminApi.deleteUser(this.userId);
                logger.info(`[${this.name}] Deleted test user ${this.userId}`);
            } catch (e) {
                logger.warn(`[${this.name}] Teardown: Failed to delete test user`);
            }
        }
    }

    getResult(): ScenarioResult {
        return {
            name: this.name,
            success: this._success,
            invariantHeld: this._invariantHeld,
            details: this._details,
            metrics: { duration: this._duration, requests: this._requests, failures: this._failures }
        };
    }
}
