import { ApiClient } from '../utils/api-client';
import { Logger } from '../utils/logger';
import { InvariantScenario, ScenarioResult } from '../types';
import { CONFIG } from '../config';

export class GDPRRaceScenario implements InvariantScenario {
    name = 'GDPRRace';
    description = 'Attempts data export while simultaneously deleting account';

    private userId: string = '';
    private userEmail: string = '';

    // Dynamic result tracking
    private _success = false;
    private _invariantHeld = false;
    private _details = 'Not executed';
    private _duration = 0;
    private _requests = 2;
    private _failures = 0;

    async setup(api: ApiClient, logger: Logger): Promise<void> {
        this.userEmail = `victim-${Math.floor(Math.random() * 1000000)}@test.com`;

        logger.info(`[${this.name}] Registering victim ${this.userEmail}...`);

        const victimApi = new ApiClient();
        const success = await victimApi.register(this.userEmail, 'Password123!', 'GDPR Victim');

        if (!success) {
            throw new Error(`[${this.name}] Registration failed (verify validation in schemas.ts)`);
        }

        const profile = await victimApi.getProfile();
        if (!profile.success) {
            throw new Error(`[${this.name}] Could not fetch profile`);
        }
        this.userId = (profile.data as any).id;
        logger.info(`[${this.name}] Setup complete. Victim ID: ${this.userId}`);
    }

    async run(api: ApiClient, logger: Logger): Promise<void> {
        logger.action(`[${this.name}] Racing: Export Data vs Delete User...`);

        const startTime = Date.now();

        const victimApi = new ApiClient();
        await victimApi.login(this.userEmail, 'Password123!');

        const adminApi = new ApiClient();
        await adminApi.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);

        // Race: export vs delete simultaneously
        const p1 = victimApi.requestDataExport();
        const p2_admin = adminApi.deleteUser(this.userId);

        const results = await Promise.allSettled([p1, p2_admin]);
        this._duration = Date.now() - startTime;

        results.forEach((res, i) => {
            if (res.status === 'rejected') this._failures++;
            else if (!(res.value as any).success) this._failures++;
        });
    }

    async verify(api: ApiClient, logger: Logger): Promise<boolean> {
        const checkApi = new ApiClient();
        await checkApi.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);

        const userRes = await checkApi.getUserById(this.userId);

        const isDeleted = !userRes.success || (userRes.data && (userRes.data as any).deleted_at);

        if (isDeleted) {
            logger.success(`[${this.name}] User successfully deleted or flagged`);
            this._details = 'User correctly deleted/flagged after race';
            this._invariantHeld = true;
            this._success = true;
            return true;
        } else {
            logger.warn(`[${this.name}] User still exists and is not deleted`);
            this._details = 'User still exists after deletion race';
            this._invariantHeld = false;
            this._success = true;
            return false;
        }
    }

    async teardown(api: ApiClient, logger: Logger): Promise<void> {
        // Ensure user is cleaned up even if verify didn't delete
        if (this.userId) {
            try {
                const adminApi = new ApiClient();
                await adminApi.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
                await adminApi.deleteUser(this.userId);
                logger.info(`[${this.name}] Teardown: Cleaned up user ${this.userId}`);
            } catch (e) {
                // User may already be deleted — that's fine
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
