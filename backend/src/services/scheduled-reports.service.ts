/**
 * Scheduled Reports Service
 * Handles automated report generation and email delivery
 */

import cron, { ScheduledTask } from 'node-cron';
import { getSupabase } from '../database/connection.js';
import { emailService } from './email.service.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

interface ScheduledReport {
  id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly';
  reportType: 'revenue' | 'occupancy' | 'orders' | 'customers' | 'overview';
  recipients: string[];
  enabled: boolean;
  lastSent?: string;
  nextRun?: string;
  createdAt: string;
  createdBy: string;
}

interface ReportData {
  title: string;
  period: string;
  generatedAt: string;
  sections: ReportSection[];
}

interface ReportSection {
  title: string;
  data: Record<string, string | number>[];
  summary?: Record<string, string | number>;
}

class ScheduledReportsService {
  private jobs: Map<string, ScheduledTask> = new Map();
  private initialized = false;

  /**
   * Initialize scheduled reports from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const supabase = getSupabase();
      
      // Check if scheduled_reports table exists, if not create it
      const { error: checkError } = await supabase
        .from('scheduled_reports')
        .select('id')
        .limit(1);
      
      if (checkError && checkError.message.includes('does not exist')) {
        logger.info('Scheduled reports table not found, skipping initialization');
        this.initialized = true;
        return;
      }
      
      // Load all enabled scheduled reports
      const { data: reports, error } = await supabase
        .from('scheduled_reports')
        .select('*')
        .eq('enabled', true);
      
      if (error) {
        logger.error('Failed to load scheduled reports', { error: error.message });
        return;
      }
      
      // Schedule each report
      for (const report of (reports || []) as ScheduledReport[]) {
        this.scheduleReport(report);
      }
      
      this.initialized = true;
      logger.info(`Scheduled reports service initialized with ${reports?.length || 0} active reports`);
    } catch (error) {
      logger.error('Failed to initialize scheduled reports', { error });
    }
  }

  /**
   * Get cron expression for report type
   */
  private getCronExpression(type: 'daily' | 'weekly' | 'monthly'): string {
    switch (type) {
      case 'daily':
        return '0 7 * * *'; // 7 AM every day
      case 'weekly':
        return '0 7 * * 1'; // 7 AM every Monday
      case 'monthly':
        return '0 7 1 * *'; // 7 AM on 1st of month
      default:
        return '0 7 * * *';
    }
  }

  /**
   * Schedule a report for automated delivery
   */
  scheduleReport(report: ScheduledReport): void {
    // Cancel existing job if any
    if (this.jobs.has(report.id)) {
      this.jobs.get(report.id)?.stop();
    }
    
    const cronExpression = this.getCronExpression(report.type);
    
    const job = cron.schedule(cronExpression, async () => {
      logger.info(`Running scheduled report: ${report.name}`);
      await this.generateAndSendReport(report);
    });
    
    this.jobs.set(report.id, job);
    logger.info(`Scheduled report "${report.name}" with cron: ${cronExpression}`);
  }

  /**
   * Unschedule a report
   */
  unscheduleReport(reportId: string): void {
    const job = this.jobs.get(reportId);
    if (job) {
      job.stop();
      this.jobs.delete(reportId);
      logger.info(`Unscheduled report: ${reportId}`);
    }
  }

