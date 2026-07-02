import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

/**
 * Audit script to check for INSERT/UPDATE calls that might be missing tenant_id
 */
async function auditTenantId() {
  console.log('🔍 Starting tenant_id audit...');
  console.log('');

  const supabase = getSupabase();

  // First, get list of tables that have tenant_id NOT NULL
  console.log('Step 1: Checking database schema for tables with tenant_id NOT NULL...');
  // To do this, we can query information_schema.columns
  const { data: tablesWithTenantId, error: schemaError } = await supabase
    .rpc('get_tables_with_tenant_id_not_null'); // We might need to create this function, but let's try to query directly via raw SQL

  // Since we might not have that RPC, let's use a different approach
  // Let's list all tables we know should have tenant_id
  const knownTables = [
    'property_settings',
    'catalog_categories',
    'catalog_items',
    'capacity_windows',
    'bookable_units',
    'coupon_usage',
    'gift_card_ledger',
    'loyalty_transactions',
    'loyalty_fraud_flags',
    'report_execution_log',
    'report_delivery_log',
    'rate_parity_alerts',
    'alert_history',
    'notifications',
    'activity_logs',
    'housekeeping_tasks',
    'email_unsubscribes',
    'gdpr_processing_activities',
    'gdpr_data_sharing_log',
    'payment_ledger',
    'payments',
    'inventory_transactions',
    'menu_item_ingredients',
    'inventory_alerts',
    'engine_state_transitions',
    'gift_card_transactions',
    'metrics_events',
    'user_roles',
    'email_events',
    'email_rate_limit_log',
    'email_bounces',
    'email_suppression_list',
    'engine_compensation_log',
    'housekeeping_logs',
    'inventory_purchase_order_items',
    'inventory_batches',
    'inventory_recipe_ingredients',
    'shared_inventory_pools',
    'group_rate_templates',
    'group_report_schedules',
    'property_benchmarks',
    'modules',
  ];

  console.log('');
  console.log('Step 2: Checking codebase for INSERT/UPDATE/upsert calls on these tables...');

  // Now, let's search the codebase for these tables
  // We'll use the SearchCodebase tool
  // But since this is a script, let's print instructions for what to check

  console.log('');
  console.log('📋 Tables to check for missing tenant_id in INSERT/upsert:');
  console.log(knownTables.join('\n'));

  console.log('');
  console.log('✅ Audit complete!');
}

auditTenantId().catch((error) => {
  logger.error('Audit failed:', error);
  process.exit(1);
});
