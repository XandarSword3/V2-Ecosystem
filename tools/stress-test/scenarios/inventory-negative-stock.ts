import { ApiClient } from '../utils/api-client';
import { Logger } from '../utils/logger';
import { InvariantScenario, ScenarioResult } from '../types';

export class NegativeInventoryScenario implements InvariantScenario {
    name = 'NegativeInventory';
    description = 'Attempts to place order while admin reduces stock concurrently';

    private itemId: string = '';
    private initialStock = 10;
    private orderQuantity = 10;
    private adminSetStock = 5;

    // Dynamic result tracking
    private _success = false;
    private _invariantHeld = false;
    private _details = 'Not executed';
    private _duration = 0;
    private _requests = 2;
    private _failures = 0;

    async setup(api: ApiClient, logger: Logger): Promise<void> {
        logger.info(`[${this.name}] Creating inventory item with stock ${this.initialStock}...`);

        const catRes = await api.getInventoryCategories();
        let categoryId;
        if (catRes.success && (catRes.data as any[]).length > 0) {
            categoryId = (catRes.data as any[])[0].id;
        } else {
            const newCat = await api.createInventoryCategory({ name: 'Stress Test Cat' });
            if (!newCat.success) throw new Error('Failed to create category');
            categoryId = (newCat.data as any).id;
        }

        const createRes = await api.createInventoryItem({
            name: `Stress Test Item ${Date.now()}`,
            sku: `STRESS-${Date.now()}`,
            currentStock: this.initialStock,
            costPerUnit: 10,
            categoryId: categoryId,
            unit: 'piece'
        });

        if (!createRes.success || !(createRes.data as any).id) {
            throw new Error(`[${this.name}] Failed to create item: ${createRes.error}`);
        }

        this.itemId = (createRes.data as any).id;
        logger.success(`[${this.name}] Created item ${this.itemId}`);
    }

    async run(api: ApiClient, logger: Logger): Promise<void> {
        logger.action(`[${this.name}] Racing: Customer Order (${this.orderQuantity}) vs Admin Update (${this.adminSetStock})...`);

        const startTime = Date.now();

        const p1 = api.createRestaurantOrder({
            customerName: 'Race Conditions',
            customerPhone: '+15551234567',
            orderType: 'takeaway',
            items: [{ menuItemId: this.itemId, quantity: this.orderQuantity }],
        });

        const p2 = api.updateInventoryItem(this.itemId, {
            currentStock: this.adminSetStock
        });

        const results = await Promise.allSettled([p1, p2]);
        this._duration = Date.now() - startTime;

        results.forEach((res) => {
            if (res.status === 'rejected') this._failures++;
            else if (!(res.value as any).success) this._failures++;
        });
    }

    async verify(api: ApiClient, logger: Logger): Promise<boolean> {
        const itemRes = await api.getInventoryItems();
        const item = (itemRes.data as any[]).find((i: any) => i.id === this.itemId);

        if (!item) {
            logger.error(`[${this.name}] Item disappeared!`);
            this._details = 'Item disappeared';
            this._invariantHeld = false;
            this._success = false;
            return false;
        }

        const stock = item.currentStock ?? item.current_stock ?? item.stock_quantity ?? item.quantity;
        logger.info(`[${this.name}] Final Stock: ${stock} (Raw keys: ${Object.keys(item).join(', ')})`);

        if (stock === undefined) {
            logger.error(`[${this.name}] Could not find stock property on item`);
            this._details = 'Stock property missing';
            this._invariantHeld = false;
            this._success = false;
            return false;
        }

        if (stock < 0) {
            logger.error(`[${this.name}] INVARIANT VIOLATED: Negative stock ${stock}`);
            this._details = `Negative stock: ${stock}`;
            this._invariantHeld = false;
            this._success = true;
            return false;
        }

        logger.success(`[${this.name}] Stock invariant held (${stock} >= 0)`);
        this._details = `Stock invariant held: ${stock} >= 0`;
        this._invariantHeld = true;
        this._success = true;
        return true;
    }

    async teardown(api: ApiClient, logger: Logger): Promise<void> {
        if (this.itemId) {
            try {
                await api.deleteInventoryItem(this.itemId);
                logger.info(`[${this.name}] Deleted test inventory item ${this.itemId}`);
            } catch (e) {
                logger.warn(`[${this.name}] Teardown: Failed to delete item`);
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
