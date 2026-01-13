/**
 * Scheduled Reports Controller
 * Handles CRUD operations for scheduled email reports
 */

import { Request, Response, NextFunction } from 'express';
import { scheduledReportsService } from '../../../services/scheduled-reports.service.js';
import { logActivity } from '../../../utils/activityLogger.js';
import { logger } from '../../../utils/logger.js';

/**
 * List all scheduled reports
 */
export async function getScheduledReports(req: Request, res: Response, next: NextFunction) {
  try {
    const reports = await scheduledReportsService.listReports();
    
    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new scheduled report
 */
export async function createScheduledReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const { name, type, reportType, recipients, enabled = true } = req.body;
    
    if (!name || !type || !reportType || !recipients?.length) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, type, reportType, recipients',
      });
    }
    
    if (!['daily', 'weekly', 'monthly'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Must be: daily, weekly, or monthly',
      });
    }
    
    if (!['revenue', 'occupancy', 'orders', 'customers', 'overview'].includes(reportType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reportType. Must be: revenue, occupancy, orders, customers, or overview',
      });
    }
    
    const report = await scheduledReportsService.createReport({
      name,
      type,
      reportType,
      recipients,
      enabled,
      createdBy: userId || 'system',
    });
    
    await logActivity({
      user_id: userId || 'system',
      action: 'CREATE',
      resource: 'scheduled_report',
      resource_id: report.id,
    });
    
    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a scheduled report
 */
export async function updateScheduledReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const updates = req.body;
    
    const report = await scheduledReportsService.updateReport(id, updates);
    
    await logActivity({
      user_id: userId || 'system',
      action: 'UPDATE',
      resource: 'scheduled_report',
      resource_id: id,
    });
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a scheduled report
 */
export async function deleteScheduledReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    
    await scheduledReportsService.deleteReport(id);
    
    await logActivity({
      user_id: userId || 'system',
      action: 'DELETE',
      resource: 'scheduled_report',
      resource_id: id,
    });
    
    res.json({
      success: true,
      message: 'Scheduled report deleted',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send a report immediately (manual trigger)
 */
export async function sendReportNow(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    
    await scheduledReportsService.sendReportNow(id);
    
    await logActivity({
      user_id: userId || 'system',
      action: 'SEND',
      resource: 'scheduled_report',
      resource_id: id,
    });
    
    res.json({
      success: true,
      message: 'Report sent successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Preview a report (generate without sending)
 */
export async function previewReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { reportType, period = 'day' } = req.query;
    
    if (!reportType) {
      return res.status(400).json({
        success: false,
        error: 'reportType query parameter required',
      });
    }
    
    const validPeriods = ['day', 'week', 'month'];
    if (!validPeriods.includes(period as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period. Must be: day, week, or month',
      });
    }
    
    const reportData = await scheduledReportsService.generateReportData(
      reportType as string,
      period as 'day' | 'week' | 'month'
    );
    
    // Return both raw data and HTML preview
    const html = scheduledReportsService.generateEmailHtml(reportData);
    
    res.json({
      success: true,
      data: {
        report: reportData,
        htmlPreview: html,
      },
    });
  } catch (error) {
    next(error);
  }
}
