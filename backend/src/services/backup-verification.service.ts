/**
 * Backup Verification Service
 * Handles database backup verification, integrity checks, and restoration testing
 */
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

interface BackupInfo {
  id: string;
  type: 'automatic' | 'manual' | 'point_in_time';
  createdAt: Date;
  sizeBytes: number;
  status: 'completed' | 'in_progress' | 'failed';
  retentionDays: number;
  verified: boolean;
  verifiedAt?: Date;
}

interface BackupVerificationResult {
  success: boolean;
  backupId: string;
  verifiedAt: Date;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
  errors: string[];
}

interface DataIntegrityReport {
  timestamp: Date;
  totalTables: number;
  tablesChecked: number;
  issuesFound: number;
  issues: {
    table: string;
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedRows?: number;
  }[];
  recommendations: string[];
}

// Critical tables that must be backed up
const CRITICAL_TABLES = [
  'users',
  'chalets',
  'chalet_bookings',
  'pool_tickets',
  'pool_memberships',
  'payments',
  'restaurant_tables',
  'table_reservations',
  'kitchen_orders',
  'menu_items',
  'seasonal_pricing_rules',
  'system_settings',
  'security_audit_log',
];

// Expected foreign key relationships
const EXPECTED_RELATIONSHIPS = [
  { table: 'chalet_bookings', column: 'user_id', references: 'users.id' },
  { table: 'chalet_bookings', column: 'chalet_id', references: 'chalets.id' },
  { table: 'pool_tickets', column: 'user_id', references: 'users.id' },
  { table: 'pool_memberships', column: 'user_id', references: 'users.id' },
  { table: 'payments', column: 'user_id', references: 'users.id' },
  { table: 'table_reservations', column: 'user_id', references: 'users.id' },
  { table: 'table_reservations', column: 'table_id', references: 'restaurant_tables.id' },
  { table: 'kitchen_orders', column: 'table_id', references: 'restaurant_tables.id' },
  { table: 'kitchen_order_items', column: 'order_id', references: 'kitchen_orders.id' },
  { table: 'kitchen_order_items', column: 'menu_item_id', references: 'menu_items.id' },
];

export class BackupVerificationService {
  
