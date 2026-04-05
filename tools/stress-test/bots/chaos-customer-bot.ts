import { ApiClient } from '../utils/api-client';
import { Logger, globalMetrics } from '../utils/logger';
import { CustomerBot } from './customer-bot';

/**
 * ChaosCustomerBot — extends CustomerBot with disruptive/adversarial behaviors.
 * Now tracks rejection counts and logs whether the backend correctly rejects invalid inputs.
 */
export class ChaosCustomerBot extends CustomerBot {
    private chaosLogger: Logger;
    private stormCount = 0;
    private abandonCount = 0;
    private boundaryCount = 0;
    private correctRejections = 0;
    private unexpectedAccepts = 0;

    constructor(botId: number) {
        super(botId);
        this.chaosLogger = new Logger('Chaos', botId);
    }

    async start(): Promise<void> {
        this.isRunning = true;
        this.chaosLogger.info('Starting chaotic customer simulation...');

        while (this.isRunning) {
            const actionWeight = Math.random();

            try {
                if (actionWeight < 0.3) {
                    await this.actionStorm();
                } else if (actionWeight < 0.5) {
                    await this.abandonTransaction();
                } else if (actionWeight < 0.7) {
                    await this.boundaryAbuse();
                } else {
                    await super.performRandomAction();
                }
            } catch (e) {
                this.chaosLogger.error(`Chaos action failed: ${e}`);
            }

            const delay = Math.floor(Math.random() * 2000) + 500;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Log chaos summary when stopped
        this.chaosLogger.info(`Chaos Summary: Storms=${this.stormCount} Abandons=${this.abandonCount} Boundary=${this.boundaryCount}`);
        this.chaosLogger.info(`Assertion Summary: Correct Rejections=${this.correctRejections} Unexpected Accepts=${this.unexpectedAccepts}`);
    }

    /**
     * ACTION STORM: Rapidly fire the same request multiple times to test idempotency
     */
    private async actionStorm(): Promise<void> {
        this.stormCount++;
        this.chaosLogger.action('⚡ ACTION STORM: Spamming requests...');

        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(this.api.getRestaurantMenu());
        }

        const results = await Promise.allSettled(promises);
        const successes = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
        globalMetrics.recordAction('Chaos.ActionStorm');
        this.chaosLogger.info(`Storm result: ${successes}/5 succeeded`);
    }

    /**
     * ABANDONED TRANSACTION: Start an order, then abort mid-flow with AbortController
     */
    private async abandonTransaction(): Promise<void> {
        this.abandonCount++;
        this.chaosLogger.action('🚪 ABANDONED TRANSACTION: Starting then aborting...');

        const controller = new AbortController();

        // Start a request then abort after 100ms
        const orderPromise = this.api.request('/restaurant/orders', 'POST', {
            customerName: 'Ghost Customer',
            customerPhone: '000',
            orderType: 'takeaway',
            items: []
        }, false, false, { signal: controller.signal });

        setTimeout(() => controller.abort(), 100);

        try {
            await orderPromise;
        } catch (e: any) {
            if (e.name === 'AbortError') {
                this.chaosLogger.info('Transaction successfully abandoned (AbortError)');
            }
        }

        globalMetrics.recordAction('Chaos.AbandonedTransaction');
    }

    /**
     * BOUNDARY ABUSE: Send invalid inputs and ASSERT the backend rejects them
     */
    private async boundaryAbuse(): Promise<void> {
        this.boundaryCount++;
        this.chaosLogger.action('🔧 BOUNDARY ABUSE: Testing invalid inputs with assertions...');

        const invalidPayloads = [
            {
                name: 'Negative quantity order',
                fn: () => this.api.createRestaurantOrder({
                    customerName: 'Chaos',
                    customerPhone: '000',
                    orderType: 'takeaway',
                    items: [{ menuItemId: 'fake-id', quantity: -1 }]
                }),
                shouldFail: true
            },
            {
                name: 'Empty order',
                fn: () => this.api.createRestaurantOrder({
                    customerName: '',
                    customerPhone: '',
                    orderType: 'takeaway',
                    items: []
                }),
                shouldFail: true
            },
            {
                name: 'XSS in name',
                fn: () => this.api.submitReview({
                    service_type: 'restaurant',
                    rating: 5,
                    text: '<script>alert("xss")</script>'
                }),
                shouldFail: false // May succeed but should sanitize
            },
            {
                name: 'SQL injection in search',
                fn: () => this.api.request("/restaurant/items?search='; DROP TABLE users;--", 'GET', null, false),
                shouldFail: false // Should succeed but return safe results
            },
            {
                name: 'Extremely large quantity',
                fn: () => this.api.createRestaurantOrder({
                    customerName: 'Chaos',
                    customerPhone: '000',
                    orderType: 'takeaway',
                    items: [{ menuItemId: 'fake-id', quantity: 999999999 }]
                }),
                shouldFail: true
            },
            {
                name: 'Invalid order type',
                fn: () => this.api.request('/restaurant/orders', 'POST', {
                    customerName: 'Chaos',
                    customerPhone: '000',
                    orderType: 'NONEXISTENT_TYPE',
                    items: []
                }, false),
                shouldFail: true
            }
        ];

        for (const payload of invalidPayloads) {
            try {
                const result = await payload.fn();
                if (payload.shouldFail) {
                    if (!result.success) {
                        this.correctRejections++;
                        this.chaosLogger.info(`✓ Correctly rejected: ${payload.name}`);
                    } else {
                        this.unexpectedAccepts++;
                        this.chaosLogger.error(`✗ UNEXPECTED ACCEPT: ${payload.name} — backend should have rejected`);
                        globalMetrics.recordError(`ChaosBot: Unexpected accept for "${payload.name}"`);
                    }
                }
            } catch (e) {
                if (payload.shouldFail) {
                    this.correctRejections++;
                    this.chaosLogger.info(`✓ Correctly threw: ${payload.name}`);
                }
            }
        }

        globalMetrics.recordAction('Chaos.BoundaryAbuse');
    }
}
