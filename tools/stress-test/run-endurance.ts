import { Orchestrator } from './orchestrator';
import { CONFIG } from './config';
import { Logger } from './utils/logger';

async function runEndurance() {
    const logger = new Logger('Endurance', 0);

    // 1. Override Config for Endurance
    // Run for 24 hours (or until manually stopped)
    CONFIG.TEST_DURATION_MS = 24 * 60 * 60 * 1000;
    CONFIG.METRICS_INTERVAL = 60000; // Log every minute

    logger.info('🚀 STARTING ENDURANCE TEST');
    logger.info(`Duration: ${CONFIG.TEST_DURATION_MS / 3600000} hours`);

    // 2. Start Resource Monitor
    setInterval(() => {
        const used = process.memoryUsage();
        logger.info(`[Resource Monitor] Memory: RSS ${(used.rss / 1024 / 1024).toFixed(2)} MB | Heap ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    }, 60000);

    // 3. Launch Orchestrator
    const orchestrator = new Orchestrator();

    // Handle shutdown signals
    process.on('SIGINT', () => {
        logger.warn('Received SIGINT. Stopping endurance test...');
        orchestrator.stop();
        process.exit(0);
    });

    try {
        await orchestrator.start();
    } catch (error) {
        logger.error(`Endurance test crashed: ${error}`);
        orchestrator.stop();
        process.exit(1);
    }
}

runEndurance().catch(console.error);
