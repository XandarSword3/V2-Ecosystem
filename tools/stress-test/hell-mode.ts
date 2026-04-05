import { ChaletRaceScenario } from './scenarios/chalet-race';
import { InventoryRaceScenario } from './scenarios/inventory-race';
import { StaffRaceScenario } from './scenarios/staff-race';
import { GiftCardDoubleSpendScenario } from './scenarios/gift-card-double-spend';
import { NegativeInventoryScenario } from './scenarios/inventory-negative-stock';
import { GDPRRaceScenario } from './scenarios/gdpr-race';
import { CouponDoubleUseScenario } from './scenarios/coupon-double-use';
import { LoyaltyRaceScenario } from './scenarios/loyalty-race';
import { InvariantScenario } from './types';
import { Logger } from './utils/logger';
import { ApiClient } from './utils/api-client';
import { CONFIG } from './config';

const ALL_SCENARIOS: Record<string, () => InvariantScenario> = {
    'chalet-rush': () => new ChaletRaceScenario(),
    'inventory-race': () => new InventoryRaceScenario(),
    'staff-race': () => new StaffRaceScenario(),
    'gift-card': () => new GiftCardDoubleSpendScenario(),
    'negative-inventory': () => new NegativeInventoryScenario(),
    'gdpr-race': () => new GDPRRaceScenario(),
    'coupon-race': () => new CouponDoubleUseScenario(),
    'loyalty-race': () => new LoyaltyRaceScenario(),
};

export class HellModeOrchestrator {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('Chaos', 0);
    }

    async startScenario(scenarioName: string) {
        console.log(`🔥 STARTING HELL MODE: ${scenarioName.toUpperCase()} 🔥`);

        const factory = ALL_SCENARIOS[scenarioName];
        if (!factory) {
            const available = Object.keys(ALL_SCENARIOS).join(', ');
            console.error(`Unknown scenario: "${scenarioName}". Available: ${available}`);
            return;
        }

        const scenario = factory();
        const api = new ApiClient();

        try {
            // 1. Authenticate as admin
            this.logger.info('🔑 Authenticating as Admin...');
            const loggedIn = await api.loginWithRetry(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
            if (!loggedIn) throw new Error('Admin login failed');

            // 2. Full lifecycle: setup → run → verify → teardown
            this.logger.info('📦 Setup...');
            await scenario.setup(api, this.logger);

            this.logger.info('🚀 Running...');
            const startTime = Date.now();
            await scenario.run(api, this.logger);
            const duration = Date.now() - startTime;

            this.logger.info('🔍 Verifying...');
            const invariantHeld = await scenario.verify(api, this.logger);

            if (invariantHeld) {
                this.logger.success(`✅ HELL MODE PASSED: ${scenario.name} (${duration}ms)`);
            } else {
                this.logger.error(`❌ HELL MODE FAILED: ${scenario.name} — INVARIANT VIOLATED`);
            }

        } catch (e) {
            console.error(`🔥 HELL MODE CRASHED: ${e}`);
        } finally {
            try {
                await scenario.teardown(api, this.logger);
            } catch (e) {
                this.logger.warn(`Teardown failed: ${e}`);
            }
        }
    }

    getAvailableScenarios(): string[] {
        return Object.keys(ALL_SCENARIOS);
    }

    async stop() {
        // cleanup if needed
    }
}
