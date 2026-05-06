/**
 * Analytics Controller
 * Phase 2 Upgrade: API endpoints for real-time analytics, alerts, and segmentation
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { alertService } from './alert.service.js';
import { queryBuilderService } from './query-builder.service.js';
import { guestSegmentationService } from './guest-segmentation.service.js';
import { metricsLayer } from './metrics-layer.service.js';

export class AnalyticsController {
  // =============================================
  // REAL-TIME ANALYTICS
  // =============================================

  getSnapshot = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    
    if (!propertyId) {
      res.status(400).json({ error: 'Property ID required' });
      return;
    }

    const [engines, financial, hourlyRevenue, revenueByEngine, timeline, systemServices] = await Promise.all([
      metricsLayer.getEngineHealth(propertyId),
      metricsLayer.getFinancialRows(propertyId),
      metricsLayer.getHourlyRevenue(propertyId),
      metricsLayer.getRevenueByEngine(propertyId),
      metricsLayer.getTimeline(propertyId, 10),
      metricsLayer.getSystemServices(propertyId)
    ]);
    
    const data = {
      engines,
      financial,
      hourlyRevenue,
      revenueByEngine,
      timeline,
      systemServices
    };
    
    res.json({ data });
  });

  // =============================================
  // ALERTS
  // =============================================

  getAlertDefinitions = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const { activeOnly, kpiCode } = req.query;

    const alerts = await alertService.getAlertDefinitions(propertyId, {
      activeOnly: activeOnly === 'true',
      kpiCode: kpiCode as string
    });

    res.json({ alerts });
  });

  createAlertDefinition = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const alert = await alertService.createAlertDefinition(propertyId, userId, req.body);
    res.status(201).json({ alert });
  });

  updateAlertDefinition = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const alert = await alertService.updateAlertDefinition(id, req.body);
    res.json({ alert });
  });

  deleteAlertDefinition = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await alertService.deleteAlertDefinition(id);
    res.status(204).send();
  });

  getActiveAlerts = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const alerts = await alertService.getActiveAlerts(propertyId);
    res.json({ alerts });
  });

  getAlertHistory = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const { status, from, to, limit } = req.query;

    const alerts = await alertService.getAlertHistory(propertyId, {
      status: status as 'active' | 'acknowledged' | 'resolved',
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json({ alerts });
  });

  acknowledgeAlert = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    await alertService.acknowledgeAlert(id, userId);
    res.json({ success: true });
  });

  // =============================================
  // QUERY BUILDER
  // =============================================

  executeQuery = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const result = await queryBuilderService.executeQuery(propertyId, req.body);
    res.json(result);
  });

  getQuerySuggestions = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const { table } = req.params;

    const suggestions = await queryBuilderService.getQuerySuggestions(propertyId, table);
    res.json(suggestions);
  });

  saveQuery = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const saved = await queryBuilderService.saveQuery(propertyId, userId, req.body);
    res.status(201).json({ query: saved });
  });

  getSavedQueries = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const userId = req.user?.id;
    const { category, publicOnly } = req.query;

    const queries = await queryBuilderService.getSavedQueries(propertyId, {
      userId,
      category: category as string,
      publicOnly: publicOnly === 'true'
    });

    res.json({ queries });
  });

  // =============================================
  // GUEST SEGMENTATION
  // =============================================

  getRFMScores = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const profiles = await guestSegmentationService.calculateRFMScores(propertyId);
    res.json({ profiles, count: profiles.length });
  });

  getSegmentDistribution = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const distribution = await guestSegmentationService.getSegmentDistribution(propertyId);
    res.json({ distribution });
  });

  getGuestsBySegment = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const { segment } = req.params;

    const guests = await guestSegmentationService.getGuestsBySegment(propertyId, segment);
    res.json({ guests, count: guests.length });
  });

  getCohortAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const analysis = await guestSegmentationService.calculateCohortAnalysis(propertyId);
    res.json({ analysis });
  });

  getSegmentRecommendations = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const recommendations = await guestSegmentationService.getSegmentRecommendations(propertyId);
    res.json({ recommendations });
  });

  // =============================================
  // GOVERNED METRICS LAYER (Executive Cockpit)
  // =============================================

  getMetricsBatch = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const { codes, period, compareTo } = req.body;

    const metrics = await metricsLayer.getMetrics(propertyId, codes, {
      period,
      compareTo
    });

    // Transform to expected format
    const data: Record<string, unknown> = {};
    for (const metric of metrics) {
      data[metric.metric.code] = {
        current: metric.current,
        prior: metric.prior,
        variance: metric.variance,
        variancePercent: metric.variancePercent,
        sparkline: []
      };
    }

    res.json({ data });
  });

  getExceptions = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const { severity, limit } = req.query;

    const exceptions = await metricsLayer.getExceptions(propertyId, {
      severity: severity as 'critical' | 'warning' | 'all',
      limit: limit ? parseInt(limit as string) : undefined
    });

    // Build module name lookup from modules table
    const { data: modules } = await metricsLayer['supabase']
      .from('modules')
      .select('id, name, engine_type, template_type')
      .eq('property_id', propertyId);
    const moduleMap: Record<string, { name: string; engine: string }> = {};
    for (const m of (modules || [])) {
      moduleMap[m.id] = {
        name: m.name,
        engine: m.engine_type || (
          m.template_type === 'menu_service' ? 'instant_transaction' :
          m.template_type === 'multi_day_booking' ? 'time_exclusive_reservation' :
          m.template_type === 'session_access' ? 'shared_capacity_access' : 'instant_transaction'
        )
      };
    }

    const data = exceptions.map(e => {
      const context = (e as any).context || {};
      const mod = moduleMap[context.module_id] || { name: 'System', engine: 'instant_transaction' };
      return {
        id: e.id,
        type: e.type,
        severity: e.severity,
        moduleName: context.module_name || mod.name,
        engineType: context.engine_type || mod.engine,
        count: context.count || 1,
        trend: context.trend || 0,
        lastOccurred: new Date(e.triggeredAt).toLocaleString()
      };
    });

    res.json({ data });
  });

  getFinancialReport = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const { reportType, period } = req.body;

    const report = await metricsLayer.getFinancialReport(propertyId, reportType, {
      start: new Date(period.start),
      end: new Date(period.end)
    });

    res.json(report);
  });

  drillDown = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;
    const { metricCode, dimensions, filters } = req.body;

    const data = await metricsLayer.drillDown(propertyId, metricCode, dimensions, filters);
    res.json({ data });
  });

  // =============================================
  // ENGINE FRAMEWORK ENDPOINT
  // =============================================

  getEngines = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.headers['x-property-id'] as string;

    if (!propertyId) {
      res.status(400).json({ error: 'Property ID required' });
      return;
    }

    const result = await metricsLayer.getEngines(propertyId);
    res.json(result);
  });
}

export const analyticsController = new AnalyticsController();
