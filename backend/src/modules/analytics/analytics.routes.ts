/**
 * Analytics Routes
 * Phase 2 Upgrade: Advanced reporting and analytics endpoints
 */

import { Router } from 'express';
import { analyticsController } from './analytics.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { validatePropertyAccess } from '../../middleware/propertyAccess.middleware.js';
import { createRateLimiter } from '../../middleware/api-security.middleware.js';

const router = Router();

// Rate limiter for expensive analytics endpoints
const analyticsRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many analytics requests'
});

// All routes require authentication and property access
router.use(authenticate);
router.use(validatePropertyAccess);

// =============================================
// REAL-TIME ANALYTICS
// =============================================
router.get('/snapshot', analyticsController.getSnapshot);

// =============================================
// ALERTS
// =============================================
router.get('/alerts/definitions', analyticsController.getAlertDefinitions);
router.post('/alerts/definitions', authorize('admin', 'manager'), analyticsController.createAlertDefinition);
router.put('/alerts/definitions/:id', authorize('admin', 'manager'), analyticsController.updateAlertDefinition);
router.delete('/alerts/definitions/:id', authorize('admin', 'manager'), analyticsController.deleteAlertDefinition);

router.get('/alerts/active', analyticsController.getActiveAlerts);
router.get('/alerts/history', analyticsController.getAlertHistory);
router.post('/alerts/:id/acknowledge', analyticsController.acknowledgeAlert);

// =============================================
// QUERY BUILDER
// =============================================
router.post('/query/execute', analyticsRateLimit, analyticsController.executeQuery);
router.get('/query/suggestions/:table', analyticsController.getQuerySuggestions);
router.post('/query/save', analyticsController.saveQuery);
router.get('/query/saved', analyticsController.getSavedQueries);

// =============================================
// GUEST SEGMENTATION
// =============================================
router.get('/guests/rfm', authorize('admin', 'manager'), analyticsController.getRFMScores);
router.get('/guests/segments', authorize('admin', 'manager'), analyticsController.getSegmentDistribution);
router.get('/guests/segments/:segment', authorize('admin', 'manager'), analyticsController.getGuestsBySegment);
router.get('/guests/cohorts', authorize('admin', 'manager'), analyticsController.getCohortAnalysis);
router.get('/guests/recommendations', authorize('admin', 'manager'), analyticsController.getSegmentRecommendations);

// =============================================
// GOVERNED METRICS LAYER (Executive Cockpit)
// =============================================
router.post('/metrics/batch', authorize('admin', 'manager'), analyticsController.getMetricsBatch);
router.get('/exceptions', authorize('admin', 'manager'), analyticsController.getExceptions);
router.post('/reports/financial', authorize('admin', 'manager'), analyticsController.getFinancialReport);
router.post('/metrics/drilldown', authorize('admin', 'manager'), analyticsController.drillDown);

// =============================================
// ENGINE FRAMEWORK
// =============================================
router.get('/engines', authorize('admin', 'manager'), analyticsController.getEngines);

export { router as analyticsRoutes };