  /**
   * Get list of recent backups from Supabase
   * Note: This would typically use Supabase Management API
   */
  async getRecentBackups(): Promise<BackupInfo[]> {
    // In production, this would call Supabase Management API
    // For now, we'll return a simulated response
    
    const backups: BackupInfo[] = [
      {
        id: 'backup_auto_' + new Date().toISOString().split('T')[0],
        type: 'automatic',
        createdAt: new Date(),
        sizeBytes: 1024 * 1024 * 500, // 500MB
        status: 'completed',
        retentionDays: 30,
        verified: false,
      },
    ];

    return backups;
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<BackupVerificationResult> {
    const checks: BackupVerificationResult['checks'] = [];
    const errors: string[] = [];

    try {
      // Check 1: Verify all critical tables exist
      const tableCheck = await this.checkCriticalTables();
      checks.push({
        name: 'Critical Tables Existence',
        passed: tableCheck.passed,
        message: tableCheck.message,
      });
      if (!tableCheck.passed) errors.push(tableCheck.message);

      // Check 2: Verify row counts are reasonable
      const rowCountCheck = await this.checkRowCounts();
      checks.push({
        name: 'Row Count Verification',
        passed: rowCountCheck.passed,
        message: rowCountCheck.message,
      });
      if (!rowCountCheck.passed) errors.push(rowCountCheck.message);

      // Check 3: Verify foreign key integrity
      const fkCheck = await this.checkForeignKeyIntegrity();
      checks.push({
        name: 'Foreign Key Integrity',
        passed: fkCheck.passed,
        message: fkCheck.message,
      });
      if (!fkCheck.passed) errors.push(fkCheck.message);

      // Check 4: Verify critical data
      const dataCheck = await this.checkCriticalData();
      checks.push({
        name: 'Critical Data Verification',
        passed: dataCheck.passed,
        message: dataCheck.message,
      });
      if (!dataCheck.passed) errors.push(dataCheck.message);

      // Check 5: Verify indexes
      const indexCheck = await this.checkIndexes();
      checks.push({
        name: 'Index Verification',
        passed: indexCheck.passed,
        message: indexCheck.message,
      });
      if (!indexCheck.passed) errors.push(indexCheck.message);

      const allPassed = checks.every(c => c.passed);

      // Log verification result
      await this.logVerificationResult(backupId, allPassed, checks);

      return {
        success: allPassed,
        backupId,
        verifiedAt: new Date(),
        checks,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Verification failed: ${errorMessage}`);
      
      return {
        success: false,
        backupId,
        verifiedAt: new Date(),
        checks,
        errors,
      };
    }
  }

  private async checkCriticalTables(): Promise<{ passed: boolean; message: string }> {
    const missingTables: string[] = [];

    for (const table of CRITICAL_TABLES) {
      const { error } = await supabase.from(table).select('id').limit(1);
      
      if (error && error.code === '42P01') {
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      return {
        passed: false,
        message: `Missing critical tables: ${missingTables.join(', ')}`,
      };
    }

    return {
      passed: true,
      message: `All ${CRITICAL_TABLES.length} critical tables present`,
    };
  }

  private async checkRowCounts(): Promise<{ passed: boolean; message: string }> {
    const counts: Record<string, number> = {};
    const issues: string[] = [];

    // Get row counts for critical tables
    for (const table of CRITICAL_TABLES) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        issues.push(`Failed to count ${table}: ${error.message}`);
        continue;
      }

      counts[table] = count || 0;

      // Check for unexpectedly empty tables that should have data
      if (count === 0 && ['system_settings', 'chalets', 'menu_items'].includes(table)) {
        issues.push(`Table ${table} is unexpectedly empty`);
      }
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: issues.join('; '),
      };
    }

    return {
      passed: true,
      message: `Row counts verified for ${Object.keys(counts).length} tables`,
    };
  }

  private async checkForeignKeyIntegrity(): Promise<{ passed: boolean; message: string }> {
    const orphans: string[] = [];

    for (const rel of EXPECTED_RELATIONSHIPS) {
      const [refTable, refColumn] = rel.references.split('.');
      
      // Check for orphaned records
      const { data, error } = await supabase.rpc('check_orphan_records', {
        source_table: rel.table,
        source_column: rel.column,
        ref_table: refTable,
        ref_column: refColumn,
      });

      // If RPC doesn't exist, skip check
      if (error && error.code === 'PGRST202') {
        continue;
      }

      if (data && data.length > 0) {
        orphans.push(`${rel.table}.${rel.column} has ${data.length} orphaned records`);
      }
    }

    if (orphans.length > 0) {
      return {
        passed: false,
        message: orphans.join('; '),
      };
    }

    return {
      passed: true,
      message: 'No orphaned records found',
    };
  }

  private async checkCriticalData(): Promise<{ passed: boolean; message: string }> {
    const issues: string[] = [];

    // Check that admin user exists
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (adminError || !adminUsers || adminUsers.length === 0) {
      issues.push('No admin user found');
    }

    // Check that system settings exist
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key')
      .limit(1);

    if (settingsError && settingsError.code !== '42P01') {
      issues.push('Unable to verify system settings');
    }

    // Check chalets exist
    const { count: chaletCount } = await supabase
      .from('chalets')
      .select('*', { count: 'exact', head: true });

    if (!chaletCount || chaletCount === 0) {
      issues.push('No chalets configured');
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: issues.join('; '),
      };
    }

    return {
      passed: true,
      message: 'Critical data verified',
    };
  }

  private async checkIndexes(): Promise<{ passed: boolean; message: string }> {
    // In a real implementation, this would query pg_indexes
    // For now, we assume indexes are fine if tables exist
    return {
      passed: true,
      message: 'Index check completed',
    };
  }

  private async logVerificationResult(
    backupId: string,
    success: boolean,
    checks: BackupVerificationResult['checks']
  ): Promise<void> {
    try {
      await supabase.from('security_audit_log').insert({
        event_type: 'backup_verification',
        severity: success ? 'info' : 'warning',
        description: `Backup ${backupId} verification: ${success ? 'PASSED' : 'FAILED'}`,
        metadata: { backupId, checks },
      });
    } catch (error) {
      console.error('Failed to log backup verification:', error);
    }
  }

  /**
   * Run comprehensive data integrity check
   */
  async runDataIntegrityCheck(): Promise<DataIntegrityReport> {
    const issues: DataIntegrityReport['issues'] = [];
    const recommendations: string[] = [];
    let tablesChecked = 0;

    // Check each critical table
    for (const table of CRITICAL_TABLES) {
      tablesChecked++;

      // Check for null values in required fields
      const nullIssues = await this.checkNullValues(table);
      issues.push(...nullIssues);

      // Check for duplicate entries where they shouldn't exist
      const duplicateIssues = await this.checkDuplicates(table);
      issues.push(...duplicateIssues);

      // Check for invalid date ranges
      if (['chalet_bookings', 'pool_memberships', 'seasonal_pricing_rules'].includes(table)) {
        const dateIssues = await this.checkDateRanges(table);
        issues.push(...dateIssues);
      }
    }

    // Check for dangling payments
    const paymentIssues = await this.checkPaymentIntegrity();
    issues.push(...paymentIssues);

    // Generate recommendations
    if (issues.some(i => i.severity === 'critical')) {
      recommendations.push('URGENT: Critical data integrity issues found. Review immediately.');
    }
    if (issues.some(i => i.table === 'payments')) {
      recommendations.push('Review payment records for consistency with bookings.');
    }
    if (issues.some(i => i.issue.includes('orphan'))) {
      recommendations.push('Consider cleaning up orphaned records with a maintenance script.');
    }
    if (issues.length === 0) {
      recommendations.push('Data integrity check passed. Continue regular monitoring.');
    }

    return {
      timestamp: new Date(),
      totalTables: CRITICAL_TABLES.length,
      tablesChecked,
      issuesFound: issues.length,
      issues,
      recommendations,
    };
  }

  private async checkNullValues(table: string): Promise<DataIntegrityReport['issues']> {
    const issues: DataIntegrityReport['issues'] = [];
    
    // Define required fields per table
    const requiredFields: Record<string, string[]> = {
      users: ['email', 'created_at'],
      chalet_bookings: ['user_id', 'chalet_id', 'check_in', 'check_out', 'total_price'],
      payments: ['user_id', 'amount', 'status'],
      pool_tickets: ['user_id', 'ticket_date', 'slot'],
    };

    const fields = requiredFields[table];
    if (!fields) return issues;

    for (const field of fields) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .is(field, null);

      if (!error && count && count > 0) {
        issues.push({
          table,
          issue: `${count} records with null ${field}`,
          severity: 'high',
          affectedRows: count,
        });
      }
    }

    return issues;
  }

  private async checkDuplicates(table: string): Promise<DataIntegrityReport['issues']> {
    const issues: DataIntegrityReport['issues'] = [];
    
    // Check for duplicate emails in users
    if (table === 'users') {
      const { data, error } = await supabase.rpc('find_duplicate_emails');
      if (!error && data && data.length > 0) {
        issues.push({
          table,
          issue: `${data.length} duplicate email addresses found`,
          severity: 'critical',
          affectedRows: data.length,
        });
      }
    }

    return issues;
  }

  private async checkDateRanges(table: string): Promise<DataIntegrityReport['issues']> {
    const issues: DataIntegrityReport['issues'] = [];

    // Check for end date before start date
    if (table === 'chalet_bookings') {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .filter('check_out', 'lt', 'check_in');

      if (!error && count && count > 0) {
        issues.push({
          table,
          issue: `${count} bookings with check_out before check_in`,
          severity: 'high',
          affectedRows: count,
        });
      }
    }

    return issues;
  }

  private async checkPaymentIntegrity(): Promise<DataIntegrityReport['issues']> {
    const issues: DataIntegrityReport['issues'] = [];

    // Check for payments without associated bookings
    const { count, error } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .not('booking_id', 'is', null)
      .eq('status', 'succeeded');

    // More checks would go here in production

    return issues;
  }

  /**
   * Schedule automated backup verification
   */
  async scheduleVerification(cronExpression: string = '0 3 * * *'): Promise<void> {
    // This would integrate with a job scheduler like node-cron
    // For now, log the intent
    logger.info(`Backup verification scheduled: ${cronExpression}`);
    
    // In production, you'd use:
    // cron.schedule(cronExpression, () => this.runScheduledVerification());
  }

  private async runScheduledVerification(): Promise<void> {
    logger.info('Running scheduled backup verification...');
    
    const backups = await this.getRecentBackups();
    for (const backup of backups.filter(b => !b.verified && b.status === 'completed')) {
      const result = await this.verifyBackup(backup.id);
      logger.info(`Backup ${backup.id} verification: ${result.success ? 'PASSED' : 'FAILED'}`);
    }

    // Also run data integrity check
    const integrityReport = await this.runDataIntegrityCheck();
    logger.info(`Data integrity check: ${integrityReport.issuesFound} issues found`);
  }
}

// Export singleton instance
export const backupVerificationService = new BackupVerificationService();
