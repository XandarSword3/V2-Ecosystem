/**
 * Revenue Management Controller
 * Phase 3.2: HTTP endpoints for revenue management
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { revenueManagementService } from './revenue.service';

export class RevenueController {
  // =============================================
  // DEMAND FORECASTING
  // =============================================

  generateForecasts = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate } = req.body;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const count = await revenueManagementService.generateForecasts(
        propertyId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({ message: 'Forecasts generated', count });
  });
  getForecasts = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate, roomTypeId } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const start = startDate ? new Date(startDate as string) : new Date();
      const end = endDate ? new Date(endDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const forecasts = await revenueManagementService.getForecasts(
        propertyId,
        start,
        end,
        roomTypeId as string
      );

      res.json({ forecasts });
  });
  // =============================================
  // PRICING RULES
  // =============================================

  getPricingRules = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { activeOnly } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const rules = await revenueManagementService.getPricingRules(
        propertyId,
        activeOnly !== 'false'
      );

      res.json({ rules });
  });
  createPricingRule = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const rule = await revenueManagementService.createPricingRule(propertyId, req.body, userId);
      res.status(201).json({ rule });
  });
  updatePricingRule = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      await revenueManagementService.updatePricingRule(id, req.body);
      res.json({ message: 'Rule updated' });
  });
  deletePricingRule = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      await revenueManagementService.deletePricingRule(id);
      res.status(204).send();
  });
  // =============================================
  // DYNAMIC PRICING
  // =============================================

  calculateRate = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { roomTypeId, date } = req.query;

      if (!propertyId || !roomTypeId || !date) {
        res.status(400).json({ error: 'Property ID, room type ID, and date required' });
        return;
      }

      const result = await revenueManagementService.calculateDynamicRate(
        propertyId,
        roomTypeId as string,
        new Date(date as string)
      );

      res.json(result);
  });
  calculateRatesForRange = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { roomTypeId, startDate, endDate } = req.query;

      if (!propertyId || !roomTypeId || !startDate || !endDate) {
        res.status(400).json({ error: 'Property ID, room type ID, start date, and end date required' });
        return;
      }

      const rates = await revenueManagementService.calculateRatesForRange(
        propertyId,
        roomTypeId as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({ rates });
  });
  // =============================================
  // PRICING CALENDAR
  // =============================================

  getPricingCalendar = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate, roomTypeId } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const start = startDate ? new Date(startDate as string) : new Date();
      const end = endDate ? new Date(endDate as string) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      const calendar = await revenueManagementService.getPricingCalendar(
        propertyId,
        start,
        end,
        roomTypeId as string
      );

      res.json({ calendar });
  });
  updatePricingCalendar = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');
      const { roomTypeId, date } = req.params;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      await revenueManagementService.updatePricingCalendar(
        propertyId,
        roomTypeId,
        new Date(date),
        req.body,
        userId
      );

      res.json({ message: 'Calendar updated' });
  });
  bulkUpdatePricingCalendar = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');
      const { roomTypeId, startDate, endDate, ...updates } = req.body;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const count = await revenueManagementService.bulkUpdatePricingCalendar(
        propertyId,
        roomTypeId,
        new Date(startDate),
        new Date(endDate),
        updates,
        userId
      );

      res.json({ message: 'Calendar updated', daysUpdated: count });
  });
  // =============================================
  // RATE RECOMMENDATIONS
  // =============================================

  generateRecommendations = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { date } = req.body;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const recommendations = await revenueManagementService.generateRecommendations(
        propertyId,
        date ? new Date(date) : new Date()
      );

      res.json({ recommendations });
  });
  getRecommendations = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { status = 'pending' } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const recommendations = await revenueManagementService.getRecommendations(
        propertyId,
        status as string
      );

      res.json({ recommendations });
  });
  respondToRecommendation = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { status, notes } = req.body;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');

      if (!['accepted', 'rejected'].includes(status)) {
        res.status(400).json({ error: 'Status must be accepted or rejected' });
        return;
      }

      await revenueManagementService.respondToRecommendation(id, status, userId, notes);
      res.json({ message: 'Recommendation processed' });
  });
  // =============================================
  // MARKET EVENTS
  // =============================================

  getMarketEvents = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const start = startDate ? new Date(startDate as string) : new Date();
      const end = endDate ? new Date(endDate as string) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const events = await revenueManagementService.getMarketEvents(propertyId, start, end);
      res.json({ events });
  });
  createMarketEvent = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');
      const { isGlobal, ...eventData } = req.body;

      const event = await revenueManagementService.createMarketEvent(
        isGlobal ? null : propertyId,
        eventData,
        userId
      );

      res.status(201).json({ event });
  });
  updateMarketEvent = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      await revenueManagementService.updateMarketEvent(id, req.body);
      res.json({ message: 'Event updated' });
  });
  deleteMarketEvent = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      await revenueManagementService.deleteMarketEvent(id);
      res.status(204).send();
  });
  // =============================================
  // COMPETITOR RATES
  // =============================================

  recordCompetitorRate = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { competitorName, date, rate, ...options } = req.body;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      await revenueManagementService.recordCompetitorRate(
        propertyId,
        competitorName,
        new Date(date),
        rate,
        options
      );

      res.status(201).json({ message: 'Competitor rate recorded' });
  });
  getCompetitorRates = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const start = startDate ? new Date(startDate as string) : new Date();
      const end = endDate ? new Date(endDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const rates = await revenueManagementService.getCompetitorRates(propertyId, start, end);
      res.json({ rates });
  });
  // =============================================
  // SEASONALITY PATTERNS
  // =============================================

  getSeasonalityPatterns = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const patterns = await revenueManagementService.getSeasonalityPatterns(propertyId);
      res.json({ patterns });
  });
  createSeasonalityPattern = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const pattern = await revenueManagementService.createSeasonalityPattern(propertyId, req.body);
      res.status(201).json({ pattern });
  });
  updateSeasonalityPattern = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      await revenueManagementService.updateSeasonalityPattern(id, req.body);
      res.json({ message: 'Pattern updated' });
  });
  // =============================================
  // YIELD MANAGEMENT LOG
  // =============================================

  getYieldLog = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate, actionType } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const log = await revenueManagementService.getYieldManagementLog(
        propertyId,
        start,
        end,
        actionType as string
      );

      res.json({ log });
  });
  // =============================================
  // REVENUE ANALYTICS
  // =============================================

  getRevenueSummary = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const summary = await revenueManagementService.getRevenueSummary(propertyId, start, end);
      res.json(summary);
  });
  getRevenueByRoomType = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const breakdown = await revenueManagementService.getRevenueByRoomType(propertyId, start, end);
      res.json({ breakdown });
  });
}

export const revenueController = new RevenueController();
