import { Request, Response } from 'express';
import * as parityService from './parity.service.js';

// ==================== CONFIGURATION ====================

export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;

    const config = await parityService.getParityConfig(propertyId);

    res.json({
      success: true,
      config: config || {
        is_enabled: false,
        message: 'Rate parity monitoring not configured for this property'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get config';
    res.status(500).json({ error: message });
  }
}

export async function updateConfig(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;
    const config = req.body;

    const updated = await parityService.createOrUpdateParityConfig(propertyId, config);

    res.json({
      success: true,
      message: 'Configuration updated',
      config: updated
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update config';
    res.status(400).json({ error: message });
  }
}

// ==================== PARITY CHECKS ====================

export async function runCheck(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;
    const { room_type_id, date, rate } = req.body;

    if (!room_type_id || !date || rate === undefined) {
      res.status(400).json({ error: 'room_type_id, date, and rate are required' });
      return;
    }

    const check = await parityService.runParityCheck(
      propertyId,
      room_type_id,
      date,
      rate
    );

    res.json({
      success: true,
      check
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run parity check';
    res.status(500).json({ error: message });
  }
}

export async function runFullCheck(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;

    const result = await parityService.runFullParityCheck(propertyId);

    res.json({
      success: true,
      message: `Completed ${result.checks} checks with ${result.violations} violations`,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run full parity check';
    res.status(500).json({ error: message });
  }
}

export async function getCheckHistory(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;
    const { start_date, end_date } = req.query;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startDate = start_date ? String(start_date) : thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = end_date ? String(end_date) : new Date().toISOString().split('T')[0];

    const history = await parityService.getCheckHistory(propertyId, startDate, endDate);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get check history';
    res.status(500).json({ error: message });
  }
}

// ==================== ALERTS ====================

export async function getAlerts(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;
    const { status, severity, limit } = req.query;

    const alerts = await parityService.getAlerts(propertyId, {
      status: status ? String(status) : undefined,
      severity: severity ? String(severity) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined
    });

    res.json({
      success: true,
      alerts
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get alerts';
    res.status(500).json({ error: message });
  }
}

export async function acknowledgeAlert(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    const userId = req.user?.id;
    const { notes } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    await parityService.acknowledgeAlert(alertId, userId, notes);

    res.json({
      success: true,
      message: 'Alert acknowledged'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to acknowledge alert';
    res.status(400).json({ error: message });
  }
}

export async function resolveAlert(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;

    await parityService.resolveAlert(alertId, notes);

    res.json({
      success: true,
      message: 'Alert resolved'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve alert';
    res.status(400).json({ error: message });
  }
}

export async function ignoreAlert(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;

    await parityService.ignoreAlert(alertId, notes);

    res.json({
      success: true,
      message: 'Alert ignored'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to ignore alert';
    res.status(400).json({ error: message });
  }
}

// ==================== DASHBOARD ====================

export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;

    const dashboard = await parityService.getParityDashboard(propertyId);

    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get dashboard';
    res.status(500).json({ error: message });
  }
}
