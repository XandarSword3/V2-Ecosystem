import { InvariantScenario, ScenarioResult } from '../types';
import { ApiClient } from '../utils/api-client';
import { Logger } from '../utils/logger';
import { CONFIG } from '../config';

export class StaffRaceScenario implements InvariantScenario {
    name = 'StaffCollisionMode';
    description = '5 staff members attempting to update the same order status simultaneously';

    private targetOrderId: string | null = null;

    // Dynamic result tracking
    private _success = false;
    private _invariantHeld = false;
    private _details = 'Not executed';
    private _duration = 0;
    private _requests = 5;
    private _failures = 0;

    async setup(api: ApiClient, logger: Logger): Promise<void> {
        logger.info(`[${this.name}] Setting up Staff Race...`);

        // 1. Ensure a menu item exists
        let menuRes = await api.getRestaurantMenu();
        if (!menuRes.success) {
            logger.error(`[${this.name}] Failed to fetch menu: ${menuRes.error}`);
            throw new Error(`Failed to fetch menu: ${menuRes.error}`);
        }

        let targetItemId: string | null = null;
        const menuData = menuRes.data;
        const items = menuData?.items || (Array.isArray(menuData) ? menuData : []);
        const categories = menuData?.categories || [];

        if (items.length > 0) {
            targetItemId = items[0].id;
            logger.info(`[${this.name}] Using existing item: ${targetItemId}`);
        } else {
            logger.info(`[${this.name}] No menu items found. Creating test data...`);

            let categoryId: string;
            if (categories.length > 0) {
                categoryId = categories[0].id;
            } else {
                const catRes = await api.createMenuCategory('restaurant', {
                    name: 'Battle Test Category',
                    description: 'Generated for Staff Race'
                });
                if (!catRes.success || !catRes.data) {
                    logger.error(`[${this.name}] Category creation failed: ${JSON.stringify(catRes)}`);
                    throw new Error('Failed to create category');
                }
                categoryId = catRes.data.id;
            }

            const itemRes = await api.createMenuItem('restaurant', {
                categoryId,
                name: 'Battle Burger',
                price: 15,
                description: 'Atomic Burger',
                available: true,
                stock_quantity: 100
            });
            if (!itemRes.success || !itemRes.data) {
                logger.error(`[${this.name}] Item creation failed: ${JSON.stringify(itemRes)}`);
                throw new Error('Failed to create item');
            }
            targetItemId = itemRes.data.id;
        }

        if (!targetItemId) throw new Error('Could not resolve targetItemId');

        // 2. Create a target order
        const customer = new ApiClient();
        const timestamp = Date.now();
        const custEmail = `staffrace_cust_${timestamp}@test.com`;

        const regSuccess = await customer.registerWithRetry(custEmail, 'Password123!', 'Staff Race Customer', '+15550001234');

        if (!regSuccess) {
            throw new Error(`Customer registration failed for ${custEmail} after retries`);
        }

        const order = await customer.createRestaurantOrder({
            orderType: 'takeaway',
            customerName: 'Staff Race Target',
            customerPhone: '+15551234567',
            items: [{ menuItemId: targetItemId, quantity: 1 }]
        });

        if (!order.success || !order.data) {
            logger.error(`[${this.name}] Order creation failed: ${JSON.stringify(order)}`);
            throw new Error(`Order creation failed: ${order?.error || 'Unknown error'}`);
        }

        this.targetOrderId = order.data.orderId || order.data.id || (order.data.data ? order.data.data.id : null);

        if (!this.targetOrderId) {
            logger.error(`[${this.name}] Could not find order ID in response: ${JSON.stringify(order.data)}`);
            throw new Error('Order ID missing from response');
        }

        logger.info(`[${this.name}] Target Order ID: ${this.targetOrderId}`);
    }

    async run(api: ApiClient, logger: Logger): Promise<void> {
        if (!this.targetOrderId) throw new Error('Setup failed');

        logger.info(`[${this.name}] Logging in 5 staff clients first, then firing concurrent updates...`);
        const startTime = Date.now();

        // FIX: Login all 5 staff clients FIRST, then fire concurrent updates
        const staffClients: ApiClient[] = [];
        for (let i = 0; i < 5; i++) {
            const staffApi = new ApiClient();
            await staffApi.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
            staffClients.push(staffApi);
        }

        const statuses = ['preparing', 'ready', 'delivered', 'cancelled', 'preparing'];
        const promises = staffClients.map((client, i) =>
            client.updateOrderStatusWithRetry('restaurant', this.targetOrderId!, statuses[i])
        );

        const results = await Promise.allSettled(promises);
        this._duration = Date.now() - startTime;

        results.forEach(r => {
            if (r.status === 'rejected') this._failures++;
            else if (!(r.value as any).success) this._failures++;
        });
    }

    async verify(api: ApiClient, logger: Logger): Promise<boolean> {
        const order = await api.getRestaurantOrderStatus(this.targetOrderId!);
        if (!order.success) {
            logger.error(`[${this.name}] Failed to get order status`);
            this._details = 'Failed to retrieve order status';
            this._invariantHeld = false;
            this._success = false;
            return false;
        }

        const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'];
        const finalStatus = order.data.status;
        logger.info(`[${this.name}] Final Status: ${finalStatus}`);

        if (!validStatuses.includes(finalStatus)) {
            logger.error(`[${this.name}] INVARIANT VIOLATED: Invalid status "${finalStatus}"`);
            this._details = `Invalid status: ${finalStatus}`;
            this._invariantHeld = false;
            this._success = true;
            return false;
        }

        this._details = `Order settled on valid status: "${finalStatus}"`;
        this._invariantHeld = true;
        this._success = true;
        return true;
    }

    async teardown(api: ApiClient, logger: Logger): Promise<void> {
        logger.info(`[${this.name}] Teardown complete`);
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
