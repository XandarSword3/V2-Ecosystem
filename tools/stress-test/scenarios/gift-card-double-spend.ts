import { ApiClient } from '../utils/api-client';
import { Logger } from '../utils/logger';
import { InvariantScenario, ScenarioResult } from '../types';
import { CONFIG } from '../config';

export class GiftCardDoubleSpendScenario implements InvariantScenario {
    name = 'GiftCardDoubleSpend';
    description = 'Attempts to redeem the same gift card multiple times concurrently';

    private giftCardCode: string = '';
    private giftCardId: string = '';
    private targetAmount = 100;

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
        // 1. Create a victim user who owns the card
        this.victimEmail = `victim-${Date.now()}@test.com`;
        const authClient = new ApiClient();
        await authClient.register(this.victimEmail, this.victimPass, 'GiftCard Victim');
        const loginSuccess = await authClient.login(this.victimEmail, this.victimPass);
        if (!loginSuccess) throw new Error('Failed to login victim');

        logger.info(`[${this.name}] Registered victim: ${this.victimEmail}`);

        // 2. Initial Setup (as Admin)
        logger.info(`[${this.name}] Setting up: Creating $${this.targetAmount} gift card...`);

        const templatesRes = await api.getGiftCardTemplates();
        if (!templatesRes.success || !templatesRes.data || templatesRes.data.length === 0) {
            throw new Error('Failed to get gift card templates or none available');
        }

        const template = templatesRes.data.find((t: any) => t.name === 'Classic') || templatesRes.data[0];
        const templateId = template.id;
        logger.info(`[${this.name}] Using template: ${template.name} (${templateId})`);

        // Purchase card as the victim (requires auth)
        const purchaseRes = await authClient.purchaseGiftCard({
            templateId,
            amount: this.targetAmount,
            recipientName: 'Test Victim',
            recipientEmail: this.victimEmail,
            message: 'Stress test card',
            paymentMethod: 'card'
        });

        if (!purchaseRes.success || !purchaseRes.data.code) {
            throw new Error(`Failed to purchase gift card: ${purchaseRes.error}`);
        }

        this.giftCardCode = purchaseRes.data.code;
        this.giftCardId = purchaseRes.data.id;
        logger.success(`[${this.name}] Created gift card ${this.giftCardCode}`);
    }

    async run(api: ApiClient, logger: Logger): Promise<void> {
        logger.action(`[${this.name}] Launching 10 concurrent redemption attempts...`);

        const attempts = 10;
        this._requests = attempts;
        const startTime = Date.now();
        const promises = [];

        // We need an authenticated client for the victim
        // Since ApiClient handles replay protection internally, using one instance might serialize if locking on token refresh or something
        // checking request implementation... it has 'isReplay' flag. fetch is async.
        // It's safer to use one authenticated client instance if token management is instance-specific.

        const victimApi = new ApiClient();
        await victimApi.login(this.victimEmail, this.victimPass);

        for (let i = 0; i < attempts; i++) {
            // For true concurrency test with fetch, firing all promises from same client is fine
            // provided the client doesn't lock internally. ApiClient seems stateless regarding request queue.
            promises.push(victimApi.redeemGiftCard(this.giftCardCode, this.targetAmount));
        }

        const results = await Promise.allSettled(promises);
        this._duration = Date.now() - startTime;

        const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
        this._failures = attempts - successCount;
        logger.info(`[${this.name}] Results: ${successCount} successes out of ${attempts}`);
    }

    async verify(api: ApiClient, logger: Logger): Promise<boolean> {
        const checkRes = await api.checkGiftCardBalance(this.giftCardCode);
        if (!checkRes.success) {
            logger.error(`[${this.name}] Failed to check balance`);
            this._details = 'Failed to check balance';
            this._invariantHeld = false;
            this._success = false;
            return false;
        }

        const balance = parseFloat(checkRes.data.balance);
        logger.info(`[${this.name}] Final Balance: $${balance}`);

        if (balance < 0) {
            logger.error(`[${this.name}] INVARIANT VIOLATED: Negative balance $${balance}`);
            this._details = `Negative balance: $${balance}`;
            this._invariantHeld = false;
            this._success = true;
            return false;
        }

        this._details = `Balance verified: $${balance} >= 0`;
        this._invariantHeld = true;
        this._success = true;
        return true;
    }

    async teardown(api: ApiClient, logger: Logger): Promise<void> {
        if (this.giftCardId) {
            try {
                await api.disableGiftCard(this.giftCardId);
                logger.info(`[${this.name}] Disabled gift card ${this.giftCardId}`);
            } catch (e) {
                logger.warn(`[${this.name}] Teardown: Failed to disable gift card`);
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
