/**
 * Revenue Management Routes
 * Phase 3.2: Revenue Management System
 */

import { Router } from 'express';
import { revenueController } from './revenue.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// =============================================
// DEMAND FORECASTING
// =============================================
router.post('/forecasts/generate', authorize('admin', 'manager'), revenueController.generateForecasts.bind(revenueController));
router.get('/forecasts', revenueController.getForecasts.bind(revenueController));

// =============================================
// PRICING RULES
// =============================================
router.get('/rules', revenueController.getPricingRules.bind(revenueController));
router.post('/rules', authorize('admin', 'manager'), revenueController.createPricingRule.bind(revenueController));
router.put('/rules/:id', authorize('admin', 'manager'), revenueController.updatePricingRule.bind(revenueController));
router.delete('/rules/:id', authorize('admin', 'manager'), revenueController.deletePricingRule.bind(revenueController));

// =============================================
// DYNAMIC PRICING
// =============================================
router.get('/calculate-rate', revenueController.calculateRate.bind(revenueController));
router.get('/calculate-rates-range', revenueController.calculateRatesForRange.bind(revenueController));

// =============================================
// PRICING CALENDAR
// =============================================
router.get('/calendar', revenueController.getPricingCalendar.bind(revenueController));
router.put('/calendar/:roomTypeId/:date', authorize('admin', 'manager'), revenueController.updatePricingCalendar.bind(revenueController));
router.post('/calendar/bulk', authorize('admin', 'manager'), revenueController.bulkUpdatePricingCalendar.bind(revenueController));

// =============================================
// RATE RECOMMENDATIONS
// =============================================
router.post('/recommendations/generate', authorize('admin', 'manager'), revenueController.generateRecommendations.bind(revenueController));
router.get('/recommendations', revenueController.getRecommendations.bind(revenueController));
router.post('/recommendations/:id/respond', authorize('admin', 'manager'), revenueController.respondToRecommendation.bind(revenueController));

// =============================================
// MARKET EVENTS
// =============================================
router.get('/events', revenueController.getMarketEvents.bind(revenueController));
router.post('/events', authorize('admin', 'manager'), revenueController.createMarketEvent.bind(revenueController));
router.put('/events/:id', authorize('admin', 'manager'), revenueController.updateMarketEvent.bind(revenueController));
router.delete('/events/:id', authorize('admin', 'manager'), revenueController.deleteMarketEvent.bind(revenueController));

// =============================================
// COMPETITOR RATES
// =============================================
router.post('/competitors', authorize('admin', 'manager'), revenueController.recordCompetitorRate.bind(revenueController));
router.get('/competitors', revenueController.getCompetitorRates.bind(revenueController));

// =============================================
// SEASONALITY PATTERNS
// =============================================
router.get('/seasonality', revenueController.getSeasonalityPatterns.bind(revenueController));
router.post('/seasonality', authorize('admin', 'manager'), revenueController.createSeasonalityPattern.bind(revenueController));
router.put('/seasonality/:id', authorize('admin', 'manager'), revenueController.updateSeasonalityPattern.bind(revenueController));

// =============================================
// YIELD MANAGEMENT LOG
// =============================================
router.get('/yield-log', revenueController.getYieldLog.bind(revenueController));

// =============================================
// REVENUE ANALYTICS
// =============================================
router.get('/analytics/summary', revenueController.getRevenueSummary.bind(revenueController));
router.get('/analytics/by-room-type', revenueController.getRevenueByRoomType.bind(revenueController));

export { router as revenueRoutes };

