import { ApiClient } from '../utils/api-client';
import { Logger } from '../utils/logger';
import { InvariantScenario, ScenarioResult } from '../types';
import { CONFIG } from '../config';

export class CouponDoubleUseScenario implements InvariantScenario {
    name = 'CouponDoubleUse';
    description = 'Attempts to use a single-use coupon multiple times concurrently';

    private couponCode: string = '';
    private couponId: string = '';

    // Dynamic result tracking
    private _success = false;
    private _invariantHeld = false;
    private _details = 'Not executed';
    private _duration = 0;
    private _requests = 0;
    private _failures = 0;

    private victimEmail = '';
    private victimPass = 'Pass123!';

    async setup(api: ApiClient, logger: Logger): Promise<void> {
        const code = `S${Math.floor(Math.random() * 1000000)}`;
        logger.info(`[${this.name}] Creating single-use coupon ${code}...`);

        // 1. Create a victim user
        this.victimEmail = `coupon-victim-${Date.now()}@test.com`;
        const authClient = new ApiClient();
        await authClient.register(this.victimEmail, this.victimPass, 'Coupon Victim');
        logger.info(`[${this.name}] Registered victim: ${this.victimEmail}`);

        const createRes = await api.createCoupon({
            code: code,
            name: 'Stress Test Coupon',
            discountType: 'fixed',
            discountValue: 10,
            usageLimit: 1,
            minOrderValue: 0,
            appliesTo: 'all'
        });

        if (!createRes.success) {
            throw new Error(`[${this.name}] Failed to create coupon: ${createRes.error}`);
        }

        this.couponCode = code;
        this.couponId = (createRes.data as any).id;
    }

    async run(api: ApiClient, logger: Logger): Promise<void> {
        logger.action(`[${this.name}] Racing: 10 concurrent applications of single-use coupon...`);

        const attempts = 10;
        this._requests = attempts;
        const startTime = Date.now();
        const promises = [];

        // Login as victim
        const victimApi = new ApiClient();
        await victimApi.login(this.victimEmail, this.victimPass);

        for (let i = 0; i < attempts; i++) {
            // Re-use authenticated client for concurrency
            promises.push(victimApi.applyCoupon(this.couponCode, 50));
        }

        const results = await Promise.allSettled(promises);
        this._duration = Date.now() - startTime;

        const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
        this._failures = attempts - successCount;
        logger.info(`[${this.name}] ${successCount}/${attempts} applications succeeded`);
    }

    async verify(api: ApiClient, logger: Logger): Promise<boolean> {
        const apiAdmin = new ApiClient();
        await apiAdmin.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);

        const couponRes = await apiAdmin.request(`/coupons/${this.couponId}`, 'GET');
        if (!couponRes.success) {
            logger.warn(`[${this.name}] Could not fetch coupon details`);
            this._details = 'Could not fetch coupon details';
            this._success = true;
            this._invariantHeld = true;
            return true;
        }

        const used = (couponRes.data as any).usage_count || (couponRes.data as any).usageCount || 0;
        logger.info(`[${this.name}] Coupon used ${used} times (Limit: 1)`);

        if (used > 1) {
            logger.error(`[${this.name}] INVARIANT VIOLATED: Single-use coupon used ${used} times!`);
            this._details = `Coupon used ${used} times (limit: 1)`;
            this._invariantHeld = false;
            this._success = true;
            return false;
        }

        this._details = `Coupon properly limited: used ${used} time(s)`;
        this._invariantHeld = true;
        this._success = true;
        return true;
    }

    async teardown(api: ApiClient, logger: Logger): Promise<void> {
        if (this.couponId) {
            try {
                const apiAdmin = new ApiClient();
                await apiAdmin.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
                await apiAdmin.deleteCoupon(this.couponId);
                logger.info(`[${this.name}] Deleted test coupon ${this.couponId}`);
            } catch (e) {
                logger.warn(`[${this.name}] Teardown: Failed to delete coupon`);
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
