import cron from 'node-cron';
import { BackupService } from './backup.service.js';
import { logger } from '../utils/logger.js';
import { expirePoolTickets } from '../scripts/expire-pool-tickets.js';
import { getSupabase } from '../database/connection.js';
import { bookingRemindersService } from './booking-reminders.service.js';
import { reportingService } from '../modules/reporting/reporting.service.js';
import { businessMetricsService } from './business-metrics.service.js';
import { emitToRole } from '../socket/index.js';
import { runMembershipRenewalJob } from '../jobs/membership-renewal.job.js';

export class SchedulerService {
  /**
   * Initialize all cron jobs
   */
  static init() {
    logger.info('Initializing scheduler service...');
    
    // Daily Backup at 3:00 AM
    this.scheduleDailyBackup();
    
    // Pool ticket expiration at midnight and every 4 hours
    this.schedulePoolTicketExpiry();
    
    // Session cleanup - expire stale user sessions
    this.scheduleSessionCleanup();
    
    // Pre-arrival booking reminders at 9:00 AM
    this.scheduleBookingReminders();
    
    // Scheduled report delivery (every 5 minutes)
    reportingService.startScheduler();
    
    // Real-time dashboard metric push to admins (every 30 seconds)
    this.scheduleDashboardMetricPush();

    // Daily membership renewal and expiration check
    this.scheduleMembershipRenewal();

    // Daily KPI threshold alerts for managers/admins
    this.scheduleDailyKPIAlerts();
    
    logger.info('Scheduler service initialized.');
  }

  /**
   * Schedule daily database backup
   */
  private static scheduleDailyBackup() {
    // Schedule task to run at 3:00 AM every day
    cron.schedule('0 3 * * *', async () => {
      logger.info('Starting scheduled daily backup...');
      try {
        const result = await BackupService.createBackup('system-scheduler');
        logger.info(`Scheduled backup completed successfully. Filename: ${result.filename}, Size: ${result.sizeBytes} bytes`);
      } catch (error) {
        logger.error('Scheduled backup failed:', error);
      }
    });
    
    logger.info('Scheduled daily backup job (0 3 * * *)');
  }

  /**
   * Schedule pool ticket expiration check
   * Runs at midnight and every 4 hours to catch expired tickets
   */
  private static schedulePoolTicketExpiry() {
    // Run at midnight every day
    cron.schedule('0 0 * * *', async () => {
      logger.info('Starting scheduled pool ticket expiry (midnight)...');
      try {
        const result = await expirePoolTickets();
        logger.info(`Pool ticket expiry completed. Expired: ${result.expired} tickets`);
      } catch (error) {
        logger.error('Scheduled pool ticket expiry failed:', error);
      }
    });
    
    // Also run at 4 AM, 8 AM, 12 PM, 4 PM, 8 PM for better coverage
    cron.schedule('0 4,8,12,16,20 * * *', async () => {
      logger.info('Starting scheduled pool ticket expiry (4-hour check)...');
      try {
        const result = await expirePoolTickets();
        if (result.expired > 0) {
          logger.info(`Pool ticket expiry completed. Expired: ${result.expired} tickets`);
        }
      } catch (error) {
        logger.error('Scheduled pool ticket expiry failed:', error);
      }
    });
    
    logger.info('Scheduled pool ticket expiry jobs (0 0 * * * and every 4 hours)');
  }

  /**
   * Schedule stale session cleanup
   * Removes user sessions that have expired beyond the refresh token window
   * Runs daily at 4:00 AM
   */
  private static scheduleSessionCleanup() {
    cron.schedule('0 4 * * *', async () => {
      logger.info('Starting scheduled session cleanup...');
      try {
        const supabase = getSupabase();
        
        // Delete sessions that have expired (using expires_at) or are older than 7 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        
        const { data: deletedSessions, error } = await supabase
          .from('sessions')
          .delete()
          .or(`expires_at.lt.${new Date().toISOString()},created_at.lt.${cutoffDate.toISOString()}`)
          .select('id');
        
        if (error) {
          logger.error('Session cleanup query failed:', error);
          return;
        }
        
        const count = deletedSessions?.length || 0;
        if (count > 0) {
          logger.info(`Session cleanup completed. Removed ${count} stale sessions`);
          
          // Log to audit
          await supabase.from('audit_logs').insert({
            user_id: 'system',
            action: 'session_cleanup',
            resource: 'sessions',
            new_value: JSON.stringify({ 
              sessions_removed: count,
              cutoff_date: cutoffDate.toISOString(),
              cleaned_by: 'scheduled_job'
            }),
          });
        } else {
          logger.info('Session cleanup completed. No stale sessions found.');
        }
      } catch (error) {
        logger.error('Session cleanup failed:', error);
      }
    });
    
    logger.info('Scheduled session cleanup job (0 4 * * *)');
  }

