import { ApiClient } from './utils/api-client';
import { Logger, globalMetrics } from './utils/logger';
import { CONFIG } from './config';
import { InvariantScenario, ScenarioResult } from './types';
import { GiftCardDoubleSpendScenario } from './scenarios/gift-card-double-spend';
import { NegativeInventoryScenario } from './scenarios/inventory-negative-stock';
import { GDPRRaceScenario } from './scenarios/gdpr-race';
import { CouponDoubleUseScenario } from './scenarios/coupon-double-use';
import { ChaletRaceScenario } from './scenarios/chalet-race';
import { InventoryRaceScenario } from './scenarios/inventory-race';
import { StaffRaceScenario } from './scenarios/staff-race';
import { LoyaltyRaceScenario } from './scenarios/loyalty-race';

const SCENARIOS: InvariantScenario[] = [
    new GiftCardDoubleSpendScenario(),
    new NegativeInventoryScenario(),
    new GDPRRaceScenario(),
    new CouponDoubleUseScenario(),
    new LoyaltyRaceScenario(),
    // Battle Testing - Concurrency Hell
    new ChaletRaceScenario(),
    new InventoryRaceScenario(),
    new StaffRaceScenario()
];

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function loginWithRetry(api: ApiClient, email: string, pass: string, retries = 5): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
        try {
            await api.fetchCsrfToken();
            const success = await api.login(email, pass);
            if (success) return true;
        } catch (e) {
            console.error(`[System Runner] Login attempt ${i + 1} failed:`, e);
            if (i === retries - 1) throw e;
            await delay(3000 * (i + 1));
        }
    }
    return false;
}

async function runScenarios() {
    const args = process.argv.slice(2);
    const scenarioFilter = args.find((_, i) => args[i - 1] === '--scenario' || args[i - 1] === '--filter');

    let targetScenarios = SCENARIOS;
    if (scenarioFilter) {
        targetScenarios = SCENARIOS.filter(s => s.name.toLowerCase().includes(scenarioFilter.toLowerCase()));
        if (targetScenarios.length === 0) {
            console.error(`❌ No scenarios found matching "${scenarioFilter}"`);
            process.exit(1);
        }
        console.log(`🎯 Filtering to scenarios: ${targetScenarios.map(s => s.name).join(', ')}`);
    }

    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      INVARIANT CONSISTENCY TESTS (LEVEL 3)                    ║
║   Validating domain truth under high-concurrency adversarial conditions       ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);

    const results: ScenarioResult[] = [];

    for (const scenario of targetScenarios) {
        const logger = new Logger('System', 'Runner');
        logger.info(`\n🚀 Starting Scenario: ${scenario.name}`);
        logger.info(`📝 Description: ${scenario.description}`);

        // Create fresh admin client for each scenario
        const api = new ApiClient();

        try {
            // 1. Setup
            logger.info('🔑 Authenticating as Admin...');
            const login = await loginWithRetry(api, CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
            if (!login) throw new Error('Admin login failed');

            await scenario.setup(api, logger);

            // 2. Run
            const startTime = Date.now();
            await scenario.run(api, logger);
            const duration = Date.now() - startTime;

            // Record in global metrics
            globalMetrics.recordAction(`Invariant.${scenario.name}`);

            // 3. Verify
            const invariantHeld = await scenario.verify(api, logger);

            // Use the scenario's own result (dynamic) and enhance with timing
            const scenarioResult = scenario.getResult();
            results.push({
                ...scenarioResult,
                metrics: {
                    ...scenarioResult.metrics,
                    duration,
                }
            });

            if (invariantHeld) {
                logger.success(`✅ SCENARIO PASSED: ${scenario.name}`);
                globalMetrics.recordRequest(true, duration);
            } else {
                logger.error(`❌ SCENARIO FAILED: ${scenario.name} (Invariant Violated)`);
                globalMetrics.recordRequest(false, duration);
            }

        } catch (e: any) {
            logger.error(`💥 CRITICAL FAILURE in ${scenario.name}: ${e.message}`);
            globalMetrics.recordError(`Invariant.${scenario.name}: ${e.message}`);
            results.push({
                name: scenario.name,
                success: false,
                invariantHeld: false,
                details: e.message,
                metrics: { duration: 0, requests: 0, failures: 1 }
            });
        } finally {
            try {
                // 4. Teardown
                await scenario.teardown(api, logger);
            } catch (cleanupError) {
                logger.warn(`Cleanup failed for ${scenario.name}: ${cleanupError}`);
            }
        }

        // Cool down between scenarios to avoid rate limiting
        await delay(5000);
    }

    // Final Report
    console.log(`\n
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            FINAL INVARIANT REPORT                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);

    let passed = 0;
    results.forEach(r => {
        const icon = r.invariantHeld ? '✅' : '❌';
        const status = r.invariantHeld ? 'PASSED' : 'VIOLATED';
        const dur = r.metrics.duration > 0 ? ` (${r.metrics.duration}ms)` : '';
        console.log(`${icon} ${r.name.padEnd(30)} | ${status.padEnd(10)} | ${r.details}${dur}`);
        if (r.invariantHeld) passed++;
    });

    console.log(`\nSummary: ${passed}/${results.length} Invariants Held`);

    // Print global metrics summary
    globalMetrics.printSummary();

    if (passed < results.length) {
        console.log('\n❌ SYSTEM FAILED CONSISTENCY CHECK');
        process.exit(1);
    } else {
        console.log('\n✅ SYSTEM PASSED CONSISTENCY CHECK');
        process.exit(0);
    }
}

runScenarios().catch(console.error);