  /**
   * Generate report data based on type
   */
  async generateReportData(reportType: string, period: 'day' | 'week' | 'month'): Promise<ReportData> {
    const supabase = getSupabase();
    const now = dayjs();
    
    let startDate: string;
    let endDate: string;
    let periodLabel: string;
    
    switch (period) {
      case 'day':
        startDate = now.subtract(1, 'day').startOf('day').toISOString();
        endDate = now.subtract(1, 'day').endOf('day').toISOString();
        periodLabel = now.subtract(1, 'day').format('MMMM D, YYYY');
        break;
      case 'week':
        startDate = now.subtract(1, 'week').startOf('week').toISOString();
        endDate = now.subtract(1, 'week').endOf('week').toISOString();
        periodLabel = `Week of ${now.subtract(1, 'week').startOf('week').format('MMM D')} - ${now.subtract(1, 'week').endOf('week').format('MMM D, YYYY')}`;
        break;
      case 'month':
        startDate = now.subtract(1, 'month').startOf('month').toISOString();
        endDate = now.subtract(1, 'month').endOf('month').toISOString();
        periodLabel = now.subtract(1, 'month').format('MMMM YYYY');
        break;
    }
    
    const sections: ReportSection[] = [];
    
    // Generate sections based on report type
    if (reportType === 'revenue' || reportType === 'overview') {
      // Restaurant revenue
      const { data: restaurantOrders } = await supabase
        .from('restaurant_orders')
        .select('total_amount, payment_status')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      const restaurantRevenue = (restaurantOrders || [])
        .filter(o => o.payment_status === 'paid')
        .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      
      // Chalet revenue
      const { data: chaletBookings } = await supabase
        .from('chalet_bookings')
        .select('total_amount, payment_status')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      const chaletRevenue = (chaletBookings || [])
        .filter(b => b.payment_status === 'paid')
        .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
      
      // Pool revenue
      const { data: poolTickets } = await supabase
        .from('pool_tickets')
        .select('total_amount, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      const poolRevenue = (poolTickets || [])
        .filter(t => t.status === 'used' || t.status === 'valid')
        .reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
      
      sections.push({
        title: 'Revenue Summary',
        data: [
          { source: 'Restaurant', amount: `$${restaurantRevenue.toFixed(2)}`, orders: restaurantOrders?.length || 0 },
          { source: 'Chalets', amount: `$${chaletRevenue.toFixed(2)}`, bookings: chaletBookings?.length || 0 },
          { source: 'Pool', amount: `$${poolRevenue.toFixed(2)}`, tickets: poolTickets?.length || 0 },
        ],
        summary: {
          'Total Revenue': `$${(restaurantRevenue + chaletRevenue + poolRevenue).toFixed(2)}`,
        },
      });
    }
    
    if (reportType === 'occupancy' || reportType === 'overview') {
      const { data: bookings } = await supabase
        .from('chalet_bookings')
        .select('chalet_id, check_in_date, check_out_date, status')
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate);
      
      const { count: totalChalets } = await supabase
        .from('chalets')
        .select('id', { count: 'exact', head: true });
      
      const confirmedBookings = (bookings || []).filter(b => b.status === 'confirmed' || b.status === 'checked_in');
      const occupancyRate = totalChalets ? (confirmedBookings.length / (totalChalets * 7)) * 100 : 0;
      
      sections.push({
        title: 'Occupancy Report',
        data: [
          { metric: 'Total Bookings', value: bookings?.length || 0 },
          { metric: 'Confirmed Bookings', value: confirmedBookings.length },
          { metric: 'Average Occupancy Rate', value: `${occupancyRate.toFixed(1)}%` },
        ],
      });
    }
    
    if (reportType === 'orders' || reportType === 'overview') {
      const { data: orders } = await supabase
        .from('restaurant_orders')
        .select('status, total_amount')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      const statusCounts = (orders || []).reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      sections.push({
        title: 'Orders Summary',
        data: Object.entries(statusCounts).map(([status, count]) => ({
          status: status.charAt(0).toUpperCase() + status.slice(1),
          count,
        })),
        summary: {
          'Total Orders': orders?.length || 0,
        },
      });
    }
    
    if (reportType === 'customers' || reportType === 'overview') {
      const { count: newCustomers } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      const { count: totalCustomers } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer');
      
      sections.push({
        title: 'Customer Metrics',
        data: [
          { metric: 'New Customers', value: newCustomers || 0 },
          { metric: 'Total Customers', value: totalCustomers || 0 },
        ],
      });
    }
    
    return {
      title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
      period: periodLabel,
      generatedAt: now.format('MMMM D, YYYY [at] h:mm A'),
      sections,
    };
  }

