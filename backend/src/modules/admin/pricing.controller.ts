import { Router, Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/async-handler';
import { AppError } from '../../utils/AppError';
import { seasonalPricingService } from '../../services/seasonal-pricing.service';
import { logger } from '../../utils/logger';

const router = Router();

// Get all seasonal pricing rules
router.get(
  '/seasonal-rules',
  authenticate,
  authorize(['admin', 'staff']),
  asyncHandler(async (req: Request, res: Response) => {
    const rules = await seasonalPricingService.getSeasonalRules();

    res.json({
      success: true,
      data: rules,
    });
  })
);

// Create a seasonal pricing rule
router.post(
  '/seasonal-rules',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, startDate, endDate, priceMultiplier, applicableTo, priority, isActive } = req.body;

    // Validate required fields
    if (!name || !startDate || !endDate) {
      throw new AppError('Name, start date, and end date are required', 400);
    }

    // Validate date format (MM-DD)
    const dateRegex = /^\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new AppError('Dates must be in MM-DD format', 400);
    }

    // Validate multiplier
    if (priceMultiplier < 0.1 || priceMultiplier > 3) {
      throw new AppError('Price multiplier must be between 0.1 and 3', 400);
    }

    const rule = await seasonalPricingService.createSeasonalRule({
      name,
      startDate,
      endDate,
      priceMultiplier,
      applicableTo: applicableTo || ['chalets'],
      priority: priority || 0,
      isActive: isActive ?? true,
    });

    logger.info(`Seasonal pricing rule created: ${name}`);

    res.status(201).json({
      success: true,
      data: rule,
    });
  })
);

// Update a seasonal pricing rule
router.put(
  '/seasonal-rules/:ruleId',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { ruleId } = req.params;
    const updates = req.body;

    // Validate date format if provided
    const dateRegex = /^\d{2}-\d{2}$/;
    if (updates.startDate && !dateRegex.test(updates.startDate)) {
      throw new AppError('Start date must be in MM-DD format', 400);
    }
    if (updates.endDate && !dateRegex.test(updates.endDate)) {
      throw new AppError('End date must be in MM-DD format', 400);
    }

    // Validate multiplier if provided
    if (updates.priceMultiplier !== undefined) {
      if (updates.priceMultiplier < 0.1 || updates.priceMultiplier > 3) {
        throw new AppError('Price multiplier must be between 0.1 and 3', 400);
      }
    }

    await seasonalPricingService.updateSeasonalRule(ruleId, updates);

    logger.info(`Seasonal pricing rule updated: ${ruleId}`);

    res.json({
      success: true,
      message: 'Rule updated successfully',
    });
  })
);

// Delete a seasonal pricing rule
router.delete(
  '/seasonal-rules/:ruleId',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { ruleId } = req.params;

    await seasonalPricingService.deleteSeasonalRule(ruleId);

    logger.info(`Seasonal pricing rule deleted: ${ruleId}`);

    res.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  })
);

// Get dynamic pricing configuration
router.get(
  '/dynamic-config',
  authenticate,
  authorize(['admin', 'staff']),
  asyncHandler(async (req: Request, res: Response) => {
    const config = await seasonalPricingService.getDynamicPricingConfig();

    res.json({
      success: true,
      data: config,
    });
  })
);

// Update dynamic pricing configuration
router.put(
  '/dynamic-config',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const config = req.body;

    // Validate configuration
    if (config.minOccupancyThreshold !== undefined) {
      if (config.minOccupancyThreshold < 0 || config.minOccupancyThreshold > 100) {
        throw new AppError('Min occupancy threshold must be between 0 and 100', 400);
      }
    }

    if (config.maxOccupancyThreshold !== undefined) {
      if (config.maxOccupancyThreshold < 0 || config.maxOccupancyThreshold > 100) {
        throw new AppError('Max occupancy threshold must be between 0 and 100', 400);
      }
    }

    if (config.minPriceMultiplier !== undefined || config.maxPriceMultiplier !== undefined) {
      const min = config.minPriceMultiplier ?? 0.5;
      const max = config.maxPriceMultiplier ?? 2;
      if (min < 0.1 || max > 3 || min > max) {
        throw new AppError('Invalid price multiplier range', 400);
      }
    }

    await seasonalPricingService.updateDynamicPricingConfig(config);

    logger.info('Dynamic pricing configuration updated');

    res.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  })
);

// Calculate price for a specific item and date
router.post(
  '/calculate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { itemType, itemId, basePrice, checkInDate, checkOutDate } = req.body;

    if (!itemType || !itemId || basePrice === undefined || !checkInDate) {
      throw new AppError('itemType, itemId, basePrice, and checkInDate are required', 400);
    }

    const result = await seasonalPricingService.calculatePrice(
      itemType,
      itemId,
      basePrice,
      new Date(checkInDate),
      checkOutDate ? new Date(checkOutDate) : undefined
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get pricing calendar for a date range
router.get(
  '/calendar',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { itemType, itemId, basePrice, startDate, endDate } = req.query;

    if (!itemType || !itemId || !basePrice || !startDate || !endDate) {
      throw new AppError('All query parameters are required', 400);
    }

    const calendar = await seasonalPricingService.getPricingCalendar(
      itemType as 'chalets' | 'pool' | 'restaurant',
      itemId as string,
      parseFloat(basePrice as string),
      new Date(startDate as string),
      new Date(endDate as string)
    );

    // Convert Map to object for JSON serialization
    const calendarObj: Record<string, any> = {};
    calendar.forEach((value, key) => {
      calendarObj[key] = value;
    });

    res.json({
      success: true,
      data: calendarObj,
    });
  })
);

// Get pricing analytics
router.get(
  '/analytics',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { days = '30' } = req.query;

    const { data: analytics, error } = await supabase
      .from('price_history')
      .select('*')
      .gte('recorded_at', new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000).toISOString())
      .order('recorded_at', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch pricing analytics', 500);
    }

    // Calculate summary statistics
    const totalBookings = analytics?.length || 0;
    const totalBaseValue = analytics?.reduce((sum, a) => sum + a.base_price, 0) || 0;
    const totalFinalValue = analytics?.reduce((sum, a) => sum + a.final_price, 0) || 0;
    const totalAdjustment = totalFinalValue - totalBaseValue;
    const averageAdjustmentPercent = totalBaseValue > 0
      ? ((totalAdjustment / totalBaseValue) * 100)
      : 0;

    // Group by applied rules
    const ruleUsage: Record<string, number> = {};
    analytics?.forEach((a) => {
      const rules = a.applied_rules || [];
      rules.forEach((rule: any) => {
        ruleUsage[rule.name] = (ruleUsage[rule.name] || 0) + 1;
      });
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalBookings,
          totalBaseValue,
          totalFinalValue,
          totalAdjustment,
          averageAdjustmentPercent: Math.round(averageAdjustmentPercent * 100) / 100,
        },
        ruleUsage,
        recentHistory: analytics?.slice(0, 50),
      },
    });
  })
);

export default router;