  /**
   * Schedule pre-arrival booking reminders
   * Sends email reminders to guests checking in the next day
   * Runs daily at 9:00 AM
   */
  private static scheduleBookingReminders() {
    cron.schedule('0 9 * * *', async () => {
      logger.info('Starting scheduled booking reminders...');
      try {
        await bookingRemindersService.sendPreArrivalReminders();
        logger.info('Booking reminders job completed.');
      } catch (error) {
        logger.error('Scheduled booking reminders failed:', error);
      }
    });
    
    logger.info('Scheduled booking reminders job (0 9 * * *)');
  }

  /**
   * Push real-time dashboard KPIs to admin clients via Socket.IO
   * Runs every 30 seconds so admin dashboard stays live
   */
  private static scheduleDashboardMetricPush() {
    setInterval(async () => {
      try {
        const metrics = await businessMetricsService.getDashboardMetrics();
        emitToRole('admin', 'dashboard:metrics', metrics);
      } catch {
        // Silently ignore — dashboard is best-effort
      }
    }, 30_000);
    logger.info('Dashboard real-time metric push started (every 30s)');
  }

  /**
   * Runs daily membership renewal checks.
   */
  private static scheduleMembershipRenewal() {
    cron.schedule('0 2 * * *', async () => {
      logger.info('Starting scheduled membership renewal job...');
      try {
        await runMembershipRenewalJob();
        logger.info('Membership renewal job completed.');
      } catch (error) {
        logger.error('Membership renewal job failed:', error);
      }
    });

    logger.info('Scheduled membership renewal job (0 2 * * *)');
  }

  /**
   * Runs daily KPI threshold checks and emits alerts to managers/admins.
   */
  private static scheduleDailyKPIAlerts() {
    // 08:30 daily local server time
    cron.schedule('30 8 * * *', async () => {
      logger.info('Starting scheduled KPI alert job...');
      try {
        const supabase = getSupabase();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().slice(0, 10);

        const { data: targets, error: targetsError } = await supabase
          .from('kpi_targets')
          .select('property_id, kpi_code, target_value, stretch_target')
          .eq('period_type', 'daily')
          .eq('period_start', dateStr);

        if (targetsError) {
          logger.warn('KPI alert job: failed loading targets', targetsError);
          return;
        }

        const rows = targets || [];
        if (rows.length === 0) {
          logger.info('KPI alert job: no daily targets found');
          return;
        }

        for (const target of rows) {
          try {
            const kpis = await reportingService.getKPIs(
              target.property_id,
              { start: new Date(dateStr), end: new Date(dateStr) },
              [target.kpi_code]
            );
            const value = Number(kpis?.[0]?.value || 0);
            const targetValue = Number(target.target_value || 0);
            const stretchValue = Number(target.stretch_target || 0);

            if (targetValue <= 0) continue;

            const belowTarget = value < targetValue;
            const reachedStretch = stretchValue > 0 && value >= stretchValue;

            if (!belowTarget && !reachedStretch) continue;

            const severity = belowTarget ? 'warning' : 'success';
            const message = belowTarget
              ? `KPI ${target.kpi_code} is below target (${value} vs ${targetValue}) for ${dateStr}`
              : `KPI ${target.kpi_code} reached stretch target (${value} vs ${stretchValue}) for ${dateStr}`;

            emitToRole('manager', 'kpi:alert', {
              severity,
              propertyId: target.property_id,
              kpiCode: target.kpi_code,
              value,
              targetValue,
              stretchValue,
              date: dateStr,
              message,
            });
            emitToRole('admin', 'kpi:alert', {
              severity,
              propertyId: target.property_id,
              kpiCode: target.kpi_code,
              value,
              targetValue,
              stretchValue,
              date: dateStr,
              message,
            });
          } catch (innerError) {
            logger.warn('KPI alert job: failed to evaluate target row', innerError);
          }
        }

        logger.info('KPI alert job completed.');
      } catch (error) {
        logger.error('KPI alert job failed:', error);
      }
    });

    logger.info('Scheduled KPI alert job (30 8 * * *)');
  }
}