  /**
   * Generate HTML email from report data
   */
  generateEmailHtml(report: ReportData): string {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9fafb; }
          .section { background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .section-title { font-size: 18px; font-weight: bold; color: #0891b2; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f3f4f6; font-weight: 600; }
          .summary { background: #ecfdf5; padding: 12px; border-radius: 6px; margin-top: 12px; }
          .summary-item { display: flex; justify-content: space-between; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${report.title}</h1>
          <p>${report.period}</p>
        </div>
        <div class="content">
    `;
    
    for (const section of report.sections) {
      html += `
        <div class="section">
          <div class="section-title">${section.title}</div>
          <table>
            <thead>
              <tr>
                ${Object.keys(section.data[0] || {}).map(key => 
                  `<th>${key.charAt(0).toUpperCase() + key.slice(1)}</th>`
                ).join('')}
              </tr>
            </thead>
            <tbody>
              ${section.data.map(row => `
                <tr>
                  ${Object.values(row).map(val => `<td>${val}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${section.summary ? `
            <div class="summary">
              ${Object.entries(section.summary).map(([key, val]) => `
                <div class="summary-item"><strong>${key}:</strong> <span>${val}</span></div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }
    
    html += `
        </div>
        <div class="footer">
          <p>Generated on ${report.generatedAt}</p>
          <p>V2 Resort Management System</p>
        </div>
      </body>
      </html>
    `;
    
    return html;
  }

  /**
   * Generate and send a scheduled report
   */
  async generateAndSendReport(report: ScheduledReport): Promise<void> {
    try {
      const period = report.type === 'daily' ? 'day' : report.type === 'weekly' ? 'week' : 'month';
      const reportData = await this.generateReportData(report.reportType, period);
      const html = this.generateEmailHtml(reportData);
      
      // Send to all recipients
      for (const recipient of report.recipients) {
        await emailService.sendEmail({
          to: recipient,
          subject: `${reportData.title} - ${reportData.period}`,
          html,
        });
      }
      
      // Update last sent timestamp
      const supabase = getSupabase();
      await supabase
        .from('scheduled_reports')
        .update({
          last_sent: new Date().toISOString(),
          next_run: this.getNextRun(report.type),
        })
        .eq('id', report.id);
      
      logger.info(`Sent scheduled report "${report.name}" to ${report.recipients.length} recipients`);
    } catch (error) {
      logger.error(`Failed to send scheduled report: ${report.name}`, { error });
    }
  }

  /**
   * Calculate next run time
   */
  private getNextRun(type: 'daily' | 'weekly' | 'monthly'): string {
    const now = dayjs();
    switch (type) {
      case 'daily':
        return now.add(1, 'day').hour(7).minute(0).second(0).toISOString();
      case 'weekly':
        return now.add(1, 'week').day(1).hour(7).minute(0).second(0).toISOString();
      case 'monthly':
        return now.add(1, 'month').date(1).hour(7).minute(0).second(0).toISOString();
    }
  }

  /**
   * Create a new scheduled report
   */
  async createReport(data: Omit<ScheduledReport, 'id' | 'createdAt' | 'lastSent' | 'nextRun'>): Promise<ScheduledReport> {
    const supabase = getSupabase();
    
    const newReport = {
      ...data,
      next_run: this.getNextRun(data.type),
      created_at: new Date().toISOString(),
    };
    
    const { data: created, error } = await supabase
      .from('scheduled_reports')
      .insert(newReport)
      .select()
      .single();
    
    if (error) throw error;
    
    const report = created as ScheduledReport;
    
    if (report.enabled) {
      this.scheduleReport(report);
    }
    
    return report;
  }

  /**
   * Update a scheduled report
   */
  async updateReport(id: string, data: Partial<ScheduledReport>): Promise<ScheduledReport> {
    const supabase = getSupabase();
    
    const { data: updated, error } = await supabase
      .from('scheduled_reports')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    const report = updated as ScheduledReport;
    
    // Re-schedule if enabled, otherwise unschedule
    if (report.enabled) {
      this.scheduleReport(report);
    } else {
      this.unscheduleReport(id);
    }
    
    return report;
  }

  /**
   * Delete a scheduled report
   */
  async deleteReport(id: string): Promise<void> {
    const supabase = getSupabase();
    
    this.unscheduleReport(id);
    
    const { error } = await supabase
      .from('scheduled_reports')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  /**
   * List all scheduled reports
   */
  async listReports(): Promise<ScheduledReport[]> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []) as ScheduledReport[];
  }

  /**
   * Send a report immediately (manual trigger)
   */
  async sendReportNow(id: string): Promise<void> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    await this.generateAndSendReport(data as ScheduledReport);
  }
}

export const scheduledReportsService = new ScheduledReportsService();
