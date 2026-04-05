import { InvariantScenario, ScenarioResult } from '../types';
import { ApiClient } from '../utils/api-client';
import { Logger } from '../utils/logger';

export class InventoryRaceScenario implements InvariantScenario {
    name = 'InventoryDepletionRace';
    description = '100 customers attempt to buy the last 3 items of a stock';

    private targetItemId: string | null = null;
    private initialStock = 3;

    // Dynamic result tracking
    private _success = false;
    private _invariantHeld = false;
    private _details = 'Not executed';
    private _duration = 0;
    private _requests = 100;
    private _failures = 0;

    async setup(api: ApiClient, logger: Logger): Promise<void> {
        logger.info(`[${this.name}] Setting up Inventory Race...`);

        const menu = await api.getRestaurantAdminItems();
        if (!menu.success || !menu.data || menu.data.length === 0) {
            throw new Error('No menu items found');
        }

        const targetItem = menu.data[0];
        this.targetItemId = targetItem.id;

        const update = await api.updateRestaurantMenuItem(targetItem.id, {
            ...targetItem,
            available: true,
            stock_quantity: this.initialStock
        });

        if (!update.success) {
            throw new Error(`Failed to set stock: ${update.error}`);
        }

        logger.info(`[${this.name}] Target Item: ${targetItem.name} (${targetItem.id}) - Stock set to ${this.initialStock}`);
    }

    async run(api: ApiClient, logger: Logger): Promise<void> {
        if (!this.targetItemId) throw new Error('Setup failed');

        logger.info(`[${this.name}] Launching 100 concurrent purchase requests...`);
        const startTime = Date.now();
        const promises = [];
        for (let i = 0; i < 100; i++) {
            const userApi = new ApiClient();
            promises.push(userApi.createRestaurantOrder({
                customerName: `InvBot ${i}`,
                customerPhone: '+15551234567',
                orderType: 'takeaway',
                items: [{ menuItemId: this.targetItemId, quantity: 1 }]
            }));
        }

        const results = await Promise.allSettled(promises);
        this._duration = Date.now() - startTime;

        const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
        this._failures = 100 - successCount;
        logger.info(`[${this.name}] Results: ${successCount} succeeded, ${this._failures} failed`);
    }

    async verify(api: ApiClient, logger: Logger): Promise<boolean> {
        const menu = await api.getRestaurantAdminItems();
        const item = menu.data.find((i: any) => i.id === this.targetItemId);

        if (!item) {
            logger.error(`[${this.name}] Item disappeared!`);
            this._details = 'Target item disappeared';
            this._invariantHeld = false;
            this._success = false;
            return false;
        }

        logger.info(`[${this.name}] Final Stock: ${item.stock_quantity}`);

        if (item.stock_quantity < 0) {
            logger.error(`[${this.name}] INVARIANT VIOLATED: Negative stock ${item.stock_quantity}`);
            this._details = `Negative stock: ${item.stock_quantity}`;
            this._invariantHeld = false;
            this._success = true;
            return false;
        }

        if (item.stock_quantity > this.initialStock) {
            logger.error(`[${this.name}] WAAT? Stock increased?`);
            this._details = `Stock increased from ${this.initialStock} to ${item.stock_quantity}`;
            this._invariantHeld = false;
            this._success = true;
            return false;
        }

        this._details = `Stock invariant held: ${item.stock_quantity} >= 0`;
        this._invariantHeld = true;
        this._success = true;
        return true;
    }

    async teardown(api: ApiClient, logger: Logger): Promise<void> {
        // Restore stock to a reasonable level
        if (this.targetItemId) {
            try {
                await api.updateRestaurantMenuItem(this.targetItemId, {
                    stock_quantity: 100,
                    available: true
                });
                logger.info(`[${this.name}] Restored stock to 100`);
            } catch (e) {
                logger.warn(`[${this.name}] Teardown: Failed to restore stock`);
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
