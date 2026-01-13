import cron from 'node-cron';
import { BackupService } from './backup.service.js';
import { logger } from '../utils/logger.js';
import { expirePoolTickets } from '../scripts/expire-pool-tickets.js';
import { getSupabase } from '../database/connection.js';

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
        
        // Delete sessions older than 7 days (refresh token lifetime)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        
        const { data: deletedSessions, error } = await supabase
          .from('sessions')
          .delete()
          .lt('created_at', cutoffDate.toISOString())
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
}
