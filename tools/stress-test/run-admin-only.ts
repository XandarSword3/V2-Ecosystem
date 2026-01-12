#!/usr/bin/env node

// Override Config BEFORE importing Orchestrator
import { CONFIG } from './config';

// Force ONLY Admin bot
Object.assign(CONFIG, {
  CUSTOMER_BOTS: 0,
  STAFF_BOTS_INITIAL: 0, // No staff needed 
  STAFF_BOTS_TRAINEES: 0,
  ADMIN_BOTS: 1, // Only 1 admin bot
  ADMIN_ACTION_INTERVAL: { min: 2000, max: 5000 }, // Faster for testing
  TEST_DURATION_MS: 300 * 60 * 1000, // 5 minutes or until stopped
});

// Force Admin Actions to be equal probability to test everything
const actions = [
  'VIEW_DASHBOARD', 'VIEW_REVENUE_STATS', 'VIEW_REPORTS', 'VIEW_USERS',
  'CREATE_USER', 'UPDATE_USER', 'VIEW_MODULES', 'UPDATE_MODULE', 'CREATE_MODULE',
  'VIEW_SETTINGS', 'UPDATE_SETTINGS', 'VIEW_REVIEWS', 'APPROVE_REVIEW',
  'REJECT_REVIEW', 'VIEW_AUDIT_LOGS', 'CREATE_BACKUP', 'MANAGE_BACKUPS',
  'MANAGE_MENU_CATEGORY', 'MANAGE_MENU_ITEM', 'MANAGE_CHALET', 'MANAGE_POOL_SESSION',
  'COMPARE_TRANSLATIONS'
];

// Reset weights - use a simple even distribution for exhaustive testing
CONFIG.ADMIN_ACTIONS = {};
actions.forEach(action => {
  CONFIG.ADMIN_ACTIONS[action] = 100 / actions.length;
});

console.log('🧪 Starting Admin-Only Exhaustive Test Mode');
console.log('🤖 Bots: 1 Admin');
console.log('⚡ Speed: 2s-5s per action');
console.log('📋 Actions:', actions.join(', '));

import { Orchestrator } from './orchestrator';

const orchestrator = new Orchestrator();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Received SIGINT. Shutting down gracefully...');
    orchestrator.stop();
    process.exit(0);
});

async function main() {
    await orchestrator.start();
}

main().catch(console.error);
